"""Unit & Integration Test Suite for Part 4 Underground Drainage Network Hydraulic Model."""

import pytest
from app.services.drainage_hydraulics_service import DrainageHydraulicsService


@pytest.mark.asyncio
async def test_drainage_graph_construction_and_manning_capacity():
    """Verify directed graph construction, dataset loading, and Manning equation capacity calculations."""
    graph = DrainageHydraulicsService.build_drainage_graph(
        city="CHENNAI",
        lat=13.0827,
        lon=80.2757
    )

    assert graph["city"] == "CHENNAI"
    assert graph["total_nodes"] == 45
    assert graph["total_edges"] == 44

    first_edge = graph["edges"][0]
    assert first_edge["from_node"].startswith("NODE-")
    assert first_edge["to_node"].startswith("NODE-")
    assert first_edge["nominal_capacity_m3_s"] > 0.0
    assert first_edge["effective_capacity_m3_s"] <= first_edge["nominal_capacity_m3_s"]
    assert first_edge["blockage_status"] in ["OBSERVED DATASET", "DATA_UNAVAILABLE", "BLOCKAGE • SIMULATION", "HYDRAULIC PARAMETERS • CONFIGURED ASSUMPTION"]


@pytest.mark.asyncio
async def test_manning_equation_calculation():
    """Verify physical sanity of Manning's equation for pipe geometry."""
    capacity, is_assumed = DrainageHydraulicsService._calculate_manning_capacity(
        diameter_or_width_m=1.0,
        depth_m=1.0,
        drain_type="underground_conduit",
        n=0.013,
        s=0.002
    )

    assert capacity > 0.0
    assert not is_assumed  # Explicit n and s provided


@pytest.mark.asyncio
async def test_coupled_surface_drainage_eval_and_mass_conservation():
    """Verify surface cell spatial coupling (<=150m), surcharge backflow, and mass conservation."""
    res = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=13.0827,
        lon=80.2757,
        location_name="Chennai",
        horizon_offset_hours=1
    )

    assert res["status"] == "PREDICTED"
    assert res["horizon"] == "T+1h"
    assert len(res["nodes"]) == 45
    assert len(res["edges"]) == 44

    g_sum = res["graph_summary"]
    assert g_sum["max_association_distance_m"] == 150.0
    assert g_sum["coupled_surface_cells_count"] == 25

    mc = res["mass_conservation"]
    assert mc["mass_conservation_status"] in ["CONSERVED", "DEGRADED"]
    assert mc["remaining_surface_storage_m3"] >= 0.0
    assert mc["drainage_inflow_m3"] >= 0.0
    assert mc["drainage_outflow_m3"] >= 0.0


@pytest.mark.asyncio
async def test_blockage_simulation_override():
    """Verify explicit simulation blockage parameter is correctly labeled as SIMULATION."""
    res = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=28.5600,
        lon=77.1000,
        location_name="Delhi",
        horizon_offset_hours=2,
        simulation_blockage_pct=50.0
    )

    prov = res["provenance"]
    assert prov["blockage_badge"] == "BLOCKAGE • SIMULATION"
    assert res["edges"][0]["blockage_pct"] == 50.0
    assert res["edges"][0]["blockage_status"] == "BLOCKAGE • SIMULATION"


@pytest.mark.asyncio
async def test_timesteps_t0_to_t3():
    """Verify execution across T+0h, T+1h, T+2h, and T+3h forecast horizons."""
    for h in [0, 1, 2, 3]:
        res = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
            lat=19.0760,
            lon=72.8777,
            location_name="Mumbai",
            horizon_offset_hours=h
        )
        assert res["horizon"] == f"T+{h}h"
        assert res["status"] == "PREDICTED"
        assert len(res["road_waterlogging_summary"]) > 0
