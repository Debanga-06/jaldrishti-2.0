/**
 * JALDRISHTI - Urban Flood Digital Twin & Command Center Types
 */

export type FloodRiskLevel = 'SAFE' | 'CAUTION' | 'HIGH' | 'CRITICAL' | 'CLOSED';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type FactorImpactLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type OperationMode = 'LIVE' | 'SIMULATION' | 'HISTORICAL';
export type VehicleType = 'AMBULANCE' | 'FIRE_ENGINE' | 'POLICE' | 'BUS' | 'CAR' | 'PEDESTRIAN' | 'BIKE' | 'MOTORBIKE';

export interface CoordinatePoint {
  latitude: float;
  longitude: float;
}

export type float = number;

export interface ContributingFactorItem {
  factor: string;
  impact: FactorImpactLevel;
  weight_percentage: number;
  description: string;
  metric_value?: string;
}

export interface ConfidenceAssessmentBreakdown {
  overall_confidence: ConfidenceLevel;
  overall_score: number;
  data_freshness_score: number;
  input_completeness_score: number;
  model_health_score: number;
  historical_performance_score: number;
  details: Record<string, string>;
}

export interface LocationExplanationResponse {
  location_id: string;
  location_name?: string;
  ward_no?: number;
  predicted_depth_cm: number;
  time_to_flood_minutes: number;
  risk_level: FloodRiskLevel;
  confidence: ConfidenceLevel;
  contributing_factors: ContributingFactorItem[];
  primary_cause: string;
  confidence_breakdown?: ConfidenceAssessmentBreakdown;
  data_mode: OperationMode;
  metadata?: Record<string, any>;
}

export interface WeatherStationReading {
  station_id: string;
  station_name: string;
  latitude: number;
  longitude: number;
  ward_no: number;
  current_intensity_mm_hr: number;
  accumulated_1h_mm: number;
  accumulated_24h_mm: number;
  last_updated: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
}

export interface CatchmentSummary {
  city_name: string;
  total_wards: number;
  critical_wards_count: number;
  high_risk_wards_count: number;
  current_avg_rainfall_mm_hr: number;
  peak_predicted_depth_cm: number;
  average_drain_utilization_pct: number;
  active_alerts_count: number;
  pump_stations_operational: number;
  pump_stations_total: number;
  last_radar_sweep: string;
  nowcast_horizon_minutes: number;
}

export interface FloodHotspot {
  id: string;
  name: string;
  ward_no: number;
  coordinates: [number, number]; // [lon, lat]
  elevation_m: number;
  predicted_depth_cm: number;
  time_to_flood_minutes: number;
  risk_level: FloodRiskLevel;
  drain_utilization_pct: number;
  primary_cause: string;
}

export interface MunicipalAlert {
  id: string;
  severity: 'WARNING' | 'CRITICAL' | 'EMERGENCY' | 'ADVISORY';
  title: string;
  ward_no: number;
  affected_road: string;
  predicted_depth_cm: number;
  lead_time_minutes: number;
  timestamp: string;
  recommended_action: string;
}

export interface SafeRouteRequest {
  origin: CoordinatePoint;
  destination: CoordinatePoint;
  vehicle_type: VehicleType;
  departure_time?: string;
  forecast_horizon_min?: number;
}

export interface RouteSegmentDetail {
  segment_id: string;
  road_name: string;
  length_meters: number;
  travel_time_seconds: number;
  predicted_flood_depth_cm: number;
  risk_level: FloodRiskLevel;
  is_closed: boolean;
  confidence: ConfidenceLevel;
  coordinates: [number, number][];
}

export interface AvoidedRoadDetail {
  segment_id: string;
  road_name: string;
  ward_no?: number;
  predicted_flood_depth_cm: number;
  risk_level: FloodRiskLevel;
  reason_avoided: string;
}

export interface RouteStep {
  instruction: string;
  distance_meters: number;
  duration_seconds: number;
  street_name?: string;
  maneuver_type?: string;
  maneuver_modifier?: string;
  latitude?: number;
  longitude?: number;
}

export interface RouteOption {
  route_id: string;
  route_type: 'RECOMMENDED_SAFE' | 'SHORTEST_UNCONSTRAINED' | 'BALANCED_BYPASS' | string;
  route_label: string;
  distance_km: number;
  travel_time_minutes: number;
  distance_meters?: number;
  duration_seconds?: number;
  max_predicted_flood_depth_cm: number;
  flood_exposure_score: number;
  geometry: [number, number][];
  steps?: RouteStep[];
  segments: RouteSegmentDetail[];
  flood_points?: any[];
  avoided_roads: AvoidedRoadDetail[];
  advisory_status: string;
}

export interface SafeRouteResponse {
  request_id: string;
  generated_at: string;
  departure_time: string;
  vehicle_type: VehicleType;
  vehicle_clearance_limit_cm: number;
  recommended_route: RouteOption;
  alternative_routes: RouteOption[];
  overall_confidence: ConfidenceLevel;
  safety_disclaimer: string;
  metadata?: Record<string, any>;
}

export interface MapLayerVisibility {
  roads: boolean;
  floodDepth: boolean;
  floodExtent: boolean;
  rainfall: boolean;
  drainageNetwork: boolean;
  drainageStress: boolean;
  criticalInfra: boolean;
  safeRoutes: boolean;
}

export type CriticalInfrastructureType =
  | 'HOSPITAL'
  | 'FIRE_STATION'
  | 'POLICE'
  | 'RAILWAY'
  | 'EMERGENCY_SHELTER';

export type AccessRouteRiskLevel = 'SAFE' | 'COMPROMISED' | 'INACCESSIBLE';

export interface CriticalInfrastructureNode {
  id: string;
  name: string;
  type: CriticalInfrastructureType;
  ward_no: number;
  coordinates: [number, number]; // [lon, lat]
  elevation_m: number;
  facility_risk: FloodRiskLevel;
  facility_water_depth_cm: number;
  access_route_risk: AccessRouteRiskLevel;
  access_road_name: string;
  access_road_predicted_depth_cm: number;
  alternative_route_availability: string;
  operational_status: string;
  recommended_action: string;
}

export interface CityDecisionRecommendation {
  id: string;
  action: string;
  target_entity: string;
  urgency: 'IMMEDIATE' | 'HIGH' | 'PLANNED';
  reason: string;
  department: string;
  status?: 'RECOMMENDED' | 'ACKNOWLEDGED' | 'IN_PROGRESS';
}

export interface CityDecisionSupportData {
  critical_action_title: string;
  predicted_flood_lead_time_minutes: number;
  expected_depth_cm: number;
  target_location_name: string;
  drainage_node: string;
  primary_driver: string;
  recommendations: CityDecisionRecommendation[];
}

// ==========================================
// 1. HISTORICAL FLOOD REPLAY TYPES
// ==========================================
export type ReplayStage =
  | 'RAIN_STARTS'
  | 'RUNOFF'
  | 'DRAINAGE_STRESS'
  | 'SURCHARGE'
  | 'FLOODING'
  | 'PEAK_FLOOD';

export interface HistoricalReplayStep {
  stage: ReplayStage;
  label: string;
  timestep_offset_min: number; // e.g. -60, -45, -30, -15, 0, +30, +60
  rain_intensity_mm_hr: number;
  catchment_runoff_cumecs: number;
  drainage_network_stress_pct: number;
  surcharged_nodes_count: number;
  average_depth_cm: number;
  max_depth_cm: number;
  description: string;
  hydrological_mechanic: string;
}

export interface HistoricalReplayEvent {
  event_id: string;
  title: string;
  date_formatted: string;
  location: string;
  total_rainfall_mm: number;
  duration_hours: number;
  peak_inundation_area_sqkm: number;
  description: string;
  steps: HistoricalReplayStep[];
}

// ==========================================
// 2. VALIDATION LAB (GROUND TRUTH VS PREDICTED)
// ==========================================
export interface ValidationMetrics {
  iou: number; // Intersection over Union
  precision: number;
  recall: number;
  f1_score: number;
  mae_cm: number; // Mean Absolute Error
  rmse_cm: number; // Root Mean Squared Error
  timing_error_minutes: number; // Lead time timing error
  confusion_matrix: {
    true_positive_area_sqkm: number;
    false_positive_area_sqkm: number;
    false_negative_area_sqkm: number;
    true_negative_area_sqkm: number;
  };
}

export interface ValidationStationComparison {
  sensor_id: string;
  station_name: string;
  ward_no: number;
  observed_depth_cm: number;
  predicted_depth_cm: number;
  error_cm: number;
  status: 'OPTIMAL_FIT' | 'SLIGHT_VARIANCE' | 'ALERT_OUTLIER';
  observed_peak_time: string;
  predicted_peak_time: string;
  time_diff_min: number;
}

export interface ValidationLabData {
  benchmark_event: string;
  date: string;
  total_gauge_stations: number;
  satellite_imagery_source: string;
  metrics: ValidationMetrics;
  stations: ValidationStationComparison[];
  conclusion_summary: string;
}

// ==========================================
// 3. DATA HEALTH MONITORING
// ==========================================
export type DataHealthStatus = 'LIVE' | 'STALE' | 'DEGRADED' | 'DATA_UNAVAILABLE';

export interface DataFeedSourceHealth {
  source_id: string;
  source_name: string;
  category: 'RADAR' | 'RAIN_GAUGE' | 'SWMM_GIS' | 'TERRAIN' | 'IOT_WATER_LEVEL' | 'WEATHER_FORECAST';
  status: DataHealthStatus;
  last_updated: string;
  latency_ms: number;
  packet_loss_pct: number;
  frequency: string;
  protocol: string;
  description: string;
  failover_active: boolean;
}

// ==========================================
// 4. MODEL HEALTH & ENGINE TELEMETRY
// ==========================================
export interface ModelHealthTelemetry {
  physics_engine: {
    name: string;
    version: string;
    equations: string;
    conservation_law_mass_error_pct: number;
    status: 'ACTIVE_ONLINE' | 'STANDBY' | 'DEGRADED';
  };
  ml_surrogate: {
    name: string;
    architecture: string;
    model_version: string;
    pinn_loss: number;
    speedup_factor: string;
    status: 'OPTIMAL' | 'DEGRADED' | 'FALLBACK';
  };
  latest_prediction_timestamp: string;
  runtime_ms: number;
  cfd_equivalent_runtime_sec: number;
  forecast_horizon: string;
  model_version: string;
  gpu_utilization_pct: number;
  confidence_calibration_score: number;
}

export interface CWCObservedStation {
  station_name: string;
  latitude: number;
  longitude: number;
  district?: string;
  basin?: string;
  river?: string;
  observed_at?: string;
  rainfall_mm: number;
  data_state: 'OBSERVED' | 'STALE' | 'DATA_UNAVAILABLE';
}

export interface CWCObservedRainfallContext {
  source_type: 'OBSERVED';
  source_name: string;
  short_label: string;
  source_file?: string;
  data_state: 'OBSERVED' | 'STALE' | 'DATA_UNAVAILABLE';
  city?: string;
  latest_observed_at?: string;
  mean_rainfall_mm?: number;
  max_rainfall_mm?: number;
  total_stations_count?: number;
  stations?: CWCObservedStation[];
}

// ==========================================
// 5. PREDICTION PROVENANCE
// ==========================================
export interface PredictionProvenanceData {
  prediction_id: string;
  generated_at: string;
  valid_for: string;
  rainfall_source: string;
  observed_rainfall_source?: string;
  observed_rainfall_state?: string;
  cwc_telemetry_station?: string;
  cwc_observed_at?: string;
  terrain_dataset: string;
  drainage_dataset: string;
  model_version: string;
  data_mode: OperationMode;
  confidence: string;
  sha256_checksum: string;
  lineage_steps: string[];
  execution_environment: string;
}

// ==========================================
// 6. CHAMPIONSHIP UX UPGRADE TYPES
// ==========================================
export type ViewExperience = 'COMMAND_CENTER' | 'FOCUS_MODE' | 'CITIZEN';

export type MapFocusPreset =
  | 'ALL'
  | 'FLOOD'
  | 'RAIN'
  | 'ROADS'
  | 'DRAINAGE'
  | 'INFRA'
  | 'ROUTES';

export interface SIHDemoStep {
  stepNumber: number;
  title: string;
  subtitle: string;
  narrative: string;
  keyAction: string;
  targetTimestep: 0 | 15 | 30 | 45 | 60 | 90 | 120 | 180;
  targetLocationId?: string;
  targetInfraId?: string;
  targetRightTab?: 'decisions' | 'intelligence' | 'infrastructure' | 'hotspots' | 'alerts';
  openRoutingModal?: boolean;
  highlightedLayers?: Partial<MapLayerVisibility>;
}

// ==========================================
// 7. FLOOD-AWARE NAVIGATION & EARLY WARNING TYPES
// ==========================================
export type AppNavTab = 'HOME' | 'SEARCH' | 'ALERTS' | 'PROFILE';
export type ConsumerSearchMode = 'NORMAL' | 'MEDICAL' | 'FIRE_RESCUE';

export interface SavedLocation {
  id: string;
  name: string;
  address: string;
  locality: string;
  coordinates: [number, number]; // [lat, lon]
  type: 'HOME' | 'WORK' | 'FAVORITE';
  isSet?: boolean;
}

export interface UsualRoute {
  id: string;
  name: string;
  originName: string;
  destinationName: string;
  riskLevel: FloodRiskLevel;
  travelTimeMin: number;
  extraTimeMin: number;
  maxWaterDepthCm: number;
  affectedRoadsCount: number;
  recommendedAlternative: string;
}

export interface ConsumerAlert {
  id: string;
  title: string;
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY';
  locationName: string;
  forecastRainfallMm: string;
  possibleDepthCm: string;
  expectedWindow: string;
  recommendedAction: string;
  dateGroup: 'TODAY' | 'UPCOMING' | 'RESOLVED';
  timestamp: string;
  confidence: string;
  affectedRoads: string[];
}

export interface HospitalAccessNode {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'NURSING_HOME' | 'CLINIC';
  distanceKm: number;
  travelTimeMin: number;
  accessStatus: 'ACCESSIBLE' | 'MODERATE_WATERLOGGING' | 'PREDICTED_FLOOD';
  accessRoadName: string;
  maxWaterDepthCm: number;
  alternativeRouteSummary: string;
  coordinates: [number, number]; // [lat, lon]
  emergencyPhone: string;
}

export interface LocationSearchResult {
  display_name: string;
  locality: string;
  address: string;
  lat: number;
  lon: number;
  district?: string;
  state?: string;
  country?: string;
  source: string;
}

export interface CommunityFeedbackReply {
  id: string;
  userEmail: string;
  userName: string;
  text: string;
  timestamp: string;
  likes?: number;
  likedBy?: string[];
  dislikes?: number;
  dislikedBy?: string[];
}

export interface CommunityFeedback {
  id: string;
  spotId: string;
  userEmail: string;
  userName: string;
  text: string;
  photoUrl?: string | null;
  timestamp: string;
  likes: number;
  likedBy: string[];
  dislikes?: number;
  dislikedBy?: string[];
  replies: CommunityFeedbackReply[];
}

export interface RadarGridCell {
  cell_id: string;
  latitude: number;
  longitude: number;
  reflectivity_dbz: number;
  rainfall_rate_mm_h: number;
  provenance: string;
}

export interface RadarRainfallContext {
  source_type: string;
  source_name: string;
  short_label: string;
  full_source_label: string;
  station_id?: string;
  data_state: 'LIVE' | 'OBSERVED' | 'STALE' | 'DATA_UNAVAILABLE' | 'DEGRADED';
  city?: string;
  observed_at?: string | null;
  age_minutes?: number | null;
  reason?: string;
  mean_rainfall_mm_h: number;
  max_rainfall_mm_h: number;
  max_dbz: number;
  optical_flow_vector?: {
    u_kmh: number;
    v_kmh: number;
    bearing_deg: number;
  };
  total_grid_cells: number;
  rainfall_grid?: RadarGridCell[];
}

export interface RadarNowcastStep {
  offset_hours: number;
  label: string;
  timestamp: string;
  rainfall_intensity_mm_h: number;
  reflectivity_dbz: number;
  source_type: string;
  source_label: string;
  provenance_label: string;
  extrapolation_method: string;
}

export interface RadarResponse {
  status: string;
  radar_telemetry: RadarRainfallContext;
  nowcast_steps: RadarNowcastStep[];
}

export interface SurfaceFlowCell {
  cell_id: string;
  row: number;
  col: number;
  latitude: number;
  longitude: number;
  elevation_m: number;
  slope_percent: number;
  is_lowland_sink: boolean;
  flow_direction: string;
  rainfall_intensity_mm_h: number;
  rainfall_volume_m3: number;
  inflow_volume_m3: number;
  outflow_volume_m3: number;
  accumulated_volume_m3: number;
  water_depth_cm: number;
  neighbor_cell_ids: string[];
}

export interface SurfaceFlowResponse {
  status: string;
  horizon: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
    city_domain: string;
    matched_zone: string;
  };
  provenance: {
    rainfall_source: string;
    rainfall_provenance_badge: string;
    terrain_dataset: string;
    surface_model: string;
    flow_routing_algorithm: string;
  };
  physics_metrics: {
    cell_side_meters: number;
    cell_area_sq_m: number;
    rainfall_intensity_mm_h: number;
    rainfall_depth_metres: number;
    total_domain_rainfall_volume_m3: number;
    total_domain_accumulated_volume_m3: number;
    mass_conservation_status: string;
  };
  road_waterlogging_summary: Array<{
    road_name: string;
    max_predicted_depth_cm: number;
    avg_predicted_depth_cm: number;
    risk_level: string;
    status: string;
  }>;
  total_grid_cells: number;
  surface_grid: SurfaceFlowCell[];
}

export interface DrainageNode {
  node_id: string;
  latitude: number;
  longitude: number;
  elevation_m: number;
  node_type: 'INLET' | 'MANHOLE' | 'OUTFALL' | 'PUMPING_STATION';
  zone?: string;
  connected_road?: string;
  status: string;
}

export interface DrainageEdge {
  edge_id: string;
  from_node: string;
  to_node: string;
  drain_type: string;
  diameter_or_width_m: number;
  depth_m: number;
  length_m: number;
  nominal_capacity_m3_s: number;
  blockage_pct: number;
  blockage_status: string;
  effective_capacity_m3_s: number;
  is_assumed_parameters: boolean;
  status: string;
  flow_m3_s: number;
  capacity_utilization: number;
  overcapacity: boolean;
  surcharge_m3: number;
  backflow_occurred: boolean;
}

export interface DrainageRoadSummary {
  road_name: string;
  max_predicted_depth_cm: number;
  avg_predicted_depth_cm: number;
  drainage_node_id: string;
  drainage_type: string;
  capacity_utilization: number;
  overcapacity: boolean;
  surcharge: boolean;
  backflow: boolean;
  blockage_pct: number;
  blockage_status: string;
  risk_level: string;
  status: string;
}

export interface DrainageHydraulicsResponse {
  status: string;
  horizon: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
    city_domain: string;
    matched_zone: string;
  };
  provenance: {
    rainfall_source: string;
    rainfall_provenance_badge: string;
    terrain_dataset: string;
    surface_model: string;
    drainage_model: string;
    hydraulic_assumptions_badge: string;
    blockage_badge: string;
  };
  graph_summary: {
    total_nodes: number;
    total_edges: number;
    total_drainage_inflow_m3: number;
    total_drainage_outflow_m3: number;
    total_surcharge_backflow_m3: number;
    surcharged_nodes_count: number;
    max_association_distance_m: number;
    coupled_surface_cells_count: number;
  };
  mass_conservation: {
    initial_storage_m3: number;
    rainfall_volume_m3: number;
    drainage_inflow_m3: number;
    drainage_outflow_m3: number;
    backflow_volume_m3: number;
    remaining_surface_storage_m3: number;
    mass_balance_residual_m3: number;
    mass_conservation_status: string;
  };
  nodes: DrainageNode[];
  edges: DrainageEdge[];
  road_waterlogging_summary: DrainageRoadSummary[];
  surface_grid: Array<SurfaceFlowCell & { backflow_volume_m3?: number; drainage_node_associated?: string }>;
}

export interface StreetProjectionRecord {
  road_name: string;
  max_predicted_depth_cm: number;
  avg_predicted_depth_cm: number;
  risk_level: string;
  status: string;
  drainage_node_id: string;
  drainage_type: string;
  capacity_utilization: number;
  overcapacity: boolean;
  surcharge: boolean;
  backflow: boolean;
  blockage_pct: number;
  blockage_status: string;
  data_state: string;
  horizon: string;
}

export interface GisDashboardResponse {
  status: string;
  horizon: string;
  timestamp: string;
  location: {
    latitude: number;
    longitude: number;
    name: string;
    city_domain: string;
    matched_zone: string;
  };
  rainfall: {
    source: string;
    provenance_badge: string;
    intensity_mm_h: number;
  };
  surface_flow: {
    total_grid_cells: number;
    surface_model: string;
    surface_grid: SurfaceFlowCell[];
  };
  drainage_hydraulics: {
    drainage_model: string;
    graph_summary: any;
    mass_conservation: any;
    nodes: DrainageNode[];
    edges: DrainageEdge[];
  };
  street_projections: StreetProjectionRecord[];
  provenance: Record<string, string>;
}


