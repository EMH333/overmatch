# Overmatch

A tool for matching Overture Maps data with OpenStreetMap elements and applying enriched tags to OSM.

## Overview

Overmatch helps OSM contributors improve map data by:

1. **Matching** OSM amenities (restaurants, cafes, bars, etc.) with corresponding Overture Maps data
2. **Reviewing** tag differences in a visual comparison interface
3. **Applying** enriched tags from Overture to OSM elements
4. **Tracking** which elements have been processed to avoid duplicate work

## Architecture

The system consists of three components:

```
┌─────────────────┐
│  Matching       │  Python scripts for geospatial matching
│  Scripts        │  (OSM ↔ Overture)
└────────┬────────┘
         │ JSONL output
         ▼
┌─────────────────┐
│  Tracking API   │  FastAPI + DynamoDB on AWS Lambda
│  (FastAPI)      │  Tracks processed elements & stores matches
└────────┬────────┘
         │ REST API
         ▼
┌─────────────────┐
│  Web Frontend   │  React + MapLibre
│  (React)        │  Visual review and tagging interface
└─────────────────┘
```

## Components

### 1. Matching Scripts (`/scripts`)

Python scripts that perform geospatial matching between OSM and Overture data:

- **`match.py`**: Core matching algorithm using spatial indexing and fuzzy name matching
- **`get_osm_ids.py`**: Fetches OSM elements for a given area
- **`build_query.py`**: Builds Overpass queries for OSM data
- **`get_categories.py`**: Analyzes Overture category distributions

**Key features:**

- Spatial indexing (R-tree) for efficient nearest-neighbor search
- Fuzzy name matching using RapidFuzz
- Configurable distance and similarity thresholds
- Outputs JSONL format with match metadata

**Dependencies:** GeoPandas, RapidFuzz, rtree, atlus, overturetoosm

### 2. Tracking API (`/api`)

FastAPI service deployed on AWS Lambda that tracks processed elements:

- **GET/POST `/osm`**: Track which OSM elements have been uploaded with changes
- **GET/POST `/overture`**: Track which Overture elements have been marked as non-matching
- **GET `/matches`**: Retrieve OSM-to-Overture matches from DynamoDB

**Key features:**

- Serverless architecture (Lambda + DynamoDB)
- Millisecond response times at any scale
- Timestamp tracking for audit trails
- Infrastructure as Code (CloudFormation)

**Cost:** under $5/month for moderate usage

See [`api/README.md`](api/README.md) for detailed deployment instructions.

### 3. Web Frontend (`/front_end`)

React application for reviewing matches and applying tags:

- Visual comparison table showing OSM vs Overture tags
- Interactive map with MapLibre GL
- Support for multiple Overture matches per OSM element
- Batch upload to OSM via authenticated changesets
- Automatic deduplication using tracking API

**Key features:**

- Color-coded tag differences
- Live OSM data fetching
- Relation-based area selection
- OAuth authentication with OSM
- Persistent state management (Zustand)

See [`front_end/IMPLEMENTATION_NOTES.md`](front_end/IMPLEMENTATION_NOTES.md) for implementation details.

## License

Provided under the [MIT License](LICENSE.md).

## Contributing

Contributions welcome! Please ensure:

1. Matching scripts handle edge cases (nodes, ways, relations)
2. API changes are reflected in CloudFormation template
3. Frontend changes maintain TypeScript type safety

## Support

For issues or questions, please open an issue on GitHub.
