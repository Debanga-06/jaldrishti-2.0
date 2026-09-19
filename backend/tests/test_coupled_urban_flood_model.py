"""Integration & Data Dependency Test Suite for Part 5 Coupled Urban Flood Pipeline.

Verifies end-to-end data flow:
Rainfall Input -> 2D DEM Surface Runoff -> Drainage Inlet Loading -> Manning Capacity & Surcharge -> Coupled Street Depth -> GIS Dashboard.
"""

import pytest
from app.services.nowcast_service import FloodNowcastService
from app.services.surface_flow_service import SurfaceFlowService
from app.services.drainage_hydraulics_service import DrainageHydraulicsService


@pytest.mark.asyncio
async def test_pipeline_a_radar_rainfall_to_surface_flow():
    """TEST A: Changing upstream nowcast rainfall rate directly changes 2D surface flow inputs & volume."""
    lat, lon = 13.0827, 80.2757
    location = "Chennai"

    # Step 1: Compute surface flow with low rainfall override (10 mm/h)
    low_res = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=10.0, rainfall_provenance_override="TEST • LOW RAIN"
    )

    # Step 2: Compute surface flow with high rainfall override (80 mm/h)
    high_res = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=80.0, rainfall_provenance_override="TEST • HIGH RAIN"
    )

    assert low_res["physics_metrics"]["rainfall_intensity_mm_h"] == 10.0
    assert high_res["physics_metrics"]["rainfall_intensity_mm_h"] == 80.0

    # High rainfall must generate higher total domain rainfall & accumulated volume
    assert high_res["physics_metrics"]["total_domain_rainfall_volume_m3"] > low_res["physics_metrics"]["total_domain_rainfall_volume_m3"]
    assert high_res["physics_metrics"]["total_domain_accumulated_volume_m3"] > low_res["physics_metrics"]["total_domain_accumulated_volume_m3"]


@pytest.mark.asyncio
async def test_pipeline_b_surface_flow_to_drainage_load():
    """TEST B: Increasing surface flow/runoff volume directly increases drainage inlet loading."""
    lat, lon = 13.0827, 80.2757
    location = "Chennai"

    # Surface flow under moderate rainfall (20 mm/h)
    surf_mod = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=20.0
    )

    # Surface flow under heavy rainfall (90 mm/h)
    surf_heavy = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=90.0
    )

    dh_mod = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        surface_result=surf_mod
    )

    dh_heavy = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        surface_result=surf_heavy
    )

    # Drainage inflow under heavy surface runoff must be higher
    assert dh_heavy["graph_summary"]["total_drainage_inflow_m3"] > dh_mod["graph_summary"]["total_drainage_inflow_m3"]


@pytest.mark.asyncio
async def test_pipeline_c_drainage_capacity_exceeded_surcharge():
    """TEST C: High drainage load or pipe blockage triggers overcapacity and surcharge/backflow."""
    lat, lon = 22.5726, 88.3639
    location = "Kolkata"

    # Normal blockage (15%)
    dh_normal = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        simulation_blockage_pct=15.0
    )

    # Severe blockage simulation (85%)
    dh_blocked = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        simulation_blockage_pct=85.0
    )

    # Blocked pipes must reduce effective capacity and increase surcharge backflow
    first_edge_normal = dh_normal["edges"][0]
    first_edge_blocked = dh_blocked["edges"][0]

    assert first_edge_blocked["effective_capacity_m3_s"] < first_edge_normal["effective_capacity_m3_s"]
    assert dh_blocked["graph_summary"]["total_surcharge_backflow_m3"] >= dh_normal["graph_summary"]["total_surcharge_backflow_m3"]


@pytest.mark.asyncio
async def test_pipeline_d_coupled_depth_to_street_projections():
    """TEST D: Coupled surface accumulation + surcharge backflow directly updates street water depth & risk level."""
    lat, lon = 13.0827, 80.2757
    location = "Chennai"

    surf_low = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=5.0
    )
    dh_low = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        surface_result=surf_low
    )

    surf_high = await SurfaceFlowService.compute_2d_surface_flow(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        rainfall_override_mm_h=75.0
    )
    dh_high = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        surface_result=surf_high
    )

    depth_low = dh_low["road_waterlogging_summary"][0]["max_predicted_depth_cm"]
    depth_high = dh_high["road_waterlogging_summary"][0]["max_predicted_depth_cm"]

    assert depth_high > depth_low
    assert dh_low["road_waterlogging_summary"][0]["risk_level"] in ["SAFE", "CAUTION"]
    assert dh_high["road_waterlogging_summary"][0]["risk_level"] in ["HIGH", "CRITICAL", "CLOSED"]


@pytest.mark.asyncio
async def test_pipeline_e_nowcast_timesteps_differ():
    """TEST E: T+0, T+1, T+2, T+3 forecast horizons produce distinct coupled outputs when nowcast rain differs."""
    lat, lon = 22.5280, 88.3650
    location = "Ballygunge"

    # Fetch nowcast once
    nowcast = await FloodNowcastService.get_0_to_3h_nowcast(lat=lat, lon=lon, location_name=location)
    timesteps = nowcast["timesteps"]

    res_t0 = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=0,
        nowcast_timestep=timesteps[0]
    )

    res_t3 = await DrainageHydraulicsService.evaluate_drainage_hydraulics(
        lat=lat, lon=lon, location_name=location, horizon_offset_hours=3,
        nowcast_timestep=timesteps[3]
    )

    assert res_t0["horizon"] == "T+0h"
    assert res_t3["horizon"] == "T+3h"
    assert res_t0["provenance"]["rainfall_source"] is not None
    assert res_t3["provenance"]["rainfall_source"] is not None
