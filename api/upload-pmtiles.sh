#!/bin/bash
# Upload PMTiles file to S3
# This script wraps the Python upload script for convenience

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default values
PMTILES_FILE="${PROJECT_ROOT}/data/matches_enriched.pmtiles"
BUCKET_NAME="${BUCKET_NAME:-}"
OBJECT_KEY="matches_enriched.pmtiles"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--bucket)
            BUCKET_NAME="$2"
            shift 2
            ;;
        -f|--file)
            PMTILES_FILE="$2"
            shift 2
            ;;
        -k|--key)
            OBJECT_KEY="$2"
            shift 2
            ;;
        -r|--region)
            AWS_REGION="$2"
            shift 2
            ;;
        -h|--help)
            echo "Upload PMTiles file to S3"
            echo ""
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  -b, --bucket NAME    S3 bucket name (required if BUCKET_NAME not set)"
            echo "  -f, --file PATH      Path to PMTiles file (default: ../data/matches_enriched.pmtiles)"
            echo "  -k, --key KEY        S3 object key (default: matches_enriched.pmtiles)"
            echo "  -r, --region REGION  AWS region (default: us-east-1)"
            echo "  -h, --help           Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BUCKET_NAME          S3 bucket name"
            echo "  AWS_REGION           AWS region"
            echo ""
            echo "Examples:"
            echo "  $0 --bucket my-pmtiles-bucket"
            echo "  BUCKET_NAME=my-bucket $0"
            echo "  $0 -b my-bucket -k tiles/matches.pmtiles"
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown option: $1${NC}" >&2
            echo "Use --help for usage information" >&2
            exit 1
            ;;
    esac
done

# Validate bucket name
if [ -z "$BUCKET_NAME" ]; then
    echo -e "${RED}Error: Bucket name required${NC}" >&2
    echo "  Provide with --bucket or set BUCKET_NAME environment variable" >&2
    echo "  Use --help for more information" >&2
    exit 1
fi

# Check if PMTiles file exists
if [ ! -f "$PMTILES_FILE" ]; then
    echo -e "${RED}Error: PMTiles file not found: $PMTILES_FILE${NC}" >&2
    echo "  Run 'python3.12 ../scripts/build_pmtiles.py production' first" >&2
    exit 1
fi

# Check if Python script exists
PYTHON_SCRIPT="${SCRIPT_DIR}/upload_pmtiles.py"
if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo -e "${RED}Error: Upload script not found: $PYTHON_SCRIPT${NC}" >&2
    exit 1
fi

# Check for AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}Warning: Unable to verify AWS credentials${NC}" >&2
    echo "  Make sure AWS credentials are configured" >&2
    echo "  Run 'aws configure' to set up credentials" >&2
fi

# Run the Python upload script
echo -e "${GREEN}Starting upload...${NC}"
echo ""

python3.12 "$PYTHON_SCRIPT" \
    "$PMTILES_FILE" \
    "$BUCKET_NAME" \
    --key "$OBJECT_KEY" \
    --region "$AWS_REGION"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Upload completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}✗ Upload failed${NC}" >&2
fi

exit $EXIT_CODE
