"""CWC Ground Automated Rain Gauge Telemetry Service for JALDRISHTI.

Integrates real CWC ground rainfall telemetry observations across Mumbai, Delhi, and Chennai
with city-region spatial bounding box filtering, timezone-aware acquisition time parsing,
and explicit OBSERVED / STALE / DATA_UNAVAILABLE data states.
"""

import os
import math
import logging
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timezone, timedelta
import zoneinfo
import pandas as pd

logger = logging.getLogger(__name__)

# Configured City Spatial Bounding Boxes (derived strictly from latitude & longitude)
CITY_BOUNDS: Dict[str, Dict[str, float]] = {
    "CHENNAI": {
        "min_lat": 12.80,
        "max_lat": 13.25,
        "min_lon": 79.90,
        "max_lon": 80.35,
        "file_name": "rainfall_tel_hr_cwc_tn_2026_2030.csv",
        "display_city": "Chennai",
    },
    "DELHI": {
        "min_lat": 28.40,
        "max_lat": 28.90,
        "min_lon": 76.85,
        "max_lon": 77.40,
        "file_name": "rainfall_tel_hr_cwc_dl_2026_2030.csv",
        "display_city": "Delhi",
    },
    "MUMBAI": {
        "min_lat": 18.89,
        "max_lat": 19.30,
        "min_lon": 72.75,
        "max_lon": 73.00,
        "file_name": "rainfall_tel_hr_cwc_mh_2026_2030.csv",
        "display_city": "Mumbai",
    },
}

# Freshness threshold (in hours) before marking telemetry data as STALE
FRESHNESS_HOURS_THRESHOLD = 72.0


class CWCTelemetryService:
    """Ingests, spatially filters, and serves CWC Ground Rain Gauge Telemetry."""

    _data_dir: str = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
    _cache: Dict[str, List[Dict[str, Any]]] = {}

    @classmethod
    def _parse_timestamp(cls, raw_time: Any) -> Optional[datetime]:
        """Parses CWC acquisition time string into timezone-aware IST datetime."""
        if not raw_time or pd.isna(raw_time):
            return None

        str_val = str(raw_time).strip()
        ist = zoneinfo.ZoneInfo("Asia/Kolkata")

        # Format 1: DD-MM-YYYY HH:MM (e.g., 01-09-2026 04:00)
        try:
            dt = datetime.strptime(str_val, "%d-%m-%Y %H:%M")
            return dt.replace(tzinfo=ist)
        except ValueError:
            pass

        # Format 2: YYYY-MM-DDTHH:MM:SS or ISO
        try:
            dt = datetime.fromisoformat(str_val)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=ist)
            return dt
        except ValueError:
            pass

        return None

    @classmethod
    def load_cwc_dataset(cls, city_key: str) -> List[Dict[str, Any]]:
        """Loads and parses CWC CSV dataset for a given city key."""
        if city_key in cls._cache:
            return cls._cache[city_key]

        cfg = CITY_BOUNDS.get(city_key.upper())
        if not cfg:
            return []

        file_path = os.path.join(cls._data_dir, cfg["file_name"])
        if not os.path.exists(file_path):
            logger.warning(f"CWC Telemetry file not found: {file_path}")
            return []

        records: List[Dict[str, Any]] = []
        try:
            df = pd.read_csv(file_path)
            required_cols = ["Station", "Latitude", "Longitude", "Data Acquisition Time", "Telemetry Hourly Rainfall (mm)"]

            for _, row in df.iterrows():
                try:
                    lat_val = row.get("Latitude")
                    lon_val = row.get("Longitude")

                    # Validate coordinates: drop NaN / invalid
                    if pd.isna(lat_val) or pd.isna(lon_val):
                        continue

                    lat = float(lat_val)
                    lon = float(lon_val)

                    # Apply city-region spatial bounding-box filtering
                    if not (cfg["min_lat"] <= lat <= cfg["max_lat"] and cfg["min_lon"] <= lon <= cfg["max_lon"]):
                        continue

                    raw_time = row.get("Data Acquisition Time")
                    dt = cls._parse_timestamp(raw_time)

                    rain_val = row.get("Telemetry Hourly Rainfall (mm)")
                    rainfall_mm = float(rain_val) if (pd.notna(rain_val) and not math.isnan(float(rain_val))) else 0.0

                    records.append({
                        "station": str(row.get("Station", "CWC Station")).strip(),
                        "agency": str(row.get("Agency", "CWC")).strip(),
                        "state": str(row.get("State", "")).strip(),
                        "district": str(row.get("District", "")).strip(),
                        "basin": str(row.get("Basin", "")).strip(),
                        "river": str(row.get("River", "")).strip(),
                        "latitude": lat,
                        "longitude": lon,
                        "observed_at_dt": dt,
                        "observed_at_str": dt.isoformat() if dt else str(raw_time),
                        "rainfall_mm": rainfall_mm,
                    })
                except Exception as row_err:
                    continue
        except Exception as file_err:
            logger.error(f"Error loading CWC file {file_path}: {file_err}")

        cls._cache[city_key] = records
        return records

    @classmethod
    def get_observed_telemetry(
        cls,
        city_domain: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
        reference_time: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Returns structured CWC observed rainfall telemetry context for a city.
        
        Returned data_state:
          - "OBSERVED": Valid active CWC ground station telemetry within freshness threshold.
          - "STALE": CWC telemetry exists but is older than staleness threshold.
          - "DATA_UNAVAILABLE": No valid CWC ground telemetry station matches spatial bounding box.
        """
        # Determine target city domain
        target_city = (city_domain or "").upper()
        if not target_city and lat is not None and lon is not None:
            for city_name, bounds in CITY_BOUNDS.items():
                if bounds["min_lat"] <= lat <= bounds["max_lat"] and bounds["min_lon"] <= lon <= bounds["max_lon"]:
                    target_city = city_name
                    break

        cfg = CITY_BOUNDS.get(target_city)
        display_city = cfg["display_city"] if cfg else (city_domain or "Unknown")

        if not cfg or target_city not in CITY_BOUNDS:
            return {
                "source_name": "CWC Ground Automated Rain Gauge Telemetry",
                "source_type": "OBSERVED",
                "short_label": "CWC ARG",
                "source_file": f"rainfall_tel_hr_cwc_{target_city.lower()[:2]}_2026_2030.csv" if target_city else "cwc_telemetry.csv",
                "data_state": "DATA_UNAVAILABLE",
                "city": display_city,
                "total_stations_count": 0,
                "latest_observed_at": None,
                "mean_rainfall_mm": 0.0,
                "max_rainfall_mm": 0.0,
                "stations": [],
            }

        records = cls.load_cwc_dataset(target_city)
        if not records:
            return {
                "source_name": "CWC Ground Automated Rain Gauge Telemetry",
                "source_type": "OBSERVED",
                "short_label": "CWC ARG",
                "source_file": cfg["file_name"],
                "data_state": "DATA_UNAVAILABLE",
                "city": display_city,
                "total_stations_count": 0,
                "latest_observed_at": None,
                "mean_rainfall_mm": 0.0,
                "max_rainfall_mm": 0.0,
                "stations": [],
            }

        # Group by station to extract latest observation per station
        stations_latest: Dict[str, Dict[str, Any]] = {}
        for r in records:
            st = r["station"]
            dt = r["observed_at_dt"]
            if st not in stations_latest:
                stations_latest[st] = r
            else:
                existing_dt = stations_latest[st]["observed_at_dt"]
                if dt and existing_dt and dt > existing_dt:
                    stations_latest[st] = r
                elif dt and not existing_dt:
                    stations_latest[st] = r

        stations_list: List[Dict[str, Any]] = []
        rainfall_values: List[float] = []
        latest_dt: Optional[datetime] = None

        now_ref = reference_time or datetime.now(zoneinfo.ZoneInfo("Asia/Kolkata"))

        for st_name, rec in stations_latest.items():
            rain_mm = rec["rainfall_mm"]
            rainfall_values.append(rain_mm)

            dt = rec["observed_at_dt"]
            if dt:
                if latest_dt is None or dt > latest_dt:
                    latest_dt = dt

            # Station-level staleness check
            is_stale = False
            if dt:
                age_hours = (now_ref - dt).total_seconds() / 3600.0
                if age_hours > FRESHNESS_HOURS_THRESHOLD:
                    is_stale = True

            stations_list.append({
                "station_name": st_name,
                "latitude": rec["latitude"],
                "longitude": rec["longitude"],
                "district": rec["district"],
                "basin": rec["basin"],
                "river": rec["river"],
                "observed_at": rec["observed_at_str"],
                "rainfall_mm": round(rain_mm, 1),
                "data_state": "STALE" if is_stale else "OBSERVED",
            })

        mean_rain = round(sum(rainfall_values) / len(rainfall_values), 1) if rainfall_values else 0.0
        max_rain = round(max(rainfall_values), 1) if rainfall_values else 0.0

        # Overall dataset staleness logic
        data_state = "OBSERVED"
        if latest_dt:
            age_hours = (now_ref - latest_dt).total_seconds() / 3600.0
            if age_hours > FRESHNESS_HOURS_THRESHOLD:
                data_state = "STALE"
        else:
            data_state = "STALE"

        return {
            "source_name": "CWC Ground Automated Rain Gauge Telemetry",
            "source_type": "OBSERVED",
            "short_label": "CWC ARG",
            "source_file": cfg["file_name"],
            "data_state": data_state,
            "city": display_city,
            "total_stations_count": len(stations_list),
            "latest_observed_at": latest_dt.isoformat() if latest_dt else None,
            "mean_rainfall_mm": mean_rain,
            "max_rainfall_mm": max_rain,
            "stations": stations_list,
        }
