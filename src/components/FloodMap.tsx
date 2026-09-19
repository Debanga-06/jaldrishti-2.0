/**
 * FloodMap Component
 * High-Performance GIS Digital Twin Map using MapLibre GL & Canvas Vector Overlays.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// Vite bundles everything into one chunk, so MapLibre's own runtime guess for its worker
// script (relative to its chunk's import.meta.url) 404s in production. That worker file
// also has its own internal relative import ('./maplibre-gl-shared.mjs'), so it can't be
// pulled in via a bundler asset import (e.g. Vite's ?url) without that sibling chunk
// 404ing too. Both files are copied verbatim into /public/maplibre (see public/maplibre/)
// so they're served as static files with their relative import intact, and we point
// MapLibre at the copy before any Map is constructed. Without this, GeoJSON sources (the
// route line, flood-extent, drainage layers) silently never render — only raster basemap
// tiles work, since those are decoded on the main thread and don't need the worker.
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}maplibre/maplibre-gl-worker.mjs`);
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Compass,
  MapPin,
  Waves,
  Navigation,
  Activity,
  AlertCircle,
  Eye,
  HeartPulse,
  Flame,
  Shield,
  Train,
  Home,
  Building2,
  AlertTriangle,
  X,
  Clock,
} from 'lucide-react';
import { JaldrishtiApi } from '../services/api';
import { CommunityFeedbackSection } from './CommunityFeedbackSection';
import { GisDashboardResponse, StreetProjectionRecord, SurfaceFlowCell, FloodHotspot } from '../types';
import { FloodDashboardSummary } from './FloodDashboardSummary';
import { getMapLibreStyle } from '../config/mapProviderConfig';
import { simplifyDisplayGeometry } from '../utils/geometrySimplifier';

import { useFloodStore } from '../store/useFloodStore';


interface FloodMapProps {
  mode?: 'HOME' | 'SEARCH' | 'NAV';
}

// Dedicated route source / layer IDs (do not reuse for unrelated layers)
const ACTIVE_ROUTE_SOURCE = 'jaldrishti-active-route-src';
const ACTIVE_ROUTE_GLOW = 'jaldrishti-active-route-glow';
const ACTIVE_ROUTE_CORE = 'jaldrishti-active-route-core';
const CANDIDATE_ROUTE_SOURCE = 'jaldrishti-candidate-route-src';
const CANDIDATE_ROUTE_LAYER = 'jaldrishti-candidate-route-line';

// Bounded retry window for route rendering (~4.9s total; last attempt is forced). No setInterval.
const ROUTE_RETRY_DELAYS_MS = [100, 250, 500, 1000, 1000, 1000, 1000];

type RouteRenderStatus = 'rendered' | 'waiting' | 'idle' | 'failed' | 'busy';

// Publishes production debug state. Safe to call at any time (even before the style exists).
function writeRouteDebug(
  map: maplibregl.Map | null,
  mapLoaded: boolean,
  hasActiveRoute: boolean,
  selectedRouteIndex: number,
  extra: Record<string, any> = {}
) {
  const safe = <T,>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };
  (window as any).__JALDRISHTI_ROUTE_DEBUG = {
    mapLoaded,
    styleLoaded: map ? safe(() => map.isStyleLoaded()) : undefined,
    hasActiveRoute,
    selectedRouteIndex,
    sourceExists: !!(map && safe(() => map.getSource(ACTIVE_ROUTE_SOURCE))),
    glowExists: !!(map && safe(() => map.getLayer(ACTIVE_ROUTE_GLOW))),
    coreExists: !!(map && safe(() => map.getLayer(ACTIVE_ROUTE_CORE))),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

// Perpendicular distance in meters from point P [lon, lat] to line segment AB [[ax, ay], [bx, by]]
function distancePointToSegmentMeters(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): number {
  const latRad = (p[1] * Math.PI) / 180;
  const px = p[0] * 111000 * Math.cos(latRad);
  const py = p[1] * 111000;
  const ax = a[0] * 111000 * Math.cos(latRad);
  const ay = a[1] * 111000;
  const bx = b[0] * 111000 * Math.cos(latRad);
  const by = b[1] * 111000;

  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) {
    const dx = px - ax;
    const dy = py - ay;
    return Math.sqrt(dx * dx + dy * dy);
  }

  let t = (apx * abx + apy * aby) / abLenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * abx;
  const projY = ay + t * aby;

  const dx = px - projX;
  const dy = py - projY;
  return Math.sqrt(dx * dx + dy * dy);
}

// Minimum distance in meters from point P to an array of route line segments
function minDistanceToRouteSegmentsMeters(
  p: [number, number],
  routeSegments: [number, number][][]
): number {
  if (!routeSegments || routeSegments.length === 0) return 999999;
  let minD = Infinity;
  for (const seg of routeSegments) {
    const d = distancePointToSegmentMeters(p, seg[0], seg[1]);
    if (d < minD) minD = d;
  }
  return minD;
}

function extractCoordsFromGeometry(geom: any): [number, number][] {
  if (!geom) return [];
  if (Array.isArray(geom)) return geom;
  if (geom.coordinates && Array.isArray(geom.coordinates)) return geom.coordinates;
  if (geom.geometry) return extractCoordsFromGeometry(geom.geometry);
  return [];
}

// Robust coordinate normalizer: accepts arrays or GeoJSON objects, drops invalid / out-of-range points
function normalizeRouteCoordinates(geometry: any): [number, number][] {
  const raw = extractCoordsFromGeometry(geometry);

  if (!Array.isArray(raw)) return [];

  return raw
    .filter((coord: any) => {
      return (
        Array.isArray(coord) &&
        coord.length >= 2 &&
        Number.isFinite(Number(coord[0])) &&
        Number.isFinite(Number(coord[1]))
      );
    })
    .map((coord: any) => [Number(coord[0]), Number(coord[1])] as [number, number])
    .filter(([lng, lat]) => {
      return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
    });
}

// Convert route polyline geometry into array of line segments [[p1, p2], [p2, p3], ...]
function extractRouteSegments(routeGeometry: any): [number, number][][] {
  const routeCoords = extractCoordsFromGeometry(routeGeometry);
  if (!routeCoords || routeCoords.length < 2) return [];
  const segments: [number, number][][] = [];
  for (let i = 0; i < routeCoords.length - 1; i++) {
    segments.push([routeCoords[i], routeCoords[i + 1]]);
  }
  return segments;
}

// Strict polygon-to-route corridor clearance validation (rigorous geometric check across all vertices, edge samples, and inner area)
function minDistancePolygonToRouteMeters(
  polyCoords: [number, number][],
  routeSegments: [number, number][][]
): number {
  if (!routeSegments || routeSegments.length === 0) return 999999;
  let minD = Infinity;

  // 1. Check all polygon vertices
  for (const pt of polyCoords) {
    const d = minDistanceToRouteSegmentsMeters(pt, routeSegments);
    if (d < minD) minD = d;
  }

  // 2. Check sample points along EVERY polygon boundary edge (10 samples per edge)
  for (let i = 0; i < polyCoords.length - 1; i++) {
    const p1 = polyCoords[i];
    const p2 = polyCoords[i + 1];
    for (const frac of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]) {
      const samp: [number, number] = [
        p1[0] + (p2[0] - p1[0]) * frac,
        p1[1] + (p2[1] - p1[1]) * frac,
      ];
      const d = minDistanceToRouteSegmentsMeters(samp, routeSegments);
      if (d < minD) minD = d;
    }
  }

  // 3. Check inner area sample points inside bounding box
  const lons = polyCoords.map((p) => p[0]);
  const lats = polyCoords.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);

  for (const fx of [0.2, 0.4, 0.6, 0.8]) {
    for (const fy of [0.2, 0.4, 0.6, 0.8]) {
      const innerPt: [number, number] = [
        minLon + (maxLon - minLon) * fx,
        minLat + (maxLat - minLat) * fy,
      ];
      const d = minDistanceToRouteSegmentsMeters(innerPt, routeSegments);
      if (d < minD) minD = d;
    }
  }

  return minD;
}

function isPolygonClearOfRouteCorridor(
  polyCoords: [number, number][],
  routeSegments: [number, number][][],
  corridorBufferMeters: number = 60
): boolean {
  if (!routeSegments || routeSegments.length === 0) return true;
  const dist = minDistancePolygonToRouteMeters(polyCoords, routeSegments);
  return dist >= corridorBufferMeters;
}

// Generate compact CHOUKONA / 4-sided quadrilateral area-wise flood patch
// with slightly irregular/uneven edges and soft corners (30m to 70m across)
function generateChoukonaHazardPolygon(
  center: [number, number],
  radiusMeters: number = 35
): [number, number][] {
  const [lon, lat] = center;
  const latRad = (lat * Math.PI) / 180;

  // Deterministic seed derived from center coordinates (NO Math.random)
  const hashSeed = Math.abs(Math.sin(lon * 4321.123 + lat * 8765.567)) * 100.0;

  // 4 Main Quadrilateral Corner angles (deg) with slight deterministic perturbation
  const cornerAnglesDeg = [
    35 + 8 * Math.sin(hashSeed + 1),
    125 + 8 * Math.cos(hashSeed + 2),
    215 + 8 * Math.sin(hashSeed + 3),
    305 + 8 * Math.cos(hashSeed + 4),
  ];

  // 4 Main Corner Radii (meters) - wide compact quadrilateral (~30m to 70m across)
  const cornerRadii = [
    radiusMeters * (0.85 + 0.30 * Math.abs(Math.sin(hashSeed * 1.1))),
    radiusMeters * (0.85 + 0.30 * Math.abs(Math.cos(hashSeed * 1.3))),
    radiusMeters * (0.85 + 0.30 * Math.abs(Math.sin(hashSeed * 1.7))),
    radiusMeters * (0.85 + 0.30 * Math.abs(Math.cos(hashSeed * 1.9))),
  ];

  const ring: [number, number][] = [];

  // Generate 4-sided polygon with soft rounded corners and slightly irregular straight/curved edges
  for (let i = 0; i < 4; i++) {
    const cAngleRad = (cornerAnglesDeg[i] * Math.PI) / 180;
    const cRad = cornerRadii[i];

    // Main Corner vertex
    const cDLat = cRad / 111000;
    const cDLon = cRad / (111000 * Math.cos(latRad));
    ring.push([lon + cDLon * Math.cos(cAngleRad), lat + cDLat * Math.sin(cAngleRad)]);

    // 2 Mid-edge sub-points along side i to (i+1)%4 to create slightly uneven 4-sided edge
    const nextIdx = (i + 1) % 4;
    let a1 = cornerAnglesDeg[i];
    let a2 = cornerAnglesDeg[nextIdx];
    if (nextIdx === 0 && a2 < a1) a2 += 360;

    for (let t = 1; t <= 2; t++) {
      const frac = t / 3.0;
      const angleDeg = a1 + (a2 - a1) * frac;
      const angleRad = (angleDeg * Math.PI) / 180;
      const interpRad = (cornerRadii[i] * (1 - frac) + cornerRadii[nextIdx] * frac) * (0.94 + 0.12 * Math.sin(hashSeed + i * 2.1 + t));

      const mDLat = interpRad / 111000;
      const mDLon = interpRad / (111000 * Math.cos(latRad));
      ring.push([lon + mDLon * Math.cos(angleRad), lat + mDLat * Math.sin(angleRad)]);
    }
  }

  ring.push(ring[0]); // Close quadrilateral ring
  return ring;
}

// Explicit Water Body Exclusion (Hooghly River Channel)
function isCoordinateInWaterBody(lon: number, lat: number): boolean {
  if (lat >= 22.50 && lat <= 22.65) {
    if (lat >= 22.50 && lat <= 22.55 && lon >= 88.315 && lon <= 88.336) return true;
    if (lat > 22.55 && lat <= 22.60 && lon >= 88.338 && lon <= 88.349) return true;
    if (lat > 22.60 && lat <= 22.65 && lon >= 88.342 && lon <= 88.362) return true;
  }
  return false;
}

function isPolygonOnLand(polyCoords: [number, number][]): boolean {
  for (const pt of polyCoords) {
    if (isCoordinateInWaterBody(pt[0], pt[1])) return false;
  }
  return true;
}

// Backward compatibility aliases
const generateOrganicWaterloggingPolygon = generateChoukonaHazardPolygon;
const generateIrregularHazardPolygon = generateChoukonaHazardPolygon;
const generateCompactHazardPolygon = generateChoukonaHazardPolygon;

// Deterministic Search & Geometric Validation Engine for Off-Route Hazard & Depth Marker Relocation
function relocateAndValidateHazard(
  baseCenter: [number, number],
  routeSegments: [number, number][][],
  corridorBufferMeters: number = 60,
  polygonRadiusMeters: number = 28
): { center: [number, number]; polygonCoords: [number, number][][]; minDistanceMeters: number } {
  const initialPoly = generateChoukonaHazardPolygon(baseCenter, polygonRadiusMeters);
  const initialDist = minDistancePolygonToRouteMeters(initialPoly, routeSegments);

  if (
    !isCoordinateInWaterBody(baseCenter[0], baseCenter[1]) &&
    isPolygonOnLand(initialPoly) &&
    (!routeSegments || routeSegments.length === 0 || initialDist >= corridorBufferMeters)
  ) {
    return { center: baseCenter, polygonCoords: [initialPoly], minDistanceMeters: initialDist };
  }

  // Expanded candidate radial search: 32 directions, expanding distances from 50m to 800m
  const angles: number[] = [];
  for (let a = 0; a < 360; a += 11.25) {
    angles.push(a);
  }
  const distances = [50, 70, 95, 125, 160, 200, 250, 310, 380, 460, 550, 650, 800];

  const [bLon, bLat] = baseCenter;
  const bLatRad = (bLat * Math.PI) / 180;

  let bestLandCandidate: { center: [number, number]; poly: [number, number][]; dist: number } | null = null;
  let maxLandDist = -1;

  for (const dist of distances) {
    const dLat = dist / 111000;
    const dLon = dist / (111000 * Math.cos(bLatRad));

    for (const angleDeg of angles) {
      const angleRad = (angleDeg * Math.PI) / 180;
      const cLon = bLon + dLon * Math.cos(angleRad);
      const cLat = bLat + dLat * Math.sin(angleRad);
      const candCenter: [number, number] = [cLon, cLat];

      if (isCoordinateInWaterBody(cLon, cLat)) continue;

      const candPoly = generateChoukonaHazardPolygon(candCenter, polygonRadiusMeters);
      if (!isPolygonOnLand(candPoly)) continue;

      const candDist = minDistancePolygonToRouteMeters(candPoly, routeSegments);

      if (!routeSegments || routeSegments.length === 0 || candDist >= corridorBufferMeters) {
        return { center: candCenter, polygonCoords: [candPoly], minDistanceMeters: candDist };
      }

      if (candDist > maxLandDist) {
        maxLandDist = candDist;
        bestLandCandidate = { center: candCenter, poly: candPoly, dist: candDist };
      }
    }
  }

  if (bestLandCandidate) {
    return {
      center: bestLandCandidate.center,
      polygonCoords: [bestLandCandidate.poly],
      minDistanceMeters: bestLandCandidate.dist,
    };
  }

  // Absolute fallback: shift inland and scale radius until strictly on land
  const isEastBank = bLon > 88.34;
  let shiftLon = isEastBank ? 0.008 : -0.008;
  let fbCenter: [number, number] = [bLon + shiftLon, bLat];
  let fbPoly = generateChoukonaHazardPolygon(fbCenter, 24);

  while (isCoordinateInWaterBody(fbCenter[0], fbCenter[1]) || !isPolygonOnLand(fbPoly)) {
    fbCenter[0] += isEastBank ? 0.002 : -0.002;
    fbPoly = generateChoukonaHazardPolygon(fbCenter, 24);
  }

  const fbDist = minDistancePolygonToRouteMeters(fbPoly, routeSegments);
  return { center: fbCenter, polygonCoords: [fbPoly], minDistanceMeters: fbDist };
}

(window as any).relocateAndValidateHazard = relocateAndValidateHazard;
(window as any).extractRouteSegments = extractRouteSegments;

// Backward compatibility helper for geometry nudging using geometric relocation engine
function nudgeGeometryAwayFromRoute(
  coordinates: any,
  routeCoords: [number, number][],
  safetyBufferMeters: number = 30
): any {
  if (!routeCoords || routeCoords.length === 0) return coordinates;

  const segments = extractRouteSegments(routeCoords);
  const pts: [number, number][] = [];
  function collectPoints(arr: any) {
    if (typeof arr[0] === 'number') {
      pts.push([arr[0], arr[1]]);
    } else if (Array.isArray(arr)) {
      arr.forEach(collectPoints);
    }
  }
  collectPoints(coordinates);
  if (pts.length === 0) return coordinates;

  const centroid: [number, number] = [
    pts.reduce((acc, p) => acc + p[0], 0) / pts.length,
    pts.reduce((acc, p) => acc + p[1], 0) / pts.length,
  ];

  const validated = relocateAndValidateHazard(centroid, segments, safetyBufferMeters, 25);

  const offsetLon = validated.center[0] - centroid[0];
  const offsetLat = validated.center[1] - centroid[1];

  function shiftPoints(arr: any): any {
    if (typeof arr[0] === 'number') {
      return [arr[0] + offsetLon, arr[1] + offsetLat];
    }
    return arr.map(shiftPoints);
  }

  return shiftPoints(coordinates);
}

// Helper to determine if a point belongs to the PURPLE category (CRITICAL/CLOSED or depth >= 45 cm)
const isPurplePoint = (pt: any): boolean => {
  if (!pt) return false;
  const depth = pt.predicted_water_depth_cm ?? pt.numeric_depth_cm ?? pt.depth ?? 0;
  const risk = (pt.risk_level || '').toUpperCase();
  const cat = (pt.category || pt.color || '').toUpperCase();

  return (
    risk === 'CRITICAL' ||
    risk === 'CLOSED' ||
    risk === 'PURPLE' ||
    cat === 'PURPLE' ||
    depth >= 45
  );
};

export const FloodMap: React.FC<FloodMapProps> = ({ mode = 'SEARCH' }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const homeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const fromMarkerRef = useRef<maplibregl.Marker | null>(null);
  const toMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userGpsMarkerRef = useRef<maplibregl.Marker | null>(null);
  const floodPointMarkersRef = useRef<maplibregl.Marker[]>([]);

  // Route rendering bookkeeping (prevents idle -> render -> setData/fitBounds -> idle loops)
  const lastFittedRouteKeyRef = useRef<string | null>(null);
  const lastRouteDataKeyRef = useRef<string | null>(null);
  const lastRouteResponseRef = useRef<any>(null);
  const isRenderingRouteRef = useRef<boolean>(false);
  const routeWaitingLoggedRef = useRef<boolean>(false);

  const [selectedFloodPoint, setSelectedFloodPoint] = useState<any | null>(null);

  const {
    currentTimestep,
    layers,
    selectedLocationId,
    setSelectedLocationId,
    selectedInfraId,
    setSelectedInfraId,
    activeRouteResponse,
    selectedRouteIndex,
    isLiveNavActive,
    userGpsCoords,
    setActiveRightTab,
    viewExperience,
    savedHome,
    selectedFromLocation,
    nowcastSelectedOffset,
    nowcastData,
    setNowcastOffset,
    setNowcastData,
  } = useFloodStore() as any; // route response carries extra fields (origin/destination/candidate_routes) not in SafeRouteResponse

  // Latest GPS coords without forcing route renderer to re-subscribe on every GPS tick
  const userGpsCoordsRef = useRef<any>(userGpsCoords);
  userGpsCoordsRef.current = userGpsCoords;

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [mapViewportVersion, setMapViewportVersion] = useState<number>(0);
  // Bumped once when the map first goes idle so the flood/drainage overlay effect can re-run after tiles finish
  const [mapIdleVersion, setMapIdleVersion] = useState<number>(0);
  const [hoveredHotspot, setHoveredHotspot] = useState<FloodHotspot | null>(null);
  const [hoveredInfra, setHoveredInfra] = useState<any | null>(null);
  const [dynamicPrediction, setDynamicPrediction] = useState<any | null>(null);
  const [selectedPredictionPoint, setSelectedPredictionPoint] = useState<any | null>(null);

  // Memoized Hazard Relocation Calculation Engine (Prevents 6,000+ geometric radial loops per frame during panning/zooming)
  const memoizedValidatedPoints = React.useMemo(() => {
    const allRoutes = (mode !== 'HOME' && activeRouteResponse)
      ? [
          activeRouteResponse.recommended_route,
          ...(activeRouteResponse.candidate_routes || []),
          ...(activeRouteResponse.alternative_routes || []),
          ...(activeRouteResponse.routes || []),
        ].filter(Boolean)
      : [];
    const activeRoute = allRoutes[selectedRouteIndex] || allRoutes[0];

    const routeSegments: [number, number][][] = [];
    allRoutes.forEach((r: any) => {
      if (r.geometry) {
        routeSegments.push(...extractRouteSegments(r.geometry));
      }
    });

    const nowcastPoints = nowcastData?.timesteps?.[nowcastSelectedOffset]?.prediction_points;

    const currentPoints = (nowcastPoints && nowcastPoints.length > 0)
      ? nowcastPoints
      : (dynamicPrediction?.prediction_points || []);

    return (currentPoints || [])
      .filter((pt: any) => pt !== null && pt !== undefined)
      .map((pt: any) => {
        const rawLon = pt.longitude !== undefined ? pt.longitude : (pt.lon !== undefined ? pt.lon : (pt.lng !== undefined ? pt.lng : (pt.coords ? pt.coords[0] : undefined)));
        const rawLat = pt.latitude !== undefined ? pt.latitude : (pt.lat !== undefined ? pt.lat : (pt.coords ? pt.coords[1] : undefined));

        if (rawLon === undefined || rawLat === undefined || isNaN(Number(rawLon)) || isNaN(Number(rawLat))) {
          return null;
        }

        const depth = pt.predicted_water_depth_cm ?? pt.numeric_depth_cm ?? pt.depth ?? 10.0;
        const spotName = pt.spot_name || pt.description || 'Waterlogging Area';

        const validated = relocateAndValidateHazard([Number(rawLon), Number(rawLat)], routeSegments, 65, 25);
        return {
          ...pt,
          rawLon: Number(rawLon),
          rawLat: Number(rawLat),
          depth,
          spotName,
          validatedCenter: validated.center,
          validatedPolyCoords: validated.polygonCoords,
        };
      })
      .filter(Boolean);
  }, [activeRouteResponse, selectedRouteIndex, dynamicPrediction, mode, nowcastData, nowcastSelectedOffset]);

  const [gisDashboardData, setGisDashboardData] = useState<GisDashboardResponse | null>(null);
  const [selectedStreet, setSelectedStreet] = useState<StreetProjectionRecord | null>(null);
  const [selectedCell, setSelectedCell] = useState<SurfaceFlowCell | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(false);

  // Fetch dynamic location prediction from multi-factor prediction engine & Part 5 Web GIS Dashboard
  useEffect(() => {
    let lat = 22.7214;
    let lon = 88.4821;
    let locName = 'Target Location';

    const map = mapInstanceRef.current;

    if (selectedFromLocation?.lat && selectedFromLocation?.lon) {
      lat = selectedFromLocation.lat;
      lon = selectedFromLocation.lon;
      locName = selectedFromLocation.locality || selectedFromLocation.display_name || 'Selected Location';
    } else if (activeRouteResponse?.origin?.coordinates) {
      lat = activeRouteResponse.origin.coordinates[0];
      lon = activeRouteResponse.origin.coordinates[1];
      locName = activeRouteResponse.origin.name || 'Search Location';
    } else if (mode === 'HOME' && savedHome?.coordinates && (savedHome.coordinates[0] !== 0 || savedHome.coordinates[1] !== 0)) {
      lat = savedHome.coordinates[0];
      lon = savedHome.coordinates[1];
      locName = savedHome.locality || savedHome.address || 'Saved Home';
    } else if (map) {
      const center = map.getCenter();
      lat = center.lat;
      lon = center.lng;
      locName = 'Map View';
    } else if (savedHome?.coordinates && (savedHome.coordinates[0] !== 0 || savedHome.coordinates[1] !== 0)) {
      lat = savedHome.coordinates[0];
      lon = savedHome.coordinates[1];
      locName = savedHome.locality || savedHome.address || 'Saved Home';
    }

    JaldrishtiApi.getWaterloggingPrediction(lat, lon, locName).then((res) => {
      if (res && res.prediction_points) {
        setDynamicPrediction(res);
      }
    });

    JaldrishtiApi.getFloodNowcast(lat, lon, locName).then((res) => {
      if (res && res.timesteps) {
        setNowcastData(res);
      }
    });

    setIsLoadingDashboard(true);
    JaldrishtiApi.getGisDashboard(lat, lon, locName, nowcastSelectedOffset).then((res) => {
      if (res) {
        setGisDashboardData(res);
      }
      setIsLoadingDashboard(false);
    });
  }, [savedHome, activeRouteResponse, selectedFromLocation, mode, nowcastSelectedOffset, mapLoaded]);


  // Helper to project lon/lat coordinates to canvas pixel position within viewport bounds
  const projectCoord = (lon: number, lat: number) => {
    const map = mapInstanceRef.current;
    if (!map || lon === undefined || lat === undefined || isNaN(Number(lon)) || isNaN(Number(lat))) return null;
    try {
      const pt = map.project([Number(lon), Number(lat)]);
      if (!pt || isNaN(pt.x) || isNaN(pt.y)) return null;
      const container = mapContainerRef.current;
      if (!container) return null;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w === 0 || h === 0) return null;
      if (pt.x < -60 || pt.x > w + 60 || pt.y < -60 || pt.y > h + 60) {
        return null;
      }
      return { x: pt.x, y: pt.y };
    } catch {
      return null;
    }
  };

  // Default Map Center Coordinates (India Center / Neutral Location)
  const DEFAULT_MAP_CENTER: [number, number] = [78.9629, 20.5937];

  // Hotspots data removed per Rule 14: Single Source of Truth (backend FloodPredictionService)
  const hotspots: FloodHotspot[] = [];

  // Critical infrastructure nodes
  const criticalInfra = [
    {
      id: 'INFRA-HOSP-01',
      name: 'Barasat Govt Medical College & Hospital',
      type: 'HOSPITAL',
      coords: [88.4785, 22.7265],
      depth: Math.min(18, Math.round(4 + currentTimestep * 0.15)),
      risk: currentTimestep >= 60 ? 'CAUTION' : 'SAFE',
      accessRisk: currentTimestep >= 45 ? 'COMPROMISED' : 'SAFE',
    },
    {
      id: 'INFRA-FIRE-01',
      name: 'Barasat Central Fire & Rescue Station',
      type: 'FIRE_STATION',
      coords: [88.4815, 22.7195],
      depth: Math.min(12, Math.round(3 + currentTimestep * 0.1)),
      risk: 'SAFE',
      accessRisk: currentTimestep >= 30 ? 'COMPROMISED' : 'SAFE',
    },
    {
      id: 'INFRA-POL-01',
      name: 'Barasat Police Station & Traffic Guard',
      type: 'POLICE',
      coords: [88.4830, 22.7245],
      depth: 5,
      risk: 'SAFE',
      accessRisk: 'SAFE',
    },
    {
      id: 'INFRA-RAIL-01',
      name: 'Barasat Railway Junction Gate',
      type: 'RAILWAY',
      coords: [88.4870, 22.7240],
      depth: Math.min(32, Math.round(12 + currentTimestep * 0.4)),
      risk: currentTimestep >= 30 ? 'HIGH' : 'CAUTION',
      accessRisk: currentTimestep >= 30 ? 'COMPROMISED' : 'SAFE',
    },
    {
      id: 'INFRA-SHELTER-01',
      name: 'Barasat Stadium Emergency Shelter',
      type: 'EMERGENCY_SHELTER',
      coords: [88.4860, 22.7150],
      depth: 2,
      risk: 'SAFE',
      accessRisk: 'SAFE',
    },
  ];

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      const isLight = viewExperience === 'CITIZEN';
      const initialCenter: [number, number] = savedHome?.coordinates
        ? [savedHome.coordinates[1], savedHome.coordinates[0]] // MapLibre uses [lng, lat] order
        : DEFAULT_MAP_CENTER;

      const initialZoom = savedHome?.coordinates ? 14.2 : 5;

      // MapLibre GIS style definition with HiDPI / 4K native canvas pixel ratio support
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapLibreStyle(isLight),
        center: initialCenter,
        zoom: initialZoom,
        maxZoom: 22,
        pitch: isLight ? 0 : 35,
        bearing: isLight ? 0 : -10,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 3),
        trackResize: true,
        maxTileCacheSize: 120,
        scrollZoom: true,
        dragPan: true,
        dragRotate: true,
        doubleClickZoom: true,
        touchZoomRotate: true,
      });

      mapInstanceRef.current = map;
      (window as any)._mapInstance = map;

      // Automatic container resize observer for sharp rendering on 1080p / 4K / Mobile displays
      const resizeObserver = new ResizeObserver(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.resize();
        }
      });

      if (mapContainerRef.current) {
        resizeObserver.observe(mapContainerRef.current);
      }

      // Map readiness: 'load' normally fires, but on some production builds it is delayed (tiles slow
      // or blocked). So 'styledata' / 'idle' also mark the map ready as soon as the style JSON is parsed.
      let readyHandled = false;
      let animFrameId: number | null = null;
      const onMove = () => {
        if (animFrameId === null) {
          animFrameId = requestAnimationFrame(() => {
            setMapViewportVersion((v) => v + 1);
            animFrameId = null;
          });
        }
      };

      const markMapReady = (reason: string) => {
        if (readyHandled) return;
        try {
          if (!map.getStyle()) return; // style JSON not parsed yet
        } catch {
          return;
        }
        readyHandled = true;
        console.log(`[JALDRISHTI] Map ready (${reason}), styleLoaded=${map.isStyleLoaded()}`);
        setMapLoaded(true);
        map.resize();
        map.resize();
        map.on('move', onMove);

        // Initial Home Pin placement
        if (savedHome?.coordinates) {
          const [lat, lon] = savedHome.coordinates;
          const center: [number, number] = [lon, lat];
          const el = document.createElement('div');
          el.className = 'w-9 h-9 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-xs ring-4 ring-blue-600/30';
          el.innerHTML = '🏠';
          el.title = `Home: ${savedHome.locality || savedHome.address}`;

          const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
            `<div style="font-family:sans-serif;padding:4px;">
              <strong style="color:#0f172a;">🏠 ${savedHome.locality || 'Saved Home'}</strong>
              <p style="font-size:11px;color:#64748b;margin:2px 0 0 0;">${savedHome.address}</p>
              <p style="font-size:10px;color:#2563eb;margin-top:4px;">Lat: ${lat.toFixed(6)}°, Lon: ${lon.toFixed(6)}°</p>
            </div>`
          );

          if (homeMarkerRef.current) {
            homeMarkerRef.current.remove();
          }
          homeMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(center).setPopup(popup).addTo(map);
        }
      };

      map.on('load', () => {
        markMapReady('load');
        setMapIdleVersion((v) => v + 1);
      });
      map.on('styledata', () => markMapReady('styledata'));
      map.once('idle', () => {
        markMapReady('idle');
        setMapIdleVersion((v) => v + 1);
      });

      return () => {
        try {
          resizeObserver.disconnect();
          if (homeMarkerRef.current) {
            homeMarkerRef.current.remove();
            homeMarkerRef.current = null;
          }
          map.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
        mapInstanceRef.current = null;
        setMapLoaded(false);
      };
    } catch (err) {
      console.warn('MapLibre GL initialization fallback:', err);
    }
  }, [viewExperience]);

  // Unified Camera & Home Pin Sync Effect: Fly map to target coordinates whenever mode, savedHome, or selected location updates
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded) return;

    let targetLat: number | null = null;
    let targetLon: number | null = null;

    if (mode === 'HOME') {
      if (savedHome?.coordinates && (savedHome.coordinates[0] !== 0 || savedHome.coordinates[1] !== 0)) {
        targetLat = savedHome.coordinates[0];
        targetLon = savedHome.coordinates[1];
      }
    } else {
      if (selectedFromLocation?.lat && selectedFromLocation?.lon) {
        targetLat = selectedFromLocation.lat;
        targetLon = selectedFromLocation.lon;
      }
    }

    if (targetLat !== null && targetLon !== null && targetLat !== 0 && targetLon !== 0) {
      map.flyTo({
        center: [targetLon, targetLat],
        zoom: 14.5,
        essential: true,
        duration: 700,
      });

      // Update or create Home Marker when savedHome is set
      if (savedHome?.coordinates && (savedHome.coordinates[0] !== 0 || savedHome.coordinates[1] !== 0)) {
        const homeLat = savedHome.coordinates[0];
        const homeLon = savedHome.coordinates[1];
        const homeCenter: [number, number] = [homeLon, homeLat];

        const popupHtml = `<div style="font-family:sans-serif;padding:4px;">
          <strong style="color:#0f172a;">🏠 ${savedHome.locality || 'Saved Home'}</strong>
          <p style="font-size:11px;color:#64748b;margin:2px 0 0 0;">${savedHome.address}</p>
          <p style="font-size:10px;color:#2563eb;margin-top:4px;">Lat: ${homeLat.toFixed(6)}°, Lon: ${homeLon.toFixed(6)}°</p>
        </div>`;

        if (homeMarkerRef.current) {
          homeMarkerRef.current.setLngLat(homeCenter);
          const popup = homeMarkerRef.current.getPopup();
          if (popup) popup.setHTML(popupHtml);
        } else {
          const el = document.createElement('div');
          el.className = 'w-9 h-9 rounded-full bg-blue-600 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-xs ring-4 ring-blue-600/30';
          el.innerHTML = '🏠';
          el.title = `Home: ${savedHome.locality || savedHome.address}`;

          homeMarkerRef.current = new maplibregl.Marker({ element: el })
            .setLngLat(homeCenter)
            .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
            .addTo(map);
        }
      }
    }
  }, [mode, savedHome, selectedFromLocation, dynamicPrediction, mapLoaded]);

  // Update Dynamic Overlays (Flood polygon extent, drainage lines, mode-based marker cleanup, GPS marker)
  // NOTE: The route polyline itself (source + layers), FROM/TO markers and route camera fit are handled
  // by the dedicated renderActiveRoute effect further below.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;

    try {
      // Extract ALL active route line segments to build a 100% strict geometric exclusion corridor
      const allRoutes = activeRouteResponse
        ? [
            activeRouteResponse.recommended_route,
            ...(activeRouteResponse.candidate_routes || []),
            ...(activeRouteResponse.alternative_routes || []),
            ...(activeRouteResponse.routes || []),
          ].filter(Boolean)
        : [];
      const activeRoute = allRoutes[selectedRouteIndex] || allRoutes[0];

      const routeSegments: [number, number][][] = [];
      allRoutes.forEach((r: any) => {
        if (r.geometry) {
          routeSegments.push(...extractRouteSegments(r.geometry));
        }
      });

      // 1. Add / Update 2D Flood Inundation Depth Extent (Single Source of Truth: Backend Prediction Points)
      const currentPoints = activeRouteResponse
        ? (activeRoute?.flood_points || [])
        : (dynamicPrediction?.prediction_points || []);

      const floodExtentFeatures = memoizedValidatedPoints.map((pt: any) => ({
        type: 'Feature',
        properties: { depth: pt.depth, name: pt.spotName },
        geometry: {
          type: 'Polygon',
          coordinates: pt.validatedPolyCoords,
        },
      }));

      const floodExtentGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: floodExtentFeatures as any,
      };
      (window as any).__floodExtentGeoJSON = floodExtentGeoJSON;

      if (map.getSource('flood-extent-src')) {
        (map.getSource('flood-extent-src') as maplibregl.GeoJSONSource).setData(floodExtentGeoJSON);
      } else {
        map.addSource('flood-extent-src', {
          type: 'geojson',
          data: floodExtentGeoJSON,
        });

        // Insert BELOW the active route (if it already exists) so route lines added earlier
        // can never end up visually buried under a later-added flood overlay.
        const routeFloor = map.getLayer(ACTIVE_ROUTE_GLOW) ? ACTIVE_ROUTE_GLOW : undefined;

        map.addLayer({
          id: 'flood-extent-fill',
          type: 'fill',
          source: 'flood-extent-src',
          paint: {
            'fill-color': [
              'interpolate',
              ['linear'],
              ['get', 'depth'],
              3, '#3b82f6',   // BLUE (Low Risk < 5 cm)
              10, '#eab308',  // YELLOW (Moderate Risk 5 - 15 cm)
              20, '#f97316',  // ORANGE (High Risk 15 - 30 cm)
              35, '#ef4444',  // RED (Very High Risk 30 - 45 cm)
              50, '#a855f7',  // PURPLE (Critical Risk >= 45 cm)
            ],
            'fill-opacity': 0.45,
          },
        }, routeFloor);

        map.addLayer({
          id: 'flood-extent-line',
          type: 'line',
          source: 'flood-extent-src',
          paint: {
            'line-color': '#ea580c',
            'line-width': 1.5,
          },
        }, routeFloor);
      }

      if (map.getLayer('flood-extent-fill')) {
        map.setLayoutProperty('flood-extent-fill', 'visibility', layers.floodDepth ? 'visible' : 'none');
        map.setLayoutProperty('flood-extent-line', 'visibility', layers.floodExtent ? 'visible' : 'none');
      }

      // 2. Add / Update 1D Stormwater Drainage Network
      const drainageGeoJSON: GeoJSON.FeatureCollection = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { status: 'SURCHARGED', name: 'Jessore Main Storm Sewer' },
            geometry: {
              type: 'LineString',
              coordinates: [[88.4805, 22.7160], [88.4845, 22.7180], [88.4870, 22.7240], [88.4895, 22.7275]],
            },
          },
          {
            type: 'Feature',
            properties: { status: 'NORMAL', name: 'NH-12 Western Bypass Culvert' },
            geometry: {
              type: 'LineString',
              coordinates: [[88.4790, 22.7120], [88.4765, 22.7220], [88.4750, 22.7310]],
            },
          },
        ],
      };

      if (map.getSource('drainage-src')) {
        (map.getSource('drainage-src') as maplibregl.GeoJSONSource).setData(drainageGeoJSON);
      } else {
        map.addSource('drainage-src', {
          type: 'geojson',
          data: drainageGeoJSON,
        });

        map.addLayer({
          id: 'drainage-lines',
          type: 'line',
          source: 'drainage-src',
          paint: {
            'line-color': ['match', ['get', 'status'], 'SURCHARGED', '#c084fc', '#6366f1'],
            'line-width': 3,
          },
        }, map.getLayer(ACTIVE_ROUTE_GLOW) ? ACTIVE_ROUTE_GLOW : undefined);
      }

      if (map.getLayer('drainage-lines')) {
        map.setLayoutProperty('drainage-lines', 'visibility', layers.drainageNetwork ? 'visible' : 'none');
      }

      // 4. Mode-based marker cleanup (route line, FROM/TO markers and route camera fit live in renderActiveRoute)
      if (mode === 'HOME') {
        // Clear Search Markers when on Home View
        if (fromMarkerRef.current) { fromMarkerRef.current.remove(); fromMarkerRef.current = null; }
        if (toMarkerRef.current) { toMarkerRef.current.remove(); toMarkerRef.current = null; }
        floodPointMarkersRef.current.forEach((m) => m.remove());
        floodPointMarkersRef.current = [];

        // Ensure Home Marker is rendered & Camera is at Home
        if (savedHome?.coordinates) {
          const [lat, lon] = savedHome.coordinates;
          map.flyTo({ center: [lon, lat], zoom: 14.5, duration: 1200 });
        }
      } else if ((mode === 'SEARCH' || mode === 'NAV') && activeRouteResponse) {
        // Hide Home Marker during Search/Nav Mode
        if (homeMarkerRef.current) { homeMarkerRef.current.remove(); homeMarkerRef.current = null; }

        // Live GPS Position Marker Update ("YOU ARE HERE") - no continuous fitBounds during navigation
        if (isLiveNavActive && userGpsCoords) {
          const gpsLngLat: [number, number] = [userGpsCoords[1], userGpsCoords[0]];
          if (userGpsMarkerRef.current) {
            userGpsMarkerRef.current.setLngLat(gpsLngLat);
          } else {
            const el = document.createElement('div');
            el.className = 'relative flex items-center justify-center';
            el.innerHTML = `
              <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-blue-400 opacity-75"></span>
              <div class="relative w-6 h-6 bg-blue-600 border-2 border-white rounded-full shadow-xl flex items-center justify-center text-white text-[10px] font-bold">
                🎯
              </div>
            `;
            el.title = 'YOU ARE HERE (Live GPS Location)';
            userGpsMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(gpsLngLat).addTo(map);
          }
        } else if (userGpsMarkerRef.current) {
          userGpsMarkerRef.current.remove();
          userGpsMarkerRef.current = null;
        }
      } else {
        // Clear Search Markers when activeRouteResponse is null (route data itself is cleared by renderActiveRoute)
        if (fromMarkerRef.current) { fromMarkerRef.current.remove(); fromMarkerRef.current = null; }
        if (toMarkerRef.current) { toMarkerRef.current.remove(); toMarkerRef.current = null; }
        if (userGpsMarkerRef.current) { userGpsMarkerRef.current.remove(); userGpsMarkerRef.current = null; }
        floodPointMarkersRef.current.forEach((m) => m.remove());
        floodPointMarkersRef.current = [];
      }
    } catch (err) {
      console.warn('Map overlay update warning:', err);
    }
  }, [mapLoaded, currentTimestep, layers, activeRouteResponse, selectedRouteIndex, isLiveNavActive, userGpsCoords, mode, nowcastData, nowcastSelectedOffset, memoizedValidatedPoints, mapIdleVersion]);

  // ---------------------------------------------------------------------------
  // AUTHORITATIVE active-route renderer (the ONLY code that draws the route line).
  // Idempotent + retry-safe: it never permanently gives up because the MapLibre
  // style/tiles were still loading. Draws the selected route, candidate routes and
  // FROM/TO markers, keeps the route above flood/drainage layers, and only fits the
  // camera once per route (after the source + layers are verified to exist).
  // ---------------------------------------------------------------------------
  const renderActiveRoute = React.useCallback((force: boolean = false): RouteRenderStatus => {
    const map = mapInstanceRef.current;

    // Always publish debug state, even when we are only waiting for the style.
    writeRouteDebug(map, mapLoaded, !!activeRouteResponse, selectedRouteIndex);

    if (!map) return 'waiting';
    if (!mapLoaded) return 'waiting';

    const noRoute = mode === 'HOME' || !activeRouteResponse;

    // Nothing to draw and nothing drawn before: no need to touch the style at all.
    if (noRoute && lastRouteDataKeyRef.current === null) return 'idle';

    // ---- Style readiness -------------------------------------------------------
    // isStyleLoaded() is false while ANY source is still fetching tiles, even though the
    // style JSON is parsed and addSource/addLayer already work. So after the bounded retry
    // window we "force" (force=true) and only require that the style JSON exists.
    let styleReady = false;
    try {
      styleReady = map.isStyleLoaded();
    } catch {
      styleReady = false;
    }
    if (!styleReady && force) {
      try {
        styleReady = !!map.getStyle();
      } catch {
        styleReady = false;
      }
    }
    if (!styleReady) {
      if (!routeWaitingLoggedRef.current) {
        routeWaitingLoggedRef.current = true;
        console.log('[JALDRISHTI] Map style not ready, waiting for styledata/idle...');
      }
      return 'waiting';
    }
    if (routeWaitingLoggedRef.current) {
      routeWaitingLoggedRef.current = false;
      console.log('[JALDRISHTI] Map style ready, rendering active route...');
    }

    const emptyCollection: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

    // ---- No route (or HOME mode): clear stale data ONCE (never setData on every idle -> loop) ----
    if (noRoute) {
      [ACTIVE_ROUTE_SOURCE, CANDIDATE_ROUTE_SOURCE].forEach((id) => {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(emptyCollection);
      });
      lastRouteDataKeyRef.current = null;
      lastRouteResponseRef.current = null;
      lastFittedRouteKeyRef.current = null;
      return 'idle';
    }

    const allRoutes = [
      activeRouteResponse.recommended_route,
      ...(activeRouteResponse.alternative_routes || []),
    ].filter(Boolean);

    const activeRoute = allRoutes[selectedRouteIndex] || allRoutes[0];
    if (!activeRoute) return 'idle';

    const rawCoords = normalizeRouteCoordinates(activeRoute.geometry);

    if (rawCoords.length < 2) {
      console.warn('[JALDRISHTI] Active route has insufficient coordinates', activeRoute);
      return 'idle';
    }

    const routeCoords = simplifyDisplayGeometry(rawCoords, 2500) as [number, number][];

    if (!routeCoords || routeCoords.length < 2) {
      console.warn('[JALDRISHTI] Simplified route has insufficient coordinates');
      return 'idle';
    }

    // ---- Candidate (non-selected) routes ----
    const candidateFeatures: GeoJSON.Feature[] = [];
    allRoutes.forEach((r: any, rIdx: number) => {
      if (rIdx === selectedRouteIndex || !r?.geometry) return;
      const coords = normalizeRouteCoordinates(r.geometry);
      if (coords.length < 2) return;
      const simplified = simplifyDisplayGeometry(coords, 2500) as [number, number][];
      if (!simplified || simplified.length < 2) return;
      candidateFeatures.push({
        type: 'Feature',
        properties: { route_id: r.route_id || `ALT-${rIdx}` },
        geometry: { type: 'LineString', coordinates: simplified },
      });
    });
    const candidatesGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: candidateFeatures,
    };

    // ---- Active route features ----
    const features: GeoJSON.Feature[] = [];
    const segments = Array.isArray(activeRoute.segments) ? activeRoute.segments : [];

    segments.forEach((seg: any) => {
      if (
        Array.isArray(seg.start_coords) &&
        Array.isArray(seg.end_coords) &&
        seg.start_coords.length >= 2 &&
        seg.end_coords.length >= 2 &&
        Number.isFinite(Number(seg.start_coords[0])) &&
        Number.isFinite(Number(seg.start_coords[1])) &&
        Number.isFinite(Number(seg.end_coords[0])) &&
        Number.isFinite(Number(seg.end_coords[1]))
      ) {
        features.push({
          type: 'Feature',
          properties: {
            color: '#10b981',
            depth: Number(seg.predicted_water_depth_cm || 0),
            risk: seg.risk_state || 'SAFE',
            label: seg.depth_label || 'SAFE',
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [Number(seg.start_coords[0]), Number(seg.start_coords[1])],
              [Number(seg.end_coords[0]), Number(seg.end_coords[1])],
            ],
          },
        });
      }
    });

    if (features.length === 0) {
      features.push({
        type: 'Feature',
        properties: { color: '#10b981', depth: 0, risk: 'SAFE', label: 'SAFE' },
        geometry: { type: 'LineString', coordinates: routeCoords },
      });
    }

    const geojson: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features };

    // Only push new data into MapLibre when it actually changed
    const dataKey = `${selectedRouteIndex}|${allRoutes.length}|${routeCoords.length}|${routeCoords[0]?.join(',')}|${routeCoords[routeCoords.length - 1]?.join(',')}|${features.length}|${candidateFeatures.length}`;
    const dataChanged =
      lastRouteDataKeyRef.current !== dataKey ||
      lastRouteResponseRef.current !== activeRouteResponse;

    const sourceMissing = !map.getSource(ACTIVE_ROUTE_SOURCE);
    if (dataChanged || sourceMissing) {
      console.log('[JALDRISHTI] Map style ready, rendering active route...');
    }

    // ---- SOURCES (add if missing, otherwise update data) ----
    if (!map.getSource(ACTIVE_ROUTE_SOURCE)) {
      map.addSource(ACTIVE_ROUTE_SOURCE, { type: 'geojson', data: geojson });
    } else if (dataChanged) {
      (map.getSource(ACTIVE_ROUTE_SOURCE) as maplibregl.GeoJSONSource).setData(geojson);
    }

    if (!map.getSource(CANDIDATE_ROUTE_SOURCE)) {
      map.addSource(CANDIDATE_ROUTE_SOURCE, { type: 'geojson', data: candidatesGeoJSON });
    } else if (dataChanged) {
      (map.getSource(CANDIDATE_ROUTE_SOURCE) as maplibregl.GeoJSONSource).setData(candidatesGeoJSON);
    }

    // Active route is ALWAYS visible while debugging (removes safeRoutes as a possible cause).
    const visibility = 'visible';
    // Candidate (dashed gray) routes keep following the safe-routes toggle.
    const candidateVisibility = layers.safeRoutes ? 'visible' : 'none';

    // ---- CANDIDATE LAYER (dashed gray, kept below the active route) ----
    if (!map.getLayer(CANDIDATE_ROUTE_LAYER)) {
      map.addLayer(
        {
          id: CANDIDATE_ROUTE_LAYER,
          type: 'line',
          source: CANDIDATE_ROUTE_SOURCE,
          layout: { visibility: candidateVisibility },
          paint: {
            'line-color': '#64748b',
            'line-width': 4,
            'line-dasharray': [2, 1],
            'line-opacity': 0.7,
          },
        },
        map.getLayer(ACTIVE_ROUTE_GLOW) ? ACTIVE_ROUTE_GLOW : undefined
      );
    } else {
      map.setLayoutProperty(CANDIDATE_ROUTE_LAYER, 'visibility', candidateVisibility);
    }

    // ---- GLOW LAYER ----
    if (!map.getLayer(ACTIVE_ROUTE_GLOW)) {
      map.addLayer({
        id: ACTIVE_ROUTE_GLOW,
        type: 'line',
        source: ACTIVE_ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          'line-color': '#10b981',
          'line-width': 14,
          'line-opacity': 0.35,
        },
      });
    } else {
      map.setLayoutProperty(ACTIVE_ROUTE_GLOW, 'visibility', visibility);
    }

    // ---- CORE LAYER ----
    if (!map.getLayer(ACTIVE_ROUTE_CORE)) {
      map.addLayer({
        id: ACTIVE_ROUTE_CORE,
        type: 'line',
        source: ACTIVE_ROUTE_SOURCE,
        layout: { 'line-cap': 'round', 'line-join': 'round', visibility },
        paint: {
          'line-color': '#10b981',
          'line-width': 7,
          'line-opacity': 1,
        },
      });
    } else {
      map.setLayoutProperty(ACTIVE_ROUTE_CORE, 'visibility', visibility);
    }

    // ---- Verify the source + layers really exist before anything else (markers / fitBounds) ----
    const sourceOk = !!map.getSource(ACTIVE_ROUTE_SOURCE);
    const glowOk = !!map.getLayer(ACTIVE_ROUTE_GLOW);
    const coreOk = !!map.getLayer(ACTIVE_ROUTE_CORE);
    if (!sourceOk || !glowOk || !coreOk) {
      console.error('[JALDRISHTI] Route source/layers missing after add', { sourceOk, glowOk, coreOk });
      writeRouteDebug(map, mapLoaded, true, selectedRouteIndex, { status: 'failed' });
      return 'failed';
    }

    // ---- Keep route above all flood / drainage layers (only when not already on top) ----
    try {
      const layerIds = map.getStyle().layers.map((l) => l.id);
      const n = layerIds.length;
      if (layerIds[n - 2] !== ACTIVE_ROUTE_GLOW || layerIds[n - 1] !== ACTIVE_ROUTE_CORE) {
        if (map.getLayer(ACTIVE_ROUTE_GLOW)) map.moveLayer(ACTIVE_ROUTE_GLOW);
        if (map.getLayer(ACTIVE_ROUTE_CORE)) map.moveLayer(ACTIVE_ROUTE_CORE);
      }
    } catch (e) {
      console.warn('[JALDRISHTI] Could not move route layers', e);
    }

    // ---- FROM / TO markers (unchanged look, now from normalized coords) ----
    const originCoord = routeCoords[0];
    const destinationCoord = routeCoords[routeCoords.length - 1];

    if (fromMarkerRef.current) {
      fromMarkerRef.current.setLngLat(originCoord);
    } else {
      const el = document.createElement('div');
      el.className = 'w-7 h-7 rounded-full bg-emerald-600 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-xs cursor-pointer';
      el.innerHTML = '🟢';
      el.title = `FROM: ${activeRouteResponse.origin?.name || 'Origin'}`;
      fromMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(originCoord).addTo(map);
    }

    if (toMarkerRef.current) {
      toMarkerRef.current.setLngLat(destinationCoord);
    } else {
      const el = document.createElement('div');
      el.className = 'w-7 h-7 rounded-full bg-rose-600 border-2 border-white text-white flex items-center justify-center shadow-lg font-bold text-xs cursor-pointer';
      el.innerHTML = '🏁';
      el.title = `TO: ${activeRouteResponse.destination?.name || 'Destination'}`;
      toMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat(destinationCoord).addTo(map);
    }

    // Clear legacy flood markers
    floodPointMarkersRef.current.forEach((m) => m.remove());
    floodPointMarkersRef.current = [];

    // ---- Camera: fit ONLY when the route changes (after layers exist); never on idle; never during GPS navigation ----
    const routeKey = `${selectedRouteIndex}-${routeCoords.length}-${routeCoords[0]?.join(',')}-${routeCoords[routeCoords.length - 1]?.join(',')}`;
    if (lastFittedRouteKeyRef.current !== routeKey) {
      lastFittedRouteKeyRef.current = routeKey;

      if (!(isLiveNavActive && userGpsCoordsRef.current)) {
        const bounds = new maplibregl.LngLatBounds();
        routeCoords.forEach((c) => bounds.extend(c));
        map.fitBounds(bounds, {
          padding: { top: 70, bottom: 70, left: 70, right: 70 },
          duration: 1200,
          maxZoom: 16,
        });
      }
    }

    if (dataChanged) {
      console.log('[JALDRISHTI] Active route rendered:', routeCoords.length, 'coordinates');
    }

    lastRouteDataKeyRef.current = dataKey;
    lastRouteResponseRef.current = activeRouteResponse;

    (window as any).__JALDRISHTI_ACTIVE_ROUTE_DEBUG = {
      coordinateCount: routeCoords.length,
      rawCoordinateCount: rawCoords.length,
      featureCount: features.length,
      routeCount: allRoutes.length,
      selectedRouteIndex,
      sourceExists: !!map.getSource(ACTIVE_ROUTE_SOURCE),
      glowExists: !!map.getLayer(ACTIVE_ROUTE_GLOW),
      coreExists: !!map.getLayer(ACTIVE_ROUTE_CORE),
    };
    writeRouteDebug(map, mapLoaded, true, selectedRouteIndex, { status: 'rendered', forced: force });

    return 'rendered';
  }, [
    mapLoaded,
    mode,
    activeRouteResponse,
    selectedRouteIndex,
    isLiveNavActive,
    layers.safeRoutes,
  ]);

  // Route rendering effect: attempts immediately, then retries inside a small BOUNDED window
  // (100/250/500/1000/1000/1000/1000 ms ~ 4.9s, final attempt forced) and also re-attempts on
  // MapLibre load / styledata / idle. No setInterval; all timers + listeners are cleaned up.
  useEffect(() => {
    const map = mapInstanceRef.current;

    // Debug state is written even when we cannot render yet.
    writeRouteDebug(map, mapLoaded, !!activeRouteResponse, selectedRouteIndex);

    if (!map || !mapLoaded) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const runOnce = (force: boolean): RouteRenderStatus => {
      if (cancelled) return 'busy';
      // addSource/addLayer/moveLayer fire styledata synchronously -> guard against re-entrancy
      if (isRenderingRouteRef.current) return 'busy';

      isRenderingRouteRef.current = true;
      try {
        return renderActiveRoute(force);
      } catch (e) {
        console.warn('[JALDRISHTI] Route render failed', e);
        return 'failed';
      } finally {
        isRenderingRouteRef.current = false;
      }
    };

    const scheduleRetry = () => {
      if (cancelled || timer !== null) return;
      if (attempt >= ROUTE_RETRY_DELAYS_MS.length) return; // retry window exhausted (events may still trigger renders)

      const delay = ROUTE_RETRY_DELAYS_MS[attempt];
      const isLast = attempt === ROUTE_RETRY_DELAYS_MS.length - 1;
      attempt += 1;
      const n = attempt;

      timer = setTimeout(() => {
        timer = null;
        if (cancelled) return;
        console.log(`[JALDRISHTI] Route render retry ${n}${isLast ? ' (forced)' : ''}`);
        const status = runOnce(isLast);
        if (status === 'waiting' || status === 'failed') scheduleRetry();
      }, delay);
    };

    const onMapEvent = () => {
      const status = runOnce(false);
      if (status === 'waiting' || status === 'failed') scheduleRetry();
    };

    // 1) immediate attempt
    const first = runOnce(false);
    if (first === 'waiting' || first === 'failed') scheduleRetry();

    // 2) temporary listeners
    map.on('load', onMapEvent);
    map.on('styledata', onMapEvent);
    map.on('idle', onMapEvent);

    return () => {
      cancelled = true;
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      map.off('load', onMapEvent);
      map.off('styledata', onMapEvent);
      map.off('idle', onMapEvent);
    };
  }, [
    mapLoaded,
    activeRouteResponse,
    selectedRouteIndex,
    isLiveNavActive,
    layers.safeRoutes,
    renderActiveRoute,
  ]);

  const getInfraIcon = (type: string) => {
    switch (type) {
      case 'HOSPITAL':
        return <HeartPulse className="w-3.5 h-3.5 text-rose-400" />;
      case 'FIRE_STATION':
        return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'POLICE':
        return <Shield className="w-3.5 h-3.5 text-blue-400" />;
      case 'RAILWAY':
        return <Train className="w-3.5 h-3.5 text-indigo-400" />;
      case 'EMERGENCY_SHELTER':
      default:
        return <Home className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  // Collect active route line segments across all modes to enforce strict geometric exclusion
  const allActiveRouteSegments: [number, number][][] = React.useMemo(() => {
    if (!activeRouteResponse) return [];
    const rList = [
      activeRouteResponse.recommended_route,
      ...(activeRouteResponse.candidate_routes || []),
      ...(activeRouteResponse.alternative_routes || []),
      ...(activeRouteResponse.routes || []),
    ].filter(Boolean);
    const segs: [number, number][][] = [];
    rList.forEach((r: any) => {
      if (r.geometry) {
        segs.push(...extractRouteSegments(r.geometry));
      }
    });
    return segs;
  }, [activeRouteResponse]);

  const allActiveRouteCoords: [number, number][] = React.useMemo(() => {
    if (!activeRouteResponse) return [];
    const rList = [
      activeRouteResponse.recommended_route,
      ...(activeRouteResponse.candidate_routes || []),
      ...(activeRouteResponse.alternative_routes || []),
      ...(activeRouteResponse.routes || []),
    ].filter(Boolean);
    const coords: [number, number][] = [];
    rList.forEach((r: any) => {
      if (r.geometry) {
        coords.push(...extractCoordsFromGeometry(r.geometry));
      }
    });
    return coords;
  }, [activeRouteResponse]);

  return (
    <div id="gis-map-viewport" className="relative w-full h-full bg-slate-100 overflow-hidden select-none">
      {/* MapLibre DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Interactive HTML Depth Badges Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Dynamic Location-Dependent Waterlogging Prediction Depth Badges */}
        {memoizedValidatedPoints.map((pt: any, idx: number) => {
          const depth = pt.depth;
          const depthText = pt.predicted_depth_range || `${Math.round(depth)} cm`;
          const spotName = pt.spotName;

          const pos = projectCoord(pt.validatedCenter[0], pt.validatedCenter[1]);
          if (!pos) return null;

          const isCritical = pt.risk_level === 'CRITICAL' || pt.risk_level === 'CLOSED' || depth >= 45;
          const isHigh = (pt.risk_level === 'HIGH' || depth >= 30) && depth < 45;
          const isOrange = (pt.risk_level === 'MODERATE' || depth >= 15) && depth < 30;
          const isYellow = (pt.risk_level === 'CAUTION' || depth >= 5) && depth < 15;

          return (
            <div
              key={pt.prediction_id || pt.id || `pred-badge-${idx}`}
              onClick={() => {
                if (pt.factors || pt.data_states) {
                  setSelectedPredictionPoint(pt);
                } else {
                  setSelectedFloodPoint(pt);
                }
              }}
              className="absolute pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 z-20"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y}px`,
              }}
              title={`${spotName}: ${pt.risk_level || 'HIGH'} Risk (${depthText})`}
            >
              <div
                className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold shadow-xl flex items-center space-x-1 ${
                  isCritical
                    ? 'bg-purple-950/95 border-purple-500 text-purple-200 ring-2 ring-purple-500 animate-pulse'
                    : isHigh
                    ? 'bg-rose-950/95 border-rose-500 text-rose-200 ring-2 ring-rose-500'
                    : isOrange
                    ? 'bg-orange-950/95 border-orange-500 text-orange-200 border-orange-500'
                    : isYellow
                    ? 'bg-amber-950/95 border-amber-500 text-amber-200 border-amber-500'
                    : 'bg-blue-950/95 border-blue-500 text-blue-200 ring-2 ring-blue-500'
                }`}
              >
                <span>{depthText}</span>
              </div>
            </div>
          );
        })}

        {/* Critical Infrastructure Markers */}
        {layers.criticalInfra &&
          criticalInfra.map((infra) => {
            const isSelected = selectedInfraId === infra.id;
            const pos = projectCoord(infra.coords[0], infra.coords[1]);
            if (!pos) return null;

            return (
              <div
                key={infra.id}
                onClick={() => {
                  setSelectedInfraId(infra.id);
                  setActiveRightTab('infrastructure');
                }}
                onMouseEnter={() => setHoveredInfra(infra)}
                onMouseLeave={() => setHoveredInfra(null)}
                className="absolute pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                style={{
                  left: `${pos.x}px`,
                  top: `${pos.y}px`,
                }}
              >
                <div
                  className={`p-2 rounded-lg border shadow-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-emerald-900/90 border-emerald-400 ring-2 ring-emerald-400'
                      : 'bg-slate-950/90 border-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {getInfraIcon(infra.type)}
                  <span className="absolute -bottom-2 bg-slate-950 border border-slate-800 text-[8px] font-mono font-bold text-slate-300 px-1 rounded truncate max-w-[80px]">
                    {infra.type.slice(0, 4)}
                  </span>
                </div>
              </div>
            );
          })}
      </div>

      {/* Hotspot Hover Tooltip */}
      {hoveredHotspot && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-950/95 border border-slate-700 text-slate-100 p-2.5 rounded shadow-2xl font-mono text-xs max-w-xs space-y-1 backdrop-blur-md"
          style={{
            left: `${((hoveredHotspot.coordinates[0] - 88.465) / 0.035) * 100}%`,
            top: `${((22.738 - hoveredHotspot.coordinates[1]) / 0.032) * 100 - 15}%`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-cyan-400">{hoveredHotspot.name}</span>
            <span className="text-[9px] px-1 rounded bg-rose-950 text-rose-300 font-bold border border-rose-800">
              {hoveredHotspot.risk_level}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span>Depth: <strong className="text-rose-400">{hoveredHotspot.predicted_depth_cm} cm</strong></span>
            <span>Drain: <strong className="text-indigo-300">{hoveredHotspot.drain_utilization_pct}%</strong></span>
          </div>
          <p className="text-[9px] text-slate-400 font-sans">{hoveredHotspot.primary_cause}</p>
        </div>
      )}

      {/* Critical Infra Hover Tooltip */}
      {hoveredInfra && (
        <div
          className="absolute z-20 pointer-events-none bg-slate-950/95 border border-emerald-700 text-slate-100 p-2.5 rounded shadow-2xl font-mono text-xs max-w-xs space-y-1 backdrop-blur-md"
          style={{
            left: `${((hoveredInfra.coords[0] - 88.465) / 0.035) * 100}%`,
            top: `${((22.738 - hoveredInfra.coords[1]) / 0.032) * 100 - 15}%`,
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="font-bold text-emerald-400">{hoveredInfra.name}</span>
            <span className="text-[9px] px-1 rounded bg-emerald-950 text-emerald-300 font-bold border border-emerald-700">
              {hoveredInfra.type}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <span>Facility Risk: <strong className="text-emerald-300">{hoveredInfra.risk}</strong></span>
            <span>Access Route: <strong className="text-amber-300">{hoveredInfra.accessRisk}</strong></span>
          </div>
        </div>
      )}

      {/* Interactive Water Accumulation Point Popup Modal (Blue, Red, Brown, Yellow Active Waterlogging Spots) */}
      {selectedFloodPoint && (() => {
        const spotId = `SPOT-FLOOD-${selectedFloodPoint.id || selectedFloodPoint.description || 'DEFAULT'}`;
        const spotName = selectedFloodPoint.description || selectedFloodPoint.spot_name || 'Waterlogging Area';
        const isPurple = isPurplePoint(selectedFloodPoint);

        return (
          <div className="absolute top-3 bottom-3 left-3 z-50 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full font-sans max-h-[calc(100%-1.5rem)] flex flex-col overflow-hidden">
            {/* FIXED TOP HEADER WITH CLEARLY VISIBLE TOP-RIGHT CLOSE (×) BUTTON */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 z-50">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5 truncate pr-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">WATER ACCUMULATION RISK</span>
              </h4>
              <button
                id="btn-close-flood-detail"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFloodPoint(null);
                  setSelectedPredictionPoint(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer font-bold z-50 pointer-events-auto"
                title="Close panel (×)"
                aria-label="Close panel"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* SCROLLABLE PANEL BODY */}
            <div className="p-3.5 overflow-y-auto space-y-2.5">
              {/* NORMAL FLOOD DETAILS FIRST */}
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Predicted Depth:</span>
                  <span className="font-bold text-slate-900">{selectedFloodPoint.predicted_water_depth_cm} cm</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Risk Level:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${selectedFloodPoint.predicted_water_depth_cm > 15 ? 'bg-rose-100 text-rose-800' : selectedFloodPoint.predicted_water_depth_cm > 5 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {selectedFloodPoint.risk_level}
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Data Source:</span>
                  <span className="font-semibold text-slate-800">{selectedFloodPoint.data_source || 'JALDRISHTI Flood Digital Twin'}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Data State:</span>
                  <span className="font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">{selectedFloodPoint.data_state || 'PREDICTED'}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-500">Confidence:</span>
                  <span className="font-semibold text-slate-800">{selectedFloodPoint.confidence || 'MEDIUM'}</span>
                </div>
                <p className="text-[10px] text-slate-500 italic mt-1">{selectedFloodPoint.description}</p>
              </div>

              {/* COMMUNITY FEEDBACK SECTION AT THE BOTTOM OF THE PANEL */}
              <CommunityFeedbackSection spotId={spotId} spotName={spotName} />
            </div>
          </div>
        );
      })()}

      {/* Standard Purple Waterlogging Prediction Factor Detail Modal (Clean & Normal) */}
      {selectedPredictionPoint && (() => {
        const spotId = `SPOT-PRED-${selectedPredictionPoint.prediction_id || selectedPredictionPoint.id || selectedPredictionPoint.spot_name || 'DEFAULT'}`;
        const spotName = selectedPredictionPoint.spot_name || selectedPredictionPoint.description || 'Waterlogging Area';
        const isPurple = isPurplePoint(selectedPredictionPoint);

        return (
          <div className="absolute top-3 bottom-3 left-3 z-50 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl max-w-md w-full font-sans max-h-[calc(100%-1.5rem)] flex flex-col overflow-hidden">
            {/* FIXED TOP HEADER WITH CLEARLY VISIBLE TOP-RIGHT CLOSE (×) BUTTON */}
            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 z-50">
              <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5 truncate pr-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="truncate">PREDICTED WATERLOGGING POINT</span>
              </h4>
              <button
                id="btn-close-prediction-detail"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPredictionPoint(null);
                  setSelectedFloodPoint(null);
                }}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-300 flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer font-bold z-50 pointer-events-auto"
                title="Close panel (×)"
                aria-label="Close panel"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* SCROLLABLE PANEL BODY */}
            <div className="p-3.5 overflow-y-auto space-y-2.5">
              {/* NORMAL CLEAN PREDICTION PANEL DETAILS FIRST */}
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="font-bold text-slate-900 text-sm">{selectedPredictionPoint.spot_name}</div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Predicted Depth Range:</span>
                  <span className="font-bold text-slate-900">{selectedPredictionPoint.predicted_depth_range}</span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Risk Level:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    selectedPredictionPoint.risk_level === 'CRITICAL' ? 'bg-purple-100 text-purple-900' :
                    selectedPredictionPoint.risk_level === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                    selectedPredictionPoint.risk_level === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                    'bg-emerald-100 text-emerald-800'
                  }`}>
                    {selectedPredictionPoint.risk_level} (Score: {selectedPredictionPoint.risk_score})
                  </span>
                </div>
                <div className="flex justify-between py-0.5 border-b border-slate-50">
                  <span className="text-slate-500">Prediction Window:</span>
                  <span className="font-semibold text-slate-800">{selectedPredictionPoint.prediction_window}</span>
                </div>
                {selectedPredictionPoint.factors && (
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1 text-[11px]">
                    <div className="font-bold text-slate-800 border-b border-slate-200 pb-1">Prediction Factors Breakdown:</div>
                    <div className="flex justify-between text-slate-600">
                      <span>24h Forecast Rain:</span>
                      <span className="font-mono text-slate-900 font-bold">{selectedPredictionPoint.factors.rainfall_24h_mm} mm ({selectedPredictionPoint.factors.peak_hourly_intensity_mm_h} mm/h)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Terrain Elevation & Slope:</span>
                      <span className="font-mono text-slate-900 font-bold">{selectedPredictionPoint.factors.elevation_m}m ({selectedPredictionPoint.factors.slope_pct}%)</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Historical Susceptibility:</span>
                      <span className="font-mono text-slate-900 font-bold">Score {selectedPredictionPoint.factors.historical_susceptibility_score} ({selectedPredictionPoint.factors.historical_events_count} past events)</span>
                    </div>
                  </div>
                )}
                {selectedPredictionPoint.data_states && (
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1 text-[9px] pt-1">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-bold">WEATHER: {selectedPredictionPoint.data_states.weather_state}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">TERRAIN: {selectedPredictionPoint.data_states.terrain_state}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">HISTORICAL: {selectedPredictionPoint.data_states.historical_state}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono">DRAINAGE: {selectedPredictionPoint.data_states.drainage_state}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold">PREDICTION: {selectedPredictionPoint.data_states.prediction_state}</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-700 bg-amber-50/80 p-2.5 rounded-xl border border-amber-200/80 mt-1 font-sans leading-relaxed">
                  {selectedPredictionPoint.explanation}
                </p>
              </div>

              {/* COMMUNITY FEEDBACK SECTION AT THE BOTTOM OF THE PANEL */}
              <CommunityFeedbackSection spotId={spotId} spotName={spotName} />
            </div>
          </div>
        );
      })()}

      {/* Part 6 Street Projection Detail Modal Popover */}
      {selectedStreet && (
        <div className="absolute top-3 bottom-3 left-3 z-50 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full font-sans max-h-[calc(100%-1.5rem)] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-100 bg-white/95 backdrop-blur-md shrink-0 z-50">
            <h4 className="font-bold text-slate-900 text-xs flex items-center space-x-1.5 truncate pr-2">
              <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="truncate">STREET FLOOD PROJECTION</span>
            </h4>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedStreet(null);
              }}
              className="w-7 h-7 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 border border-slate-200 flex items-center justify-center transition-all shadow-sm shrink-0 cursor-pointer font-bold"
              title="Close panel"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
          <div className="p-3.5 space-y-2 text-xs text-slate-700 overflow-y-auto">
            <div className="font-bold text-slate-900 text-sm">{selectedStreet.road_name}</div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Water Depth:</span>
              <span className="font-bold text-blue-700 font-mono text-sm">{selectedStreet.max_predicted_depth_cm} cm</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Severity:</span>
              <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                selectedStreet.risk_level === 'CLOSED' || selectedStreet.risk_level === 'CRITICAL' ? 'bg-purple-100 text-purple-900' :
                selectedStreet.risk_level === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                selectedStreet.risk_level === 'CAUTION' || selectedStreet.risk_level === 'MODERATE' ? 'bg-amber-100 text-amber-800' :
                'bg-emerald-100 text-emerald-800'
              }`}>
                {selectedStreet.risk_level}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Forecast Horizon:</span>
              <span className="font-mono text-slate-800 font-semibold">{selectedStreet.horizon || `T+${nowcastSelectedOffset}h`}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-100">
              <span className="text-slate-500">Data Provenance:</span>
              <span className="font-mono text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded font-bold">
                {gisDashboardData?.provenance?.rainfall_provenance_badge || selectedStreet.data_state || 'PREDICTED'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[10px] space-y-1 font-mono">
              <div className="font-bold text-slate-700">Drainage Hydraulics Status:</div>
              <div>Node ID: <strong className="text-slate-900">{selectedStreet.drainage_node_id}</strong></div>
              <div>Drain Type: <strong className="text-slate-900">{selectedStreet.drainage_type}</strong></div>
              <div>Pipe Utilization: <strong className="text-indigo-600">{Math.round((selectedStreet.capacity_utilization || 0) * 100)}%</strong></div>
              <div>Blockage Status: <strong className="text-slate-800">{selectedStreet.blockage_status || 'OBSERVED DATASET'} ({selectedStreet.blockage_pct || 0}%)</strong></div>
            </div>
          </div>
        </div>
      )}

      {/* Floating Water Depth Ramp & Clean Controls (White + Blue Aesthetic) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col space-y-2 select-none font-sans">
        {/* Depth Color Ramp Legend */}
        <div className="bg-white/95 border border-slate-200/90 rounded-2xl p-3 text-slate-900 text-xs shadow-xl backdrop-blur-md space-y-1.5 max-w-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 font-bold text-[11px]">
            <span className="text-slate-900">FLOOD WATER DEPTH</span>
            <span className="text-blue-600 text-[10px] uppercase font-semibold">LIVE NOWCAST</span>
          </div>
          <div className="flex items-center space-x-1 text-[10px] font-semibold flex-wrap gap-1">
            <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-800 px-1.5 py-0.5 rounded border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>0-5 cm SAFE</span>
            </span>
            <span className="inline-flex items-center space-x-1 bg-yellow-50 text-yellow-800 px-1.5 py-0.5 rounded border border-yellow-200">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              <span>5-15 cm CAUTION</span>
            </span>
            <span className="inline-flex items-center space-x-1 bg-orange-50 text-orange-900 px-1.5 py-0.5 rounded border border-orange-200">
              <span className="w-2 h-2 rounded-full bg-orange-500"></span>
              <span>15-30 cm HIGH</span>
            </span>
            <span className="inline-flex items-center space-x-1 bg-rose-50 text-rose-900 px-1.5 py-0.5 rounded border border-rose-200">
              <span className="w-2 h-2 rounded-full bg-rose-600"></span>
              <span>30-50 cm CRITICAL</span>
            </span>
            <span className="inline-flex items-center space-x-1 bg-purple-50 text-purple-900 px-1.5 py-0.5 rounded border border-purple-200">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span>
              <span>&gt;50 cm CLOSED</span>
            </span>
          </div>
        </div>

        {/* NOWCAST 0–3h Temporal Layer Control */}
        <div id="nowcast-0-3h-control" className="bg-white/95 border border-slate-200/90 rounded-2xl p-2.5 text-slate-900 text-xs shadow-xl backdrop-blur-md space-y-1.5 max-w-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1 font-bold text-[11px]">
            <span className="text-slate-900 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>NOWCAST</span>
            </span>
            <span className="text-blue-600 text-[10px] uppercase font-semibold">0–3h HORIZON</span>
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold">
            {[0, 1, 2, 3].map((offset) => (
              <button
                key={offset}
                id={`nowcast-tab-btn-${offset}`}
                onClick={() => setNowcastOffset(offset)}
                className={`flex-1 py-1 rounded-lg transition-all text-center text-xs font-mono font-bold ${
                  nowcastSelectedOffset === offset
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {offset === 0 ? '0h' : `${offset}h`}
              </button>
            ))}
          </div>
          {nowcastData?.timesteps?.[nowcastSelectedOffset] && (
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-0.5">
              <span>{nowcastData.timesteps[nowcastSelectedOffset].label}</span>
              <span className="font-bold text-slate-800">
                {nowcastData.timesteps[nowcastSelectedOffset].rainfall_intensity_mm_h} mm/h
              </span>
            </div>
          )}
        </div>

        {/* Map Controls */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-1 flex items-center space-x-1 shadow-lg w-max backdrop-blur-md">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            className="p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            className="p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              if (mapInstanceRef.current && savedHome?.coordinates) {
                mapInstanceRef.current.flyTo({
                  center: [savedHome.coordinates[1], savedHome.coordinates[0]],
                  zoom: 15.0,
                  pitch: 0,
                  bearing: 0,
                  duration: 1500,
                });
              }
            }}
            className="p-2 rounded-xl text-slate-700 hover:text-blue-600 hover:bg-slate-100 transition-colors"
            title={`Reset view to Home (${savedHome?.locality || 'Home'})`}
          >
            <Compass className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
