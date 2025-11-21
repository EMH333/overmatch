"""
FastAPI application for tracking OSM and Overture map elements.

This API provides endpoints to check if elements have been seen before
and to mark elements as seen in the database.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
from .db import DynamoDBManager
import os

app = FastAPI(
    title="Overmatch Element Tracking API",
    description="Track which OSM and Overture elements have been processed",
    version="1.0.0",
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


class ElementRequest(BaseModel):
    """Request model for element IDs"""

    ids: list[str]


class ElementStatus(BaseModel):
    """Response model for element status"""

    id: str
    exists: bool
    first_seen: str | None = None
    last_seen: str | None = None


class ElementsResponse(BaseModel):
    """Response model for multiple elements"""

    elements: list[ElementStatus]


class PostResponse(BaseModel):
    """Response model for POST requests"""

    success: bool
    count: int
    timestamp: str


class MatchInfo(BaseModel):
    """Match information between OSM and Overture elements"""

    osm_id: str
    overture_id: str
    lon: float
    lat: float
    distance_m: float
    similarity: float
    overture_tags: dict


class MatchStatus(BaseModel):
    """Response model for match status of a single OSM element"""

    osm_id: str
    has_match: bool
    matches: list[MatchInfo] = []


class MatchesResponse(BaseModel):
    """Response model for matches query"""

    elements: list[MatchStatus]


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Overmatch Element Tracking API",
        "version": "1.0.0",
    }


@app.get("/osm", response_model=ElementsResponse)
async def get_osm_elements(ids: str):
    """
    Check if OSM elements exist in the database.

    Args:
        ids: Comma-separated list of OSM element IDs

    Returns:
        ElementsResponse with status for each ID

    Example:
        GET /osm?ids=node/123,way/456,relation/789
    """
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    id_list = [id.strip() for id in ids.split(",") if id.strip()]

    if not id_list:
        raise HTTPException(status_code=400, detail="No valid IDs provided")

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


@app.post("/osm", response_model=PostResponse)
async def post_osm_elements(request: ElementRequest):
    """
    Mark OSM elements as seen in the database.

    Args:
        request: ElementRequest with list of OSM element IDs

    Returns:
        PostResponse with confirmation

    Example:
        POST /osm
        {"ids": ["node/123", "way/456", "relation/789"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in request.ids:
        osm_db.put_element(element_id, current_time)

    return PostResponse(success=True, count=len(request.ids), timestamp=current_time)


@app.get("/overture", response_model=ElementsResponse)
async def get_overture_elements(ids: str):
    """
    Check if Overture elements exist in the database.

    Args:
        ids: Comma-separated list of Overture element IDs

    Returns:
        ElementsResponse with status for each ID

    Example:
        GET /overture?ids=id1,id2,id3
    """
    if not ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    id_list = [id.strip() for id in ids.split(",") if id.strip()]

    if not id_list:
        raise HTTPException(status_code=400, detail="No valid IDs provided")

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


@app.post("/overture", response_model=PostResponse)
async def post_overture_elements(request: ElementRequest):
    """
    Mark Overture elements as seen in the database.

    Args:
        request: ElementRequest with list of Overture element IDs

    Returns:
        PostResponse with confirmation

    Example:
        POST /overture
        {"ids": ["id1", "id2", "id3"]}
    """
    if not request.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    current_time = datetime.utcnow().isoformat() + "Z"

    for element_id in request.ids:
        overture_db.put_element(element_id, current_time)

    return PostResponse(success=True, count=len(request.ids), timestamp=current_time)


@app.get("/matches", response_model=MatchesResponse)
async def get_matches(osm_ids: str):
    """
    Check if OSM elements have matches with Overture elements.

    Args:
        osm_ids: Comma-separated list of OSM element IDs (e.g., "way/123,node/456")

    Returns:
        MatchesResponse with match details for each OSM ID

    Example:
        GET /matches?osm_ids=way/48039595,way/48039713,node/123456
    """
    if not osm_ids:
        raise HTTPException(status_code=400, detail="No OSM IDs provided")

    id_list = [id.strip() for id in osm_ids.split(",") if id.strip()]

    if not id_list:
        raise HTTPException(status_code=400, detail="No valid OSM IDs provided")

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
