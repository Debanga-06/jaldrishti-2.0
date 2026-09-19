"""Dynamic Web GIS Dashboard API Endpoint for JALDRISHTI (Part 5).

Aggregates 0-3h Nowcast (Part 1), Doppler Radar Advection (Part 2), 2D DEM Surface Flow (Part 3),
and Underground Directed Drainage Graph Hydraulics (Part 4) into a unified street-by-street
GIS flood projection payload for T+0h, T+1h, T+2h, and T+3h timelines.
"""

from typing import Optional, Dict, Any
from fastapi import APIRouter, Query
from app.services.drainage_hydraulics_service import DrainageHydraulicsService

router = APIRouter()


@router.get("/gis-dashboard", summary="Dynamic Web GIS Dashboard & Street Flood Projections")
async def get_gis_dashboard(
    lat: float = Query(13.0827, description="Target Latitude"),
    lon: float = Query(80.2757, description="Target Longitude"),
    location_name: Optional[str] = Query("Chennai", description="Locality or Area Name"),
    horizon_offset_hours: int = Query(0, ge=0, le=3, description="Nowcast horizon offset in hours (0 to 3)"),
    simulation_blockage_pct: Optional[float] = Query(None, ge=0.0, le=100.0, description="Optional simulation blockage % override"),
) -> Dict[str, Any]:
    """
    Returns authoritative street-by-street flood projections, water depth in cm,
    flood severity risk levels, 2D DEM surface cells, directed drainage graph metrics,
    and complete 5-tier data provenance for the selected 0-3h forecast horizon.
    """
    dh_res = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat,
        lon=lon,
        location_name=location_name or "Target Location",
        horizon_offset_hours=horizon_offset_hours,
        simulation_blockage_pct=simulation_blockage_pct,
    )

    # Format street projections according to Part 5 data contract
    street_projections = []
    for rd in dh_res.get("road_waterlogging_summary", []):
        street_projections.append({
            "road_name": rd["road_name"],
            "max_predicted_depth_cm": rd["max_predicted_depth_cm"],
            "avg_predicted_depth_cm": rd["avg_predicted_depth_cm"],
            "risk_level": rd["risk_level"],
            "status": rd["status"],
            "drainage_node_id": rd.get("drainage_node_id", "NODE-001"),
            "drainage_type": rd.get("drainage_type", "underground_conduit"),
            "capacity_utilization": rd.get("capacity_utilization", 0.0),
            "overcapacity": rd.get("overcapacity", False),
            "surcharge": rd.get("surcharge", False),
            "backflow": rd.get("backflow", False),
            "blockage_pct": rd.get("blockage_pct", 0.0),
            "blockage_status": rd.get("blockage_status", "OBSERVED DATASET"),
            "data_state": dh_res.get("status", "PREDICTED"),
            "horizon": dh_res.get("horizon", f"T+{horizon_offset_hours}h")
        })

    return {
        "status": dh_res.get("status", "PREDICTED"),
        "horizon": dh_res.get("horizon", f"T+{horizon_offset_hours}h"),
        "timestamp": dh_res.get("timestamp", ""),
        "location": dh_res.get("location", {}),
        "rainfall": {
            "source": dh_res["provenance"].get("rainfall_source", "Doppler Weather Radar"),
            "provenance_badge": dh_res["provenance"].get("rainfall_provenance_badge", "OBSERVED • DOPPLER WEATHER RADAR"),
            "intensity_mm_h": dh_res.get("physics_metrics", {}).get("rainfall_intensity_mm_h", 45.0) if "physics_metrics" in dh_res else 45.0
        },
        "surface_flow": {
            "total_grid_cells": len(dh_res.get("surface_grid", [])),
            "surface_model": dh_res["provenance"].get("surface_model", "PREDICTED • 2D SURFACE FLOW MODEL"),
            "surface_grid": dh_res.get("surface_grid", [])
        },
        "drainage_hydraulics": {
            "drainage_model": dh_res["provenance"].get("drainage_model", "HYDRAULIC MODEL • DIRECTED DRAINAGE GRAPH"),
            "graph_summary": dh_res.get("graph_summary", {}),
            "mass_conservation": dh_res.get("mass_conservation", {}),
            "nodes": dh_res.get("nodes", []),
            "edges": dh_res.get("edges", [])
        },
        "street_projections": street_projections,
        "provenance": dh_res.get("provenance", {})
    }
