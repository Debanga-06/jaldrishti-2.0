"""Unit & Integration Tests for 2D Surface Water Flow & Accumulation Physics Model."""

import pytest
from app.services.surface_flow_service import SurfaceFlowService


@pytest.mark.asyncio
async def test_2d_surface_flow_grid_generation_and_mass_conservation():
    """Verify 2D spatial terrain grid generation, D8 flow routing, and domain mass conservation."""
    res = await SurfaceFlowService.compute_2d_surface_flow(
        lat=22.7214,
        lon=88.4821,
        location_name="Barasat",
        horizon_offset_hours=0,
    )

    assert res["status"] == "PREDICTED"
    assert res["horizon"] == "T+0h"
    assert res["total_grid_cells"] == 25  # 5x5 grid

    physics = res["physics_metrics"]
    assert physics["cell_side_meters"] == 50.0
    assert physics["cell_area_sq_m"] == 2500.0
    assert physics["mass_conservation_status"] == "CONSERVED"

    # Verify physical sanity checks on all grid cells
    for cell in res["surface_grid"]:
        assert cell["elevation_m"] > 0.0
        assert cell["rainfall_volume_m3"] >= 0.0
        assert cell["inflow_volume_m3"] >= 0.0
        assert cell["outflow_volume_m3"] >= 0.0
        assert cell["accumulated_volume_m3"] >= 0.0
        assert cell["water_depth_cm"] >= 0.0
        assert len(cell["neighbor_cell_ids"]) > 0


@pytest.mark.asyncio
async def test_2d_surface_flow_provenance():
    """Verify data provenance distinguishes DEM terrain dataset and 2D surface flow model."""
    res = await SurfaceFlowService.compute_2d_surface_flow(
        lat=13.0827,
        lon=80.2757,
        location_name="Chennai",
        horizon_offset_hours=1,
    )

    prov = res["provenance"]
    assert prov["terrain_dataset"] == "DEM / ELEVATION DATASET (GIS)"
    assert prov["surface_model"] == "PREDICTED • 2D SURFACE FLOW MODEL"
    assert "D8 Steepest-Descent" in prov["flow_routing_algorithm"]


@pytest.mark.asyncio
async def test_road_waterlogging_mapping():
    """Verify terrain cell water depths map cleanly to street-level road segments."""
    res = await SurfaceFlowService.compute_2d_surface_flow(
        lat=28.5600,
        lon=77.1000,
        location_name="Delhi",
        horizon_offset_hours=2,
    )

    summary = res["road_waterlogging_summary"]
    assert len(summary) >= 2
    assert "road_name" in summary[0]
    assert summary[0]["max_predicted_depth_cm"] >= 0.0
    assert summary[0]["risk_level"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
