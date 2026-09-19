"""OSRM Multimodal Real-Time Routing Engine & Segment-by-Segment Flood Risk Service.

Queries OpenStreetMap Deutschland Multimodal OSRM Servers (routed-car, routed-bike, routed-foot)
for authentic, independent road/path geometries across any Pan-India coordinates.
Evaluates segment-by-segment water depth over complete route geometries,
vehicle clearance compatibility, extracts spatially anchored flood accumulation points,
and computes flood-aware route rankings concurrently.
"""

from typing import List, Dict, Any, Optional
import httpx
import math
import asyncio
import time

from app.services.prediction_service import FloodPredictionService

# Short-lived TTL cache (60s TTL) for route calculations & geocoding
_ROUTE_CACHE: Dict[str, tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 60.0


class RoutingService:
    # Dedicated Multimodal OpenStreetMap OSRM Server Endpoints
    OSRM_ENDPOINTS = {
        "CAR": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "AMBULANCE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "FIRE_ENGINE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "POLICE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "BUS": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "MOTORBIKE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "MOTORCYCLE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "BIKE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "BICYCLE": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "CYCLIST": "https://routing.openstreetmap.de/routed-car/route/v1/driving",
        "WALK": "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
        "PEDESTRIAN": "https://routing.openstreetmap.de/routed-foot/route/v1/foot",
    }

    # Vehicle clearance thresholds (in cm)
    VEHICLE_CLEARANCE_LIMITS = {
        "WALK": 10.0,
        "PEDESTRIAN": 10.0,
        "BIKE": 12.0,
        "BICYCLE": 12.0,
        "CYCLIST": 12.0,
        "MOTORBIKE": 12.0,
        "MOTORCYCLE": 12.0,
        "CAR": 15.0,
        "POLICE": 15.0,
        "BUS": 25.0,
        "AMBULANCE": 35.0,
        "FIRE_ENGINE": 50.0,
    }

    @classmethod
    async def evaluate_routes(
        cls,
        origin_lat: float,
        origin_lon: float,
        dest_lat: float,
        dest_lon: float,
        origin_name: str = "Origin",
        dest_name: str = "Destination",
        vehicle_type: str = "CAR",
        horizon_offset_hours: int = 0,
    ) -> Dict[str, Any]:
        """Calculates authentic Pan-India candidate routes and evaluates flood risk segment by segment concurrently."""
        
        v_upper = vehicle_type.upper()
        cache_key = f"{round(origin_lat, 5)}_{round(origin_lon, 5)}_{round(dest_lat, 5)}_{round(dest_lon, 5)}_{v_upper}_{horizon_offset_hours}"
        now = time.time()

        # Check short-lived TTL cache
        if cache_key in _ROUTE_CACHE:
            ts, cached_res = _ROUTE_CACHE[cache_key]
            if now - ts < CACHE_TTL_SECONDS:
                return cached_res

        clearance_limit = cls.VEHICLE_CLEARANCE_LIMITS.get(v_upper, 15.0)

        # 1. Fetch 100% genuine multimodal OSRM road network routes
        raw_routes = await cls._fetch_osrm_routes(origin_lat, origin_lon, dest_lat, dest_lon, v_upper)

        if not raw_routes:
            empty_res = {
                "status": "NO_SAFE_ROUTE",
                "origin": {"latitude": origin_lat, "longitude": origin_lon, "name": origin_name},
                "destination": {"latitude": dest_lat, "longitude": dest_lon, "name": dest_name},
                "travel_mode": vehicle_type,
                "vehicle_type": vehicle_type,
                "horizon_offset_hours": horizon_offset_hours,
                "vehicle_clearance_limit_cm": clearance_limit,
                "routes_evaluated_count": 0,
                "candidate_routes": [],
                "routes": [],
                "recommended_route_id": None,
                "message": f"No routes available for {v_upper} at T+{horizon_offset_hours}h.",
            }
            return empty_res

        # Filter out raw routes with implausible distances (> 3,500 km)
        valid_raw_routes = []
        for r_item in raw_routes:
            dist_m = r_item.get("route", {}).get("distance", 0.0)
            if dist_m <= 3_500_000.0:  # Max 3,500 km for valid road routing
                valid_raw_routes.append(r_item)

        if not valid_raw_routes:
            return {
                "status": "DATA_INVALID",
                "origin": {"latitude": origin_lat, "longitude": origin_lon, "name": origin_name},
                "destination": {"latitude": dest_lat, "longitude": dest_lon, "name": dest_name},
                "travel_mode": vehicle_type,
                "vehicle_type": vehicle_type,
                "horizon_offset_hours": horizon_offset_hours,
                "vehicle_clearance_limit_cm": clearance_limit,
                "routes_evaluated_count": 0,
                "candidate_routes": [],
                "routes": [],
                "recommended_route_id": None,
                "message": "Routing returned an implausible route across continents. Please retry search with a valid location.",
            }

        # 2. Fetch spatial flood prediction data from FloodPredictionService along complete primary route geometry
        primary_geometry = valid_raw_routes[0].get("route", {}).get("geometry", {}).get("coordinates", [])
        if primary_geometry:
            spatial_prediction_points, weather_data_state = await FloodPredictionService.get_spatial_prediction_points_for_route(
                primary_geometry, origin_lat, origin_lon, dest_lat, dest_lon, horizon_offset_hours=horizon_offset_hours
            )
        else:
            waypoints = [(origin_lat, origin_lon), (dest_lat, dest_lon)]
            spatial_prediction_points, weather_data_state = await FloodPredictionService.get_spatial_prediction_points_for_area(waypoints)

        # 3. Evaluate all candidate routes concurrently using asyncio against spatial prediction data
        tasks = [
            cls._evaluate_single_route(
                idx, route_data, origin_name, dest_name, origin_lat, origin_lon, dest_lat, dest_lon, v_upper, clearance_limit, spatial_prediction_points, weather_data_state
            )
            for idx, route_data in enumerate(valid_raw_routes)
        ]
        evaluated_routes = await asyncio.gather(*tasks)

        # 4. Multi-factor composite ranking for best route recommendation (SAFE + SHORT + PRACTICAL)
        MAX_PRACTICAL_DETOUR_RATIO = 0.22  # Strict 22% detour limit for safe routes (prefer shortest within 20-25%)

        TIME_WEIGHT_BY_MODE = {
            "WALK": 1.0,
            "PEDESTRIAN": 1.0,
            "BIKE": 1.0,
            "BICYCLE": 1.0,
            "CYCLIST": 1.0,
            "MOTORBIKE": 1.0,
            "MOTORCYCLE": 1.0,
            "CAR": 1.0,
            "POLICE": 1.0,
            "BUS": 1.0,
            "AMBULANCE": 0.8,
            "FIRE_ENGINE": 0.8,
        }

        DISTANCE_WEIGHT_BY_MODE = {
            "WALK": 10.0,
            "PEDESTRIAN": 10.0,
            "BIKE": 8.0,
            "BICYCLE": 8.0,
            "CYCLIST": 8.0,
            "MOTORBIKE": 5.0,
            "MOTORCYCLE": 5.0,
            "CAR": 5.0,
            "POLICE": 5.0,
            "BUS": 4.0,
            "AMBULANCE": 3.0,
            "FIRE_ENGINE": 3.0,
        }

        time_weight = TIME_WEIGHT_BY_MODE.get(v_upper, 1.0)
        dist_weight = DISTANCE_WEIGHT_BY_MODE.get(v_upper, 5.0)

        # Identify baseline shortest distance among genuinely SAFE routes (within clearance limit & no high hazard)
        safe_candidates = [
            r for r in evaluated_routes
            if r.get("is_clearance_safe", True)
            and r.get("closed_segment_count", 0) == 0
            and r.get("high_risk_segment_count", 0) == 0
            and r.get("max_water_depth_cm", 0.0) <= clearance_limit
        ]
        min_safe_dist_km = min(r["distance_km"] for r in safe_candidates) if safe_candidates else (min(r["distance_km"] for r in evaluated_routes) if evaluated_routes else 0.0)

        for r in evaluated_routes:
            depth = r["max_water_depth_cm"]
            dist_km = r["distance_km"]
            time_min = r["travel_time_minutes"]
            high_risk_count = r.get("high_risk_segment_count", 0)
            closed_count = r.get("closed_segment_count", 0)
            is_clearance_safe = r.get("is_clearance_safe", True)
            exposure_score = r.get("flood_exposure_score", 0.0)

            # 1. Hard Block Penalty for CLOSED or Clearance-Violating Routes (PURPLE / IMPASSABLE / EXCEEDS MODE TOLERANCE)
            closed_penalty = 0.0
            if closed_count > 0 or not is_clearance_safe:
                closed_penalty = 5000.0  # Massive HARD BLOCK penalty so unsafe route is eliminated!

            # 2. Strong Hazard Avoidance Penalty for HIGH / CRITICAL Flood Segments (RED / ORANGE)
            high_hazard_penalty = 0.0
            if high_risk_count > 0 or depth > 15.0:
                high_hazard_penalty = (high_risk_count * 300.0) + (depth * 10.0) + (exposure_score * 15.0)

            # 3. Proportional Moderate Flood Exposure Penalty (YELLOW / BLUE: 5.1 - 15.0 cm within clearance)
            moderate_penalty = 0.0
            if 5.0 < depth <= 15.0 and is_clearance_safe:
                moderate_penalty = (depth - 5.0) * 0.2 + (exposure_score * 0.5)

            # 4. Excessive Detour Penalty (> 22% extra distance over shortest safe route)
            extra_dist_ratio = (dist_km - min_safe_dist_km) / max(min_safe_dist_km, 0.1)
            detour_penalty = 0.0
            if is_clearance_safe and closed_count == 0 and high_risk_count == 0:
                if extra_dist_ratio > MAX_PRACTICAL_DETOUR_RATIO:
                    detour_penalty = (extra_dist_ratio - MAX_PRACTICAL_DETOUR_RATIO) * 1000.0
                elif extra_dist_ratio > 0.0:
                    detour_penalty = extra_dist_ratio * 50.0

            # 5. Composite Ranking Score (lower is better)
            r["_rank_score"] = (
                time_min * time_weight
                + dist_km * dist_weight
                + closed_penalty
                + high_hazard_penalty
                + moderate_penalty
                + detour_penalty
            )
            r["routing_score"] = round(r["_rank_score"], 2)

        # Sort candidate routes by _rank_score ascending
        evaluated_routes.sort(key=lambda r: r["_rank_score"])

        # Identify shortest route for factual "Why Recommended?" explanation context
        shortest_route = min(evaluated_routes, key=lambda r: r["distance_km"]) if evaluated_routes else None

        # Update labels & recommendation flag after composite ranking
        for idx, r in enumerate(evaluated_routes):
            high_risk_count = r.get("high_risk_segment_count", 0)
            closed_count = r.get("closed_segment_count", 0)
            is_clearance_safe = r.get("is_clearance_safe", True)
            dest_flooded = r.get("is_destination_flooded", False)
            max_depth = r.get("max_water_depth_cm", 0.0)

            is_rec = (idx == 0)
            r["recommended"] = is_rec
            r["is_recommended"] = is_rec

            if is_rec:
                if closed_count > 0 or not is_clearance_safe:
                    r["recommended_safety_state"] = "INACCESSIBLE_CLOSED"
                    r["label"] = f"CAUTION: FLOOD HAZARD / IMPASSABLE ({v_upper})"
                    r["why_recommended"] = f"MODEL PREDICTION — Route contains predicted flood hazard exceeding clearance limit ({max_depth} cm max depth)."
                elif high_risk_count > 0 or max_depth > 15.0:
                    r["recommended_safety_state"] = "HIGH_RISK_WARNING"
                    r["label"] = f"CAUTION: FLOOD HAZARD AHEAD ({v_upper})"
                    if dest_flooded:
                        r["why_recommended"] = f"MODEL PREDICTION — Destination area is inside a predicted flood zone ({max_depth} cm max depth)."
                    else:
                        r["why_recommended"] = f"MODEL PREDICTION — Route corridor intersects predicted water accumulation ({max_depth} cm max depth)."
                else:
                    r["recommended_safety_state"] = "SAFE"
                    r["label"] = f"RECOMMENDED SAFE ROUTE ({v_upper})"

                    if shortest_route and r["route_id"] == shortest_route["route_id"]:
                        r["why_recommended"] = f"LOW FLOOD EXPOSURE — MODEL PREDICTION | Shortest practical route ({r['distance_km']} km, {r['travel_time_minutes']} min) — CLEAR."
                    else:
                        extra_d = round(r["distance_km"] - shortest_route["distance_km"], 1)
                        if shortest_route and (shortest_route.get("high_risk_segment_count", 0) > 0 or shortest_route.get("max_water_depth_cm", 0) > clearance_limit):
                            r["why_recommended"] = f"SAFE FLOOD DETOUR — MODEL PREDICTION | Bypasses severe flood hazard on shorter corridor (+{extra_d} km, {r['travel_time_minutes']} min)."
                        else:
                            r["why_recommended"] = f"LOW FLOOD EXPOSURE — MODEL PREDICTION | Practical route (+{extra_d} km, {r['travel_time_minutes']} min) — CLEAR."
            else:
                if closed_count > 0 or not is_clearance_safe:
                    r["label"] = f"ALTERNATIVE ROUTE {idx} (FLOOD HAZARD)"
                    r["why_recommended"] = f"MODEL PREDICTION — Intersects predicted hazard ({max_depth} cm max depth)."
                elif high_risk_count > 0 or max_depth > 15.0:
                    r["label"] = f"ALTERNATIVE ROUTE {idx} (FLOOD HAZARD)"
                    r["why_recommended"] = f"MODEL PREDICTION — Intersects predicted hazard ({max_depth} cm max depth)."
                else:
                    r["label"] = f"ALTERNATIVE ROUTE {idx} ({v_upper})"
                    r["why_recommended"] = f"LOW FLOOD EXPOSURE — MODEL PREDICTION | Alternative genuine corridor ({r['distance_km']} km, {r['travel_time_minutes']} min) — CLEAR."

        all_unsafe = all(
            not r.get("is_clearance_safe", True)
            or r.get("closed_segment_count", 0) > 0
            or r.get("max_water_depth_cm", 0.0) > clearance_limit
            for r in evaluated_routes
        )

        overall_status = "NO_SAFE_ROUTE" if all_unsafe else "SUCCESS"
        recommended_id = None if all_unsafe else (evaluated_routes[0]["route_id"] if evaluated_routes else None)
        clearance_global_warning = "No clearance-safe route is currently identified. Please verify conditions directly with emergency authorities." if all_unsafe else None
        msg = (
            f"No route currently satisfies the configured flood accessibility constraints for {v_upper} at T+{horizon_offset_hours}h."
            if all_unsafe
            else "Flood-safe route identified successfully."
        )

        res = {
            "status": overall_status,
            "origin": {"latitude": origin_lat, "longitude": origin_lon, "name": origin_name},
            "destination": {"latitude": dest_lat, "longitude": dest_lon, "name": dest_name},
            "travel_mode": vehicle_type,
            "vehicle_type": vehicle_type,
            "horizon_offset_hours": horizon_offset_hours,
            "vehicle_clearance_limit_cm": clearance_limit,
            "routes_evaluated_count": len(evaluated_routes),
            "candidate_routes": evaluated_routes,
            "routes": evaluated_routes,
            "recommended_route_id": recommended_id,
            "clearance_global_warning": clearance_global_warning,
            "message": msg,
        }

        # Store in cache
        _ROUTE_CACHE[cache_key] = (now, res)
        return res


    @classmethod
    async def _evaluate_single_route(
        cls,
        idx: int,
        route_data: Dict[str, Any],
        origin_name: str,
        dest_name: str,
        o_lat: float,
        o_lon: float,
        d_lat: float,
        d_lon: float,
        v_upper: str,
        clearance_limit: float,
        spatial_prediction_points: List[Dict[str, Any]],
        weather_data_state: str,
    ) -> Dict[str, Any]:
        """Evaluates segments & extracts flood accumulation points for a single candidate route."""
        route_id = f"ROUTE-0{idx+1}"
        corridor_label = route_data.get("label", f"Corridor {idx+1}")
        route = route_data.get("route", {})
        geometry_coords = route.get("geometry", {}).get("coordinates", [])
        raw_distance_m = route.get("distance", 1000.0)
        raw_duration_s = route.get("duration", 600.0)
        distance_km = round(raw_distance_m / 1000.0, 2)

        # Calculate bicycle duration deterministically from actual route distance using configured speed profile
        if v_upper in ("BIKE", "BICYCLE", "CYCLIST"):
            CONFIGURED_BICYCLE_SPEED_KMH = 15.0  # Configured bicycle urban speed (15 km/h)
            duration_min = max(1.0, round((distance_km / CONFIGURED_BICYCLE_SPEED_KMH) * 60.0, 1))
            raw_duration_s = round(duration_min * 60.0, 1)
        else:
            duration_min = max(1.0, round(raw_duration_s / 60.0, 1))

        # Extract OSRM turn-by-turn steps if available
        steps = cls._format_osrm_steps(route)

        # Segment-by-segment flood risk evaluation & point extraction against prediction points
        (
            segments,
            flood_points,
            max_depth,
            exposure_score,
            flood_affected_km,
            high_risk_count,
            moderate_risk_segment_count,
            closed_count,
            risk_level,
            route_data_state,
            dest_flooded
        ) = cls._evaluate_route_segments(
            geometry_coords, route_id, o_lat, o_lon, d_lat, d_lon, clearance_limit, spatial_prediction_points, weather_data_state
        )

        is_clearance_safe = (max_depth <= clearance_limit) and (closed_count == 0)
        clearance_warning = None if is_clearance_safe else f"Max predicted water depth ({max_depth} cm) exceeds {v_upper} clearance limit ({clearance_limit} cm) or contains closed segments."

        return {
            "route_id": route_id,
            "corridor_label": corridor_label,
            "label": f"CORRIDOR {idx+1} ({v_upper})",
            "recommended": idx == 0,
            "is_recommended": idx == 0,
            "origin_name": origin_name,
            "dest_name": dest_name,
            "distance_meters": raw_distance_m,
            "duration_seconds": raw_duration_s,
            "distance_km": distance_km,
            "travel_time_minutes": duration_min,
            "max_water_depth_cm": max_depth,
            "max_predicted_depth_cm": max_depth,
            "flood_exposure": risk_level,
            "flood_exposure_score": exposure_score,
            "flood_affected_distance_km": flood_affected_km,
            "high_risk_segment_count": high_risk_count,
            "moderate_risk_segment_count": moderate_risk_segment_count,
            "closed_segment_count": closed_count,
            "risk_level": risk_level,
            "data_state": route_data_state,
            "data_states": {
                "weather_state": "FORECAST" if route_data_state == "LIVE" else route_data_state,
                "terrain_state": "SIMULATION",
                "historical_state": "SIMULATION",
                "drainage_state": "SIMULATION",
                "prediction_state": "PREDICTED",
            },
            "is_destination_flooded": dest_flooded,
            "is_clearance_safe": is_clearance_safe,
            "clearance_limit_cm": clearance_limit,
            "clearance_warning": clearance_warning,
            "why_recommended": "Evaluating flood risk & travel time...",
            "geometry": {
                "type": "LineString",
                "coordinates": geometry_coords,
            },
            "steps": steps,
            "segments": segments,
            "flood_points": flood_points,
            "data_provenance": {
                "road_geometry": f"LIVE (OSRM DE {v_upper} / OpenStreetMap)",
                "flood_depth": "MODEL PREDICTION",
                "weather_source": "FORECAST" if route_data_state == "LIVE" else route_data_state,
                "terrain_state": "SIMULATION",
                "historical_state": "SIMULATION",
                "drainage_state": "SIMULATION",
                "prediction_state": "PREDICTED",
            },
        }

    @classmethod
    def _format_osrm_steps(cls, route_data: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Extracts and formats turn-by-turn navigation instructions from OSRM leg steps."""
        steps_out = []
        legs = route_data.get("legs", [])

        if legs:
            for leg in legs:
                for s in leg.get("steps", []):
                    m = s.get("maneuver", {})
                    m_type = (m.get("type") or "").lower()
                    m_mod = (m.get("modifier") or "").lower()
                    street_name = s.get("name") or "road"
                    dist_m = round(s.get("distance", 0.0), 1)

                    if m_type == "depart":
                        instruction = f"Head {m_mod.replace('_', ' ') or 'forward'} on {street_name}".strip()
                    elif m_type == "arrive":
                        instruction = "Arrive at destination"
                    elif m_type in ("turn", "end of road", "off ramp", "on ramp"):
                        if m_mod:
                            instruction = f"Turn {m_mod.replace('_', ' ')} onto {street_name}"
                        else:
                            instruction = f"Continue onto {street_name}"
                    elif m_type == "fork":
                        instruction = f"Take the fork {m_mod.replace('_', ' ')} onto {street_name}"
                    elif m_type == "roundabout":
                        instruction = f"At roundabout, take exit onto {street_name}"
                    elif m_type in ("continue", "new name"):
                        if m_mod and m_mod != "straight":
                            instruction = f"Bear {m_mod.replace('_', ' ')} onto {street_name}"
                        else:
                            instruction = f"Continue straight on {street_name}"
                    elif m_type == "merge":
                        instruction = f"Merge {m_mod.replace('_', ' ')} onto {street_name}"
                    else:
                        if m_mod:
                            instruction = f"Turn {m_mod.replace('_', ' ')} onto {street_name}"
                        else:
                            instruction = f"Proceed on {street_name}"

                    location = m.get("location", [0.0, 0.0])
                    steps_out.append({
                        "instruction": instruction,
                        "distance_meters": dist_m,
                        "duration_seconds": round(s.get("duration", 0.0), 1),
                        "street_name": street_name,
                        "maneuver_type": m_type,
                        "maneuver_modifier": m_mod,
                        "latitude": location[1] if len(location) >= 2 else 0.0,
                        "longitude": location[0] if len(location) >= 2 else 0.0,
                    })

        # Fallback polyline bearing step generator if OSRM steps are empty
        if not steps_out:
            coords = route_data.get("geometry", {}).get("coordinates", [])
            if coords and len(coords) >= 2:
                steps_out = cls._generate_steps_from_polyline(coords)

        return steps_out

    @classmethod
    def _generate_steps_from_polyline(cls, coords: List[List[float]]) -> List[Dict[str, Any]]:
        """Generates geometry-anchored turn steps from polyline points if OSRM steps are omitted."""
        if not coords or len(coords) < 2:
            return []

        steps = []
        d_m = cls._haversine_distance_m(coords[0][1], coords[0][0], coords[1][1], coords[1][0])
        steps.append({
            "instruction": "Head forward along primary corridor",
            "distance_meters": round(d_m, 1),
            "duration_seconds": round(d_m / 8.0, 1),
            "street_name": "Main Corridor",
            "maneuver_type": "depart",
            "maneuver_modifier": "straight",
            "latitude": coords[0][1],
            "longitude": coords[0][0],
        })

        accum_dist = 0.0
        for i in range(1, len(coords) - 1):
            p1 = coords[i - 1]
            p2 = coords[i]
            p3 = coords[i + 1]

            seg_dist = cls._haversine_distance_m(p2[1], p2[0], p3[1], p3[0])
            accum_dist += seg_dist

            b1 = math.atan2(p2[0] - p1[0], p2[1] - p1[1])
            b2 = math.atan2(p3[0] - p2[0], p3[1] - p2[1])
            diff_deg = math.degrees(b2 - b1)
            while diff_deg > 180: diff_deg -= 360
            while diff_deg < -180: diff_deg += 360

            if abs(diff_deg) >= 25.0 and accum_dist >= 150.0:
                mod = "right" if diff_deg > 0 else "left"
                if abs(diff_deg) < 45.0:
                    mod = f"slight {mod}"
                steps.append({
                    "instruction": f"Turn {mod} onto Connecting Corridor",
                    "distance_meters": round(accum_dist, 1),
                    "duration_seconds": round(accum_dist / 8.0, 1),
                    "street_name": "Connecting Corridor",
                    "maneuver_type": "turn",
                    "maneuver_modifier": mod,
                    "latitude": p2[1],
                    "longitude": p2[0],
                })
                accum_dist = 0.0

        last_pt = coords[-1]
        steps.append({
            "instruction": "Arrive at destination",
            "distance_meters": round(accum_dist, 1),
            "duration_seconds": 0.0,
            "street_name": "Destination",
            "maneuver_type": "arrive",
            "maneuver_modifier": "",
            "latitude": last_pt[1],
            "longitude": last_pt[0],
        })
        return steps

    @classmethod
    async def _fetch_osrm_routes(
        cls, o_lat: float, o_lon: float, d_lat: float, d_lon: float, vehicle_type: str = "CAR"
    ) -> List[Dict[str, Any]]:
        """Queries OpenStreetMap DE OSRM REST API for exact requested mode, returning 1-4 genuine alternatives."""
        if not (-90.0 <= o_lat <= 90.0 and -180.0 <= o_lon <= 180.0):
            raise ValueError(f"Invalid origin coordinates: lat={o_lat}, lon={o_lon}")
        if not (-90.0 <= d_lat <= 90.0 and -180.0 <= d_lon <= 180.0):
            raise ValueError(f"Invalid destination coordinates: lat={d_lat}, lon={d_lon}")

        routes_out = []
        endpoint = cls.OSRM_ENDPOINTS.get(vehicle_type.upper(), cls.OSRM_ENDPOINTS["CAR"])
        url_direct = f"{endpoint}/{o_lon},{o_lat};{d_lon},{d_lat}"

        print(f"==================================================")
        print(f"OSRM ROUTE REQUEST ({vehicle_type}):")
        print(f"  FROM: ({o_lat:.6f}°N, {o_lon:.6f}°E)")
        print(f"  TO:   ({d_lat:.6f}°N, {d_lon:.6f}°E)")
        print(f"  URL:  {url_direct}")

        headers = {"User-Agent": "JALDRISHTI-Digital-Twin/2.0"}
        async with httpx.AsyncClient(timeout=8.0) as client:
            try:
                res = await client.get(url_direct, params={"overview": "full", "geometries": "geojson", "alternatives": "true", "steps": "true"}, headers=headers)
                if res.status_code == 200:
                    osrm_routes = res.json().get("routes", [])
                    for i, r in enumerate(osrm_routes):
                        lbl = "Primary Corridor" if i == 0 else f"Discovered Alternative {i}"
                        routes_out.append({"label": lbl, "route": r})
            except Exception as e:
                print(f"OSRM DE {vehicle_type} query warning:", e)

            # Fallback to secondary genuine OSRM router if DE endpoint fails or returns 0 routes
            if not routes_out:
                try:
                    mode_profile = "driving"
                    if vehicle_type.upper() in ("WALK", "PEDESTRIAN"):
                        mode_profile = "foot"
                    elif vehicle_type.upper() in ("BIKE", "BICYCLE", "CYCLIST"):
                        mode_profile = "driving"

                    url_fallback = f"https://router.project-osrm.org/route/v1/{mode_profile}/{o_lon},{o_lat};{d_lon},{d_lat}"
                    res = await client.get(url_fallback, params={"overview": "full", "geometries": "geojson", "alternatives": "true", "steps": "true"}, headers=headers)
                    if res.status_code == 200:
                        osrm_routes = res.json().get("routes", [])
                        for i, r in enumerate(osrm_routes):
                            lbl = "Primary Corridor" if i == 0 else f"Discovered Alternative {i}"
                            routes_out.append({"label": lbl, "route": r})
                except Exception as e:
                    print("OSRM fallback query warning:", e)

        return routes_out

    @staticmethod
    def _haversine_distance_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Computes Haversine distance in meters between two lat/lon coordinates."""
        R = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)

        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    @classmethod
    def _evaluate_route_segments(
        cls,
        coords: List[List[float]],
        route_id: str,
        o_lat: float,
        o_lon: float,
        d_lat: float,
        d_lon: float,
        clearance_limit: float,
        spatial_prediction_points: List[Dict[str, Any]],
        weather_data_state: str,
    ) -> tuple:
        """Evaluates route LineString coordinates against structured spatial flood prediction points."""
        segments = []
        flood_points = []
        max_depth = 0.0
        high_risk_count = 0
        moderate_risk_count = 0
        closed_count = 0
        flood_affected_m = 0.0
        cumulative_exposure = 0.0

        total_pts = len(coords)
        if total_pts < 2:
            overall_state = weather_data_state if weather_data_state != "DATA_UNAVAILABLE" else "DATA_UNAVAILABLE"
            r_level = "UNKNOWN" if overall_state == "DATA_UNAVAILABLE" else "LOW"
            return [], [], 0.0, 0.0, 0.0, 0, 0, 0, r_level, overall_state, False

        # Spatial Bounding-Box Pre-Filtering for performance optimization
        # Filter candidate flood points against route bounding box expanded by ~10 km corridor threshold
        if coords:
            all_lats = [c[1] for c in coords]
            all_lons = [c[0] for c in coords]
            box_min_lat = min(all_lats) - 0.1
            box_max_lat = max(all_lats) + 0.1
            box_min_lon = min(all_lons) - 0.1
            box_max_lon = max(all_lons) + 0.1
            relevant_pts = [
                pt for pt in spatial_prediction_points
                if box_min_lat <= pt.get("latitude", 0.0) <= box_max_lat
                and box_min_lon <= pt.get("longitude", 0.0) <= box_max_lon
            ]
        else:
            relevant_pts = spatial_prediction_points

        sample_interval = max(1, total_pts // 100) # Sample 100 segments for concise payload unless hazard exists

        for i in range(total_pts - 1):
            p1 = coords[i]
            p2 = coords[i + 1]

            seg_len_m = cls._haversine_distance_m(p1[1], p1[0], p2[1], p2[0])
            mid_lon = (p1[0] + p2[0]) / 2.0
            mid_lat = (p1[1] + p2[1]) / 2.0

            segment_depth = 0.0
            hazard_name = None

            # Spatial evaluation against relevant prediction points using 120m corridor buffer
            corridor_radius_m = 120.0
            for pt in relevant_pts:
                dist_m = cls._haversine_distance_m(mid_lat, mid_lon, pt["latitude"], pt["longitude"])
                if dist_m <= corridor_radius_m:
                    factor = max(0.0, 1.0 - (dist_m / corridor_radius_m))
                    pt_depth = pt.get("predicted_water_depth_cm") if pt.get("predicted_water_depth_cm") is not None else pt.get("numeric_depth_cm", 0.0)
                    d_val = round(pt_depth * factor, 1)
                    if d_val > segment_depth:
                        segment_depth = d_val
                        hazard_name = pt.get("spot_name", "Predicted Flood Area")

            depth = segment_depth
            if depth > max_depth:
                max_depth = depth

            if depth > 5.0:
                flood_affected_m += seg_len_m
                if depth > 15.0:
                    high_risk_count += 1
                else:
                    moderate_risk_count += 1

            cumulative_exposure += (depth / 30.0) * (seg_len_m / 100.0)

            # Category & Color Mapping
            if depth == 0.0:
                risk_state = "SAFE"
                color = "#10b981"
                depth_label = "0 cm CLEAR"
                provenance = "MODEL PREDICTION — CLEAR"
            elif depth <= 5.0:
                risk_state = "SAFE"
                color = "#10b981"
                depth_label = f"{depth} cm SAFE"
                provenance = "MODEL PREDICTION"
            elif depth <= 15.0:
                risk_state = "CAUTION"
                color = "#3b82f6"
                depth_label = f"{depth} cm CAUTION"
                provenance = "MODEL PREDICTION"
            elif depth <= 30.0:
                risk_state = "HIGH"
                color = "#f97316"
                depth_label = f"{depth} cm HIGH"
                provenance = "MODEL PREDICTION"
            elif depth <= 50.0:
                risk_state = "CRITICAL"
                color = "#ef4444"
                depth_label = f"{depth} cm CRITICAL"
                provenance = "MODEL PREDICTION"
            else:
                risk_state = "CLOSED"
                color = "#8b5cf6"
                depth_label = f"{depth} cm CLOSED"
                provenance = "MODEL PREDICTION"
                closed_count += 1

            # Payload optimization: include segment if hazard exists or at sampled intervals to keep payload lightweight
            if depth > 0.0 or (i % sample_interval == 0) or i == total_pts - 2:
                segments.append({
                    "segment_index": i,
                    "predicted_water_depth_cm": depth,
                    "risk_state": risk_state,
                    "color": color,
                    "hazard_name": hazard_name,
                    "depth_label": depth_label,
                    "is_vehicle_clearance_safe": (depth <= clearance_limit) and (risk_state != "CLOSED"),
                    "data_provenance": provenance,
                })

        # Attach authoritative dataset prediction points that lie near this route corridor
        seen_pts = set()
        for pt in spatial_prediction_points:
            pt_lat = pt.get("latitude")
            pt_lon = pt.get("longitude")
            if pt_lat is not None and pt_lon is not None:
                min_d = float('inf')
                for coord in coords:
                    d = cls._haversine_distance_m(pt_lat, pt_lon, coord[1], coord[0])
                    if d < min_d:
                        min_d = d
                if min_d <= 2500.0:
                    pt_id = pt.get("prediction_id") or f"FP-{pt_lat}_{pt_lon}"
                    if pt_id not in seen_pts:
                        seen_pts.add(pt_id)
                        depth_cm = pt.get("numeric_depth_cm", 0.0)
                        flood_points.append({
                            "id": pt_id,
                            "prediction_id": pt.get("prediction_id"),
                            "latitude": pt_lat,
                            "longitude": pt_lon,
                            "spot_name": pt.get("spot_name", "Flood Location"),
                            "predicted_water_depth_cm": depth_cm,
                            "numeric_depth_cm": depth_cm,
                            "predicted_depth_range": pt.get("predicted_depth_range", f"{round(depth_cm)} cm"),
                            "risk_level": pt.get("risk_level", "SAFE"),
                            "risk_score": pt.get("risk_score", 0.0),
                            "confidence_pct": pt.get("confidence_pct", 85),
                            "explanation": pt.get("explanation", ""),
                            "factors": pt.get("factors", {}),
                            "data_states": pt.get("data_states", {}),
                            "color": "#a855f7" if (pt.get("risk_level") in ("CRITICAL", "CLOSED") or depth_cm >= 45.0) else "#ef4444" if (pt.get("risk_level") == "HIGH" or depth_cm >= 30.0) else "#f97316" if (pt.get("risk_level") == "MODERATE" or depth_cm >= 15.0) else "#eab308" if (pt.get("risk_level") == "CAUTION" or depth_cm >= 5.0) else "#3b82f6",
                            "depth_label": pt.get("predicted_depth_range", f"{round(depth_cm)} cm"),
                            "data_source": "FloodPredictionService",
                            "confidence": "MODEL PREDICTION",
                            "description": pt.get("explanation", ""),
                        })

        # Calculate route-level risk summary
        flood_affected_km = round(flood_affected_m / 1000.0, 2)
        exposure_score = round(cumulative_exposure, 2)

        if weather_data_state == "DATA_UNAVAILABLE" and max_depth == 0.0:
            overall_risk = "UNKNOWN"
            route_data_state = "DATA_UNAVAILABLE"
        elif max_depth == 0.0 or max_depth <= 5.0:
            overall_risk = "LOW"
            route_data_state = weather_data_state
        elif max_depth <= 15.0:
            overall_risk = "MODERATE"
            route_data_state = weather_data_state
        elif max_depth <= 30.0:
            overall_risk = "HIGH"
            route_data_state = weather_data_state
        else:
            overall_risk = "CRITICAL"
            route_data_state = weather_data_state

        is_dest_flooded = False
        if segments and (segments[-1]["risk_state"] in ("HIGH", "CRITICAL", "CLOSED") or segments[-1]["predicted_water_depth_cm"] > clearance_limit):
            is_dest_flooded = True

        return (
            segments,
            flood_points,
            max_depth,
            exposure_score,
            flood_affected_km,
            high_risk_count,
            moderate_risk_count,
            closed_count,
            overall_risk,
            route_data_state,
            is_dest_flooded
        )


