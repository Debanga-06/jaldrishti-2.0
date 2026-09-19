"""API Version 1 Router Aggregator."""

from fastapi import APIRouter
from app.api.v1.endpoints import health, system, navigation, agent, home, prediction, auth, profile, feedback, nowcast, radar, surface_flow, drainage, gis_dashboard
from app.rainfall.router import router as rainfall_router
from app.explainability.router import router as explainability_router

api_router = APIRouter()

# Register core foundation and domain endpoints
api_router.include_router(health.router)
api_router.include_router(system.router)
api_router.include_router(navigation.router, prefix="/navigation", tags=["Navigation"])
api_router.include_router(home.router, prefix="/home", tags=["Home Early Warning"])
api_router.include_router(prediction.router, prefix="/prediction", tags=["Flood Prediction"])
api_router.include_router(agent.router, prefix="/agent", tags=["Agentic AI"])
api_router.include_router(nowcast.router, prefix="/flood", tags=["Flood Nowcast"])
api_router.include_router(radar.router, prefix="/radar", tags=["Doppler Weather Radar"])
api_router.include_router(surface_flow.router, prefix="/flood", tags=["2D Surface Water Flow"])
api_router.include_router(drainage.router, prefix="/flood", tags=["Underground Drainage Hydraulics"])
api_router.include_router(gis_dashboard.router, prefix="/flood", tags=["Dynamic Web GIS Dashboard"])
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(feedback.router)
api_router.include_router(rainfall_router)
api_router.include_router(explainability_router)

# Top-level direct endpoint aliases required by API specification
api_router.add_api_route("/routes", navigation.calculate_osrm_routes_post_api, methods=["POST"], tags=["Navigation"])
api_router.add_api_route("/routes", navigation.evaluate_routes_api, methods=["GET"], tags=["Navigation"])
api_router.add_api_route("/geocode", navigation.geocode_search_api, methods=["GET"], tags=["Navigation"])
api_router.add_api_route("/nowcast", nowcast.get_0_to_3h_flood_nowcast, methods=["GET"], tags=["Flood Nowcast"])
api_router.add_api_route("/flood/nowcast", nowcast.get_0_to_3h_flood_nowcast, methods=["GET"], tags=["Flood Nowcast"])
api_router.add_api_route("/radar/rainfall", radar.get_radar_rainfall, methods=["GET"], tags=["Doppler Weather Radar"])
api_router.add_api_route("/flood/surface-flow", surface_flow.get_2d_surface_flow, methods=["GET"], tags=["2D Surface Water Flow"])
api_router.add_api_route("/flood/drainage-hydraulics", drainage.get_drainage_hydraulics, methods=["GET"], tags=["Underground Drainage Hydraulics"])
api_router.add_api_route("/flood/gis-dashboard", gis_dashboard.get_gis_dashboard, methods=["GET"], tags=["Dynamic Web GIS Dashboard"])


