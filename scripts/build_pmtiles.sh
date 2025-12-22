#!/usr/bin/env bash
#
# Wrapper script to build PMTiles with proper AWS credential handling
#
# This script handles the AWS credential export needed for boto3 to access
# DynamoDB when credentials are stored in a credential helper (e.g., from
# AWS web console login).
#
# Usage:
#   ./build_pmtiles_with_credentials.sh [environment]
#
# Arguments:
#   environment: Environment suffix for DynamoDB tables (e.g., 'production', 'dev')
#                Default: production
#
# Example:
#   ./build_pmtiles_with_credentials.sh production
#

set -e  # Exit on error

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default environment
ENVIRONMENT="${1:-production}"

echo "==========================================================="
echo "PMTiles Build Wrapper with AWS Credential Management"
echo "==========================================================="
echo "Environment: $ENVIRONMENT"
echo ""

# Check if AWS CLI is available
if ! command -v aws &> /dev/null; then
    echo "Error: AWS CLI not found. Please install it first."
    echo "Visit: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

# Check if Python 3.12 is available
if ! command -v python3.12 &> /dev/null; then
    echo "Error: Python 3.12 not found. Please install it first."
    exit 1
fi

# Check AWS credentials
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo "Error: AWS credentials not configured or expired."
    echo "Please configure AWS credentials using 'aws configure' or log in via AWS SSO."
    exit 1
fi

# Get caller identity for verification
CALLER_IDENTITY=$(aws sts get-caller-identity --output json)
ACCOUNT=$(echo "$CALLER_IDENTITY" | grep -o '"Account": "[^"]*"' | cut -d'"' -f4)
ARN=$(echo "$CALLER_IDENTITY" | grep -o '"Arn": "[^"]*"' | cut -d'"' -f4)

echo "✓ AWS credentials found"
echo "  Account: $ACCOUNT"
echo "  ARN: $ARN"
echo ""

# Export credentials to environment variables for boto3
echo "Exporting credentials for boto3..."
if aws configure export-credentials --format env &> /dev/null; then
    # Export credentials to current environment
    eval "$(aws configure export-credentials --format env)"
    echo "✓ Credentials exported successfully"

    # Check if credentials have expiration
    if [ -n "$AWS_CREDENTIAL_EXPIRATION" ]; then
        echo "  Note: Credentials expire at $AWS_CREDENTIAL_EXPIRATION"
    fi
else
    echo "Warning: Could not export credentials using 'aws configure export-credentials'"
    echo "Attempting to continue anyway (credentials may already be in environment)..."
fi

echo ""
echo "==========================================================="
echo "Running build_pmtiles.py"
echo "==========================================================="
echo ""

# Change to project root and run the Python script
cd "$PROJECT_ROOT"
python3.12 -m scripts.build_pmtiles "$ENVIRONMENT"

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "==========================================================="
    echo "✓ Build completed successfully!"
    echo "==========================================================="
else
    echo "==========================================================="
    echo "✗ Build failed with exit code $EXIT_CODE"
    echo "==========================================================="
fi

exit $EXIT_CODE
