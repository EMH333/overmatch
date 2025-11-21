"""
Script to load match data from JSONL file into DynamoDB.

This script reads the matches.jsonl file and stores the matches in DynamoDB
with the OSM ID as the partition key and an array of matches for each OSM element.
"""

import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import boto3
from botocore.exceptions import ClientError


def load_jsonl(file_path: str) -> list[dict]:
    """
    Load data from a JSONL file.

    Args:
        file_path: Path to the JSONL file

    Returns:
        List of dictionaries, one per line
    """
    matches = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                matches.append(json.loads(line))
            except json.JSONDecodeError as e:
                print(f"Warning: Skipping invalid JSON on line {line_num}: {e}")
    return matches


def convert_floats_to_decimal(obj):
    """
    Recursively convert float values to Decimal for DynamoDB compatibility.

    Args:
        obj: Object to convert (dict, list, or primitive)

    Returns:
        Object with floats converted to Decimal
    """
    if isinstance(obj, list):
        return [convert_floats_to_decimal(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: convert_floats_to_decimal(value) for key, value in obj.items()}
    elif isinstance(obj, float):
        return Decimal(str(obj))
    else:
        return obj


def group_matches_by_osm_id(matches: list[dict]) -> dict[str, list[dict]]:
    """
    Group matches by OSM ID.

    Args:
        matches: List of match dictionaries

    Returns:
        Dictionary mapping OSM ID to list of matches
    """
    grouped = defaultdict(list)

    for match in matches:
        osm_id = match.get("osm_id")
        if not osm_id:
            print(f"Warning: Skipping match without osm_id: {match}")
            continue

        # Store match without the osm_id (we use it as the key)
        match_data = {
            "overture_id": match.get("overture_id"),
            "lon": match.get("lon"),
            "lat": match.get("lat"),
            "distance_m": match.get("distance_m"),
            "similarity": match.get("similarity"),
            "overture_tags": match.get("overture_tags", {}),
        }
        grouped[osm_id].append(match_data)

    return grouped


def upload_to_dynamodb(
    grouped_matches: dict[str, list[dict]],
    table_name: str,
    region_name: str = "us-east-1",
    batch_size: int = 25,
) -> tuple[int, int]:
    """
    Upload grouped matches to DynamoDB.

    Args:
        grouped_matches: Dictionary mapping OSM ID to list of matches
        table_name: Name of the DynamoDB table
        region_name: AWS region
        batch_size: Number of items per batch (max 25 for DynamoDB)

    Returns:
        Tuple of (successful_count, failed_count)
    """
    dynamodb = boto3.resource("dynamodb", region_name=region_name)
    table = dynamodb.Table(table_name)

    timestamp = datetime.now(datetime.UTC).isoformat()
    successful = 0
    failed = 0

    osm_ids = list(grouped_matches.keys())
    total = len(osm_ids)

    print(f"Uploading {total} OSM elements with matches to DynamoDB...")

    for i in range(0, total, batch_size):
        batch = osm_ids[i : i + batch_size]

        try:
            with table.batch_writer() as writer:
                for osm_id in batch:
                    matches = grouped_matches[osm_id]

                    item = {
                        "element_id": osm_id,
                        "matches": matches,
                        "match_count": len(matches),
                        "loaded_at": timestamp,
                    }

                    # Convert floats to Decimal for DynamoDB
                    item = convert_floats_to_decimal(item)

                    writer.put_item(Item=item)
                    successful += 1

            # Progress indicator
            if (i + batch_size) % 100 == 0 or (i + batch_size) >= total:
                print(
                    f"  Progress: {min(i + batch_size, total)}/{total} items uploaded"
                )

        except ClientError as e:
            print(f"Error uploading batch starting at index {i}: {e}")
            failed += len(batch)

    return successful, failed


def main():
    """Main execution function."""
    # Parse command line arguments
    if len(sys.argv) < 2:
        print(
            "Usage: python load_matches.py <path_to_matches.jsonl> [table_name] [region]"
        )
        print("\nExample:")
        print("  python load_matches.py ../data/matches.jsonl")
        print(
            "  python load_matches.py ../data/matches.jsonl overmatch-matches us-east-1"
        )
        sys.exit(1)

    jsonl_path = sys.argv[1]
    table_name = (
        sys.argv[2]
        if len(sys.argv) > 2
        else os.getenv("MATCHES_TABLE_NAME", "overmatch-matches")
    )
    region_name = (
        sys.argv[3] if len(sys.argv) > 3 else os.getenv("AWS_REGION", "us-east-1")
    )

    # Validate file exists
    if not Path(jsonl_path).exists():
        print(f"Error: File not found: {jsonl_path}")
        sys.exit(1)

    print("=" * 60)
    print("Match Data Loader")
    print("=" * 60)
    print(f"Source file: {jsonl_path}")
    print(f"Table name: {table_name}")
    print(f"Region: {region_name}")
    print()

    # Check AWS credentials
    try:
        boto3.client("sts", region_name=region_name).get_caller_identity()
        print("✓ AWS credentials valid")
    except Exception as e:
        print(f"Error: AWS credentials not configured or invalid: {e}")
        print("Run: aws configure")
        sys.exit(1)

    # Check if table exists
    try:
        dynamodb = boto3.resource("dynamodb", region_name=region_name)
        table = dynamodb.Table(table_name)
        table.load()
        print(f"✓ Table '{table_name}' exists")
    except ClientError as e:
        if e.response["Error"]["Code"] == "ResourceNotFoundException":
            print(f"Error: Table '{table_name}' does not exist")
            print("\nCreate it using:")
            print("  aws dynamodb create-table \\")
            print(f"    --table-name {table_name} \\")
            print(
                "    --attribute-definitions AttributeName=element_id,AttributeType=S \\"
            )
            print("    --key-schema AttributeName=element_id,KeyType=HASH \\")
            print("    --billing-mode PAY_PER_REQUEST \\")
            print(f"    --region {region_name}")
            sys.exit(1)
        else:
            print(f"Error checking table: {e}")
            sys.exit(1)

    print()

    # Load JSONL file
    print("Loading matches from JSONL file...")
    matches = load_jsonl(jsonl_path)
    print(f"✓ Loaded {len(matches)} match records")
    print()

    # Group by OSM ID
    print("Grouping matches by OSM ID...")
    grouped_matches = group_matches_by_osm_id(matches)
    print(f"✓ Grouped into {len(grouped_matches)} unique OSM elements")
    print()

    # Show statistics
    match_counts = [len(m) for m in grouped_matches.values()]
    print("Match statistics:")
    print(f"  Total OSM elements: {len(grouped_matches)}")
    print(f"  Total matches: {sum(match_counts)}")
    print(f"  Average matches per element: {sum(match_counts) / len(match_counts):.2f}")
    print(f"  Min matches: {min(match_counts)}")
    print(f"  Max matches: {max(match_counts)}")
    print()

    # Confirm upload
    response = input("Proceed with upload to DynamoDB? (yes/no): ")
    if response.lower() not in ["yes", "y"]:
        print("Upload cancelled.")
        sys.exit(0)

    print()

    # Upload to DynamoDB
    successful, failed = upload_to_dynamodb(grouped_matches, table_name, region_name)

    print()
    print("=" * 60)
    print("Upload Complete")
    print("=" * 60)
    print(f"Successfully uploaded: {successful}")
    print(f"Failed: {failed}")

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
