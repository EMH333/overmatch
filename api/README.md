# Overmatch Element Tracking API

A FastAPI-based REST API for tracking which OpenStreetMap (OSM) and Overture map elements have been processed. This API is designed to run on AWS Lambda with DynamoDB storage, allowing you to track which elements have been "changed" (OSM) or "skipped" (Overture) to prevent duplicate work.

## Features

- **Two separate endpoints**: `/osm` for OpenStreetMap elements and `/overture` for Overture elements
- **GET requests**: Check if elements exist in the database
- **POST requests**: Mark elements as seen/processed
- **Timestamp tracking**: Records `first_seen` and `last_seen` timestamps for each element
- **Serverless architecture**: Runs on AWS Lambda with DynamoDB for scalability
- **High performance**: DynamoDB provides millisecond lookups at any scale

## Architecture

```
API Gateway (HTTP API)
    ↓
AWS Lambda (FastAPI + Mangum)
    ↓
DynamoDB (3 tables: OSM elements, Overture elements, Matches)
```

## Prerequisites

- Python 3.11 or higher
- AWS CLI configured with appropriate credentials
- AWS account with permissions for:
  - Lambda
  - DynamoDB
  - API Gateway
  - CloudFormation
  - IAM
  - CloudWatch Logs

## Project Structure

```
api/
├── __init__.py                    # Package initialization
├── main.py                        # FastAPI application
├── db.py                          # DynamoDB manager
├── lambda_handler.py              # Lambda entry point
├── requirements.txt               # Python dependencies
├── cloudformation-template.yaml   # Infrastructure as Code
├── deploy.sh                      # Deployment script
└── README.md                      # This file
```

## Installation

### 1. Install Dependencies (for local development)

```bash
cd api
pip install -r requirements.txt
```

### 2. Deploy to AWS

The deployment script will:

1. Create DynamoDB tables for OSM and Overture elements
2. Create Lambda function with appropriate IAM roles
3. Set up API Gateway HTTP API
4. Deploy your code

```bash
# Set your preferred AWS region (optional)
export AWS_REGION=us-east-1

# Set environment name (optional, defaults to "production")
export ENVIRONMENT=production

# Deploy
./deploy.sh
```

The script will output your API endpoint URL when deployment is complete.

### 3. Manual Deployment (Alternative)

If you prefer manual deployment:

```bash
# 1. Create CloudFormation stack
aws cloudformation deploy \
    --template-file cloudformation-template.yaml \
    --stack-name overmatch-api \
    --parameter-overrides Environment=production \
    --capabilities CAPABILITY_NAMED_IAM \
    --region us-east-1

# 2. Package Lambda function
mkdir -p build
pip install -r requirements.txt -t build/
cp *.py build/
cd build && zip -r ../lambda-deployment.zip . && cd ..

# 3. Update Lambda function code
aws lambda update-function-code \
    --function-name overmatch-api-production \
    --zip-file fileb://lambda-deployment.zip \
    --region us-east-1
```

## API Documentation

### Base URL

After deployment, your API will be available at:

```
https://{api-id}.execute-api.{region}.amazonaws.com
```

### Endpoints

#### Health Check

```http
GET /
```

Response:

```json
{
  "status": "healthy",
  "service": "Overmatch Element Tracking API",
  "version": "1.0.0"
}
```

#### OSM Elements - Check Existence

Check if OSM elements have been seen before.

```http
GET /osm?ids={comma-separated-ids}
```

**Parameters:**

- `ids` (required): Comma-separated list of OSM element IDs (e.g., "node/123,way/456,relation/789")

**Response:**

```json
{
  "elements": [
    {
      "id": "node/123",
      "exists": true,
      "first_seen": "2024-01-15T10:30:00Z",
      "last_seen": "2024-01-15T14:45:00Z"
    },
    {
      "id": "way/456",
      "exists": false,
      "first_seen": null,
      "last_seen": null
    }
  ]
}
```

**Example:**

```bash
curl "https://your-api-url.com/osm?ids=node/123,way/456"
```

#### OSM Elements - Mark as Seen

Mark OSM elements as seen/processed.

```http
POST /osm
Content-Type: application/json

{
  "ids": ["node/123", "way/456", "relation/789"]
}
```

**Request Body:**

```json
{
  "ids": ["string", "string", ...]
}
```

**Response:**

```json
{
  "success": true,
  "count": 3,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example:**

```bash
curl -X POST https://your-api-url.com/osm \
  -H "Content-Type: application/json" \
  -d '{"ids": ["node/123", "way/456"]}'
```

#### Overture Elements - Check Existence

Check if Overture elements have been seen before.

```http
GET /overture?ids={comma-separated-ids}
```

**Parameters:**

- `ids` (required): Comma-separated list of Overture element IDs

**Response:**

```json
{
  "elements": [
    {
      "id": "08f2a2c9c8a6e7ff",
      "exists": true,
      "first_seen": "2024-01-15T10:30:00Z",
      "last_seen": "2024-01-15T14:45:00Z"
    },
    {
      "id": "08f2a2c9c8a6e800",
      "exists": false,
      "first_seen": null,
      "last_seen": null
    }
  ]
}
```

**Example:**

```bash
curl "https://your-api-url.com/overture?ids=08f2a2c9c8a6e7ff,08f2a2c9c8a6e800"
```

#### Overture Elements - Mark as Seen

Mark Overture elements as seen/processed.

```http
POST /overture
Content-Type: application/json

{
  "ids": ["08f2a2c9c8a6e7ff", "08f2a2c9c8a6e800"]
}
```

**Request Body:**

```json
{
  "ids": ["string", "string", ...]
}
```

**Response:**

```json
{
  "success": true,
  "count": 2,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Example:**

```bash
curl -X POST https://your-api-url.com/overture \
  -H "Content-Type: application/json" \
  -d '{"ids": ["08f2a2c9c8a6e7ff", "08f2a2c9c8a6e800"]}'
```

#### Matches - Check OSM to Overture Matches

Check if OSM elements have matches with Overture elements in the database.

```http
GET /matches?osm_ids={comma-separated-osm-ids}
```

**Parameters:**

- `osm_ids` (required): Comma-separated list of OSM element IDs (e.g., "way/48039595,node/123")

**Response:**

```json
{
  "elements": [
    {
      "osm_id": "way/48039595",
      "has_match": true,
      "matches": [
        {
          "osm_id": "way/48039595",
          "overture_id": "1435d085-8b3b-4bf6-a484-71973c5363f0",
          "lon": -77.0017128,
          "lat": 38.8865709,
          "distance_m": 17.0467862073,
          "similarity": 0.88,
          "overture_tags": {
            "amenity": "restaurant",
            "cuisine": "pizza",
            "name": "We, The Pizza",
            "phone": "+1 202-544-4008",
            "website": "http://www.wethepizza.com/"
          }
        }
      ]
    },
    {
      "osm_id": "node/123",
      "has_match": false,
      "matches": []
    }
  ]
}
```

**Example:**

```bash
curl "https://your-api-url.com/matches?osm_ids=way/48039595,way/48039713"
```

**Note:** The matches data must be loaded into the database first using the `load_matches.py` script (see [Loading Match Data](#loading-match-data) section below).

## Local Development

Run the API locally for testing:

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables (use local DynamoDB or real AWS tables)
export OSM_TABLE_NAME=overmatch-osm-elements-development
export OVERTURE_TABLE_NAME=overmatch-overture-elements-development
export AWS_REGION=us-east-1

# Run with uvicorn
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

Visit http://localhost:8000/docs for interactive API documentation (Swagger UI).

### Using Local DynamoDB (Optional)

For local development without AWS costs:

```bash
# Install and run DynamoDB Local
docker run -p 8000:8000 amazon/dynamodb-local

# Create local tables
aws dynamodb create-table \
    --table-name overmatch-osm-elements-development \
    --attribute-definitions AttributeName=element_id,AttributeType=S \
    --key-schema AttributeName=element_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url http://localhost:8000

aws dynamodb create-table \
    --table-name overmatch-overture-elements-development \
    --attribute-definitions AttributeName=element_id,AttributeType=S \
    --key-schema AttributeName=element_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --endpoint-url http://localhost:8000

# Update db.py to use local endpoint
# boto3.resource("dynamodb", region_name=region_name, endpoint_url="http://localhost:8000")
```

## Loading Match Data

After deploying the API, you can load match data from a JSONL file into the DynamoDB matches table.

### Match Data Format

The JSONL file should contain one match per line:

```jsonl
{"osm_id":"way/48039595","overture_id":"1435d085-8b3b-4bf6-a484-71973c5363f0","lon":-77.0017128,"lat":38.8865709,"distance_m":17.0467862073,"similarity":0.88,"overture_tags":{"amenity":"restaurant","name":"We, The Pizza"}}
{"osm_id":"way/48039713","overture_id":"957e7088-95c2-43c4-9674-5d259dfc9a13","lon":-77.0022167,"lat":38.8868171,"distance_m":10.3023857814,"similarity":1.0,"overture_tags":{"amenity":"cafe","name":"Starbucks"}}
```

### Loading Data

```bash
# Load matches from JSONL file
python load_matches.py ../data/matches.jsonl

# Or specify table name and region explicitly
python load_matches.py ../data/matches.jsonl overmatch-matches-production us-east-1
```

The script will:

1. Validate AWS credentials
2. Check that the DynamoDB table exists
3. Load and parse the JSONL file
4. Group matches by OSM ID (one OSM element can have multiple Overture matches)
5. Show statistics about the matches
6. Prompt for confirmation before uploading
7. Upload to DynamoDB in batches

### Match Data Structure in DynamoDB

Each item in the matches table contains:

```json
{
  "element_id": "way/48039595",
  "match_count": 2,
  "loaded_at": "2024-01-15T10:30:00Z",
  "matches": [
    {
      "overture_id": "1435d085-8b3b-4bf6-a484-71973c5363f0",
      "lon": -77.0017128,
      "lat": 38.8865709,
      "distance_m": 17.0467862073,
      "similarity": 0.88,
      "overture_tags": { "amenity": "restaurant", "name": "We, The Pizza" }
    },
    {
      "overture_id": "0bb8f26d-4496-4915-b526-888d95405d33",
      "lon": -77.0017128,
      "lat": 38.8865709,
      "distance_m": 29.4520430748,
      "similarity": 0.88,
      "overture_tags": { "amenity": "restaurant", "name": "We, The Pizza" }
    }
  ]
}
```

## Data Model

### DynamoDB Tables

Three tables are created:

- `overmatch-osm-elements-{environment}` - Tracks which OSM elements have been seen
- `overmatch-overture-elements-{environment}` - Tracks which Overture elements have been seen
- `overmatch-matches-{environment}` - Stores OSM to Overture match data

### Item Structure

**OSM and Overture tables:**

```json
{
  "element_id": "node/123", // Partition key
  "first_seen": "2024-01-15T10:30:00Z",
  "last_seen": "2024-01-15T14:45:00Z"
}
```

**Fields:**

- `element_id` (string): Unique identifier for the element (partition key)
- `first_seen` (string): ISO 8601 timestamp when element was first added
- `last_seen` (string): ISO 8601 timestamp when element was last accessed (updated on every GET and POST)

**Matches table:**

```json
{
  "element_id": "way/48039595", // Partition key (OSM ID)
  "match_count": 2,
  "loaded_at": "2024-01-15T10:30:00Z",
  "matches": [
    {
      "overture_id": "uuid-string",
      "lon": -77.0017128,
      "lat": 38.8865709,
      "distance_m": 17.05,
      "similarity": 0.88,
      "overture_tags": {}
    }
  ]
}
```

**Fields:**

- `element_id` (string): OSM element ID (partition key)
- `match_count` (number): Number of Overture matches for this OSM element
- `loaded_at` (string): ISO 8601 timestamp when data was loaded
- `matches` (array): List of match objects with Overture details

## Cost Estimation

### DynamoDB (Pay-per-request)

- Read requests: $0.25 per million
- Write requests: $1.25 per million
- Storage: $0.25 per GB-month

**Example:** 1 million reads + 500k writes + 1 GB storage = ~$0.25 + ~$0.63 + ~$0.25 = **~$1.13/month**

### Lambda

- First 1M requests/month: Free
- After that: $0.20 per 1M requests
- Compute time: $0.0000166667 per GB-second

**Example:** 2 million requests with 512 MB and 200ms average = **~$0.20/month**

### API Gateway (HTTP API)

- First 1M requests/month: $1.00
- After that: $0.90-$1.00 per million

**Example:** 2 million requests = **~$1.90/month**

**Total estimated cost for moderate usage: ~$3-5/month**

## Monitoring

### CloudWatch Logs

Logs are automatically sent to CloudWatch:

- Lambda logs: `/aws/lambda/overmatch-api-{environment}`
- API Gateway logs: `/aws/apigateway/overmatch-api-{environment}`

View logs:

```bash
aws logs tail /aws/lambda/overmatch-api-production --follow
```

### Metrics

Monitor in CloudWatch:

- Lambda invocations, errors, duration
- DynamoDB read/write capacity units, throttles
- API Gateway request count, latency, 4xx/5xx errors

## Troubleshooting

### "Unable to import module 'api.lambda_handler'"

The Lambda deployment package may not include all dependencies. Ensure you're using the deploy script which packages everything correctly.

### DynamoDB "ResourceNotFoundException"

The tables may not exist or the Lambda function doesn't have permission. Check:

1. CloudFormation stack deployed successfully
2. IAM role has DynamoDB permissions
3. Environment variables are set correctly

### High latency on first request

Lambda cold starts can add 1-2 seconds. This is normal. Consider:

- Provisioned concurrency (costs more)
- CloudWatch Events to keep function warm

### CORS errors

The API includes CORS headers by default. If you need to restrict origins, modify the `cloudformation-template.yaml` CORS configuration.

## Security Considerations

1. **Authentication**: This API currently has no authentication. Consider adding:
   - API Gateway API keys
   - AWS IAM authentication
   - Lambda authorizers with JWT tokens

2. **Rate limiting**: Configure API Gateway throttling to prevent abuse

3. **Input validation**: The API validates input, but consider additional checks for your use case

4. **Encryption**: DynamoDB supports encryption at rest (enable in CloudFormation template if needed)

## Future Enhancements

Potential features to add:

- Batch operations for better performance with large datasets
- Filtering/search capabilities
- Element metadata storage
- Delete/cleanup operations for old elements
- Authentication and authorization
- Rate limiting per user
- Caching layer (ElastiCache/CloudFront)

## Contributing

When making changes:

1. Test locally first
2. Update this README if adding new features
3. Run deployment script to staging environment
4. Test in staging
5. Deploy to production

## License

[Add your license here]

## Support

For issues or questions:

- Create an issue in the repository
- Contact the maintainer

## Changelog

### v1.0.0 (2024)

- Initial release
- OSM and Overture element tracking
- GET and POST endpoints
- DynamoDB backend
- AWS Lambda deployment
