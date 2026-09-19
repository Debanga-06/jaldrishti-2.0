"""Unit & Integration Test Suite for Part 6 Street-Level Dynamic Web GIS Dashboard."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_a_gis_endpoint_returns_coupled_street_projections():
    """TEST A: GIS endpoint GET /api/v1/flood/gis-dashboard returns coupled street-level projections."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=22.5280&lon=88.3650&location_name=Ballygunge&horizon_offset_hours=0")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert "street_projections" in data
    assert len(data["street_projections"]) > 0
    assert "road_name" in data["street_projections"][0]


def test_b_street_projections_have_valid_depth_severity_horizon_provenance():
    """TEST B: Every displayed street projection has valid road name, water depth in cm, severity, horizon, and provenance."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=1")
    assert res.status_code == 200
    data = res.json()

    assert data["horizon"] == "T+1h"
    assert "provenance" in data
    assert "rainfall_provenance_badge" in data["provenance"]

    for rd in data["street_projections"]:
        assert "road_name" in rd and len(rd["road_name"]) > 0
        assert "max_predicted_depth_cm" in rd and isinstance(rd["max_predicted_depth_cm"], (int, float))
        assert "risk_level" in rd and rd["risk_level"] in ["SAFE", "CAUTION", "MODERATE", "HIGH", "CRITICAL", "CLOSED"]
        assert "horizon" in rd


def test_c_forecast_horizons_t0_to_t3_use_corresponding_coupled_outputs():
    """TEST C: T+0h, T+1h, T+2h, T+3h correspond to their respective backend horizon results."""
    for offset in [0, 1, 2, 3]:
        res = client.get(f"/api/v1/flood/gis-dashboard?lat=22.5650&lon=88.3190&location_name=Shibpur&horizon_offset_hours={offset}")
        assert res.status_code == 200
        data = res.json()
        assert data["horizon"] == f"T+{offset}h"
        assert len(data["street_projections"]) > 0
        assert data["street_projections"][0]["horizon"] == f"T+{offset}h"


def test_d_water_depth_in_cm_drives_severity():
    """TEST D: Water depth in cm directly drives severity risk classification according to authoritative coupled backend rules."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=22.5280&lon=88.3650&location_name=Ballygunge&horizon_offset_hours=0")
    assert res.status_code == 200
    data = res.json()

    for rd in data["street_projections"]:
        depth = rd["max_predicted_depth_cm"]
        risk = rd["risk_level"]
        if depth >= 50.0:
            assert risk in ["CLOSED", "CRITICAL"]
        elif depth >= 30.0:
            assert risk in ["CRITICAL", "HIGH"]
        elif depth >= 15.0:
            assert risk in ["HIGH", "CAUTION", "MODERATE"]
        elif depth < 5.0:
            assert risk in ["SAFE", "CAUTION"]


def test_e_deterministic_street_projections_no_random():
    """TEST E: Deterministic calculation produces identical results for identical parameters (0 random values)."""
    res1 = client.get("/api/v1/flood/gis-dashboard?lat=22.5280&lon=88.3650&location_name=Ballygunge&horizon_offset_hours=0")
    res2 = client.get("/api/v1/flood/gis-dashboard?lat=22.5280&lon=88.3650&location_name=Ballygunge&horizon_offset_hours=0")

    d1 = res1.json()
    d2 = res2.json()

    assert d1["street_projections"][0]["max_predicted_depth_cm"] == d2["street_projections"][0]["max_predicted_depth_cm"]
    assert d1["street_projections"][0]["risk_level"] == d2["street_projections"][0]["risk_level"]


def test_f_existing_flood_categories_locked():
    """TEST F: Standard flood severity categories are locked and preserved."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=28.5600&lon=77.1000&location_name=Delhi&horizon_offset_hours=2")
    assert res.status_code == 200
    data = res.json()

    allowed = {"SAFE", "CAUTION", "MODERATE", "HIGH", "CRITICAL", "CLOSED"}
    for rd in data["street_projections"]:
        assert rd["risk_level"] in allowed, f"Unexpected risk level {rd['risk_level']}"


def test_g_osrm_route_evaluation_preserved():
    """TEST G: OSRM route evaluation endpoints remain functional and protected."""
    res = client.post("/api/v1/navigation/routes/evaluate?origin=Barasat&destination=Howrah&vehicle_type=CAR")
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert "route_id" in data[0]


def test_h_provenance_tier_badges_preserved():
    """TEST H: 5-tier data provenance badges are preserved in GIS payload."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=0")
    assert res.status_code == 200
    data = res.json()

    assert "provenance" in data
    prov = data["provenance"]
    assert "rainfall_provenance_badge" in prov
    assert "surface_model" in prov
    assert "drainage_model" in prov
