"""Navigation and Early Warning Endpoints for JALDRISHTI FastAPI Backend."""

from typing import List, Optional
from fastapi import APIRouter, Query, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


class SavedLocationDTO(BaseModel):
    id: str
    name: str
    address: str
    locality: str
    coordinates: List[float]
    type: str


class HomeStatusDTO(BaseModel):
    home_locality: str
    flood_risk_level: str
    forecast_rainfall_mm: float
    expected_peak_depth_cm: float
    time_window: str
    affected_roads_count: int
    is_home_safe: bool
    recommended_alternative: str


class RouteOptionDTO(BaseModel):
    route_id: str
    label: str
    distance_km: float
    travel_time_minutes: float
    max_water_depth_cm: float
    flood_exposure: str
    why_recommended: str


class HospitalAccessDTO(BaseModel):
    id: str
    name: str
    distance_km: float
    travel_time_min: int
    access_status: str
    access_road_name: str
    max_water_depth_cm: float
    emergency_phone: str


@router.get("/home/status", response_model=HomeStatusDTO)
async def get_home_status(
    locality: str = Query(default="Barasat Ward 4"),
    timestep_min: int = Query(default=30)
):
    """Returns early warning and flood risk summary for user's saved Home area."""
    return HomeStatusDTO(
        home_locality=locality,
        flood_risk_level="HIGH",
        forecast_rainfall_mm=88.5,
        expected_peak_depth_cm=35.0,
        time_window="4:00 PM – 7:00 PM IST Today",
        affected_roads_count=3,
        is_home_safe=False,
        recommended_alternative="NH-12 Elevated Bypass Corridor (+7 min, Max 8cm depth)"
    )


@router.get("/hospitals", response_model=List[HospitalAccessDTO])
async def get_nearby_hospitals(
    lat: float = Query(default=22.7214),
    lon: float = Query(default=88.4821)
):
    """Returns nearby hospital accessibility status and waterlogging risk."""
    return [
        HospitalAccessDTO(
            id="HOSP-01",
            name="Barasat Govt Medical College & District Hospital",
            distance_km=2.4,
            travel_time_min=8,
            access_status="ACCESSIBLE",
            access_road_name="NH-12 Elevated Bypass Corridor",
            max_water_depth_cm=8.0,
            emergency_phone="108"
        ),
        HospitalAccessDTO(
            id="HOSP-02",
            name="Barasat Sub-Divisional Hospital & Trauma Center",
            distance_km=3.1,
            travel_time_min=11,
            access_status="MODERATE_WATERLOGGING",
            access_road_name="Kachhari Road Entrance",
            max_water_depth_cm=14.0,
            emergency_phone="033-25523456"
        ),
        HospitalAccessDTO(
            id="HOSP-03",
            name="City Care Emergency Nursing Home",
            distance_km=4.0,
            travel_time_min=15,
            access_status="PREDICTED_FLOOD",
            access_road_name="Champadali Station Road",
            max_water_depth_cm=35.0,
            emergency_phone="033-25529999"
        ),
    ]


from app.services.routing_service import RoutingService
from app.services.geocoding_service import GeocodingService


@router.get("/geocode")
@router.get("/geocode/search")
async def geocode_search_api(q: str = Query(..., description="Location search query throughout India")):
    """Searches real location suggestions throughout India using OpenStreetMap Geocoder."""
    return await GeocodingService.search_address(q)


@router.get("/reverse-geocode")
@router.get("/geocode/reverse")
async def reverse_geocode_api(
    lat: float = Query(..., description="Latitude"),
    lon: float = Query(..., description="Longitude")
):
    """Reverse geocodes latitude/longitude coordinates into a real address."""
    return await GeocodingService.reverse_geocode(lat, lon)


@router.post("/routes/evaluate")
@router.get("/routes/evaluate")
@router.get("/route")
@router.get("/routes")
@router.get("/flood-risk/route")
async def evaluate_routes_api(
    origin: str = Query(default="Barasat"),
    destination: str = Query(default="Howrah Station"),
    vehicle_type: str = Query(default="CAR"),
    origin_lat: float = Query(default=22.7214),
    origin_lon: float = Query(default=88.4821),
    dest_lat: float = Query(default=22.5835),
    dest_lon: float = Query(default=88.3426),
):
    """Evaluates candidate Pan-India routes considering travel time, flood risk, and vehicle clearance."""
    res = await RoutingService.evaluate_routes(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        origin_name=origin,
        dest_name=destination,
        vehicle_type=vehicle_type,
    )
    return res


class LocationPointDTO(BaseModel):
    name: str = "Location"
    latitude: float
    longitude: float


class RouteRequestDTO(BaseModel):
    from_location: LocationPointDTO = Field(..., alias="from")
    to_location: LocationPointDTO = Field(..., alias="to")
    profile: str = Field(default="car")

    class Config:
        populate_by_name = True


@router.post("/routes")
@router.post("/routes/safe")
async def calculate_osrm_routes_post_api(payload: RouteRequestDTO):
    """Calculates canonical OSRM routes using JSON request payload."""
    v_type = "CAR"
    if payload.profile.lower() in ("bike", "bicycle", "cyclist"):
        v_type = "BIKE"
    elif payload.profile.lower() in ("walk", "walking", "pedestrian"):
        v_type = "WALK"
    elif payload.profile.upper() in ("AMBULANCE", "FIRE_ENGINE", "POLICE"):
        v_type = payload.profile.upper()

    return await RoutingService.evaluate_routes(
        origin_lat=payload.from_location.latitude,
        origin_lon=payload.from_location.longitude,
        dest_lat=payload.to_location.latitude,
        dest_lon=payload.to_location.longitude,
        origin_name=payload.from_location.name,
        dest_name=payload.to_location.name,
        vehicle_type=v_type,
    )


@router.get("/routes/evaluate-detailed")
@router.post("/recalculate")
@router.get("/recalculate")
async def evaluate_routes_detailed_api(
    origin: str = Query(default="Origin"),
    destination: str = Query(default="Destination"),
    vehicle_type: str = Query(default="CAR"),
    origin_lat: float = Query(default=22.7214),
    origin_lon: float = Query(default=88.4821),
    dest_lat: float = Query(default=22.5835),
    dest_lon: float = Query(default=88.3426),
):
    """Returns full detailed candidate routes with geometry coordinates and segment-by-segment flood colors."""
    return await RoutingService.evaluate_routes(
        origin_lat=origin_lat,
        origin_lon=origin_lon,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        origin_name=origin,
        dest_name=destination,
        vehicle_type=vehicle_type,
    )


class LocationPointFlexibleDTO(BaseModel):
    name: str = "Location"
    lat: Optional[float] = None
    lon: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    @property
    def get_lat(self) -> float:
        if self.lat is not None:
            return self.lat
        if self.latitude is not None:
            return self.latitude
        return 0.0

    @property
    def get_lon(self) -> float:
        if self.lon is not None:
            return self.lon
        if self.longitude is not None:
            return self.longitude
        return 0.0


class FloodSafeRouteRequestDTO(BaseModel):
    from_location: LocationPointFlexibleDTO = Field(..., alias="from")
    to_location: LocationPointFlexibleDTO = Field(..., alias="to")
    travel_mode: Optional[str] = Field(default=None)
    vehicle_type: Optional[str] = Field(default=None)
    profile: Optional[str] = Field(default=None)
    horizon_offset_hours: int = Field(default=0, ge=0, le=3)

    class Config:
        populate_by_name = True


@router.post("/flood-safe-route")
@router.post("/routes/flood-safe")
async def calculate_flood_safe_route_api(payload: FloodSafeRouteRequestDTO):
    """Calculates flood-safe route using OSRM candidate routes and temporal nowcast flood risk model."""
    v_type = "CAR"
    if payload.travel_mode:
        v_type = payload.travel_mode.upper()
    elif payload.vehicle_type:
        v_type = payload.vehicle_type.upper()
    elif payload.profile:
        p = payload.profile.lower()
        if p in ("bike", "bicycle", "cyclist"):
            v_type = "BIKE"
        elif p in ("walk", "walking", "pedestrian"):
            v_type = "WALK"
        else:
            v_type = payload.profile.upper()

    return await RoutingService.evaluate_routes(
        origin_lat=payload.from_location.get_lat,
        origin_lon=payload.from_location.get_lon,
        dest_lat=payload.to_location.get_lat,
        dest_lon=payload.to_location.get_lon,
        origin_name=payload.from_location.name,
        dest_name=payload.to_location.name,
        vehicle_type=v_type,
        horizon_offset_hours=payload.horizon_offset_hours,
    )



