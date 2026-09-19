"""2D Surface Water Flow & Accumulation API Endpoint for JALDRISHTI."""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.surface_flow_service import SurfaceFlowService

router = APIRouter()


@router.get("/surface-flow", summary="2D Surface Water Flow & Accumulation Model")
async def get_2d_surface_flow(
    lat: float = Query(22.7214, description="Target Latitude"),
    lon: float = Query(88.4821, description="Target Longitude"),
    location_name: Optional[str] = Query("Target Location", description="Locality or Area Name"),
    horizon_offset_hours: int = Query(0, ge=0, le=3, description="Nowcast horizon offset in hours (0 to 3)"),
) -> Dict[str, Any]:
    """
    Returns 2D terrain elevation grid, D8 surface water flow routing, accumulated volume (m3),
    water depth (cm), and road segment inundation mapping for given time horizon (T+0h, T+1h, T+2h, T+3h).
    """
    return await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat,
        lon=lon,
        location_name=location_name or "Target Location",
        horizon_offset_hours=horizon_offset_hours,
    )
