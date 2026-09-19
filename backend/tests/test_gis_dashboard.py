"""Unit & Integration Test Suite for Part 5 Dynamic Web GIS Dashboard Endpoint."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_gis_dashboard_default():
    """Test default GET /api/v1/flood/gis-dashboard for Chennai at T+0h."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=0")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    data = res.json()

    assert data["status"] in ["PREDICTED", "SIMULATION"]
    assert data["horizon"] == "T+0h"
    assert "location" in data
    assert "rainfall" in data
    assert "surface_flow" in data
    assert "drainage_hydraulics" in data
    assert "street_projections" in data
    assert "provenance" in data

    assert len(data["street_projections"]) > 0
    first_street = data["street_projections"][0]
    assert "road_name" in first_street
    assert "max_predicted_depth_cm" in first_street
    assert "risk_level" in first_street
    assert first_street["risk_level"] in ["SAFE", "CAUTION", "MODERATE", "HIGH", "CRITICAL", "CLOSED"]


def test_gis_dashboard_timelines():
    """Test GIS dashboard endpoint across T+0h, T+1h, T+2h, T+3h forecast horizons."""
    for offset in range(4):
        res = client.get(f"/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours={offset}")
        assert res.status_code == 200
        data = res.json()
        assert data["horizon"] == f"T+{offset}h"
        assert len(data["street_projections"]) > 0


def test_gis_dashboard_blockage_simulation():
    """Test GIS dashboard endpoint with custom blockage percentage override."""
    res = client.get("/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=2&simulation_blockage_pct=75.0")
    assert res.status_code == 200
    data = res.json()
    assert data["horizon"] == "T+2h"
    assert len(data["street_projections"]) > 0
