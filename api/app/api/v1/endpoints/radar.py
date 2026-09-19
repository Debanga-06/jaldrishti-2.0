"""Doppler Weather Radar API Endpoint for JALDRISHTI."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.radar_service import DopplerRadarService

router = APIRouter()


@router.get("/rainfall", summary="Doppler Weather Radar Rainfall Telemetry & Grid")
@router.get("/nowcast", summary="Doppler Weather Radar 0-3h Optical Flow Nowcast (Alias)")
async def get_radar_rainfall(
    lat: float = Query(22.7214, description="Target Latitude"),
    lon: float = Query(88.4821, description="Target Longitude"),
    location_name: Optional[str] = Query("Target Location", description="Locality or Area Name"),
) -> Dict[str, Any]:
    """
    Returns normalized Doppler Weather Radar telemetry, reflectivity dBZ, spatial rainfall grid,
    and 0-3 hour optical-flow advection nowcast steps (T+0h, T+1h, T+2h, T+3h).
    """
    return DopplerRadarService.generate_0_to_3h_radar_nowcast(lat=lat, lon=lon, location_name=location_name or "Target Location")
