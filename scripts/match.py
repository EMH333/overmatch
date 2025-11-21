import json

import geopandas as gpd
import pandas as pd
from rapidfuzz import fuzz
from rtree import index
from tqdm import tqdm
from shapely.geometry import Point

import atlus
import overturetoosm


def load_and_prepare_data():
    """Load data and prepare for matching"""
    # Load data
    osm_layer = gpd.read_file("data/osm.geojson")
    with open("data/overture.geojson") as f:
        overture_json = json.load(f)

    overture_layer = gpd.GeoDataFrame.from_features(
        overture_json["features"], crs="EPSG:4326"
    )

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


def find_matches_for_point(
    row_data: pd.Series,
    overture_layer: gpd.GeoDataFrame,
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

    # Vectorized distance calculation for all candidates
    candidates = overture_layer.iloc[candidate_indices]
    distances = candidates.geometry.distance(point)

    # Filter by distance first
    within_distance = distances <= buffer_distance
    close_candidates = candidates[within_distance]
    close_distances = distances[within_distance]

    # Now check string similarity only for close candidates
    for (cand_idx, candidate), distance in zip(
        close_candidates.iterrows(), close_distances
    ):
        # Fixed name extraction
        names_dict = candidate.get("names")
        if names_dict and isinstance(names_dict, dict):
            candidate_name = names_dict.get("primary", "")
        else:
            candidate_name = ""

        if not candidate_name:
            continue

        similarity = fuzz.ratio(osm_name, candidate_name) / 100.0

        if similarity >= similarity_threshold:
            geometry: Point = candidate.get("geometry")

            # Convert point to lat/lon for output
            point_4326 = gpd.GeoSeries([geometry], crs="EPSG:3857").to_crs("EPSG:4326")[
                0
            ]

            for unsupported in [
                "basic_category",
                "geometry",
                "filename",
                "operating_status",
            ]:
                candidate.pop(unsupported)
            candidate_tags = overturetoosm.process_place(candidate)

            try:
                address_tags = atlus.get_address(
                    candidate_tags.get("addr:street_address", "")
                )[0]
                candidate_tags.update(address_tags)
            except ValueError:
                pass

            if "addr:housenumber" in candidate_tags and "addr:housenumber" in row:
                if candidate_tags["addr:housenumber"] != row["addr:housenumber"]:
                    continue

            try:
                phone_tag = atlus.get_phone(candidate_tags.get("phone", ""))
                candidate_tags.update({"phone": phone_tag})
            except ValueError:
                pass

            for toss_tag in ["addr:country", "addr:street_address", "source"]:
                candidate_tags.pop(toss_tag, None)

            matches.append(
                {
                    "osm_id": row["id"],
                    "overture_id": candidate["id"],
                    "lon": point_4326.x,
                    "lat": point_4326.y,
                    "distance_m": round(float(distance), 1),
                    "similarity": similarity,
                    "overture_tags": candidate_tags,
                }
            )

    return matches


def process_chunk(chunk_data, overture_layer, spatial_idx):
    """Process a chunk of OSM features"""
    all_matches = []
    for row_data in chunk_data:
        matches = find_matches_for_point(row_data, overture_layer, spatial_idx)
        all_matches.extend(matches)
    return all_matches


def main():
    # Load and prepare data
    osm_layer, overture_layer = load_and_prepare_data()

    # Build spatial index
    spatial_idx = build_spatial_index(overture_layer)

    # Prepare row data for processing
    row_data = list(osm_layer.iterrows())

    # Option 1: Sequential with progress bar (easier to debug)
    print("Processing matches...")
    all_matches = []
    for data in tqdm(row_data, total=len(osm_layer)):
        matches = find_matches_for_point(data, overture_layer, spatial_idx)
        all_matches.extend(matches)

    # Option 2: Parallel processing (uncomment to use)
    # print(f"Processing matches using {cpu_count()} cores...")
    # chunk_size = max(1, len(row_data) // (cpu_count() * 4))
    # chunks = [row_data[i:i + chunk_size] for i in range(0, len(row_data), chunk_size)]
    #
    # process_func = partial(process_chunk,
    #                       overture_layer=overture_layer,
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
