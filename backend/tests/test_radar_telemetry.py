"""Unit & Integration Tests for Doppler Weather Radar Telemetry & Optical Flow Nowcasting."""

import pytest
from app.services.radar_service import DopplerRadarService
from app.services.nowcast_service import FloodNowcastService


def test_marshall_palmer_conversion_math():
    """Verify Marshall-Palmer dBZ to mm/h and inverse conversions."""
    # Test zero/light rain threshold
    assert DopplerRadarService.dbz_to_rainfall_mm_h(10.0) == 0.0
    assert DopplerRadarService.rainfall_mm_h_to_dbz(0.0) == 0.0

    # Test Marshall-Palmer Z = 200 * R^1.6
    # 30 dBZ -> Z = 1000 -> R = (1000/200)^0.625 = 5^0.625 = 2.7 mm/h
    r_30 = DopplerRadarService.dbz_to_rainfall_mm_h(30.0)
    assert 2.5 <= r_30 <= 3.0

    # Inverse round-trip check
    dbz_recalculated = DopplerRadarService.rainfall_mm_h_to_dbz(r_30)
    assert abs(dbz_recalculated - 30.0) <= 0.5


def test_radar_station_registry():
    """Verify IMD Doppler Weather Radar station coverage registry for Chennai, Delhi, Mumbai, Kolkata."""
    che_radar = DopplerRadarService.get_radar_telemetry("CHENNAI", 13.0827, 80.2757)
    assert che_radar["short_label"] == "DWR Radar"
    assert che_radar["full_source_label"] == "OBSERVED • DOPPLER WEATHER RADAR"
    assert "IMD Chennai" in che_radar["source_name"]

    del_radar = DopplerRadarService.get_radar_telemetry("DELHI", 28.5600, 77.1000)
    assert "IMD New Delhi Palam" in del_radar["source_name"]

    mum_radar = DopplerRadarService.get_radar_telemetry("MUMBAI", 18.9000, 72.8100)
    assert "IMD Mumbai Colaba" in mum_radar["source_name"]


def test_radar_unconfigured_data_unavailable_honesty():
    """Verify radar telemetry handles unconfigured/offline feeds without fabricating fake radar data."""
    res = DopplerRadarService.get_radar_telemetry("MUMBAI", 18.9000, 72.8100)
    assert res["data_state"] == "DATA_UNAVAILABLE"
    assert "unconfigured or offline" in res["reason"]
    assert res["total_grid_cells"] == 0
    assert res["mean_rainfall_mm_h"] == 0.0
    assert res["max_dbz"] == 0.0


def test_radar_0_to_3h_nowcast_extrapolation():
    """Verify 0-3 hour optical flow advection nowcast steps generation."""
    nowcast = DopplerRadarService.generate_0_to_3h_radar_nowcast(13.0827, 80.2757, "Chennai")
    assert "status" in nowcast
    assert len(nowcast["nowcast_steps"]) == 4

    step0 = nowcast["nowcast_steps"][0]
    assert step0["offset_hours"] == 0
    assert "Radar" in step0["label"]


@pytest.mark.asyncio
async def test_nowcast_three_source_provenance_integration():
    """Verify FloodNowcastService exposes radar_rainfall, observed_rainfall, and forecast_rainfall separately."""
    nowcast = await FloodNowcastService.get_0_to_3h_nowcast(13.0827, 80.2757, "Chennai")
    assert "radar_rainfall" in nowcast
    assert "observed_rainfall" in nowcast
    assert "forecast_rainfall" in nowcast

    rad = nowcast["radar_rainfall"]
    assert rad["source_type"] == "OBSERVED"
    assert rad["short_label"] == "DWR Radar"
    assert rad["full_source_label"] == "OBSERVED • DOPPLER WEATHER RADAR"

    obs = nowcast["observed_rainfall"]
    assert obs["source_type"] == "OBSERVED"
    assert obs["short_label"] == "CWC ARG"

    fcst = nowcast["forecast_rainfall"]
    assert fcst["source_type"] == "FORECAST"
    assert fcst["source_name"] == "Open-Meteo"
