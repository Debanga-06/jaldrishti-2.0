"""Standalone Test Runner for JALDRISHTI FastAPI Backend & Agentic AI Engine."""

from fastapi.testclient import TestClient
from app.main import app


def run_backend_tests():
    print("=" * 65)
    print("JALDRISHTI BACKEND API INTEGRATION & AGENTIC AI TEST SUITE")
    print("=" * 65)

    client = TestClient(app)

    # Test 1: Health Endpoint
    print("[TEST 1/10] GET /api/v1/health ...", end=" ")
    res = client.get("/api/v1/health")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.json()
    assert data["version"] == "1.0.0"
    print("PASSED [OK]")

    # Test 2: System Info
    print("[TEST 2/10] GET /api/v1/system/info ...", end=" ")
    res = client.get("/api/v1/system/info")
    assert res.status_code == 200
    data = res.json()
    assert data["municipality"]["name"] == "Barasat Municipality"
    print("PASSED [OK]")

    # Test 3: Home Status Early Warning
    print("[TEST 3/10] GET /api/v1/navigation/home/status ...", end=" ")
    res = client.get("/api/v1/navigation/home/status?locality=Barasat%20Ward%204")
    assert res.status_code == 200
    data = res.json()
    assert data["home_locality"] == "Barasat Ward 4"
    assert data["expected_peak_depth_cm"] == 35.0
    print("PASSED [OK]")

    # Test 4: Hospitals Accessibility
    print("[TEST 4/10] GET /api/v1/navigation/hospitals ...", end=" ")
    res = client.get("/api/v1/navigation/hospitals")
    assert res.status_code == 200
    hospitals = res.json()
    assert len(hospitals) >= 3
    print("PASSED [OK]")

    # Test 5: Route Evaluation & Ranking
    print("[TEST 5/10] POST /api/v1/navigation/routes/evaluate ...", end=" ")
    res = client.post("/api/v1/navigation/routes/evaluate?origin=Barasat&destination=Howrah&vehicle_type=CAR")
    assert res.status_code == 200
    routes = res.json()
    assert len(routes) >= 1
    assert routes[0]["flood_exposure"] in ("LOW", "MODERATE", "HIGH", "CRITICAL")
    print("PASSED [OK]")

    # Test 6: Agent Home Safety Advisory
    print("[TEST 6/10] GET /api/v1/agent/home-safety ...", end=" ")
    res = client.get("/api/v1/agent/home-safety?locality=Barasat%20Ward%204&forecast_rainfall=88.5")
    assert res.status_code == 200
    agent_home = res.json()
    assert agent_home["home_locality"] == "Barasat Ward 4"
    assert agent_home["should_notify_user"] is True
    print("PASSED [OK]")

    # Test 7: Agent Route Evaluation
    print("[TEST 7/10] POST /api/v1/agent/evaluate-routes ...", end=" ")
    res = client.post("/api/v1/agent/evaluate-routes?origin=Barasat&destination=Howrah&vehicle_type=CAR")
    assert res.status_code == 200
    agent_routes = res.json()
    assert len(agent_routes) >= 1
    assert agent_routes[0]["vehicle_clearance_status"] in ("SAFE", "FLOOD_RISK", "WARNING", "IMPASSABLE", "CAUTION", "INACCESSIBLE", "COMPROMISED")
    print("PASSED [OK]")

    # Test 8: Agent Decision Trace & Telemetry Quality
    print("[TEST 8/10] GET /api/v1/agent/trace ...", end=" ")
    res = client.get("/api/v1/agent/trace")
    assert res.status_code == 200
    trace = res.json()
    assert len(trace) >= 4
    print("PASSED [OK]")

    # Test 9: Location-Agnostic Home Flood Risk Evaluation
    print("[TEST 9/10] GET /api/v1/home/status ...", end=" ")
    res = client.get("/api/v1/home/status?lat=22.7214&lon=88.4821&locality=Barasat%20Ward%204")
    assert res.status_code == 200
    home_eval = res.json()
    assert "home_safety" in home_eval
    assert home_eval["data_provenance"]["weather_state"] in ["LIVE", "SIMULATION"]
    print("PASSED [OK]")

    # Test 10: OpenStreetMap Nominatim Geocoding API Search
    print("[TEST 10/11] GET /api/v1/home/geocode/search ...", end=" ")
    res = client.get("/api/v1/home/geocode/search?q=Barasat")
    assert res.status_code == 200
    geocode = res.json()
    assert len(geocode) >= 1
    print("PASSED [OK]")

    # Test 11: 0-3 Hour Flood Nowcast with Radar, CWC Observed Telemetry & Open-Meteo Forecast
    print("[TEST 11/12] GET /api/v1/flood/nowcast (Chennai, Delhi, Mumbai 3-Source Telemetry) ...", end=" ")
    # Chennai
    res_che = client.get("/api/v1/flood/nowcast?lat=13.0827&lon=80.2757&location_name=Chennai")
    assert res_che.status_code == 200, f"Chennai nowcast failed: {res_che.status_code} {res_che.text}"
    data_che = res_che.json()
    assert "radar_rainfall" in data_che
    assert data_che["radar_rainfall"]["short_label"] == "DWR Radar"
    assert data_che["observed_rainfall"]["source_type"] == "OBSERVED"
    assert data_che["observed_rainfall"]["source_name"] == "CWC Ground Automated Rain Gauge Telemetry"
    assert data_che["observed_rainfall"]["total_stations_count"] == 5
    assert data_che["forecast_rainfall"]["source_type"] == "FORECAST"

    # Delhi
    res_del = client.get("/api/v1/flood/nowcast?lat=28.6625&lon=77.2489&location_name=Delhi")
    assert res_del.status_code == 200, f"Delhi nowcast failed: {res_del.status_code} {res_del.text}"
    data_del = res_del.json()
    assert data_del["observed_rainfall"]["total_stations_count"] == 1

    # Mumbai
    res_mum = client.get("/api/v1/flood/nowcast?lat=19.0760&lon=72.8777&location_name=Mumbai")
    assert res_mum.status_code == 200, f"Mumbai nowcast failed: {res_mum.status_code} {res_mum.text}"
    data_mum = res_mum.json()
    assert data_mum["observed_rainfall"]["data_state"] == "DATA_UNAVAILABLE"
    print("PASSED [OK]")

    # Test 12: Doppler Weather Radar Dedicated API Endpoint & Reflectivity Grid
    print("[TEST 12/13] GET /api/v1/radar/rainfall (Doppler Weather Radar Adapter) ...", end=" ")
    res_radar = client.get("/api/v1/radar/rainfall?lat=13.0827&lon=80.2757&location_name=Chennai")
    assert res_radar.status_code == 200, f"Radar endpoint failed: {res_radar.status_code} {res_radar.text}"
    data_radar = res_radar.json()
    assert "radar_telemetry" in data_radar
    assert data_radar["radar_telemetry"]["short_label"] == "DWR Radar"
    assert "nowcast_steps" in data_radar
    assert len(data_radar["nowcast_steps"]) == 4
    print("PASSED [OK]")

    # Test 13: 2D Surface Water Flow & Topographic Accumulation Engine API
    print("[TEST 13/14] GET /api/v1/flood/surface-flow (2D DEM Terrain Flow Model) ...", end=" ")
    res_flow = client.get("/api/v1/flood/surface-flow?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=1")
    assert res_flow.status_code == 200, f"Surface flow endpoint failed: {res_flow.status_code} {res_flow.text}"
    data_flow = res_flow.json()
    assert data_flow["status"] == "PREDICTED"
    assert data_flow["horizon"] == "T+1h"
    assert "physics_metrics" in data_flow
    assert data_flow["total_grid_cells"] == 25
    print("PASSED [OK]")

    # Test 14: Underground Drainage Network Hydraulic Model API
    print("[TEST 14/15] GET /api/v1/flood/drainage-hydraulics (Graph & Manning Capacity Model) ...", end=" ")
    res_drain = client.get("/api/v1/flood/drainage-hydraulics?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=1")
    assert res_drain.status_code == 200, f"Drainage hydraulics endpoint failed: {res_drain.status_code} {res_drain.text}"
    data_drain = res_drain.json()
    assert data_drain["status"] == "PREDICTED"
    assert data_drain["horizon"] == "T+1h"
    assert data_drain["provenance"]["drainage_model"] == "HYDRAULIC MODEL • DIRECTED DRAINAGE GRAPH"
    assert data_drain["graph_summary"]["total_nodes"] == 45
    assert data_drain["graph_summary"]["total_edges"] == 44
    assert data_drain["mass_conservation"]["mass_conservation_status"] in ["CONSERVED", "DEGRADED"]
    print("PASSED [OK]")

    # Test 15: Dynamic Web GIS Dashboard Endpoint (Part 5 Single Source Aggregation)
    print("[TEST 15/15] GET /api/v1/flood/gis-dashboard (Street Flood Projections & GIS Payload) ...", end=" ")
    res_gis = client.get("/api/v1/flood/gis-dashboard?lat=13.0827&lon=80.2757&location_name=Chennai&horizon_offset_hours=1")
    assert res_gis.status_code == 200, f"GIS Dashboard endpoint failed: {res_gis.status_code} {res_gis.text}"
    data_gis = res_gis.json()
    assert data_gis["status"] == "PREDICTED"
    assert data_gis["horizon"] == "T+1h"
    assert "street_projections" in data_gis
    assert len(data_gis["street_projections"]) > 0
    assert "surface_flow" in data_gis
    assert "drainage_hydraulics" in data_gis
    assert "provenance" in data_gis
    print("PASSED [OK]")

    print("=" * 65)
    print("ALL 15 BACKEND INTEGRATION & AGENTIC AI TESTS PASSED! [OK]")
    print("=" * 65)


if __name__ == "__main__":
    run_backend_tests()


