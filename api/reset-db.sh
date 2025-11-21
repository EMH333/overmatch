#!/bin/bash

# Reset script for Overmatch API DynamoDB tables
# This script clears all items from the database tables

set -e  # Exit on error

# Configuration
ENVIRONMENT="${ENVIRONMENT:-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"

OSM_TABLE="overmatch-osm-elements-${ENVIRONMENT}"
OVERTURE_TABLE="overmatch-overture-elements-${ENVIRONMENT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Overmatch API Database Reset${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo ""
echo "Tables to reset:"
echo "  - $OSM_TABLE"
echo "  - $OVERTURE_TABLE"
echo ""

# Warning prompt
echo -e "${RED}WARNING: This will delete ALL items from both tables!${NC}"
echo -n "Are you sure you want to continue? (yes/no): "
read -r response

if [ "$response" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""

# Function to delete all items from a table
delete_all_items() {
    local table_name=$1
    echo -e "${YELLOW}Clearing table: $table_name${NC}"

    # Check if table exists
    if ! aws dynamodb describe-table --table-name "$table_name" --region "$AWS_REGION" &> /dev/null; then
        echo -e "${RED}Error: Table $table_name does not exist${NC}"
        return 1
    fi

    # Get all items
    local items=$(aws dynamodb scan \
        --table-name "$table_name" \
        --attributes-to-get element_id \
        --region "$AWS_REGION" \
        --output json)

    # Count items
    local count=$(echo "$items" | grep -c '"element_id"' || true)

    if [ "$count" -eq 0 ]; then
        echo -e "${GREEN}  Table is already empty${NC}"
        return 0
    fi

    echo "  Found $count items to delete"

    # Delete each item
    local deleted=0
    echo "$items" | grep -o '"S":"[^"]*"' | sed 's/"S":"\([^"]*\)"/\1/' | while read -r element_id; do
        aws dynamodb delete-item \
            --table-name "$table_name" \
            --key "{\"element_id\":{\"S\":\"$element_id\"}}" \
            --region "$AWS_REGION" \
            --no-cli-pager &> /dev/null
        deleted=$((deleted + 1))

        # Show progress every 10 items
        if [ $((deleted % 10)) -eq 0 ]; then
            echo "  Deleted $deleted/$count items..."
        fi
    done

    echo -e "${GREEN}  ✓ Cleared $count items from $table_name${NC}"
}

# Reset OSM table
delete_all_items "$OSM_TABLE"
echo ""

# Reset Overture table
delete_all_items "$OVERTURE_TABLE"
echo ""

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Reset Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Both tables have been cleared and are ready for testing."
