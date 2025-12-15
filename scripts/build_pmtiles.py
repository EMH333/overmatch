#!/usr/bin/env python3
"""
Build PMTiles from matches.jsonl data with DynamoDB enrichment.

This script automates the conversion of matches.jsonl to PMTiles format:
1. Scans DynamoDB tables to get marking status for OSM/Overture elements
2. Converts matches.jsonl to GeoJSON with enriched DynamoDB data
3. Runs tippecanoe to convert GeoJSON to PMTiles format

Usage:
    python3.12 build_pmtiles.py [environment]

Arguments:
    environment: Environment suffix for DynamoDB tables (e.g., 'production', 'dev')
                 If not provided, uses ENVIRONMENT env var or no suffix

Environment Variables:
    ENVIRONMENT: Environment suffix for table names
    AWS_REGION: AWS region (default: us-east-1)
    OSM_TABLE_NAME, OVERTURE_TABLE_NAME, MATCHES_TABLE_NAME: Override table names

Requirements:
- tippecanoe must be installed and available in PATH
  (Install: https://github.com/felt/tippecanoe)
- AWS credentials configured for DynamoDB access

Example:
    python3.12 build_pmtiles.py production
"""

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# Import the enrichment function from the sibling module
from .enrich_matches_with_dynamodb import enrich_matches_to_geojson

start_time = datetime.now()


def check_tippecanoe():
    """Check if tippecanoe is installed."""
    try:
        result = subprocess.run(
            ["tippecanoe", "--version"],
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode == 0:
            print(f"Found tippecanoe: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass

    print("Error: tippecanoe not found in PATH", file=sys.stderr)
    print(
        "Install from: https://github.com/felt/tippecanoe",
        file=sys.stderr,
    )
    return False


def run_command(cmd, description):
    """
    Run a shell command and handle errors.

    Args:
        cmd: Command as list of strings
        description: Human-readable description of the command

    Returns:
        True if successful, False otherwise
    """
    print(f"\n{description}...")
    print(f"Running: {' '.join(cmd)}")

    try:
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        if result.stdout:
            print(result.stdout)
        return True
    except subprocess.CalledProcessError as e:
        print(f"Error: {description} failed", file=sys.stderr)
        if e.stdout:
            print(e.stdout, file=sys.stderr)
        if e.stderr:
            print(e.stderr, file=sys.stderr)
        return False


def main():
    """Main entry point."""
    # Parse command-line arguments
    environment = "production"
    if len(sys.argv) > 1:
        environment = sys.argv[1]
    elif os.getenv("ENVIRONMENT"):
        environment = os.getenv("ENVIRONMENT")

    region = os.getenv("AWS_REGION", "us-east-1")

    # Setup paths
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    data_dir = project_root / "data"

    input_jsonl = data_dir / "matches.jsonl"
    output_geojson = data_dir / "matches_enriched.geojson"
    output_pmtiles = data_dir / "matches_enriched.pmtiles"

    # Validate input file
    if not input_jsonl.exists():
        print(f"Error: Input file not found: {input_jsonl}", file=sys.stderr)
        sys.exit(1)

    # Check for tippecanoe
    if not check_tippecanoe():
        sys.exit(1)

    print("=" * 60)
    print("Building PMTiles from matches.jsonl with DynamoDB enrichment")
    print("=" * 60)
    print(f"Input:       {input_jsonl}")
    print(f"Output:      {output_pmtiles}")
    print(f"Environment: {environment if environment else '(none)'}")
    print()

    # Step 1: Enrich JSONL with DynamoDB data and convert to GeoJSON
    print("\n" + "=" * 60)
    print("Step 1: Enriching matches with DynamoDB data")
    print("=" * 60)

    try:
        stats = enrich_matches_to_geojson(
            input_jsonl, output_geojson, environment, region
        )
    except Exception as e:
        print(f"Error during enrichment: {e}", file=sys.stderr)
        sys.exit(1)

    # Verify GeoJSON was created
    if not output_geojson.exists():
        print(f"Error: GeoJSON file was not created: {output_geojson}", file=sys.stderr)
        sys.exit(1)

    # Step 2: Convert GeoJSON to PMTiles using tippecanoe
    print("\n" + "=" * 60)
    print("Step 2: Converting GeoJSON to PMTiles")
    print("=" * 60)

    tippecanoe_cmd = [
        "tippecanoe",
        "-o",
        str(output_pmtiles),
        "-zg",  # Automatically choose max zoom level
        "--drop-densest-as-needed",  # Drop features to stay under tile size limits
        "--force",  # Overwrite existing output file
        "--read-parallel",  # Read input in parallel for speed
        "--no-feature-limit",  # No limit on features per tile
        "--no-tile-size-limit",  # No limit on tile size
        "--use-attribute-for-id=id",  # Use 'id' attribute as tile ID
        str(output_geojson),
    ]

    success = run_command(tippecanoe_cmd, "Converting GeoJSON to PMTiles")
    if not success:
        sys.exit(1)

    # Verify PMTiles was created
    if not output_pmtiles.exists():
        print(f"Error: PMTiles file was not created: {output_pmtiles}", file=sys.stderr)
        sys.exit(1)

    # Get file sizes
    jsonl_size = input_jsonl.stat().st_size / (1024 * 1024)  # MB
    geojson_size = output_geojson.stat().st_size / (1024 * 1024)  # MB
    pmtiles_size = output_pmtiles.stat().st_size / (1024 * 1024)  # MB

    print("\n" + "=" * 60)
    print("SUCCESS!")
    print("=" * 60)
    print(f"JSONL size:   {jsonl_size:.2f} MB")
    print(f"GeoJSON size: {geojson_size:.2f} MB")
    print(f"PMTiles size: {pmtiles_size:.2f} MB")
    print(f"Compression:  {(1 - pmtiles_size / geojson_size) * 100:.1f}%")
    print("\nEnrichment stats:")
    print(f"  Total matches:    {stats['total_matches']:,}")
    print(f"  OSM marked:       {stats['osm_marked_count']:,}")
    print(f"  Overture marked:  {stats['overture_marked_count']:,}")
    print(f"  Both marked:      {stats['both_marked_count']:,}")
    print(f"\nOutput file: {output_pmtiles}")

    # Log to file for later reference
    with open("logs/enrich_matches.log", "a") as f:
        f.write(
            " | ".join(
                [
                    f"{start_time.strftime('%Y-%m-%d %H:%M:%S')}",
                    f"Duration: {(datetime.now() - start_time).seconds} sec",
                    f"Total matches: {stats['total_matches']}",
                    f"OSM marked: {stats['osm_marked_count']}",
                    f"Overture marked: {stats['overture_marked_count']}",
                    f"Both marked: {stats['both_marked_count']}",
                    f"PMTiles size: {pmtiles_size:.2f} MB",
                ]
            )
            + "\n"
        )


if __name__ == "__main__":
    main()
