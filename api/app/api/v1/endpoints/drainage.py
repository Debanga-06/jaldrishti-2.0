"""Underground Drainage Network Hydraulic Model API Endpoint for JALDRISHTI (Part 4)."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.drainage_hydraulics_service import DrainageHydraulicsService

router = APIRouter()


@router.get("/drainage-hydraulics", summary="Underground Drainage Network Hydraulic & Surcharge Model")
async def get_drainage_hydraulics(
    lat: float = Query(13.0827, description="Target Latitude"),
    lon: float = Query(80.2757, description="Target Longitude"),
    location_name: Optional[str] = Query("Chennai", description="Locality or Area Name"),
    horizon_offset_hours: int = Query(1, ge=0, le=3, description="Nowcast horizon offset in hours (0 to 3)"),
    simulation_blockage_pct: Optional[float] = Query(None, ge=0.0, le=100.0, description="Optional simulation blockage % override"),
) -> Dict[str, Any]:
    """
    Returns directed stormwater drainage network graph G=(V,E), Manning hydraulic capacity,
    blockage status, 2D surface coupling (max 150m), overcapacity detection, surcharge, backflow,
    road waterlogging updates, and mass conservation state.
    """
    return await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat,
        lon=lon,
        location_name=location_name or "Target Location",
        horizon_offset_hours=horizon_offset_hours,
        simulation_blockage_pct=simulation_blockage_pct,
    )
