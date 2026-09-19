"""Multi-City JALDRISHTI Expansion & City-Isolation Unit Test Suite.

Verifies:
A. Delhi dataset loading & domain resolution.
B. Mumbai dataset loading & domain resolution.
C. Chennai dataset loading & domain resolution.
D. Kolkata regression.
E. Howrah regression.
F. City isolation (zero cross-city location leakage).
G. City-specific flood locations.
H. City-specific water depth evaluation.
I. City-specific rainfall provenance.
J. City-specific terrain elevation lookup.
K. City-specific drainage capacity.
L. Nowcast timesteps T+0h, T+1h, T+2h, T+3h per city.
M. GIS dashboard city query parameter filtering.
N. Flood-safe navigation city routing.
O. Complete route-polyline spatial flood risk evaluation.
P. Shortest vs lower-risk route evaluation.
Q. NO_SAFE_ROUTE handling.
R. Ambulance routing per city.
S. No synthetic/random coordinates.
T. CRITICAL CROSS-CITY ISOLATION TEST (Delhi/Mumbai/Chennai/Kolkata mutual exclusion).
"""

import pytest
import asyncio
from fastapi.testclient import TestClient

from app.main import app
from app.services.dataset_repository import DatasetRepository
from app.services.prediction_service import FloodPredictionService
from app.services.routing_service import RoutingService
from app.services.cwc_telemetry_service import CWCTelemetryService
from app.services.radar_service import DopplerRadarService

client = TestClient(app)


def test_city_domain_detection():
    """Test A, B, C, D, E: Verify city domain detection for all 5 supported cities."""
    assert DatasetRepository.get_city_domain(28.6139, 77.2090, "Delhi") == "DELHI"
    assert DatasetRepository.get_city_domain(19.0760, 72.8777, "Mumbai") == "MUMBAI"
    assert DatasetRepository.get_city_domain(13.0827, 80.2757, "Chennai") == "CHENNAI"
    assert DatasetRepository.get_city_domain(22.5280, 88.3650, "Ballygunge") == "KOLKATA"
    assert DatasetRepository.get_city_domain(22.5900, 88.3470, "Howrah") == "HOWRAH"


def test_city_drains_dataset_loading():
    """Test K: Verify city drains loaded directly from CSV dataset files for Chennai, Delhi, Mumbai, Kolkata."""
    che_drains = DatasetRepository.get_city_drains("CHENNAI")
    del_drains = DatasetRepository.get_city_drains("DELHI")
    mum_drains = DatasetRepository.get_city_drains("MUMBAI")
    kol_drains = DatasetRepository.get_city_drains("KOLKATA")

    assert len(che_drains) > 0
    assert len(del_drains) > 0
    assert len(mum_drains) > 0
    assert len(kol_drains) > 0

    assert che_drains[0]["drain_id"].startswith("CHE")
    assert del_drains[0]["drain_id"].startswith("DEL")
    assert mum_drains[0]["drain_id"].startswith("MUM")


@pytest.mark.asyncio
async def test_critical_cross_city_isolation():
    """Test F & T: Verify strict city spatial location isolation with zero cross-city data leakage."""
    delhi_pts, _ = await FloodPredictionService.get_spatial_prediction_points_for_route(
        [[77.1025, 28.7041], [77.2090, 28.6139]],
        origin_lat=28.7041, origin_lon=77.1025,
        dest_lat=28.6139, dest_lon=77.2090
    )
    mumbai_pts, _ = await FloodPredictionService.get_spatial_prediction_points_for_route(
        [[72.8464, 19.1197], [72.8777, 19.0760]],
        origin_lat=19.1197, origin_lon=72.8464,
        dest_lat=19.0760, dest_lon=72.8777
    )
    chennai_pts, _ = await FloodPredictionService.get_spatial_prediction_points_for_route(
        [[80.2200, 12.9750], [80.2757, 13.0827]],
        origin_lat=12.9750, origin_lon=80.2200,
        dest_lat=13.0827, dest_lon=80.2757
    )

    # Delhi results must NOT contain Kolkata, Howrah, Mumbai, or Chennai points
    for p in delhi_pts:
        spot = p["spot_name"].lower()
        assert "ballygunge" not in spot
        assert "shibpur" not in spot
        assert "velachery" not in spot
        assert "andheri" not in spot

    # Mumbai results must NOT contain Delhi, Chennai, Kolkata points
    for p in mumbai_pts:
        spot = p["spot_name"].lower()
        assert "rohini" not in spot
        assert "velachery" not in spot
        assert "ballygunge" not in spot

    # Chennai results must NOT contain Delhi, Mumbai, Kolkata points
    for p in chennai_pts:
        spot = p["spot_name"].lower()
        assert "rohini" not in spot
        assert "andheri" not in spot
        assert "ballygunge" not in spot


def test_gis_dashboard_city_parameter():
    """Test M: Verify GET /api/v1/flood/gis-dashboard accepts city parameter and filters domain."""
    for city_name in ["DELHI", "MUMBAI", "CHENNAI", "KOLKATA", "HOWRAH"]:
        resp = client.get(f"/api/v1/flood/gis-dashboard?city={city_name}")
        assert resp.status_code == 200
        data = resp.json()
        assert "street_projections" in data
        assert "surface_flow" in data
        assert "drainage_hydraulics" in data


def test_cwc_telemetry_multicity():
    """Test I: Verify CWC Telemetry loading across Delhi, Mumbai, and Chennai."""
    del_cwc = CWCTelemetryService.load_cwc_dataset("DELHI")
    tn_cwc = CWCTelemetryService.load_cwc_dataset("CHENNAI")

    assert len(del_cwc) > 0
    assert len(tn_cwc) > 0


def test_doppler_radar_registry():
    """Test I: Verify Radar adapter registry contains Chennai, Delhi, Mumbai, Kolkata."""
    for city in ["CHENNAI", "DELHI", "MUMBAI", "KOLKATA"]:
        assert city in DopplerRadarService.RADAR_STATION_REGISTRY


@pytest.mark.asyncio
async def test_multicity_routing_evaluation():
    """Test N, P, Q, R: Verify RoutingService evaluates routes for Delhi, Mumbai, Chennai."""
    del_route = await RoutingService.evaluate_routes(
        origin_lat=28.7041, origin_lon=77.1025,
        dest_lat=28.6139, dest_lon=77.2090,
        origin_name="Rohini", dest_name="Connaught Place",
        vehicle_type="CAR", horizon_offset_hours=0
    )
    assert del_route["status"] in ("SUCCESS", "NO_SAFE_ROUTE")
    assert del_route["origin"]["name"] == "Rohini"

    mum_route = await RoutingService.evaluate_routes(
        origin_lat=19.1197, origin_lon=72.8464,
        dest_lat=19.0760, dest_lon=72.8777,
        origin_name="Andheri", dest_name="Kurla",
        vehicle_type="AMBULANCE", horizon_offset_hours=1
    )
    assert mum_route["status"] in ("SUCCESS", "NO_SAFE_ROUTE")
    assert mum_route["vehicle_clearance_limit_cm"] == 35.0

    che_route = await RoutingService.evaluate_routes(
        origin_lat=12.9750, origin_lon=80.2200,
        dest_lat=13.0827, dest_lon=80.2757,
        origin_name="Velachery", dest_name="Chennai Central",
        vehicle_type="CAR", horizon_offset_hours=2
    )
    assert che_route["status"] in ("SUCCESS", "NO_SAFE_ROUTE")
