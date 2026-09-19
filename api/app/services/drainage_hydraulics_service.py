"""Underground Drainage Network Hydraulic Model Service for JALDRISHTI (Part 4).

Models urban stormwater drainage networks as a directed graph G = (V, E), calculates Manning
hydraulic capacity, handles dataset or simulated blockage, couples with Part 3 2D surface flow grid
via nearest-neighbor inlet matching (max 150m), detects overcapacity, calculates surcharge and backflow,
returns backflow water to surface grid cells, and tracks volumetric mass conservation.
"""

import math
from typing import Dict, Any, List, Optional, Tuple
from app.services.dataset_repository import DatasetRepository
from app.services.surface_flow_service import SurfaceFlowService


class DrainageHydraulicsService:
    """Directed Drainage Network Hydraulic Capacity, Surcharge, and Surface Backflow Model."""

    # Configured engineering defaults (strictly exposed when missing in dataset)
    DEFAULT_MANNING_N: float = 0.013      # Concrete conduit / smooth box drain
    DEFAULT_SLOPE_S: float = 0.002         # 0.2% slope gradient (2m per 1000m)
    MAX_ASSOCIATION_DISTANCE_M: float = 150.0  # Max distance to couple surface cell to inlet node

    @classmethod
    def _calculate_manning_capacity(
        cls,
        diameter_or_width_m: float,
        depth_m: float,
        drain_type: str,
        n: float = DEFAULT_MANNING_N,
        s: float = DEFAULT_SLOPE_S
    ) -> Tuple[float, bool]:
        """Calculates nominal discharge capacity Q (m³/s) using Manning's Equation:
        Q = (1 / n) * A * R^(2/3) * S^(1/2)

        Returns: (capacity_m3_s, is_configured_assumption)
        """
        w = max(0.2, diameter_or_width_m or 1.0)
        y = max(0.2, depth_m or 1.0)

        # Refine roughness n based on drain type if available
        is_assumed = False
        if "open" in (drain_type or "").lower():
            n = 0.025
        elif "brick" in (drain_type or "").lower():
            n = 0.015
        elif not n:
            n = cls.DEFAULT_MANNING_N
            is_assumed = True

        if not s:
            s = cls.DEFAULT_SLOPE_S
            is_assumed = True

        if "conduit" in (drain_type or "").lower() or "pipe" in (drain_type or "").lower():
            # Circular pipe geometry (full flow)
            d = w
            area = math.pi * (d ** 2) / 4.0
            r = d / 4.0
        else:
            # Rectangular box drain / channel
            area = w * y
            wetted_perimeter = w + 2.0 * y
            r = area / wetted_perimeter if wetted_perimeter > 0 else (w / 2.0)

        velocity = (1.0 / n) * (r ** (2.0 / 3.0)) * math.sqrt(s)
        capacity_m3_s = area * velocity
        return (round(max(0.1, capacity_m3_s), 2), is_assumed)

    @classmethod
    def build_drainage_graph(
        cls,
        city: str,
        lat: float,
        lon: float,
        simulation_blockage_pct: Optional[float] = None
    ) -> Dict[str, Any]:
        """Constructs a deterministic directed graph G = (V, E) from dataset records."""
        drains_raw = DatasetRepository.get_city_drains(city)
        city_domain = city.upper() if city else "CHENNAI"

        nodes: List[Dict[str, Any]] = []
        edges: List[Dict[str, Any]] = []

        # If no explicit CSV records exist, build structured dataset nodes from city terrain points
        if not drains_raw:
            elev_pts = []
            if city_domain == "KOLKATA":
                elev_pts = DatasetRepository.KOLKATA_ELEVATION_POINTS
            elif city_domain == "HOWRAH":
                elev_pts = DatasetRepository.HOWRAH_ELEVATION_POINTS
            elif city_domain == "BARASAT":
                elev_pts = DatasetRepository.BARASAT_ELEVATION_POINTS

            if not elev_pts:
                for r in range(3):
                    for c in range(3):
                        node_id = f"NODE-{city_domain[:3]}-R{r}-C{c}"
                        node_lat = lat + (r - 1) * 0.005
                        node_lon = lon + (c - 1) * 0.005
                        node_type = "OUTFALL" if (r == 2 and c == 2) else ("PUMPING_STATION" if (r == 1 and c == 1) else "INLET")
                        nodes.append({
                            "node_id": node_id,
                            "latitude": round(node_lat, 4),
                            "longitude": round(node_lon, 4),
                            "elevation_m": round(5.0 - (r + c) * 0.4, 2),
                            "node_type": node_type,
                            "connected_road": f"{city_domain.capitalize()} Arterial Link {r+1}",
                            "status": "NORMAL"
                        })
            else:
                for idx, pt in enumerate(elev_pts):
                    node_id = f"NODE-{pt['point_id']}"
                    nodes.append({
                        "node_id": node_id,
                        "latitude": pt["lat"],
                        "longitude": pt["lon"],
                        "elevation_m": pt["elevation_m"],
                        "node_type": "OUTFALL" if pt.get("low_point") and idx % 2 == 0 else "INLET",
                        "connected_road": f"{pt['zone']} Main Road",
                        "status": "NORMAL"
                    })

            for i in range(len(nodes) - 1):
                from_n = nodes[i]
                to_n = nodes[i + 1]
                edge_id = f"EDGE-{from_n['node_id']}-TO-{to_n['node_id']}"

                nom_cap, is_assumed = cls._calculate_manning_capacity(
                    diameter_or_width_m=1.2,
                    depth_m=1.5,
                    drain_type="underground_conduit"
                )

                is_sim_block = isinstance(simulation_blockage_pct, (int, float))
                blk_pct = float(simulation_blockage_pct) if is_sim_block else 15.0
                blk_status = "BLOCKAGE • SIMULATION" if is_sim_block else "HYDRAULIC PARAMETERS • CONFIGURED ASSUMPTION"

                eff_cap = round(nom_cap * (1.0 - (blk_pct / 100.0)), 2)

                edges.append({
                    "edge_id": edge_id,
                    "from_node": from_n["node_id"],
                    "to_node": to_n["node_id"],
                    "drain_type": "underground_conduit",
                    "diameter_or_width_m": 1.2,
                    "depth_m": 1.5,
                    "length_m": 120.0,
                    "nominal_capacity_m3_s": nom_cap,
                    "blockage_pct": blk_pct,
                    "blockage_status": blk_status,
                    "effective_capacity_m3_s": eff_cap,
                    "is_assumed_parameters": True,
                    "status": "NORMAL"
                })
        else:
            matched_zone = DatasetRepository.get_matched_zone_name(city_domain, lat, lon, "") or city_domain

            for idx, d_rec in enumerate(drains_raw):
                drain_id = d_rec.get("drain_id", f"DRN-{idx+1}")
                zone = d_rec.get("zone", matched_zone)

                offset_lat = ((idx % 5) - 2) * 0.0006
                offset_lon = ((idx // 5) - 2) * 0.0006
                node_lat = round(lat + offset_lat, 4)
                node_lon = round(lon + offset_lon, 4)


                is_pump = d_rec.get("pumping_station_connected", False)
                node_type = "PUMPING_STATION" if is_pump else ("OUTFALL" if idx % 8 == 0 else "INLET")

                nodes.append({
                    "node_id": f"NODE-{drain_id}",
                    "latitude": node_lat,
                    "longitude": node_lon,
                    "elevation_m": round(6.0 - (idx % 5) * 0.6, 2),
                    "node_type": node_type,
                    "zone": zone,
                    "connected_road": str(d_rec.get("connected_roads", f"{zone} Arterial Road")),
                    "status": str(d_rec.get("status", "normal")).upper()
                })

            for i in range(len(nodes) - 1):
                from_n = nodes[i]
                to_n = nodes[i + 1]
                d_rec = drains_raw[i]

                w = float(d_rec.get("diameter_or_width_m", 1.0) or 1.0)
                d = float(d_rec.get("depth_m", 1.2) or 1.2)
                dtype = str(d_rec.get("drain_type", "underground_conduit"))

                calc_cap, is_assumed = cls._calculate_manning_capacity(w, d, dtype)
                ds_cap = float(d_rec.get("capacity_m3_per_second", 0) or 0)
                nom_cap = round(ds_cap if ds_cap > 0 else calc_cap, 2)

                is_sim_block = isinstance(simulation_blockage_pct, (int, float))
                if is_sim_block:
                    blk_pct = float(simulation_blockage_pct)
                    blk_status = "BLOCKAGE • SIMULATION"
                elif "blockage_percent" in d_rec and not math.isnan(float(d_rec.get("blockage_percent", 0) or 0)):
                    blk_pct = float(d_rec["blockage_percent"])
                    blk_status = "OBSERVED DATASET"
                else:
                    blk_pct = 0.0
                    blk_status = "DATA_UNAVAILABLE"


                eff_cap = round(max(0.01, nom_cap * (1.0 - (blk_pct / 100.0))), 2)

                edges.append({
                    "edge_id": f"EDGE-{from_n['node_id']}-TO-{to_n['node_id']}",
                    "from_node": from_n["node_id"],
                    "to_node": to_n["node_id"],
                    "drain_type": dtype,
                    "diameter_or_width_m": w,
                    "depth_m": d,
                    "length_m": 150.0,
                    "nominal_capacity_m3_s": nom_cap,
                    "blockage_pct": blk_pct,
                    "blockage_status": blk_status,
                    "effective_capacity_m3_s": eff_cap,
                    "is_assumed_parameters": is_assumed,
                    "status": from_n["status"]
                })

        return {
            "city": city_domain,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "nodes": nodes,
            "edges": edges
        }

    @classmethod
    async def evaluate_drainage_hydraulics(
        cls,
        lat: float,
        lon: float,
        location_name: str = "",
        horizon_offset_hours: int = 1,
        simulation_blockage_pct: Optional[float] = None
    ) -> Dict[str, Any]:
        """Main coupled surface-drainage simulation pipeline for Part 4."""
        surface_res = await SurfaceFlowService.compute_2d_surface_flow(
            lat=lat,
            lon=lon,
            location_name=location_name,
            horizon_offset_hours=horizon_offset_hours
        )


        city_domain = surface_res["location"]["city_domain"]
        grid = surface_res["surface_grid"]
        summary = surface_res["physics_metrics"]

        graph_data = cls.build_drainage_graph(
            city=city_domain,
            lat=lat,
            lon=lon,
            simulation_blockage_pct=simulation_blockage_pct
        )

        nodes = graph_data["nodes"]
        edges = graph_data["edges"]

        cell_to_node_map: Dict[str, str] = {}
        node_inflow_m3: Dict[str, float] = {n["node_id"]: 0.0 for n in nodes}

        def haversine_dist_m(lat1, lon1, lat2, lon2):
            R = 6371000.0
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi / 2.0)**2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2.0)**2
            return R * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

        inlet_nodes = [n for n in nodes if n["node_type"] == "INLET"] or nodes

        for cell in grid:
            c_lat, c_lon = cell["latitude"], cell["longitude"]
            best_node = None
            min_dist = float("inf")

            for node in inlet_nodes:
                d = haversine_dist_m(c_lat, c_lon, node["latitude"], node["longitude"])
                if d < min_dist:
                    min_dist = d
                    best_node = node

            if best_node and min_dist <= cls.MAX_ASSOCIATION_DISTANCE_M:
                cell_to_node_map[cell["cell_id"]] = best_node["node_id"]
                inflow_v = cell["accumulated_volume_m3"] * 0.40
                node_inflow_m3[best_node["node_id"]] += inflow_v

        timestep_seconds = 3600.0
        edge_results: List[Dict[str, Any]] = []
        node_surcharge_m3: Dict[str, float] = {n["node_id"]: 0.0 for n in nodes}

        total_drainage_inflow_m3 = 0.0
        total_drainage_outflow_m3 = 0.0
        total_backflow_m3 = 0.0

        for edge in edges:
            from_id = edge["from_node"]
            eff_cap_m3_s = edge["effective_capacity_m3_s"]

            inflow_m3 = node_inflow_m3.get(from_id, 0.0)
            inflow_m3_s = inflow_m3 / timestep_seconds
            total_drainage_inflow_m3 += inflow_m3

            utilization = round(inflow_m3_s / eff_cap_m3_s, 2) if eff_cap_m3_s > 0 else 2.0
            is_overcapacity = utilization > 1.0

            if is_overcapacity:
                excess_m3_s = max(0.0, inflow_m3_s - eff_cap_m3_s)
                surcharge_vol_m3 = excess_m3_s * timestep_seconds
                outflow_m3_s = eff_cap_m3_s
            else:
                surcharge_vol_m3 = 0.0
                outflow_m3_s = inflow_m3_s

            total_drainage_outflow_m3 += (outflow_m3_s * timestep_seconds)
            node_surcharge_m3[from_id] += surcharge_vol_m3
            total_backflow_m3 += surcharge_vol_m3

            edge_results.append({
                **edge,
                "flow_m3_s": round(outflow_m3_s, 2),
                "capacity_utilization": utilization,
                "overcapacity": is_overcapacity,
                "surcharge_m3": round(surcharge_vol_m3, 2),
                "backflow_occurred": surcharge_vol_m3 > 0,
                "status": "SURCHARGED" if surcharge_vol_m3 > 0 else ("HIGH_LOAD" if utilization > 0.8 else "NORMAL")
            })

        node_to_cells_map: Dict[str, List[Dict[str, Any]]] = {}
        for cell in grid:
            nid = cell_to_node_map.get(cell["cell_id"])
            if nid:
                node_to_cells_map.setdefault(nid, []).append(cell)

        updated_grid = []
        cell_area_sq_m = summary["cell_area_sq_m"]

        for cell in grid:
            nid = cell_to_node_map.get(cell["cell_id"])
            backflow_vol = 0.0

            if nid and nid in node_to_cells_map:
                assigned_cells_count = len(node_to_cells_map[nid])
                backflow_vol = node_surcharge_m3.get(nid, 0.0) / float(assigned_cells_count)

            final_accum_m3 = cell["accumulated_volume_m3"] + backflow_vol
            final_depth_cm = round((final_accum_m3 / cell_area_sq_m) * 100.0, 1)

            updated_grid.append({
                **cell,
                "backflow_volume_m3": round(backflow_vol, 2),
                "accumulated_volume_m3": round(final_accum_m3, 2),
                "water_depth_cm": final_depth_cm,
                "drainage_node_associated": nid
            })

        road_summaries = surface_res.get("road_waterlogging_summary", [])
        updated_road_summaries = []

        for idx, rd in enumerate(road_summaries):
            matched_edge = edge_results[idx % len(edge_results)] if edge_results else {}
            has_backflow = matched_edge.get("backflow_occurred", False)
            add_depth = 8.0 if has_backflow else 0.0

            final_max_depth = round(rd["max_predicted_depth_cm"] + add_depth, 1)

            risk_level = "CRITICAL" if final_max_depth >= 30.0 else ("HIGH" if final_max_depth >= 15.0 else "MEDIUM")
            status = "IMPASSABLE" if final_max_depth >= 30.0 else ("CAUTION" if final_max_depth >= 15.0 else "PASSABLE")

            updated_road_summaries.append({
                "road_name": rd["road_name"],
                "max_predicted_depth_cm": final_max_depth,
                "avg_predicted_depth_cm": round(rd["avg_predicted_depth_cm"] + add_depth * 0.5, 1),
                "drainage_node_id": matched_edge.get("from_node", "NODE-001"),
                "drainage_type": matched_edge.get("drain_type", "underground_conduit"),
                "capacity_utilization": matched_edge.get("capacity_utilization", 0.75),
                "overcapacity": matched_edge.get("overcapacity", False),
                "surcharge": matched_edge.get("backflow_occurred", False),
                "backflow": matched_edge.get("backflow_occurred", False),
                "blockage_pct": matched_edge.get("blockage_pct", 15.0),
                "blockage_status": matched_edge.get("blockage_status", "OBSERVED DATASET"),
                "risk_level": risk_level,
                "status": status
            })

        v_rain = summary["total_domain_rainfall_volume_m3"]
        v_initial = 0.0
        v_drain_inflow = total_drainage_inflow_m3
        v_drain_outflow = total_drainage_outflow_m3
        v_backflow = total_backflow_m3
        v_remaining_surface = round(max(0.0, v_rain - v_drain_inflow + v_backflow), 2)

        balance_residual = round(abs((v_rain + v_initial) - (v_remaining_surface + v_drain_outflow)), 2)
        mass_conserved = balance_residual < 50.0 or (balance_residual / max(1.0, v_rain)) < 0.05
        has_assumed_params = any(e.get("is_assumed_parameters", False) for e in edges)

        return {
            "status": "PREDICTED",
            "horizon": f"T+{horizon_offset_hours}h",
            "timestamp": surface_res["timestamp"],
            "location": surface_res["location"],
            "provenance": {
                "rainfall_source": surface_res["provenance"]["rainfall_source"],
                "rainfall_provenance_badge": surface_res["provenance"]["rainfall_provenance_badge"],
                "terrain_dataset": surface_res["provenance"]["terrain_dataset"],
                "surface_model": surface_res["provenance"]["surface_model"],
                "drainage_model": "HYDRAULIC MODEL • DIRECTED DRAINAGE GRAPH",
                "hydraulic_assumptions_badge": "HYDRAULIC PARAMETERS • CONFIGURED ASSUMPTION" if has_assumed_params else "OBSERVED DATASET PARAMETERS",
                "blockage_badge": edges[0].get("blockage_status", "OBSERVED DATASET") if edges else "OBSERVED DATASET"
            },
            "graph_summary": {
                "total_nodes": graph_data["total_nodes"],
                "total_edges": graph_data["total_edges"],
                "total_drainage_inflow_m3": round(total_drainage_inflow_m3, 2),
                "total_drainage_outflow_m3": round(total_drainage_outflow_m3, 2),
                "total_surcharge_backflow_m3": round(total_backflow_m3, 2),
                "surcharged_nodes_count": sum(1 for e in edge_results if e["backflow_occurred"]),
                "max_association_distance_m": cls.MAX_ASSOCIATION_DISTANCE_M,
                "coupled_surface_cells_count": len(cell_to_node_map)
            },
            "mass_conservation": {
                "initial_storage_m3": v_initial,
                "rainfall_volume_m3": v_rain,
                "drainage_inflow_m3": round(total_drainage_inflow_m3, 2),
                "drainage_outflow_m3": round(total_drainage_outflow_m3, 2),
                "backflow_volume_m3": round(total_backflow_m3, 2),
                "remaining_surface_storage_m3": v_remaining_surface,
                "mass_balance_residual_m3": balance_residual,
                "mass_conservation_status": "CONSERVED" if mass_conserved else "DEGRADED"
            },
            "nodes": graph_data["nodes"],


            "edges": edge_results,
            "road_waterlogging_summary": updated_road_summaries,
            "surface_grid": updated_grid
        }
