"""
FastAPI application for tracking OSM and Overture map elements.

This API provides endpoints to check if elements have been seen before
and to mark elements as seen in the database.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from datetime import datetime
from .db import DynamoDBManager
import os

app = FastAPI(
    title="Overmatch Element Tracking API",
    description="Track which OSM and Overture elements have been processed",
    version="1.0.0",
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize DynamoDB managers
osm_db = DynamoDBManager(
    table_name=os.getenv("OSM_TABLE_NAME", "overmatch-osm-elements"),
    region_name=os.getenv("AWS_REGION", "us-east-1"),
)

overture_db = DynamoDBManager(
    table_name=os.getenv("OVERTURE_TABLE_NAME", "overmatch-overture-elements"),
    region_name=os.getenv("AWS_REGION", "us-east-1"),
)

matches_db = DynamoDBManager(
    table_name=os.getenv("MATCHES_TABLE_NAME", "overmatch-matches"),
    region_name=os.getenv("AWS_REGION", "us-east-1"),
)


class HealthResponse(BaseModel):
    """Response model for health check"""

    status: str = Field(examples=["healthy"])
    service: str = Field(examples=["Overmatch Element Tracking API"])
    version: str = Field(examples=["1.0.0"])


class OsmElementRequest(BaseModel):
    """Request model for OSM element IDs"""

    ids: list[str] = Field(examples=[["node/123", "way/456", "relation/789"]])


class OvertureElementRequest(BaseModel):
    """Request model for Overture element IDs"""

    ids: list[str] = Field(
        examples=[
            [
                "3a651d6c-4684-4250-880c-c34be754590d",
                "21858aad-48ca-4d20-91a0-1ad020d2b963",
                "1bbd2673-7dd4-49da-9c4a-892392ac680f",
            ]
        ]
    )


class ElementStatus(BaseModel):
    """Response model for element status"""

    id: str = Field(examples=["way/48039595"])
    exists: bool = Field(examples=[True])
    first_seen: str | None = Field(default=None, examples=["2024-01-15T10:30:00.000Z"])
    last_seen: str | None = Field(default=None, examples=["2024-01-15T14:45:00.000Z"])


class ElementsResponse(BaseModel):
    """Response model for multiple elements"""

    elements: list[ElementStatus] = Field(
        examples=[
            [
                {
                    "id": "way/48039595",
                    "exists": True,
                    "first_seen": "2024-01-15T10:30:00.000Z",
                    "last_seen": "2024-01-15T14:45:00.000Z",
                }
            ]
        ]
    )


class PostResponse(BaseModel):
    """Response model for POST requests"""

    success: bool = Field(examples=[True])
    count: int = Field(examples=[3])
    timestamp: str = Field(examples=["2024-01-15T14:45:00.000Z"])


class MatchInfo(BaseModel):
    """Match information between OSM and Overture elements"""

    osm_id: str = Field(examples=["way/48039595"])
    overture_id: str = Field(examples=["a60fa4ac-5b72-4557-8e64-ad4282852745"])
    lon: float = Field(examples=[-122.4194])
    lat: float = Field(examples=[37.7749])
    distance_m: float = Field(examples=[2.5])
    similarity: float = Field(examples=[0.95])
    overture_tags: dict = Field(examples=[{"name": "Central Park", "amenity": "park"}])


class MatchStatus(BaseModel):
    """Response model for match status of a single OSM element"""

    osm_id: str = Field(examples=["way/48039595"])
    has_match: bool = Field(examples=[True])
    matches: list[MatchInfo] = Field(
        default=[],
        examples=[
            [
                {
                    "osm_id": "way/48039595",
                    "overture_id": "a60fa4ac-5b72-4557-8e64-ad4282852745",
                    "lon": -122.4194,
                    "lat": 37.7749,
                    "distance_m": 22.5,
                    "similarity": 0.95,
                    "overture_tags": {"name": "Central Park Cafe", "amenity": "cafe"},
                }
            ]
        ],
    )


class MatchesResponse(BaseModel):
    """Response model for matches query"""

    elements: list[MatchStatus] = Field(
        examples=[
            [
                {
                    "osm_id": "way/48039595",
                    "has_match": True,
                    "matches": [
                        {
                            "osm_id": "way/48039595",
                            "overture_id": "a60fa4ac-5b72-4557-8e64-ad4282852745",
                            "lon": -122.4194,
                            "lat": 37.7749,
                            "distance_m": 22.5,
                            "similarity": 0.95,
                            "overture_tags": {
                                "name": "Central Park Cafe",
                                "amenity": "cafe",
                            },
                        }
                    ],
                }
            ]
        ]
    )


@app.get("/", response_model=HealthResponse)
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Overmatch Element Tracking API",
        "version": "1.0.0",
    }


@app.post("/osm/check", response_model=ElementsResponse)
async def check_osm_elements(request: OsmElementRequest):
    """
    Check if OSM elements exist in the database.

    Args:
        request: OsmElementRequest with list of OSM element IDs

    Returns:
        ElementsResponse with status for each ID

    Example:
        POST /osm/check
        {"ids": ["node/123", "way/456", "relation/789"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    id_list = request.ids

    results = []
    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in id_list:
        element = osm_db.get_element(element_id)

        if element:
            # Update last_seen timestamp
            osm_db.update_last_seen(element_id, current_time)
            results.append(
                ElementStatus(
                    id=element_id,
                    exists=True,
                    first_seen=element.get("first_seen"),
                    last_seen=current_time,
                )
            )
        else:
            results.append(ElementStatus(id=element_id, exists=False))

    return ElementsResponse(elements=results)


@app.post("/osm/mark", response_model=PostResponse)
async def mark_osm_elements(request: OsmElementRequest):
    """
    Mark OSM elements as seen in the database.

    Args:
        request: OsmElementRequest with list of OSM element IDs

    Returns:
        PostResponse with confirmation

    Example:
        POST /osm/mark
        {"ids": ["node/123", "way/456", "relation/789"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in request.ids:
        osm_db.put_element(element_id, current_time)

    return PostResponse(success=True, count=len(request.ids), timestamp=current_time)


@app.post("/overture/check", response_model=ElementsResponse)
async def check_overture_elements(request: OvertureElementRequest):
    """
    Check if Overture elements exist in the database.

    Args:
        request: OvertureElementRequest with list of Overture element IDs

    Returns:
        ElementsResponse with status for each ID

    Example:
        POST /overture/check
        {"ids": ["3a651d6c-4684-4250-880c-c34be754590d", "21858aad-48ca-4d20-91a0-1ad020d2b963"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    id_list = request.ids

    results = []
    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in id_list:
        element = overture_db.get_element(element_id)

        if element:
            # Update last_seen timestamp
            overture_db.update_last_seen(element_id, current_time)
            results.append(
                ElementStatus(
                    id=element_id,
                    exists=True,
                    first_seen=element.get("first_seen"),
                    last_seen=current_time,
                )
            )
        else:
            results.append(ElementStatus(id=element_id, exists=False))

    return ElementsResponse(elements=results)


@app.post("/overture/mark", response_model=PostResponse)
async def mark_overture_elements(request: OvertureElementRequest):
    """
    Mark Overture elements as seen in the database.

    Args:
        request: OvertureElementRequest with list of Overture element IDs

    Returns:
        PostResponse with confirmation

    Example:
        POST /overture/mark
        {"ids": ["3a651d6c-4684-4250-880c-c34be754590d", "21858aad-48ca-4d20-91a0-1ad020d2b963"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in request.ids:
        overture_db.put_element(element_id, current_time)

    return PostResponse(success=True, count=len(request.ids), timestamp=current_time)


@app.post("/matches/check", response_model=MatchesResponse)
async def check_matches(request: OsmElementRequest):
    """
    Check if OSM elements have matches with Overture elements.

    Args:
        request: OsmElementRequest with list of OSM element IDs

    Returns:
        MatchesResponse with match details for each OSM ID

    Example:
        POST /matches/check
        {"ids": ["way/48039595", "way/48039713", "node/123456"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No OSM IDs provided")

    id_list = request.ids

    results = []

    for osm_id in id_list:
        # Query matches table for this OSM ID
        match_data = matches_db.get_element(osm_id)

        if match_data and "matches" in match_data:
            # Parse matches from stored data
            matches = []
            for match in match_data["matches"]:
                matches.append(
                    MatchInfo(
                        osm_id=osm_id,
                        overture_id=match.get("overture_id", ""),
                        lon=float(match.get("lon", 0)),
                        lat=float(match.get("lat", 0)),
                        distance_m=float(match.get("distance_m", 0)),
                        similarity=float(match.get("similarity", 0)),
                        overture_tags=match.get("overture_tags", {}),
                    )
                )

            results.append(MatchStatus(osm_id=osm_id, has_match=True, matches=matches))
        else:
            results.append(MatchStatus(osm_id=osm_id, has_match=False, matches=[]))

    return MatchesResponse(elements=results)
