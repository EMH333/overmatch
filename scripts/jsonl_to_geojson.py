#!/usr/bin/env python3
"""
Convert matches.jsonl to GeoJSON format for use with tippecanoe.

This script reads the matches.jsonl file and converts each match record
into a GeoJSON Feature with Point geometry. The properties include all
relevant match information including OSM and Overture IDs, distance,
similarity score, and flattened Overture tags.
"""

import json
import sys
from pathlib import Path


def flatten_tags(tags_dict, prefix=""):
    """
    Flatten nested dictionary keys with a prefix.

    Args:
        tags_dict: Dictionary to flatten
        prefix: Prefix to add to keys (default: empty string)

    Returns:
        Flattened dictionary
    """
    flattened = {}
    for key, value in tags_dict.items():
        new_key = f"{prefix}{key}" if prefix else key
        if isinstance(value, dict):
            flattened.update(flatten_tags(value, f"{new_key}_"))
        else:
            flattened[new_key] = value
    return flattened


def match_to_feature(match):
    """
    Convert a match record to a GeoJSON Feature.

    Args:
        match: Dictionary containing match data

    Returns:
        GeoJSON Feature dictionary
    """
    # Extract coordinates
    lon = match["lon"]
    lat = match["lat"]

    # Build properties - include all fields except lon/lat
    properties = {
        "osm_id": match["osm_id"],
        "overture_id": match["overture_id"],
        "distance_m": match["distance_m"],
        "similarity": match["similarity"],
    }

    # Flatten and add Overture tags
    if "overture_tags" in match:
        overture_tags = flatten_tags(match["overture_tags"], "overture_")
        properties.update(overture_tags)

    # Create GeoJSON Feature
    feature = {
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [lon, lat]},
        "properties": properties,
    }

    return feature


def convert_jsonl_to_geojson(input_path, output_path):
    """
    Convert JSONL file to GeoJSON format.

    Args:
        input_path: Path to input JSONL file
        output_path: Path to output GeoJSON file
    """
    features = []

    print(f"Reading {input_path}...")
    with open(input_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                match = json.loads(line)
                feature = match_to_feature(match)
                features.append({**feature, "id": line_num})
            except json.JSONDecodeError as e:
                print(
                    f"Warning: Skipping line {line_num} due to JSON error: {e}",
                    file=sys.stderr,
                )
            except KeyError as e:
                print(
                    f"Warning: Skipping line {line_num} due to missing field: {e}",
                    file=sys.stderr,
                )

    print(f"Converted {len(features)} features")

    # Create GeoJSON FeatureCollection
    geojson = {"type": "FeatureCollection", "features": features}

    print(f"Writing {output_path}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    print("Done!")


def main():
    """Main entry point."""
    # Default paths relative to script location
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    input_file = project_root / "data" / "matches.jsonl"
    output_file = project_root / "data" / "matches.geojson"

    # Allow command-line arguments to override defaults
    if len(sys.argv) > 1:
        input_file = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_file = Path(sys.argv[2])

    # Validate input file exists
    if not input_file.exists():
        print(f"Error: Input file not found: {input_file}", file=sys.stderr)
        sys.exit(1)

    # Convert
    convert_jsonl_to_geojson(input_file, output_file)

    print("\nTo convert to PMTiles format, run:")
    print(
        f"tippecanoe -o {output_file.with_suffix('.pmtiles')} -zg --drop-densest-as-needed {output_file}"
    )


if __name__ == "__main__":
    main()
