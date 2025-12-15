#!/usr/bin/env python3
"""
Upload PMTiles file to AWS S3.

This script uploads the enriched PMTiles file to an S3 bucket for public access.
The file is uploaded with appropriate headers for serving PMTiles to web clients.

Usage:
    python3 upload_pmtiles.py [pmtiles_file] [bucket_name] [--key KEY]

Arguments:
    pmtiles_file: Path to PMTiles file (default: ../data/matches_enriched.pmtiles)
    bucket_name: S3 bucket name (required if BUCKET_NAME env var not set)
    --key: S3 object key/path (default: matches_enriched.pmtiles)

Environment Variables:
    BUCKET_NAME: S3 bucket name
    AWS_REGION: AWS region (default: us-east-1)
    AWS_PROFILE: AWS profile to use (optional)

Examples:
    python3 upload_pmtiles.py --bucket my-bucket
    python3 upload_pmtiles.py ../data/matches.pmtiles my-bucket --key tiles/matches.pmtiles
    BUCKET_NAME=my-bucket python3 upload_pmtiles.py
"""

import argparse
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError, NoCredentialsError


def create_bucket_if_not_exists(s3_client, bucket_name, region):
    """
    Create S3 bucket if it doesn't exist.

    Args:
        s3_client: Boto3 S3 client
        bucket_name: Name of the bucket
        region: AWS region

    Returns:
        True if bucket exists or was created, False otherwise
    """
    try:
        s3_client.head_bucket(Bucket=bucket_name)
        print(f"✓ Bucket '{bucket_name}' exists")
        return True
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code == "404":
            print(f"Bucket '{bucket_name}' does not exist. Creating...")
            try:
                if region == "us-east-1":
                    s3_client.create_bucket(Bucket=bucket_name)
                else:
                    s3_client.create_bucket(
                        Bucket=bucket_name,
                        CreateBucketConfiguration={"LocationConstraint": region},
                    )
                print(f"✓ Created bucket '{bucket_name}'")
                return True
            except ClientError as create_error:
                print(f"✗ Error creating bucket: {create_error}", file=sys.stderr)
                return False
        else:
            print(f"✗ Error checking bucket: {e}", file=sys.stderr)
            return False


def configure_bucket_cors(s3_client, bucket_name):
    """
    Configure CORS for the bucket to allow web access.

    Args:
        s3_client: Boto3 S3 client
        bucket_name: Name of the bucket

    Returns:
        True if successful, False otherwise
    """
    cors_configuration = {
        "CORSRules": [
            {
                "AllowedHeaders": ["*"],
                "AllowedMethods": ["GET", "HEAD"],
                "AllowedOrigins": ["*"],
                "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
                "MaxAgeSeconds": 3600,
            }
        ]
    }

    try:
        s3_client.put_bucket_cors(
            Bucket=bucket_name, CORSConfiguration=cors_configuration
        )
        print(f"✓ Configured CORS for bucket '{bucket_name}'")
        return True
    except ClientError as e:
        print(f"⚠ Warning: Could not set CORS: {e}", file=sys.stderr)
        return False


def configure_bucket_policy(s3_client, bucket_name):
    """
    Configure bucket policy to allow public read access.

    Args:
        s3_client: Boto3 S3 client
        bucket_name: Name of the bucket

    Returns:
        True if successful, False otherwise
    """
    bucket_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "PublicReadGetObject",
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{bucket_name}/*",
            }
        ],
    }

    try:
        import json

        s3_client.put_bucket_policy(
            Bucket=bucket_name, Policy=json.dumps(bucket_policy)
        )
        print("✓ Configured bucket policy for public read access")
        return True
    except ClientError as e:
        print(f"⚠ Warning: Could not set bucket policy: {e}", file=sys.stderr)
        print("  Objects may not be publicly accessible")
        return False


def upload_pmtiles(pmtiles_file, bucket_name, object_key, region="us-east-1"):
    """
    Upload PMTiles file to S3.

    Args:
        pmtiles_file: Path to PMTiles file
        bucket_name: S3 bucket name
        object_key: S3 object key/path
        region: AWS region

    Returns:
        True if successful, False otherwise
    """
    pmtiles_path = Path(pmtiles_file)

    # Validate file exists
    if not pmtiles_path.exists():
        print(f"✗ Error: File not found: {pmtiles_file}", file=sys.stderr)
        return False

    # Get file size
    file_size_mb = pmtiles_path.stat().st_size / (1024 * 1024)

    print("=" * 60)
    print("Uploading PMTiles to S3")
    print("=" * 60)
    print(f"File:   {pmtiles_file} ({file_size_mb:.2f} MB)")
    print(f"Bucket: {bucket_name}")
    print(f"Key:    {object_key}")
    print(f"Region: {region}")
    print()

    try:
        # Initialize S3 client
        session_kwargs = {"region_name": region}
        if os.getenv("AWS_PROFILE"):
            session_kwargs["profile_name"] = os.getenv("AWS_PROFILE")

        session = boto3.Session(**session_kwargs)
        s3_client = session.client("s3")

        # Create bucket if needed
        if not create_bucket_if_not_exists(s3_client, bucket_name, region):
            return False

        # Configure CORS
        configure_bucket_cors(s3_client, bucket_name)

        # Configure bucket policy for public access
        configure_bucket_policy(s3_client, bucket_name)

        # Upload file with appropriate headers
        print(f"\nUploading {pmtiles_file}...")
        extra_args = {
            "ContentType": "application/vnd.pmtiles",
            "CacheControl": "public, max-age=86400",  # Cache for 24 hours
            "Metadata": {
                "source": "overmatch",
                "format": "pmtiles",
            },
        }

        s3_client.upload_file(
            str(pmtiles_path), bucket_name, object_key, ExtraArgs=extra_args
        )
        print("✓ Upload complete")

        # Generate URLs
        public_url = f"https://{bucket_name}.s3.{region}.amazonaws.com/{object_key}"
        if region == "us-east-1":
            public_url = f"https://{bucket_name}.s3.amazonaws.com/{object_key}"

        print()
        print("=" * 60)
        print("SUCCESS!")
        print("=" * 60)
        print(f"Public URL: {public_url}")

        return True

    except NoCredentialsError:
        print("✗ Error: AWS credentials not found", file=sys.stderr)
        print("  Configure with: aws configure", file=sys.stderr)
        return False
    except ClientError as e:
        print(f"✗ Error uploading to S3: {e}", file=sys.stderr)
        return False
    except Exception as e:
        print(f"✗ Unexpected error: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Upload PMTiles file to AWS S3",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --bucket my-bucket
  %(prog)s ../data/matches.pmtiles --bucket my-bucket --key tiles/matches.pmtiles
  BUCKET_NAME=my-bucket %(prog)s
        """,
    )

    parser.add_argument(
        "pmtiles_file",
        nargs="?",
        default=None,
        help="Path to PMTiles file (default: ../data/matches_enriched.pmtiles)",
    )

    parser.add_argument(
        "-b",
        "--bucket",
        dest="bucket_name",
        default="overmatch-pmtiles",
        help="S3 bucket name (or set BUCKET_NAME env var)",
    )

    parser.add_argument(
        "--key",
        default="matches_enriched.pmtiles",
        help="S3 object key/path (default: matches_enriched.pmtiles)",
    )

    parser.add_argument(
        "--region",
        default=os.getenv("AWS_REGION", "us-east-1"),
        help="AWS region (default: us-east-1)",
    )

    parser.add_argument(
        "--create-bucket",
        action="store_true",
        help="Create bucket if it doesn't exist",
    )

    args = parser.parse_args()

    # Determine PMTiles file path
    if args.pmtiles_file:
        pmtiles_file = args.pmtiles_file
    else:
        # Default to relative path from api directory
        script_dir = Path(__file__).parent
        pmtiles_file = script_dir.parent / "data" / "matches_enriched.pmtiles"

    # Determine bucket name
    bucket_name = args.bucket_name or os.getenv("BUCKET_NAME")
    if not bucket_name:
        print("Error: Bucket name required", file=sys.stderr)
        print(
            "  Provide as argument or set BUCKET_NAME environment variable",
            file=sys.stderr,
        )
        sys.exit(1)

    # Upload
    success = upload_pmtiles(pmtiles_file, bucket_name, args.key, args.region)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
