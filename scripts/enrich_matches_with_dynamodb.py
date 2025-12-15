#!/usr/bin/env python3
"""
Enrich matches.jsonl with DynamoDB marking status.

This script:
1. Scans DynamoDB tables (OSM elements, Overture elements)
2. Reads matches.jsonl
3. Enriches each match with information about whether the OSM/Overture IDs
   have been marked as "seen" in DynamoDB
4. Outputs enriched GeoJSON that can be converted to PMTiles

Usage:
    python enrich_matches_with_dynamodb.py [input_jsonl] [output_geojson] [environment]

    Or import and call directly:
        from enrich_matches_with_dynamodb import enrich_matches_to_geojson
        enrich_matches_to_geojson(input_jsonl, output_geojson, environment="dev")

Arguments:
    input_jsonl: Path to matches.jsonl (default: data/matches.jsonl)
    output_geojson: Path to output GeoJSON (default: data/matches_enriched.geojson)
    environment: Environment suffix for DynamoDB tables, e.g. 'dev', 'prod' (default: none)

Environment Variables:
    ENVIRONMENT: Environment suffix for table names
    OSM_TABLE_NAME: Override OSM table name
    OVERTURE_TABLE_NAME: Override Overture table name
    AWS_REGION: AWS region (default: us-east-1)

The enriched data includes:
- osm_marked: boolean indicating if OSM element has been marked
- osm_first_seen: timestamp when OSM element was first seen
- osm_last_seen: timestamp when OSM element was last seen
- overture_marked: boolean indicating if Overture element has been marked
- overture_first_seen: timestamp when Overture element was first seen
- overture_last_seen: timestamp when Overture element was last seen
"""

import json
import os
import sys
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def scan_dynamodb_table(table_name: str, region_name: str = "us-east-1") -> dict:
    """
    Scan an entire DynamoDB table and return all items.

    Args:
        table_name: Name of the DynamoDB table
        region_name: AWS region name

    Returns:
        Dictionary mapping element_id to item data
    """
    print(f"Scanning DynamoDB table: {table_name}...")
    start_time = time.time()

    try:
        dynamodb = boto3.resource("dynamodb", region_name=region_name)
        table = dynamodb.Table(table_name)

        items = {}
        scan_kwargs = {}

        # Scan with pagination
        while True:
            response = table.scan(**scan_kwargs)

            for item in response.get("Items", []):
                element_id = item.get("element_id")
                if element_id:
                    items[element_id] = item

            # Check if there are more items to scan
            last_key = response.get("LastEvaluatedKey")
            if not last_key:
                break

            scan_kwargs["ExclusiveStartKey"] = last_key

        elapsed = time.time() - start_time
        print(f"  Found {len(items)} items (took {elapsed:.2f}s)")

        # Debug: Print sample of items
        if items:
            sample_keys = list(items.keys())[:3]
            print(f"  Sample element_ids from table: {sample_keys}")

        return items

    except ClientError as e:
        print(f"Error scanning table {table_name}: {e}", file=sys.stderr)
        return {}


def flatten_tags(tags_dict: dict, prefix: str = ""):
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


def enrich_match(match: dict, osm_data: dict, overture_data: dict) -> dict:
    """
    Enrich a match record with DynamoDB marking status.

    Args:
        match: Match dictionary from matches.jsonl
        osm_data: Dictionary of OSM element data from DynamoDB
        overture_data: Dictionary of Overture element data from DynamoDB

    Returns:
        Enriched match dictionary
    """
    enriched = match.copy()

    # Check OSM marking status
    osm_id = match.get("osm_id")
    if osm_id and osm_id in osm_data:
        osm_item = osm_data[osm_id]
        enriched["osm_marked"] = True
        enriched["osm_first_seen"] = osm_item.get("first_seen")
        enriched["osm_last_seen"] = osm_item.get("last_seen")
    else:
        enriched["osm_marked"] = False
        enriched["osm_first_seen"] = None
        enriched["osm_last_seen"] = None

    # Check Overture marking status
    overture_id = match.get("overture_id")
    if overture_id and overture_id in overture_data:
        overture_item = overture_data[overture_id]
        enriched["overture_marked"] = True
        enriched["overture_first_seen"] = overture_item.get("first_seen")
        enriched["overture_last_seen"] = overture_item.get("last_seen")
    else:
        enriched["overture_marked"] = False
        enriched["overture_first_seen"] = None
        enriched["overture_last_seen"] = None

    return enriched


def match_to_feature(match: dict) -> dict:
    """
    Convert an enriched match record to a GeoJSON Feature.

    Args:
        match: Dictionary containing enriched match data

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
        "osm_marked": match.get("osm_marked", False),
        "osm_first_seen": match.get("osm_first_seen"),
        "osm_last_seen": match.get("osm_last_seen"),
        "overture_marked": match.get("overture_marked", False),
        "overture_first_seen": match.get("overture_first_seen"),
        "overture_last_seen": match.get("overture_last_seen"),
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


def enrich_matches_to_geojson(
    input_jsonl, output_geojson, environment=None, region="us-east-1"
) -> dict[str, int | float]:
    """
    Enrich matches.jsonl with DynamoDB data and convert to GeoJSON.

    This is the main function that can be called programmatically.

    Args:
        input_jsonl: Path to input matches.jsonl file
        output_geojson: Path to output GeoJSON file
        environment: Environment suffix for DynamoDB tables (e.g., 'dev', 'production')
        region: AWS region name (default: 'us-east-1')

    Returns:
        dict: Statistics about the enrichment process with keys:
            - total_matches: Total number of matches processed
            - osm_marked_count: Number of matches with marked OSM elements
            - overture_marked_count: Number of matches with marked Overture elements
            - both_marked_count: Number of matches with both marked
            - file_size_mb: Output file size in megabytes

    Raises:
        FileNotFoundError: If input file doesn't exist
        RuntimeError: If DynamoDB operations fail
    """
    # Validate input
    input_path = Path(input_jsonl)
    output_path = Path(output_geojson)

    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    # Get table names from environment or use defaults
    env_suffix = os.getenv("ENVIRONMENT", "")
    if environment:
        env_suffix = environment

    if env_suffix and not env_suffix.startswith("-"):
        env_suffix = f"-{env_suffix}"

    osm_table = os.getenv("OSM_TABLE_NAME", f"overmatch-osm-elements{env_suffix}")
    overture_table = os.getenv(
        "OVERTURE_TABLE_NAME", f"overmatch-overture-elements{env_suffix}"
    )

    print("=" * 60)
    print("Enriching matches with DynamoDB data")
    print("=" * 60)
    print(f"Input:  {input_path}")
    print(f"Output: {output_path}")
    print(f"Region: {region}")
    print(f"Environment suffix: {env_suffix if env_suffix else '(none)'}")
    print(f"OSM table: {osm_table}")
    print(f"Overture table: {overture_table}")
    print()

    # Step 1: Scan DynamoDB tables
    print("Step 1: Scanning DynamoDB tables...")
    step_start = time.time()
    osm_data = scan_dynamodb_table(osm_table, region)
    overture_data = scan_dynamodb_table(overture_table, region)

    print(f"\nDynamoDB data loaded (total: {time.time() - step_start:.2f}s):")
    print(f"  OSM elements:      {len(osm_data)}")
    print(f"  Overture elements: {len(overture_data)}\n")

    # Step 2: Read and enrich matches.jsonl
    print("Step 2: Reading and enriching matches.jsonl...")
    step_start = time.time()
    features = []
    total_matches = 0
    osm_marked_count = 0
    overture_marked_count = 0
    both_marked_count = 0

    # Debug: Track first few matches
    debug_match_count = 0
    max_debug_matches = 5

    with open(input_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue

            try:
                match = json.loads(line)

                # Debug: Print details for first few matches
                if debug_match_count < max_debug_matches:
                    print(f"\n--- Debug Match #{debug_match_count + 1} ---")
                    print(f"  OSM ID from match:     '{match.get('osm_id')}'")
                    print(f"  Overture ID from match: '{match.get('overture_id')}'")
                    print(f"  OSM ID in DynamoDB:    {match.get('osm_id') in osm_data}")
                    print(
                        f"  Overture ID in DynamoDB: {match.get('overture_id') in overture_data}"
                    )
                    debug_match_count += 1

                enriched_match = enrich_match(match, osm_data, overture_data)
                feature = match_to_feature(enriched_match)
                features.append(feature)

                total_matches += 1
                if enriched_match.get("osm_marked"):
                    osm_marked_count += 1
                    if osm_marked_count == 1:
                        print("\n*** FIRST OSM MATCH FOUND ***")
                        print(f"  OSM ID: {match.get('osm_id')}")
                        print(f"  Data: {osm_data.get(match.get('osm_id'))}")

                if enriched_match.get("overture_marked"):
                    overture_marked_count += 1
                    if overture_marked_count == 1:
                        print("\n*** FIRST OVERTURE MATCH FOUND ***")
                        print(f"  Overture ID: {match.get('overture_id')}")
                        print(f"  Data: {overture_data.get(match.get('overture_id'))}")

                if enriched_match.get("osm_marked") and enriched_match.get(
                    "overture_marked"
                ):
                    both_marked_count += 1

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

    print(f"\nProcessed {total_matches} matches (took {time.time() - step_start:.2f}s)")
    print(
        f"  OSM marked:       {osm_marked_count} ({osm_marked_count / total_matches * 100:.1f}%)"
    )
    print(
        f"  Overture marked:  {overture_marked_count} ({overture_marked_count / total_matches * 100:.1f}%)"
    )
    print(
        f"  Both marked:      {both_marked_count} ({both_marked_count / total_matches * 100:.1f}%)"
    )

    # Debug: If no matches found, check format compatibility
    if osm_marked_count == 0 and len(osm_data) > 0:
        print("\n*** DEBUG: No OSM matches found but DynamoDB has data ***")
        print("Checking ID format compatibility...")
        sample_match_id = None
        with open(input_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    match = json.loads(line.strip())
                    sample_match_id = match.get("osm_id")
                    break
        sample_db_id = list(osm_data.keys())[0] if osm_data else None
        print(
            f"  Sample match OSM ID:    '{sample_match_id}' (type: {type(sample_match_id)})"
        )
        print(
            f"  Sample DynamoDB OSM ID: '{sample_db_id}' (type: {type(sample_db_id)})"
        )

    if overture_marked_count == 0 and len(overture_data) > 0:
        print("\n*** DEBUG: No Overture matches found but DynamoDB has data ***")
        print("Checking ID format compatibility...")
        sample_match_id = None
        with open(input_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    match = json.loads(line.strip())
                    sample_match_id = match.get("overture_id")
                    break
        sample_db_id = list(overture_data.keys())[0] if overture_data else None
        print(
            f"  Sample match Overture ID:    '{sample_match_id}' (type: {type(sample_match_id)})"
        )
        print(
            f"  Sample DynamoDB Overture ID: '{sample_db_id}' (type: {type(sample_db_id)})"
        )

    print()

    # Step 3: Create and write GeoJSON
    print("Step 3: Writing GeoJSON...")
    step_start = time.time()
    geojson = {"type": "FeatureCollection", "features": features}

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, separators=(",", ":"))

    file_size_mb = output_path.stat().st_size / (1024 * 1024)
    print(
        f"Wrote {output_path} ({file_size_mb:.2f} MB) (took {time.time() - step_start:.2f}s)"
    )
    print()

    return {
        "total_matches": total_matches,
        "osm_marked_count": osm_marked_count,
        "overture_marked_count": overture_marked_count,
        "both_marked_count": both_marked_count,
        "file_size_mb": file_size_mb,
    }


def main():
    """Main entry point for CLI usage."""
    # Setup paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    data_dir = project_root / "data"

    input_jsonl = data_dir / "matches.jsonl"
    output_geojson = data_dir / "matches_enriched.geojson"

    # Allow command-line arguments to override defaults
    if len(sys.argv) > 1:
        input_jsonl = Path(sys.argv[1])
    if len(sys.argv) > 2:
        output_geojson = Path(sys.argv[2])

    # Get environment from CLI or env var
    environment = None
    if len(sys.argv) > 3:
        environment = sys.argv[3]
    elif os.getenv("ENVIRONMENT"):
        environment = os.getenv("ENVIRONMENT")

    region = os.getenv("AWS_REGION", "us-east-1")

    try:
        _ = enrich_matches_to_geojson(input_jsonl, output_geojson, environment, region)

        # Show tippecanoe command
        print("=" * 60)
        print("SUCCESS!")
        print("=" * 60)
        print("To convert to PMTiles format, run:")
        pmtiles_output = output_geojson.with_suffix(".pmtiles")
        print(
            f"tippecanoe -o {pmtiles_output} -zg --drop-densest-as-needed --force {output_geojson}"
        )

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
