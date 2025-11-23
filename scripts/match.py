import json

import geopandas as gpd
import pandas as pd
import numpy as np
from rapidfuzz import fuzz
from rtree import index
from tqdm import tqdm

import atlus
import overturetoosm


def load_and_prepare_data():
    """Load data and prepare for matching"""
    # Load data
    osm_layer = gpd.read_file("data/osm_qlever.geojson")
    with open("data/overture.geojson") as f:
        overture_json = json.load(f)

    overture_layer = gpd.GeoDataFrame.from_features(
        overture_json["features"], crs="EPSG:4326"
    )

    # Store original 4326 coordinates to avoid repeated CRS transformations
    overture_layer["lon"] = overture_layer.geometry.x
    overture_layer["lat"] = overture_layer.geometry.y

    # Use a projected CRS for accurate distance calculations
    # Choose appropriate UTM zone or use a local projection
    osm_layer = osm_layer.to_crs("EPSG:3857")  # Web Mercator (meters)
    overture_layer = overture_layer.to_crs("EPSG:3857")

    print(f"OSM layer has {len(osm_layer)} features")
    print(f"Overture layer has {len(overture_layer)} features")

    return osm_layer, overture_layer


def build_spatial_index(layer: gpd.GeoDataFrame) -> index.Index:
    """Build spatial index for the layer"""
    spatial_idx = index.Index()
    for idx, geom in enumerate(layer.geometry):
        spatial_idx.insert(idx, geom.bounds)
    print(f"Spatial index built with {len(layer)} features")
    return spatial_idx


def preprocess_overture_layer(overture_layer: gpd.GeoDataFrame) -> dict:
    """Pre-extract frequently accessed data for faster lookup"""
    print("Preprocessing overture layer...")

    preprocessed = {"names": [], "ids": [], "lon": [], "lat": [], "geometries": []}

    # Extract data by position to match spatial index
    for i in range(len(overture_layer)):
        row = overture_layer.iloc[i]

        # Extract name
        names_dict = row.get("names")
        if names_dict and isinstance(names_dict, dict):
            name = names_dict.get("primary", "")
        else:
            name = ""

        preprocessed["names"].append(name)
        preprocessed["ids"].append(row["id"])
        preprocessed["lon"].append(row["lon"])
        preprocessed["lat"].append(row["lat"])
        preprocessed["geometries"].append(row.geometry)

    # Convert to numpy for faster indexing
    preprocessed["names"] = np.array(preprocessed["names"], dtype=object)
    preprocessed["ids"] = np.array(preprocessed["ids"], dtype=object)
    preprocessed["lon"] = np.array(preprocessed["lon"], dtype=float)
    preprocessed["lat"] = np.array(preprocessed["lat"], dtype=float)

    return preprocessed


def find_matches_for_point(
    row_data: pd.Series,
    overture_layer: gpd.GeoDataFrame,
    preprocessed: dict,
    spatial_idx: index.Index,
    buffer_distance: float = 100,
    similarity_threshold: float = 0.6,
) -> list[dict]:
    """Find matches for a single point - optimized version"""
    matches = []
    row: pd.Series = row_data[1]
    row: dict = {k: v for k, v in dict(row).items() if v and v is not None}

    point = row.get("geometry")
    osm_name = row.get("name", "")

    # Skip if no name
    if not osm_name or pd.isna(osm_name):
        return matches

    # Buffer in meters (since we're using EPSG:3857)
    bounds = point.buffer(buffer_distance).bounds

    # Get candidate indices from spatial index
    candidate_indices = list(spatial_idx.intersection(bounds))

    if not candidate_indices:
        return matches

    # Calculate distances using preprocessed geometries
    candidate_geoms = [preprocessed["geometries"][i] for i in candidate_indices]
    distances = np.array([geom.distance(point) for geom in candidate_geoms])

    # Filter by distance first
    within_distance_mask = distances <= buffer_distance
    close_indices = np.array(candidate_indices)[within_distance_mask]
    close_distances = distances[within_distance_mask]

    if len(close_indices) == 0:
        return matches

    # Get pre-extracted names for close candidates
    close_names = preprocessed["names"][close_indices]

    # Now check string similarity only for close candidates
    for idx, distance, candidate_name in zip(
        close_indices, close_distances, close_names
    ):
        if not candidate_name:
            continue

        similarity = fuzz.ratio(osm_name, candidate_name) / 100.0

        if similarity >= similarity_threshold:
            # Use pre-stored lat/lon
            lon = preprocessed["lon"][idx]
            lat = preprocessed["lat"][idx]

            # Get full candidate row only when needed
            candidate = overture_layer.iloc[idx]

            # Build dict for processing without copying entire Series
            candidate_dict = {}
            for key in candidate.index:
                if key not in [
                    "basic_category",
                    "geometry",
                    "filename",
                    "operating_status",
                    "lon",
                    "lat",
                ]:
                    val = candidate[key]
                    if val is not None and not (
                        isinstance(val, float) and pd.isna(val)
                    ):
                        candidate_dict[key] = val

            candidate_tags = overturetoosm.process_place(candidate_dict)

            try:
                street_addr = candidate_tags.get("addr:street_address", "")
                if street_addr:
                    address_tags = atlus.get_address(street_addr)[0]
                    candidate_tags.update(address_tags)
            except ValueError:
                pass

            if "addr:housenumber" in candidate_tags and "addr:housenumber" in row:
                if candidate_tags["addr:housenumber"] != row["addr:housenumber"]:
                    continue

            try:
                phone = candidate_tags.get("phone", "")
                if phone:
                    phone_tag = atlus.get_phone(phone)
                    candidate_tags.update({"phone": phone_tag})
            except ValueError:
                pass

            for toss_tag in ["addr:country", "addr:street_address", "source"]:
                candidate_tags.pop(toss_tag, None)

            matches.append(
                {
                    "osm_id": row["@id"],
                    "overture_id": preprocessed["ids"][idx],
                    "lon": float(lon),
                    "lat": float(lat),
                    "distance_m": round(float(distance), 1),
                    "similarity": similarity,
                    "overture_tags": candidate_tags,
                }
            )

    return matches


def process_chunk(chunk_data, overture_layer, preprocessed, spatial_idx):
    """Process a chunk of OSM features"""
    all_matches = []
    for row_data in chunk_data:
        matches = find_matches_for_point(
            row_data, overture_layer, preprocessed, spatial_idx
        )
        all_matches.extend(matches)
    return all_matches


def main():
    # Load and prepare data
    osm_layer, overture_layer = load_and_prepare_data()

    # Build spatial index
    spatial_idx = build_spatial_index(overture_layer)

    # Preprocess overture layer for faster access
    preprocessed = preprocess_overture_layer(overture_layer)

    # Prepare row data for processing
    row_data = list(osm_layer.iterrows())

    # Option 1: Sequential with progress bar (easier to debug)
    print("Processing matches...")
    all_matches = []
    for data in tqdm(row_data, total=len(osm_layer)):
        matches = find_matches_for_point(
            data, overture_layer, preprocessed, spatial_idx
        )
        all_matches.extend(matches)

    # Option 2: Parallel processing (uncomment to use)
    # print(f"Processing matches using {cpu_count()} cores...")
    # chunk_size = max(1, len(row_data) // (cpu_count() * 4))
    # chunks = [row_data[i:i + chunk_size] for i in range(0, len(row_data), chunk_size)]
    #
    # process_func = partial(process_chunk,
    #                       overture_layer=overture_layer,
    #                       preprocessed=preprocessed,
    #                       spatial_idx=spatial_idx)
    #
    # with Pool(cpu_count()) as pool:
    #     results = list(tqdm(pool.imap(process_func, chunks), total=len(chunks)))
    #
    # all_matches = [match for chunk_matches in results for match in chunk_matches]

    # Save results
    print(f"Found {len(all_matches)} matches")
    matches_df = pd.DataFrame(all_matches)
    matches_df.to_json("data/matches.jsonl", orient="records", lines=True)
    print("Results saved to matches.jsonl")


if __name__ == "__main__":
    main()
