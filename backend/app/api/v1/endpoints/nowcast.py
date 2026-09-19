"""0-3 Hour Urban Flood Nowcast API Endpoint for JALDRISHTI."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.nowcast_service import FloodNowcastService

router = APIRouter()


@router.get("/nowcast", summary="0–3 Hour Urban Flood Nowcast Pipeline")
@router.get("/flood/nowcast", summary="0–3 Hour Urban Flood Nowcast Pipeline (Alias)")
async def get_0_to_3h_flood_nowcast(
    lat: float = Query(22.7214, description="Target Latitude"),
    lon: float = Query(88.4821, description="Target Longitude"),
    location_name: Optional[str] = Query("Target Location", description="Locality or Area Name"),
) -> Dict[str, Any]:
    """
    Returns time-indexed 0-3 hour urban flood nowcast prediction slices (T+0h, T+1h, T+2h, T+3h).
    Combines Open-Meteo meteorological forecasts with city terrain elevation, drainage load, and historical flood factors.
    """
    return await FloodNowcastService.get_0_to_3h_nowcast(lat=lat, lon=lon, location_name=location_name or "Target Location")
