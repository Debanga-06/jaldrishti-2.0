# JALDRISHTI — System Architecture

This document describes the end-to-end technical architecture of JALDRISHTI: how data flows from field sensors through the hydrodynamic core to the command-center frontend, and how each layer is composed.

The architecture is **city-agnostic by design** — every layer below is parameterized over standard municipal inputs (drainage GIS, DEM, rainfall telemetry, road network) rather than hardcoded to one location. Data sources shown below (radar network, ward gauges) reflect the current Barasat Municipality pilot deployment; onboarding a new Indian city means pointing these same ingestion interfaces at that city's radar/gauge network and GIS data, not modifying the core models or services.

For a product-level overview, see [`README.md`](./README.md).

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layer 1 — Data Ingestion](#layer-1--data-ingestion)
3. [Layer 2 — Hydrodynamic Core & ML Surrogate](#layer-2--hydrodynamic-core--ml-surrogate)
4. [Layer 3 — PostGIS & Spatial Analytics Service](#layer-3--postgis--spatial-analytics-service)
5. [Layer 4 — Command Center Frontend](#layer-4--command-center-frontend)
6. [End-to-End Operational Pipeline](#end-to-end-operational-pipeline)
7. [Deployment Topology](#deployment-topology)
8. [Data Flow Summary](#data-flow-summary)

---

## Architecture Overview

```
                                JALDRISHTI ARCHITECTURE

+--------------------------------------------------------------------------------------------+
|                                 DATA INGESTION LAYER                                        |
|  +------------------+   +------------------+   +--------------------+   +----------------+  |
|  | DWR Doppler Radar|   | IoT Rain Gauges  |   | SWMM GIS Sewers    |   | 1m LiDAR DEM   |  |
|  | (Regional Radar) |   | (Ward Gauges)    |   | (Conduits &         |   | (Cartosat)     |  |
|  |  Network)        |   |                  |   |  Manholes)          |   |                |  |
|  +--------+---------+   +--------+---------+   +----------+---------+   +--------+-------+  |
+-----------|------------------------|-----------------------|-----------------------|---------+
            v                        v                       v                       v
+--------------------------------------------------------------------------------------------+
|                        HYDRODYNAMIC CORE & ML SURROGATE                                    |
|                                                                                              |
|  1D Sewer Hydraulic Model (EPA SWMM 5.2)   <====  Coupled  ====>   2D Overland Flow          |
|  • Saint-Venant 1D dynamic-wave equations                          HydroGNN PINN             |
|  • Hydraulic grade line (HGL) surcharges                          • Physics-informed graph   |
|  • Conduit choke & backwater outfalls                               neural network           |
|                                                                     • Shallow-water diffusion |
|                                                                     • 142 ms inundation field |
+---------------------------------------------+----------------------------------------------+
                                                |
                                                v
+--------------------------------------------------------------------------------------------+
|                     POSTGIS & SPATIAL ANALYTICS SERVICE                                     |
|  • Dynamic-cost Dijkstra / A* routing matrix (depth-penalty functions per vehicle class)    |
|  • Critical infrastructure risk classifier (hospitals, fire stations, police, shelters)     |
|  • Hydrodynamic explainability decomposer & SHA-256 provenance audit generator              |
+---------------------------------------------+----------------------------------------------+
                                                |
                                                v
+--------------------------------------------------------------------------------------------+
|                    COMMAND CENTER FRONTEND (React + MapLibre GL)                            |
|  +--------------------------+  +---------------------------+  +---------------------------+ |
|  | GIS Digital Twin Map     |  | T+0 to T+180 min Timeline  |  | Multimodal Safe Routing   | |
|  | (1D sewers + 2D depths)  |  | (15-min hyetograph scrub)  |  | (Ambulance, Fire, Boats)  | |
|  +--------------------------+  +---------------------------+  +---------------------------+ |
|  +--------------------------+  +---------------------------+  +---------------------------+ |
|  | City Decision Support    |  | Hydro Validation Lab       |  | Historical Flood Replay   | |
|  | ("What should the        |  | (Observed vs. predicted)   |  | (6-stage causal chain)    | |
|  |  city do?")               |  |                            |  |                           | |
|  +--------------------------+  +---------------------------+  +---------------------------+ |
+--------------------------------------------------------------------------------------------+
```
*Data source labels above reflect the current Barasat pilot deployment; the ingestion layer accepts equivalent radar/gauge/GIS feeds from any onboarded city.*

---

## Layer 1 — Data Ingestion

Sources below are shown as configured for the Barasat pilot. Onboarding a new city means registering its equivalent radar network, gauge network, sewer GIS export, and DEM against the same interfaces — no changes to the models or services in Layers 2–4.

| Source | Protocol | Frequency | Purpose |
| :--- | :--- | :--- | :--- |
| Doppler weather radar (Kolkata Radar Network, in the Barasat pilot) | WMO-GRIB2 | 10-min sweep | Rainfall intensity field for nowcasting |
| IoT rain gauges (Wards 1–35, Barasat pilot) | MQTT / LoRaWAN | 1–5 min | Ground-truth point rainfall, gauge calibration |
| SWMM GIS sewer network | PostGIS import | Static + event-driven | Conduit geometry, manhole locations, invert levels |
| 1m LiDAR DEM (Cartosat) | Static raster | One-time / periodic resurvey | Terrain elevation for overland flow routing |

Ingested data is validated and health-checked continuously; degraded or stale feeds are surfaced directly in the **Data Health** telemetry panel (`LIVE` / `STALE` / `DEGRADED` / `DATA_UNAVAILABLE`) rather than silently failing.

---

## Layer 2 — Hydrodynamic Core & ML Surrogate

Two coupled models produce the inundation forecast:

**1D Sewer Hydraulic Model — EPA SWMM 5.2**
- Solves Saint-Venant 1D dynamic-wave equations for the underground conduit network.
- Computes hydraulic grade line (HGL) surcharges when conduits exceed capacity.
- Models conduit choke points and backwater effects at outfalls.

**2D Overland Flow — HydroGNN PINN**
- A physics-informed graph neural network trained as a surrogate for full 2D shallow-water diffusion.
- Enforces mass conservation as a physical constraint (not just a data-fit loss term), keeping volume error to ~0.024%.
- Computes a citywide depth field in ~142 ms, versus ~42 minutes for a traditional 2D CFD solver — the acceleration that makes real-time 0–3 h nowcasting operationally viable.

The two models are coupled: sewer surcharge output from SWMM feeds into the HydroGNN overland model as a boundary condition, so underground and surface flooding are represented as one connected system rather than two independent forecasts.

---

## Layer 3 — PostGIS & Spatial Analytics Service

- **Routing matrix** — a dynamic-cost Dijkstra/A* graph over the road network, where edge weights are penalized as a function of predicted water depth relative to the requesting vehicle's clearance limit (pedestrian, light vehicle, ambulance, fire tender, rescue boat).
- **Critical infrastructure risk classifier** — continuously scores access risk to hospitals, fire stations, police stations, and shelters based on the current and forecast depth field along their access roads.
- **Explainability decomposer** — attributes a predicted flood at any given point to its physical drivers (sewer surcharge, topographic depression, imperviousness, infiltration saturation) rather than exposing only a raw depth number.
- **Provenance audit generator** — stamps every prediction with a SHA-256 checksum plus the source dataset versions and model version that produced it, for auditability.

---

## Layer 4 — Command Center Frontend

Built with React + MapLibre GL. Key surfaces:

| Surface | Purpose |
| :--- | :--- |
| GIS Digital Twin Map | Combined 1D sewer network + 2D depth field visualization |
| T+0 to T+180 min Timeline | 15-minute hyetograph scrubber for nowcast playback |
| Multimodal Safe Routing | Vehicle-aware flood-safe route calculation and display |
| City Decision Support | Department-specific action recommendations |
| Hydro Validation Lab | Observed vs. predicted accuracy scorecard |
| Historical Flood Replay | Six-stage causal playback of a past flood event |

State is managed with Zustand; server data fetching uses TanStack Query. Map rendering (basemap tiles, route lines, flood-extent polygons, drainage-network overlays) runs on MapLibre GL JS.

---

## End-to-End Operational Pipeline

```
Rainfall ingestion (radar + gauges)
   ↓
0–3 h nowcasting (optical-flow tracking)
   ↓
Catchment hydrology (SCS-CN runoff generation)
   ↓
1D drainage network hydraulic analysis (SWMM manhole surcharges)
   ↓
2D surface flood diffusion (HydroGNN PINN spatial prediction)
   ↓
Street-by-street inundation depth & velocity extraction
   ↓
Multi-criteria risk scoring (traffic, pedestrians, infrastructure)
   ↓
Departmental decision support & automated early warnings
   ↓
Flood-safe evacuation & emergency vehicle routing
   ↓
GIS digital twin visualization & real-time telemetry audit
```

---

## Deployment Topology

| Component | Hosting | Notes |
| :--- | :--- | :--- |
| Frontend (React + Vite build) | Vercel | Static build served via CDN; SPA routing with asset-path exclusions |
| Backend (FastAPI) | Render | Python 3.12 / Uvicorn service exposing `/api/v1/*` |
| Spatial database | PostgreSQL + PostGIS | Managed instance; stores sewer network geometry, hotspot data, routing graph |
| Map tiles & GeoJSON rendering | MapLibre GL (client-side) | Worker-based GeoJSON processing served as static assets alongside the frontend build |

For local development, all of the above can be run together with Docker Compose — see [`README.md`](./README.md#quickstart--installation).

---

## Data Flow Summary

1. Radar, rain gauges, and static GIS/DEM data are ingested continuously.
2. The 1D SWMM model and 2D HydroGNN PINN surrogate run coupled, producing a citywide depth field every nowcast cycle.
3. The PostGIS service consumes that depth field to update the routing cost graph, infrastructure risk scores, and explainability decomposition.
4. The frontend polls/queries this layer and renders it on the digital twin map, timeline, routing panel, and decision-support dashboard — with every prediction traceable back to its source data via the provenance record.
