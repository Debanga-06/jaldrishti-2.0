"""Structured Dataset Repository & City-Safe Spatial Lookup Engine for JALDRISHTI.

Loads uploaded Kolkata and Howrah domain datasets into structured in-memory caches.
Provides location-aware spatial lookups for terrain elevation/slope, drainage capacity/stress,
historical flood susceptibility, and citizen reports without cross-domain ID leakage.
"""

import math
from typing import Dict, Any, List, Optional, Tuple


class DatasetRepository:
    """In-memory structured data repository for Kolkata & Howrah domain datasets."""

    # ------------------------------------------------------------------
    # 1. KOLKATA DATASET REGISTRY
    # ------------------------------------------------------------------
    KOLKATA_ZONES: Dict[str, Dict[str, Any]] = {
        "Ballygunge": {"zone_id": "KOL-Z-01", "ward_ids": "W-061,W-062", "avg_elevation_m": 5.4, "pumping_station": "BDPS", "outfall_channel": "Circular Canal", "area_sq_km": 4.62, "tide_dependent": True},
        "Park Circus": {"zone_id": "KOL-Z-02", "ward_ids": "W-062,W-063", "avg_elevation_m": 4.9, "pumping_station": "PBPS", "outfall_channel": "Tolly's Nullah", "area_sq_km": 3.75, "tide_dependent": True},
        "Tiljala": {"zone_id": "KOL-Z-03", "ward_ids": "W-063,W-064", "avg_elevation_m": 4.5, "pumping_station": "PBPS", "outfall_channel": "Circular Canal", "area_sq_km": 6.25, "tide_dependent": True},
        "Topsia": {"zone_id": "KOL-Z-04", "ward_ids": "W-064,W-065", "avg_elevation_m": 4.1, "pumping_station": "DLPS", "outfall_channel": "Circular Canal", "area_sq_km": 3.36, "tide_dependent": True},
        "Dhapa": {"zone_id": "KOL-Z-05", "ward_ids": "W-065,W-066", "avg_elevation_m": 3.6, "pumping_station": "DLPS", "outfall_channel": "Kultigang (tidal creek)", "area_sq_km": 5.68, "tide_dependent": True},
        "Park Street": {"zone_id": "KOL-Z-01", "ward_ids": "W-061", "avg_elevation_m": 5.4, "pumping_station": "BDPS", "outfall_channel": "Circular Canal", "area_sq_km": 4.00, "tide_dependent": True},
        "Salt Lake": {"zone_id": "KOL-Z-05", "ward_ids": "W-066", "avg_elevation_m": 3.8, "pumping_station": "DLPS", "outfall_channel": "Kultigang (tidal creek)", "area_sq_km": 5.00, "tide_dependent": True},
    }

    KOLKATA_ELEVATION_POINTS: List[Dict[str, Any]] = [
        {"point_id": "ELV-0001", "zone": "Ballygunge", "elevation_m": 6.14, "slope_percent": 0.99, "flow_direction": "south-west", "low_point": False, "lat": 22.5280, "lon": 88.3650},
        {"point_id": "ELV-0006", "zone": "Ballygunge", "elevation_m": 5.02, "slope_percent": 0.07, "flow_direction": "east", "low_point": True, "lat": 22.5250, "lon": 88.3620},
        {"point_id": "ELV-0008", "zone": "Ballygunge", "elevation_m": 4.55, "slope_percent": 1.04, "flow_direction": "south", "low_point": True, "lat": 22.5230, "lon": 88.3680},
        {"point_id": "ELV-0009", "zone": "Ballygunge", "elevation_m": 4.43, "slope_percent": 1.19, "flow_direction": "south", "low_point": True, "lat": 22.5220, "lon": 88.3690},
        {"point_id": "ELV-0011", "zone": "Park Circus", "elevation_m": 4.00, "slope_percent": 0.87, "flow_direction": "east", "low_point": True, "lat": 22.5440, "lon": 88.3680},
        {"point_id": "ELV-0013", "zone": "Park Circus", "elevation_m": 4.36, "slope_percent": 0.41, "flow_direction": "north", "low_point": True, "lat": 22.5420, "lon": 88.3660},
        {"point_id": "ELV-0017", "zone": "Park Circus", "elevation_m": 3.94, "slope_percent": 0.89, "flow_direction": "south-east", "low_point": True, "lat": 22.5460, "lon": 88.3700},
        {"point_id": "ELV-0025", "zone": "Tiljala", "elevation_m": 3.66, "slope_percent": 0.90, "flow_direction": "north", "low_point": True, "lat": 22.5350, "lon": 88.3850},
        {"point_id": "ELV-0029", "zone": "Tiljala", "elevation_m": 4.17, "slope_percent": 0.58, "flow_direction": "west", "low_point": True, "lat": 22.5320, "lon": 88.3820},
        {"point_id": "ELV-0030", "zone": "Tiljala", "elevation_m": 4.12, "slope_percent": 0.05, "flow_direction": "north", "low_point": True, "lat": 22.5310, "lon": 88.3810},
        {"point_id": "ELV-0032", "zone": "Topsia", "elevation_m": 3.84, "slope_percent": 0.09, "flow_direction": "north", "low_point": True, "lat": 22.5300, "lon": 88.3950},
        {"point_id": "ELV-0033", "zone": "Topsia", "elevation_m": 3.60, "slope_percent": 0.26, "flow_direction": "north", "low_point": True, "lat": 22.5290, "lon": 88.3940},
        {"point_id": "ELV-0036", "zone": "Topsia", "elevation_m": 3.31, "slope_percent": 0.99, "flow_direction": "west", "low_point": True, "lat": 22.5280, "lon": 88.3920},
        {"point_id": "ELV-0038", "zone": "Topsia", "elevation_m": 3.79, "slope_percent": 0.77, "flow_direction": "east", "low_point": True, "lat": 22.5310, "lon": 88.3960},
        {"point_id": "ELV-0042", "zone": "Dhapa", "elevation_m": 2.94, "slope_percent": 0.88, "flow_direction": "south-west", "low_point": True, "lat": 22.5450, "lon": 88.4150},
        {"point_id": "ELV-0043", "zone": "Dhapa", "elevation_m": 2.93, "slope_percent": 1.00, "flow_direction": "south-west", "low_point": True, "lat": 22.5440, "lon": 88.4140},
        {"point_id": "ELV-0049", "zone": "Dhapa", "elevation_m": 2.80, "slope_percent": 0.10, "flow_direction": "south-west", "low_point": True, "lat": 22.5420, "lon": 88.4120},
    ]

    KOLKATA_DRAINS: List[Dict[str, Any]] = [
        {"drain_id": "KMC-D-001", "zone": "Ballygunge", "drain_type": "storm_drain", "capacity_m3_s": 2.68, "load_pct": 83, "blockage_pct": 12, "status": "warning"},
        {"drain_id": "KMC-D-004", "zone": "Park Circus", "drain_type": "combined_sewer", "capacity_m3_s": 3.17, "load_pct": 47, "blockage_pct": 13, "status": "normal"},
        {"drain_id": "KMC-D-007", "zone": "Tiljala", "drain_type": "combined_sewer", "capacity_m3_s": 2.29, "load_pct": 42, "blockage_pct": 35, "status": "critical"},
        {"drain_id": "KMC-D-009", "zone": "Tiljala", "drain_type": "egg_shaped_brick_sewer", "capacity_m3_s": 1.58, "load_pct": 97, "blockage_pct": 32, "status": "critical"},
        {"drain_id": "KMC-D-010", "zone": "Topsia", "drain_type": "egg_shaped_brick_sewer", "capacity_m3_s": 2.90, "load_pct": 95, "blockage_pct": 16, "status": "critical"},
        {"drain_id": "KMC-D-012", "zone": "Topsia", "drain_type": "combined_sewer", "capacity_m3_s": 2.92, "load_pct": 96, "blockage_pct": 29, "status": "critical"},
        {"drain_id": "KMC-D-013", "zone": "Dhapa", "drain_type": "storm_drain", "capacity_m3_s": 2.50, "load_pct": 67, "blockage_pct": 25, "status": "warning"},
    ]

    KOLKATA_ROADS_TRAINING: Dict[str, Dict[str, Any]] = {
        "Ballygunge": {"avg_drain_load_pct": 74.0, "avg_drain_blockage_pct": 8.7, "avg_drain_capacity_m3s": 2.32, "historical_risk": "low", "zone_flood_score": 0.429},
        "Park Circus": {"avg_drain_load_pct": 50.7, "avg_drain_blockage_pct": 12.0, "avg_drain_capacity_m3s": 2.38, "historical_risk": "medium", "zone_flood_score": 0.492},
        "Tiljala": {"avg_drain_load_pct": 62.0, "avg_drain_blockage_pct": 28.0, "avg_drain_capacity_m3s": 1.60, "historical_risk": "high", "zone_flood_score": 0.671},
        "Topsia": {"avg_drain_load_pct": 76.7, "avg_drain_blockage_pct": 20.0, "avg_drain_capacity_m3s": 2.56, "historical_risk": "high", "zone_flood_score": 0.554},
        "Dhapa": {"avg_drain_load_pct": 57.0, "avg_drain_blockage_pct": 10.3, "avg_drain_capacity_m3s": 2.59, "historical_risk": "high", "zone_flood_score": 0.508},
    }

    KOLKATA_CITIZEN_REPORTS: List[Dict[str, Any]] = [
        {"report_id": "CR-0001", "location": "Sarat Bose Road", "zone": "Ballygunge", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0003", "location": "Ballygunge Circular Road", "zone": "Ballygunge", "depth_category": "Knee-deep", "verification_status": "verified"},
        {"report_id": "CR-0010", "location": "Park Circus 7-Point Crossing", "zone": "Park Circus", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0012", "location": "Baghajatin Road (Tiljala)", "zone": "Tiljala", "depth_category": "Drain overflow", "verification_status": "verified"},
        {"report_id": "CR-0014", "location": "Kayasthapara Road", "zone": "Tiljala", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0016", "location": "Topsia Depot Road", "zone": "Topsia", "depth_category": "Knee-deep", "verification_status": "verified"},
        {"report_id": "CR-0018", "location": "EM Bypass Service Road (Topsia)", "zone": "Topsia", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0021", "location": "Dhapa Road", "zone": "Dhapa", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0023", "location": "Kheadaha Road", "zone": "Dhapa", "depth_category": "Drain overflow", "verification_status": "verified"},
    ]

    KOLKATA_FACILITIES: List[Dict[str, Any]] = [
        {"facility_id": "FAC-009", "name": "Park Circus Junction", "type": "junction", "zone": "Park Circus", "lat": 22.54835, "lon": 88.34642, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-010", "name": "Dhapa Lock Gate", "type": "flap_gate_outfall", "zone": "Dhapa", "lat": 22.54919, "lon": 88.40806, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-011", "name": "Topsia Bus Depot", "type": "bus_terminal", "zone": "Topsia", "lat": 22.52952, "lon": 88.36060, "priority": "high", "accessible": True},
        {"facility_id": "FAC-012", "name": "Ballygunge Electrical Substation", "type": "substation", "zone": "Ballygunge", "lat": 22.52832, "lon": 88.38470, "priority": "critical", "accessible": True},
    ]

    # ------------------------------------------------------------------
    # 2. HOWRAH DATASET REGISTRY
    # ------------------------------------------------------------------
    HOWRAH_ZONES: Dict[str, Dict[str, Any]] = {
        "Shibpur": {"zone_id": "HOW-Z-01", "ward_ids": "W-011,W-012", "avg_elevation_m": 5.8, "authority": "Howrah Municipal Corporation", "area_sq_km": 2.67},
        "Ramrajatala": {"zone_id": "HOW-Z-02", "ward_ids": "W-012,W-013", "avg_elevation_m": 4.6, "authority": "Howrah Municipal Corporation", "area_sq_km": 1.26},
        "Salkia": {"zone_id": "HOW-Z-03", "ward_ids": "W-013,W-014", "avg_elevation_m": 5.1, "authority": "Howrah Municipal Corporation", "area_sq_km": 1.83},
        "Bamangachi": {"zone_id": "HOW-Z-04", "ward_ids": "W-014,W-015", "avg_elevation_m": 4.9, "authority": "Howrah Municipal Corporation", "area_sq_km": 1.71},
        "Howrah Station": {"zone_id": "HOW-Z-05", "ward_ids": "W-015,W-016", "avg_elevation_m": 4.3, "authority": "Howrah Municipal Corporation", "area_sq_km": 2.89},
    }

    HOWRAH_ELEVATION_POINTS: List[Dict[str, Any]] = [
        {"point_id": "ELV-0008", "zone": "Shibpur", "elevation_m": 5.45, "slope_percent": 1.28, "flow_direction": "south-west", "low_point": True, "lat": 22.5650, "lon": 88.3190},
        {"point_id": "ELV-0016", "zone": "Ramrajatala", "elevation_m": 4.27, "slope_percent": 0.69, "flow_direction": "south-west", "low_point": True, "lat": 22.5850, "lon": 88.3390},
        {"point_id": "ELV-0017", "zone": "Ramrajatala", "elevation_m": 3.98, "slope_percent": 0.74, "flow_direction": "south-west", "low_point": True, "lat": 22.5840, "lon": 88.3380},
        {"point_id": "ELV-0018", "zone": "Ramrajatala", "elevation_m": 3.86, "slope_percent": 0.17, "flow_direction": "south-east", "low_point": True, "lat": 22.5830, "lon": 88.3370},
        {"point_id": "ELV-0021", "zone": "Salkia", "elevation_m": 4.74, "slope_percent": 1.22, "flow_direction": "west", "low_point": True, "lat": 22.6020, "lon": 88.3540},
        {"point_id": "ELV-0022", "zone": "Salkia", "elevation_m": 3.97, "slope_percent": 0.41, "flow_direction": "south", "low_point": True, "lat": 22.6010, "lon": 88.3530},
        {"point_id": "ELV-0026", "zone": "Salkia", "elevation_m": 4.56, "slope_percent": 1.00, "flow_direction": "east", "low_point": True, "lat": 22.6030, "lon": 88.3550},
        {"point_id": "ELV-0037", "zone": "Bamangachi", "elevation_m": 4.45, "slope_percent": 1.18, "flow_direction": "south", "low_point": True, "lat": 22.5770, "lon": 88.3250},
        {"point_id": "ELV-0040", "zone": "Bamangachi", "elevation_m": 4.56, "slope_percent": 0.83, "flow_direction": "west", "low_point": True, "lat": 22.5760, "lon": 88.3240},
        {"point_id": "ELV-0041", "zone": "Howrah Station", "elevation_m": 3.51, "slope_percent": 0.61, "flow_direction": "west", "low_point": True, "lat": 22.5900, "lon": 88.3470},
        {"point_id": "ELV-0043", "zone": "Howrah Station", "elevation_m": 3.99, "slope_percent": 0.73, "flow_direction": "east", "low_point": True, "lat": 22.5910, "lon": 88.3480},
        {"point_id": "ELV-0044", "zone": "Howrah Station", "elevation_m": 3.66, "slope_percent": 0.66, "flow_direction": "south-east", "low_point": True, "lat": 22.5920, "lon": 88.3490},
        {"point_id": "ELV-0047", "zone": "Howrah Station", "elevation_m": 3.91, "slope_percent": 0.62, "flow_direction": "south", "low_point": True, "lat": 22.5890, "lon": 88.3460},
    ]

    HOWRAH_HISTORICAL_EVENTS: List[Dict[str, Any]] = [
        {"event_id": "FH-001", "location": "GT Road (Shibpur)", "zone": "Shibpur", "water_depth_cm": 38, "duration_min": 74, "rainfall_mm": 82, "road_status": "impassable", "cause": "drain blockage", "drain_blocked": True, "pumping_used": True},
        {"event_id": "FH-003", "location": "Kazipara Road", "zone": "Shibpur", "water_depth_cm": 33, "duration_min": 128, "rainfall_mm": 64, "road_status": "impassable", "cause": "drain blockage", "drain_blocked": True, "pumping_used": False},
        {"event_id": "FH-005", "location": "Domjur Road", "zone": "Ramrajatala", "water_depth_cm": 37, "duration_min": 110, "rainfall_mm": 72, "road_status": "impassable", "cause": "high tide backflow", "drain_blocked": True, "pumping_used": True},
        {"event_id": "FH-009", "location": "Nawabganj Road", "zone": "Salkia", "water_depth_cm": 40, "duration_min": 126, "rainfall_mm": 91, "road_status": "impassable", "cause": "drain blockage + heavy rainfall", "drain_blocked": False, "pumping_used": True},
        {"event_id": "FH-010", "location": "Salkia School Road", "zone": "Salkia", "water_depth_cm": 35, "duration_min": 92, "rainfall_mm": 89, "road_status": "impassable", "cause": "high tide backflow", "drain_blocked": False, "pumping_used": False},
        {"event_id": "FH-012", "location": "Salkia Main Road", "zone": "Salkia", "water_depth_cm": 39, "duration_min": 87, "rainfall_mm": 76, "road_status": "impassable", "cause": "high tide backflow", "drain_blocked": True, "pumping_used": False},
        {"event_id": "FH-014", "location": "Kalitala Road", "zone": "Bamangachi", "water_depth_cm": 34, "duration_min": 69, "rainfall_mm": 79, "road_status": "impassable", "cause": "drain blockage", "drain_blocked": True, "pumping_used": False},
        {"event_id": "FH-015", "location": "Bamangachi Station Road", "zone": "Bamangachi", "water_depth_cm": 38, "duration_min": 127, "rainfall_mm": 82, "road_status": "impassable", "cause": "heavy rainfall", "drain_blocked": False, "pumping_used": False},
        {"event_id": "FH-018", "location": "Howrah Bridge Approach", "zone": "Howrah Station", "water_depth_cm": 27, "duration_min": 91, "rainfall_mm": 71, "road_status": "difficult", "cause": "heavy rainfall", "drain_blocked": True, "pumping_used": False},
    ]

    HOWRAH_ROADS_TRAINING: Dict[str, Dict[str, Any]] = {
        "Shibpur": {"avg_drain_load_pct": 42.7, "avg_drain_blockage_pct": 24.0, "avg_drain_capacity_m3s": 1.97, "historical_risk": "high", "zone_flood_score": 0.496},
        "Ramrajatala": {"avg_drain_load_pct": 57.0, "avg_drain_blockage_pct": 21.0, "avg_drain_capacity_m3s": 1.36, "historical_risk": "high", "zone_flood_score": 0.471},
        "Salkia": {"avg_drain_load_pct": 60.3, "avg_drain_blockage_pct": 30.0, "avg_drain_capacity_m3s": 1.15, "historical_risk": "high", "zone_flood_score": 0.562},
        "Bamangachi": {"avg_drain_load_pct": 43.7, "avg_drain_blockage_pct": 17.3, "avg_drain_capacity_m3s": 1.70, "historical_risk": "medium", "zone_flood_score": 0.508},
        "Howrah Station": {"avg_drain_load_pct": 59.3, "avg_drain_blockage_pct": 20.7, "avg_drain_capacity_m3s": 1.82, "historical_risk": "medium", "zone_flood_score": 0.375},
    }

    HOWRAH_CITIZEN_REPORTS: List[Dict[str, Any]] = [
        {"report_id": "CR-0001", "location": "Kazipara Road", "zone": "Shibpur", "depth_category": "Road impassable", "verification_status": "verified"},
        {"report_id": "CR-0007", "location": "Netaji Subhas Road", "zone": "Ramrajatala", "depth_category": "Road impassable", "verification_status": "verified"},
        {"report_id": "CR-0008", "location": "Andul Road (Ramrajatala)", "zone": "Ramrajatala", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0012", "location": "Salkia School Road", "zone": "Salkia", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0016", "location": "Kalitala Road", "zone": "Bamangachi", "depth_category": "Vehicle movement difficult", "verification_status": "verified"},
        {"report_id": "CR-0017", "location": "Bamangachi Bazar Lane", "zone": "Bamangachi", "depth_category": "Vehicle movement difficult", "verification_status": "verified"},
        {"report_id": "CR-0018", "location": "Bamangachi Main Road", "zone": "Bamangachi", "depth_category": "No water", "verification_status": "verified"},
        {"report_id": "CR-0021", "location": "Subway Connector Road", "zone": "Howrah Station", "depth_category": "Drain overflow", "verification_status": "verified"},
        {"report_id": "CR-0022", "location": "Subway Connector Road", "zone": "Howrah Station", "depth_category": "Ankle-deep", "verification_status": "verified"},
        {"report_id": "CR-0023", "location": "Subway Connector Road", "zone": "Howrah Station", "depth_category": "Vehicle movement difficult", "verification_status": "verified"},
        {"report_id": "CR-0025", "location": "Howrah Bridge Approach", "zone": "Howrah Station", "depth_category": "Vehicle movement difficult", "verification_status": "verified"},
    ]

    HOWRAH_FACILITIES: List[Dict[str, Any]] = [
        {"facility_id": "FAC-001", "name": "Howrah Station", "type": "railway_station", "zone": "Howrah Station", "lat": 22.59013, "lon": 88.34789, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-002", "name": "Howrah Station Subway", "type": "subway", "zone": "Howrah Station", "lat": 22.59345, "lon": 88.35043, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-003", "name": "Shibpur General Hospital", "type": "hospital", "zone": "Shibpur", "lat": 22.60517, "lon": 88.35884, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-004", "name": "Salkia Fire Station", "type": "fire_station", "zone": "Salkia", "lat": 22.58205, "lon": 88.35442, "priority": "high", "accessible": True},
        {"facility_id": "FAC-005", "name": "Ramrajatala Police Station", "type": "police_station", "zone": "Ramrajatala", "lat": 22.58551, "lon": 88.33978, "priority": "high", "accessible": True},
        {"facility_id": "FAC-006", "name": "Bamangachi Community Shelter", "type": "shelter", "zone": "Bamangachi", "lat": 22.55504, "lon": 88.32572, "priority": "medium", "accessible": True},
        {"facility_id": "FAC-007", "name": "Salkia Primary School", "type": "school", "zone": "Salkia", "lat": 22.60201, "lon": 88.31090, "priority": "medium", "accessible": True},
        {"facility_id": "FAC-008", "name": "Shibpur Ambulance Point", "type": "ambulance_point", "zone": "Shibpur", "lat": 22.56561, "lon": 88.31964, "priority": "high", "accessible": True},
        {"facility_id": "FAC-009", "name": "Bamangachi Pumping Station", "type": "pumping_station", "zone": "Bamangachi", "lat": 22.57728, "lon": 88.32025, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-010", "name": "Howrah Bus Terminal", "type": "bus_terminal", "zone": "Howrah Station", "lat": 22.60278, "lon": 88.31670, "priority": "high", "accessible": True},
        {"facility_id": "FAC-011", "name": "Ramrajatala Electrical Substation", "type": "substation", "zone": "Ramrajatala", "lat": 22.60707, "lon": 88.32529, "priority": "critical", "accessible": True},
        {"facility_id": "FAC-012", "name": "Salkia Ghat Bridge", "type": "bridge", "zone": "Salkia", "lat": 22.60009, "lon": 88.32822, "priority": "medium", "accessible": True},
    ]

    # ------------------------------------------------------------------
    # 3. BARASAT DATASET REGISTRY
    # ------------------------------------------------------------------
    BARASAT_ZONES: Dict[str, Dict[str, Any]] = {
        "Barasat": {"zone_id": "BAR-Z-01", "ward_ids": "W-001,W-004", "avg_elevation_m": 4.1, "authority": "Barasat Municipality", "area_sq_km": 4.50},
    }

    BARASAT_ELEVATION_POINTS: List[Dict[str, Any]] = [
        {"point_id": "ELV-BAR-01", "zone": "Barasat", "elevation_m": 2.80, "slope_percent": 0.12, "flow_direction": "east", "low_point": True, "lat": 22.7275, "lon": 88.4895},
        {"point_id": "ELV-BAR-02", "zone": "Barasat", "elevation_m": 3.10, "slope_percent": 0.18, "flow_direction": "east", "low_point": True, "lat": 22.7090, "lon": 88.4910},
        {"point_id": "ELV-BAR-03", "zone": "Barasat", "elevation_m": 4.20, "slope_percent": 0.85, "flow_direction": "south", "low_point": False, "lat": 22.7214, "lon": 88.4821},
        {"point_id": "ELV-BAR-04", "zone": "Barasat", "elevation_m": 3.90, "slope_percent": 0.45, "flow_direction": "south", "low_point": True, "lat": 22.7180, "lon": 88.4845},
    ]

    BARASAT_ROADS_TRAINING: Dict[str, Dict[str, Any]] = {
        "Barasat": {"avg_drain_load_pct": 82.0, "avg_drain_blockage_pct": 35.0, "avg_drain_capacity_m3s": 1.20, "historical_risk": "high", "zone_flood_score": 0.880},
    }

    BARASAT_HISTORICAL_EVENTS: List[Dict[str, Any]] = [
        {"event_id": "FH-BAR-01", "location": "Barasat Sethpukur Lowland", "zone": "Barasat", "water_depth_cm": 55, "duration_min": 180, "rainfall_mm": 95, "road_status": "impassable", "cause": "extreme lowland accumulation", "drain_blocked": True, "pumping_used": True},
        {"event_id": "FH-BAR-02", "location": "Barasat Nabapally Lowland", "zone": "Barasat", "water_depth_cm": 52, "duration_min": 160, "rainfall_mm": 90, "road_status": "impassable", "cause": "lowland depression", "drain_blocked": True, "pumping_used": True},
    ]

    # ------------------------------------------------------------------
    # 4. SPATIAL CITY & ZONE LOOKUP UTILITIES
    # ------------------------------------------------------------------
    @classmethod
    def get_city_domain(cls, lat: float, lon: float, location_name: str = "") -> Optional[str]:
        """Detects whether coordinates/name fall into Kolkata, Howrah, or an Unsupported City."""
        name_upper = (location_name or "").upper()

        # Check explicit zone names in location string
        for k_zone in cls.KOLKATA_ZONES:
            if k_zone.upper() in name_upper:
                return "KOLKATA"
        if "KOLKATA" in name_upper:
            return "KOLKATA"

        for h_zone in cls.HOWRAH_ZONES:
            if h_zone.upper() in name_upper:
                return "HOWRAH"
        if "HOWRAH" in name_upper:
            return "HOWRAH"

        if "BARASAT" in name_upper or "CHAMPADALI" in name_upper or "KACHHARI" in name_upper or "NABAPALLY" in name_upper:
            return "BARASAT"

        if "CHENNAI" in name_upper or "VELACHERY" in name_upper or "ADYAR" in name_upper or "TAMBARAM" in name_upper or "ANNA NAGAR" in name_upper:
            return "CHENNAI"

        if "DELHI" in name_upper or "ROHINI" in name_upper or "DWARKA" in name_upper or "LAJPAT NAGAR" in name_upper or "MAYUR VIHAR" in name_upper:
            return "DELHI"

        if "MUMBAI" in name_upper or "ANDHERI" in name_upper or "KURLA" in name_upper or "BANDRA" in name_upper or "DADAR" in name_upper:
            return "MUMBAI"

        # Bounding box checks
        # Howrah Bounding Box: Lat 22.50 to 22.65, Lon 88.25 to 88.355
        if 22.50 <= lat <= 22.65 and 88.25 <= lon < 88.355:
            return "HOWRAH"

        # Kolkata Bounding Box: Lat 22.45 to 22.65, Lon 88.355 to 88.48
        if 22.45 <= lat <= 22.65 and 88.355 <= lon <= 88.48:
            return "KOLKATA"

        # Barasat Bounding Box: Lat 22.65 to 22.80, Lon 88.40 to 88.55
        if 22.65 <= lat <= 22.80 and 88.40 <= lon <= 88.55:
            return "BARASAT"

        # Chennai Bounding Box: Lat 12.80 to 13.25, Lon 79.90 to 80.35
        if 12.80 <= lat <= 13.25 and 79.90 <= lon <= 80.35:
            return "CHENNAI"

        # Delhi Bounding Box: Lat 28.40 to 28.90, Lon 76.85 to 77.40
        if 28.40 <= lat <= 28.90 and 76.85 <= lon <= 77.40:
            return "DELHI"

        # Mumbai Bounding Box: Lat 18.89 to 19.30, Lon 72.75 to 73.00
        if 18.89 <= lat <= 19.30 and 72.75 <= lon <= 73.00:
            return "MUMBAI"

        # Unsupported city (e.g. Bengaluru)
        return None

    @classmethod
    def get_matched_zone_name(cls, city: str, lat: float, lon: float, location_name: str = "") -> Optional[str]:
        """Finds the nearest zone name for a supported city domain."""
        name_upper = (location_name or "").upper()

        if city == "BARASAT":
            return "Barasat"

        if city == "CHENNAI":
            for z in ["Velachery", "Adyar", "Tambaram", "Anna Nagar", "Perambur"]:
                if z.upper() in name_upper:
                    return z
            return location_name if location_name != "Target Location" else "Chennai Region"

        if city == "DELHI":
            for z in ["Rohini", "Dwarka", "Lajpat Nagar", "Mayur Vihar", "Saket", "Model Town"]:
                if z.upper() in name_upper:
                    return z
            return location_name if location_name != "Target Location" else "Delhi Region"

        if city == "MUMBAI":
            for z in ["Andheri", "Kurla", "Bandra", "Dadar", "Colaba", "Sion"]:
                if z.upper() in name_upper:
                    return z
            return location_name if location_name != "Target Location" else "Mumbai Region"

        if city == "KOLKATA":
            for z in cls.KOLKATA_ZONES:
                if z.upper() in name_upper:
                    return z
            # Fallback based on longitude/latitude distance
            if lon > 88.40:
                return "Dhapa"
            elif lon > 88.38:
                return "Topsia"
            elif lon > 88.37:
                return "Tiljala"
            elif lat > 22.54:
                return "Park Circus"
            else:
                return "Ballygunge"

        elif city == "HOWRAH":
            for z in cls.HOWRAH_ZONES:
                if z.upper() in name_upper:
                    return z
            if lat > 22.59:
                return "Salkia"
            elif lat > 22.58:
                return "Ramrajatala"
            elif lon > 88.34:
                return "Howrah Station"
            elif lat > 22.57:
                return "Bamangachi"
            else:
                return "Shibpur"

        return None

    @classmethod
    def get_terrain_factor(cls, city: Optional[str], lat: float, lon: float, zone_name: Optional[str]) -> Tuple[float, float, float, bool]:
        """Calculates normalized terrain depression score based on actual dataset elevation & slope.
        Returns: (elevation_m, slope_pct, lowland_depression_score, low_point_flag)
        """
        if not city:
            # Fallback for unsupported cities (generic calculation)
            return (6.0, 1.5, 0.3, False)

        if city == "KOLKATA":
            points = cls.KOLKATA_ELEVATION_POINTS
            zones = cls.KOLKATA_ZONES
        elif city == "HOWRAH":
            points = cls.HOWRAH_ELEVATION_POINTS
            zones = cls.HOWRAH_ZONES
        elif city == "BARASAT":
            points = cls.BARASAT_ELEVATION_POINTS
            zones = cls.BARASAT_ZONES
        else:
            points = []
            zones = {}

        # Find nearest elevation point in dataset
        best_pt = None
        min_dist = float("inf")

        for pt in points:
            if zone_name and pt["zone"] != zone_name:
                continue
            d = math.sqrt((pt["lat"] - lat) ** 2 + (pt["lon"] - lon) ** 2)
            if d < min_dist:
                min_dist = d
                best_pt = pt

        if not best_pt and points:
            # Fallback across all city points
            for pt in points:
                d = math.sqrt((pt["lat"] - lat) ** 2 + (pt["lon"] - lon) ** 2)
                if d < min_dist:
                    min_dist = d
                    best_pt = pt

        if best_pt:
            elev = best_pt["elevation_m"]
            slope = best_pt["slope_percent"]
            is_low = best_pt["low_point"]
        else:
            z_meta = zones.get(zone_name or "", {})
            elev = z_meta.get("avg_elevation_m", 5.0)
            slope = 1.0
            is_low = False

        # Lowland depression score formula: lower elevation & lower slope -> higher water accumulation score
        depression_score = min(1.0, max(0.05, (7.0 - elev) / 4.0))
        if is_low:
            depression_score = min(1.0, depression_score + 0.15)

        return (elev, slope, round(depression_score, 3), is_low)

    @classmethod
    def get_drainage_factor(cls, city: Optional[str], zone_name: Optional[str]) -> Tuple[float, float, float, float]:
        """Calculates normalized drainage stress score based on dataset capacity, load %, and blockage %.
        Returns: (avg_capacity_m3s, avg_load_pct, avg_blockage_pct, drainage_stress_score)
        """
        if not city:
            return (2.0, 50.0, 15.0, 0.25)

        if city == "KOLKATA":
            roads_meta = cls.KOLKATA_ROADS_TRAINING
        elif city == "HOWRAH":
            roads_meta = cls.HOWRAH_ROADS_TRAINING
        elif city == "BARASAT":
            roads_meta = cls.BARASAT_ROADS_TRAINING
        else:
            roads_meta = {}

        z_data = roads_meta.get(zone_name or "", {})

        if z_data:
            cap = z_data.get("avg_drain_capacity_m3s", 2.0)
            load = z_data.get("avg_drain_load_pct", 50.0)
            block = z_data.get("avg_drain_blockage_pct", 15.0)
        else:
            cap, load, block = 2.0, 50.0, 15.0

        # Drainage stress score formula: Higher load % and higher blockage % increase stress score
        stress_score = min(1.0, max(0.1, (load * 0.5 + block * 1.5) / 100.0))
        return (cap, load, block, round(stress_score, 3))

    @classmethod
    def get_historical_susceptibility(cls, city: Optional[str], zone_name: Optional[str]) -> Tuple[float, int, str]:
        """Calculates normalized historical susceptibility score from dataset event records.
        Returns: (historical_score, event_count, depth_range_str)
        """
        if not city:
            return (0.15, 0, "NOT AVAILABLE FOR THIS AREA")

        if city == "HOWRAH":
            events = [e for e in cls.HOWRAH_HISTORICAL_EVENTS if not zone_name or e["zone"] == zone_name]
            count = len(events)
            if count > 0:
                avg_depth = sum(e["water_depth_cm"] for e in events) / count
                hist_score = min(1.0, round(0.3 + (count * 0.1) + (avg_depth / 100.0), 3))
                depth_range = f"Historical avg {int(avg_depth)} cm across {count} recorded events"
            else:
                hist_score = 0.45
                depth_range = "Historical frequency: Moderate (2-3 events/yr)"
        elif city == "BARASAT":
            events = [e for e in cls.BARASAT_HISTORICAL_EVENTS if not zone_name or e["zone"] == zone_name]
            count = len(events)
            if count > 0:
                avg_depth = sum(e["water_depth_cm"] for e in events) / count
                hist_score = min(1.0, round(0.4 + (count * 0.1) + (avg_depth / 100.0), 3))
                depth_range = f"Historical avg {int(avg_depth)} cm across {count} recorded events"
            else:
                hist_score = 0.85
                depth_range = "Historical risk level: HIGH (Barasat Lowlands)"
        else:  # KOLKATA
            z_road = cls.KOLKATA_ROADS_TRAINING.get(zone_name or "", {})
            hist_score = z_road.get("zone_flood_score", 0.45)
            risk_level = z_road.get("historical_risk", "medium")
            count = 5 if risk_level == "high" else (3 if risk_level == "medium" else 1)
            depth_range = f"Historical risk level: {risk_level.upper()} ({count} historical flood events/yr)"

        return (hist_score, count, depth_range)

    @classmethod
    def get_citizen_verification_bonus(cls, city: Optional[str], zone_name: Optional[str]) -> float:
        """Calculates citizen report verification confidence bonus for active location."""
        if not city:
            return 0.0

        reports = cls.KOLKATA_CITIZEN_REPORTS if city == "KOLKATA" else cls.HOWRAH_CITIZEN_REPORTS
        verified_count = sum(1 for r in reports if (not zone_name or r["zone"] == zone_name) and r["verification_status"] == "verified")

        if verified_count >= 3:
            return 0.10
        elif verified_count >= 1:
            return 0.05
        return 0.0

    @classmethod
    def get_city_drains(cls, city: str) -> List[Dict[str, Any]]:
        """Loads structured drainage dataset for a specified city domain."""
        import os
        import pandas as pd

        city_upper = (city or "").upper()
        if city_upper == "KOLKATA":
            return cls.KOLKATA_DRAINS

        # File mapping for CSV-based city datasets
        file_map = {
            "CHENNAI": "drains_chennai.csv",
            "DELHI": "drains_delhi.csv",
            "MUMBAI": "drains_mumbai.csv"
        }

        filename = file_map.get(city_upper)
        if not filename:
            # Return empty list if city has no explicit dataset
            return []

        base_dirs = [
            os.path.join(os.path.dirname(__file__), "..", "data"),
            os.path.join(os.path.dirname(__file__), "..", "..", "data"),
            r"C:\Users\sourav\antigravity\JALDRISHTI---Urban-Flood-Digital-Twin\api\app\data",
            r"C:\Users\sourav\antigravity\JALDRISHTI---Urban-Flood-Digital-Twin\backend\app\data"
        ]

        for bdir in base_dirs:
            filepath = os.path.join(bdir, filename)
            if os.path.exists(filepath):
                try:
                    df = pd.read_csv(filepath)
                    return df.to_dict("records")
                except Exception:
                    pass

        return []

