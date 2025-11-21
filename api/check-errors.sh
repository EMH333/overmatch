#!/bin/bash

# Diagnostic script to check CloudFormation stack errors

set -e

STACK_NAME="${STACK_NAME:-overmatch-api}"
AWS_REGION="${AWS_REGION:-us-east-1}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}CloudFormation Stack Diagnostics${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Stack Name: $STACK_NAME"
echo "Region: $AWS_REGION"
echo ""

# Check if stack exists
echo -e "${YELLOW}Checking stack status...${NC}"
STACK_STATUS=$(aws cloudformation describe-stacks \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "Stacks[0].StackStatus" \
    --output text 2>/dev/null || echo "DOES_NOT_EXIST")

echo "Current status: $STACK_STATUS"
echo ""

if [ "$STACK_STATUS" = "DOES_NOT_EXIST" ]; then
    echo -e "${GREEN}Stack does not exist - ready for fresh deployment${NC}"
    exit 0
fi

# Get failed events
echo -e "${YELLOW}Recent stack events (last 20):${NC}"
echo ""

aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --max-items 20 \
    --query 'StackEvents[].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId,ResourceStatusReason]' \
    --output table

echo ""

# Show failed resources
echo -e "${YELLOW}Failed resources:${NC}"
FAILED=$(aws cloudformation describe-stack-events \
    --stack-name "$STACK_NAME" \
    --region "$AWS_REGION" \
    --query "StackEvents[?contains(ResourceStatus, 'FAILED')].[LogicalResourceId,ResourceStatusReason]" \
    --output text 2>/dev/null)

if [ -z "$FAILED" ]; then
    echo -e "${GREEN}No failed resources found${NC}"
else
    echo -e "${RED}$FAILED${NC}"
fi

echo ""
echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Common Issues and Solutions:${NC}"
echo -e "${YELLOW}========================================${NC}"
echo ""
echo "1. IAM Role already exists:"
echo "   Solution: Delete the stack first:"
echo "   aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION"
echo ""
echo "2. DynamoDB table already exists:"
echo "   Solution: Delete tables manually or use different environment name:"
echo "   export ENVIRONMENT=development"
echo ""
echo "3. Insufficient permissions:"
echo "   Solution: Ensure your IAM user has permissions for:"
echo "   - CloudFormation, Lambda, DynamoDB, API Gateway, IAM, CloudWatch"
echo ""
echo "To delete the stack and start fresh:"
echo "   aws cloudformation delete-stack --stack-name $STACK_NAME --region $AWS_REGION"
echo "   aws cloudformation wait stack-delete-complete --stack-name $STACK_NAME --region $AWS_REGION"
echo ""
