"""Unit & Integration Tests for CWC Ground Rainfall Telemetry Service."""

import pytest
from app.services.cwc_telemetry_service import CWCTelemetryService
from app.services.nowcast_service import FloodNowcastService


def test_cwc_chennai_spatial_filtering():
    """Verify Chennai CWC spatial filtering retains exactly 5 relevant stations within bounds."""
    res = CWCTelemetryService.get_observed_telemetry("CHENNAI", 13.0827, 80.2757)
    assert res["source_name"] == "CWC Ground Automated Rain Gauge Telemetry"
    assert res["source_type"] == "OBSERVED"
    assert res["short_label"] == "CWC ARG"
    assert res["city"] == "Chennai"
    assert res["total_stations_count"] == 5
    station_names = [s["station_name"] for s in res["stations"]]
    assert "Chembarampakkam" in station_names
    assert "Anakaputhur_1" in station_names
    assert "Anaikattucherry" in station_names
    assert "Nemam Tank" in station_names
    assert "Pennalur Causeway" in station_names


def test_cwc_delhi_spatial_filtering():
    """Verify Delhi CWC spatial filtering retains Delhi Railway Bridge station."""
    res = CWCTelemetryService.get_observed_telemetry("DELHI", 28.6625, 77.2489)
    assert res["source_name"] == "CWC Ground Automated Rain Gauge Telemetry"
    assert res["source_type"] == "OBSERVED"
    assert res["city"] == "Delhi"
    assert res["total_stations_count"] == 1
    assert res["stations"][0]["station_name"] == "Delhi Railway Bridge"


def test_cwc_mumbai_spatial_filtering():
    """Verify Mumbai CWC spatial filtering returns DATA_UNAVAILABLE when 0 valid stations match."""
    res = CWCTelemetryService.get_observed_telemetry("MUMBAI", 19.0760, 72.8777)
    assert res["source_name"] == "CWC Ground Automated Rain Gauge Telemetry"
    assert res["source_type"] == "OBSERVED"
    assert res["city"] == "Mumbai"
    assert res["total_stations_count"] == 0
    assert res["data_state"] == "DATA_UNAVAILABLE"


@pytest.mark.asyncio
async def test_nowcast_observed_and_forecast_separation():
    """Verify nowcast response separates observed_rainfall and forecast_rainfall."""
    nowcast = await FloodNowcastService.get_0_to_3h_nowcast(13.0827, 80.2757, "Chennai")
    assert "observed_rainfall" in nowcast
    assert "forecast_rainfall" in nowcast

    obs = nowcast["observed_rainfall"]
    assert obs["source_type"] == "OBSERVED"
    assert obs["source_name"] == "CWC Ground Automated Rain Gauge Telemetry"

    fcst = nowcast["forecast_rainfall"]
    assert fcst["source_type"] == "FORECAST"
    assert fcst["source_name"] == "Open-Meteo"

    # Verify timesteps
    assert len(nowcast["timesteps"]) == 4
    assert nowcast["timesteps"][0]["label"] == "T+0h (Nowcast)"
    assert nowcast["timesteps"][1]["label"] == "T+1h Forecast"
