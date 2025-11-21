#!/bin/bash

# Deployment script for Overmatch API to AWS Lambda
# This script packages the Lambda function and deploys it to AWS

set -e  # Exit on error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$SCRIPT_DIR/build"
DIST_DIR="$SCRIPT_DIR/dist"
LAMBDA_PACKAGE="$DIST_DIR/lambda-deployment.zip"

# AWS Configuration (can be overridden by environment variables)
STACK_NAME="${STACK_NAME:-overmatch-api}"
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Overmatch API Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "Stack Name: $STACK_NAME"
echo ""

# Check if Python 3.12 is installed
if ! command -v python3.12 &> /dev/null; then
    echo -e "${RED}Error: Python 3.12 is not installed${NC}"
    echo "AWS Lambda uses Python 3.12. Please install it:"
    echo "  brew install python@3.12"
    exit 1
fi

PYTHON_VERSION=$(python3.12 --version | cut -d' ' -f2)
echo "Using Python: $PYTHON_VERSION"
echo ""

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

# Check AWS credentials
echo -e "${YELLOW}Checking AWS credentials...${NC}"
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi
echo -e "${GREEN}✓ AWS credentials valid${NC}"
echo ""

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"
echo -e "${GREEN}✓ Build directories cleaned${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}Installing dependencies for Lambda (Linux platform)...${NC}"

# Check if Docker is available and running
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo "Using Docker to build Lambda-compatible packages..."

    # Use Amazon Linux 2023 (matches Lambda runtime environment)
    docker run --rm \
        -v "$SCRIPT_DIR:/var/task" \
        -v "$BUILD_DIR:/var/build" \
        public.ecr.aws/lambda/python:3.12 \
        bash -c "pip install -r /var/task/requirements.txt -t /var/build --upgrade --quiet"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed with Docker${NC}"
    else
        echo -e "${RED}Error installing dependencies with Docker${NC}"
        exit 1
    fi
else
    # Fallback: Use pip with platform-specific wheels for Linux
    if ! command -v docker &> /dev/null; then
        echo -e "${YELLOW}Docker not found. Using pip with platform-specific builds...${NC}"
    else
        echo -e "${YELLOW}Docker not running. Using pip with platform-specific builds...${NC}"
        echo -e "${YELLOW}Tip: Start Docker Desktop and run this script again for better compatibility${NC}"
    fi

    # Try to install with platform-specific wheels
    python3.12 -m pip install -r "$SCRIPT_DIR/requirements.txt" -t "$BUILD_DIR" \
        --platform manylinux2014_x86_64 \
        --implementation cp \
        --python-version 3.12 \
        --only-binary=:all: \
        --upgrade \
        --quiet

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Dependencies installed with Linux-compatible wheels${NC}"
    else
        echo -e "${YELLOW}Warning: Some packages may not have compatible wheels${NC}"
        echo -e "${YELLOW}Attempting to install without binary restrictions...${NC}"

        # Clear build dir and try without binary restriction
        rm -rf "$BUILD_DIR"/*
        python3.12 -m pip install -r "$SCRIPT_DIR/requirements.txt" -t "$BUILD_DIR" \
            --platform manylinux2014_x86_64 \
            --implementation cp \
            --python-version 3.12 \
            --upgrade \
            --quiet

        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ Dependencies installed${NC}"
            echo -e "${YELLOW}⚠ Warning: Some packages may not work in Lambda without Docker build${NC}"
        else
            echo -e "${RED}Error: Failed to install dependencies${NC}"
            echo -e "${RED}Please install and start Docker Desktop for Lambda-compatible builds${NC}"
            exit 1
        fi
    fi
fi
echo ""

# Copy application code
echo -e "${YELLOW}Copying application code...${NC}"
cp -r "$SCRIPT_DIR"/*.py "$BUILD_DIR/"
mkdir -p "$BUILD_DIR/api"
cp "$SCRIPT_DIR"/*.py "$BUILD_DIR/api/" 2>/dev/null || true
echo -e "${GREEN}✓ Application code copied${NC}"
echo ""

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
cd "$BUILD_DIR"
zip -r "$LAMBDA_PACKAGE" . -q
cd "$SCRIPT_DIR"

PACKAGE_SIZE=$(du -h "$LAMBDA_PACKAGE" | cut -f1)
echo -e "${GREEN}✓ Deployment package created ($PACKAGE_SIZE)${NC}"
echo ""

# Deploy CloudFormation stack
echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
aws cloudformation deploy \
    --template-file "$SCRIPT_DIR/cloudformation-template.yaml" \
    --stack-name "$STACK_NAME" \
    --parameter-overrides Environment="$ENVIRONMENT" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "$AWS_REGION" \
    --no-fail-on-empty-changeset

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ CloudFormation stack deployed${NC}"
else
    echo -e "${RED}Error deploying CloudFormation stack${NC}"
    exit 1
fi
echo ""

# Get Lambda function name from stack
echo -e "${YELLOW}Getting Lambda function name...${NC}"
LAMBDA_FUNCTION_NAME=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='LambdaFunctionName'].OutputValue" \
    --output text)

if [ -z "$LAMBDA_FUNCTION_NAME" ]; then
    echo -e "${RED}Error: Could not get Lambda function name${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Lambda function: $LAMBDA_FUNCTION_NAME${NC}"
echo ""

# Update Lambda function code
echo -e "${YELLOW}Updating Lambda function code...${NC}"
aws lambda update-function-code \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --zip-file "fileb://$LAMBDA_PACKAGE" \
    --region "$AWS_REGION" \
    --no-cli-pager > /dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Lambda function code updated${NC}"
else
    echo -e "${RED}Error updating Lambda function code${NC}"
    exit 1
fi
echo ""

# Wait for function update to complete
echo -e "${YELLOW}Waiting for function update to complete...${NC}"
aws lambda wait function-updated \
    --function-name "$LAMBDA_FUNCTION_NAME" \
    --region "$AWS_REGION"
echo -e "${GREEN}✓ Function update completed${NC}"
echo ""

# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='APIEndpoint'].OutputValue" \
    --output text)

# Display summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Deployment Successful!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "API Endpoint: $API_ENDPOINT"
echo ""
echo "Example usage:"
echo "  Health check:"
echo "    curl $API_ENDPOINT/"
echo ""
echo "  Check OSM elements:"
echo "    curl \"$API_ENDPOINT/osm?ids=node/123,way/456\""
echo ""
echo "  Mark OSM elements as seen:"
echo "    curl -X POST $API_ENDPOINT/osm \\"
echo "      -H \"Content-Type: application/json\" \\"
echo "      -d '{\"ids\": [\"node/123\", \"way/456\"]}'"
echo ""
echo "  Check Overture elements:"
echo "    curl \"$API_ENDPOINT/overture?ids=id1,id2\""
echo ""
echo "  Mark Overture elements as seen:"
echo "    curl -X POST $API_ENDPOINT/overture \\"
echo "      -H \"Content-Type: application/json\" \\"
echo "      -d '{\"ids\": [\"id1\", \"id2\"]}'"
echo ""
echo -e "${YELLOW}Note: It may take a few seconds for the API to become available${NC}"
echo ""

# Clean up build directory (optional)
if [ "$KEEP_BUILD" != "true" ]; then
    echo -e "${YELLOW}Cleaning up build directory...${NC}"
    rm -rf "$BUILD_DIR"
    echo -e "${GREEN}✓ Build directory cleaned${NC}"
fi

echo -e "${GREEN}Done!${NC}"
