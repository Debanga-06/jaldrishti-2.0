/**
 * JALDRISHTI Alerts View
 * Proactive location-aware predictive flood warnings & active waterlogging alerts
 * Consumes existing authoritative prediction engines, weather forecasts, terrain & drainage datasets.
 * Generic coordinate-based spatial proximity scoping for Saved Home and Live GPS locations.
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  AlertTriangle,
  MapPin,
  CheckCircle2,
  CloudRain,
  ShieldAlert,
  Clock,
  Navigation,
  Compass,
  AlertOctagon,
} from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';
import { JaldrishtiApi } from '../services/api';
import { FloodHotspot } from '../types';

export interface AuthoritativeArea {
  key: string;
  name: string;
  city: string;
  centerLat: number;
  centerLon: number;
  maxRadiusKm: number;
  keywords: string[];
}

export const AUTHORITATIVE_AREAS: AuthoritativeArea[] = [
  {
    key: 'BALLYGUNGE',
    name: 'Ballygunge',
    city: 'Kolkata',
    centerLat: 22.5280,
    centerLon: 88.3650,
    maxRadiusKm: 5.0,
    keywords: ['ballygunge', 'sarat bose', 'gariahat'],
  },
  {
    key: 'BARASAT',
    name: 'Barasat',
    city: 'Barasat',
    centerLat: 22.7214,
    centerLon: 88.4821,
    maxRadiusKm: 7.0,
    keywords: ['barasat', 'champadali', 'duckbanglow', 'sethpukur', 'kazipara', 'nabapally'],
  },
  {
    key: 'PARK_CIRCUS',
    name: 'Park Circus',
    city: 'Kolkata',
    centerLat: 22.5440,
    centerLon: 88.3680,
    maxRadiusKm: 3.5,
    keywords: ['park circus', 'beckbagan'],
  },
  {
    key: 'TILJALA',
    name: 'Tiljala',
    city: 'Kolkata',
    centerLat: 22.5350,
    centerLon: 88.3850,
    maxRadiusKm: 3.5,
    keywords: ['tiljala', 'baghajatin road', 'kayasthapara'],
  },
  {
    key: 'TOPSIA',
    name: 'Topsia',
    city: 'Kolkata',
    centerLat: 22.5300,
    centerLon: 88.3950,
    maxRadiusKm: 3.5,
    keywords: ['topsia'],
  },
  {
    key: 'SHIBPUR',
    name: 'Shibpur',
    city: 'Howrah',
    centerLat: 22.5650,
    centerLon: 88.3190,
    maxRadiusKm: 4.0,
    keywords: ['shibpur'],
  },
  {
    key: 'RAMRAJATALA',
    name: 'Ramrajatala',
    city: 'Howrah',
    centerLat: 22.5850,
    centerLon: 88.3390,
    maxRadiusKm: 3.5,
    keywords: ['ramrajatala'],
  },
  {
    key: 'SALKIA',
    name: 'Salkia',
    city: 'Howrah',
    centerLat: 22.6020,
    centerLon: 88.3540,
    maxRadiusKm: 3.5,
    keywords: ['salkia'],
  },
  {
    key: 'BAMANGACHI',
    name: 'Bamangachi',
    city: 'Howrah',
    centerLat: 22.5770,
    centerLon: 88.3250,
    maxRadiusKm: 3.5,
    keywords: ['bamangachi'],
  },
  {
    key: 'HOWRAH_STATION',
    name: 'Howrah Station',
    city: 'Howrah',
    centerLat: 22.5900,
    centerLon: 88.3470,
    maxRadiusKm: 3.5,
    keywords: ['howrah station'],
  },
];

export const resolveAreaForLocation = (
  coords: { lat: number; lon: number } | null,
  localityOrAddress?: string | null
): AuthoritativeArea | null => {
  if (localityOrAddress) {
    const lower = localityOrAddress.toLowerCase();
    for (const area of AUTHORITATIVE_AREAS) {
      if (area.keywords.some((kw) => lower.includes(kw))) {
        return area;
      }
    }
  }

  if (coords) {
    let closestArea: AuthoritativeArea | null = null;
    let minDist = Infinity;
    for (const area of AUTHORITATIVE_AREAS) {
      const dist = calcDistanceKm(coords.lat, coords.lon, area.centerLat, area.centerLon);
      if (dist <= area.maxRadiusKm && dist < minDist) {
        minDist = dist;
        closestArea = area;
      }
    }
    if (closestArea) return closestArea;
  }

  return null;
};

export interface SpecificSpotDetail {
  name: string;
  depthCm: number | string;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'CLOSED';
  distanceKm?: number;
  reason?: string;
}

export interface EnhancedAlertItem {
  id: string;
  lat: number;
  lon: number;
  areaKey: string;
  title: string;
  alertType: 'PREDICTIVE_BEFORE_WATERLOGGING' | 'ACTIVE_AFTER_WATERLOGGING';
  severity: 'CRITICAL' | 'WARNING' | 'ADVISORY' | 'CLOSED';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'CLOSED';
  locationScope: 'HOME' | 'LIVE_GPS' | 'MONITORED_CORRIDOR';
  cityLocality: string;
  specificSpotName: string;
  locationName: string;
  forecastRainfallMm: string;
  possibleDepthCm: string;
  expectedWindow: string;
  whyLikelyReason: string;
  recommendedAction: string;
  dateGroup: 'TODAY' | 'UPCOMING' | 'RESOLVED';
  timestamp: string;
  confidence: string;
  affectedRoads: string[];
  specificSpotsList: SpecificSpotDetail[];
  primaryDriver: string;
  elevationMeters?: number;
  drainUtilizationPct?: number;
  isPredicted: boolean;
  sourceFile?: string | null;
  sourceRecordId?: string | null;
  originalLocationName?: string | null;
  originalDepthCm?: number | string | null;
  sourceType?: string;
  provenance?: string;
}

// ---------------------------------------------------------------------
// Coordinate Utilities & Haversine Distance
// ---------------------------------------------------------------------
export const normalizeCoords = (coords?: [number, number] | null): { lat: number; lon: number } | null => {
  if (!coords || !Array.isArray(coords) || coords.length < 2) return null;
  const [c0, c1] = coords;
  if (c0 === 0 && c1 === 0) return null;
  if (Math.abs(c0) > 40) {
    return { lat: c1, lon: c0 };
  }
  return { lat: c0, lon: c1 };
};

export const calcDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const AlertsView: React.FC = () => {
  const { savedHome, userGpsCoords, currentTimestep, notificationSettings } = useFloodStore();

  const [dateTab, setDateTab] = useState<'TODAY' | 'UPCOMING' | 'RESOLVED'>('TODAY');
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'HOME' | 'LIVE_GPS'>('ALL');
  const [alertsList, setAlertsList] = useState<EnhancedAlertItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [liveLocationName, setLiveLocationName] = useState<string>('Champadali More, Barasat');

  const homeCoords = normalizeCoords(savedHome?.coordinates);
  const liveCoords = normalizeCoords(userGpsCoords);

  // Sync browser GPS if userGpsCoords is null
  useEffect(() => {
    if (!userGpsCoords && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          useFloodStore.getState().updateLiveGpsState(
            [latitude, longitude],
            0,
            0,
            0,
            false,
            null
          );
        },
        () => {},
        { timeout: 3000 }
      );
    }
  }, [userGpsCoords]);

  useEffect(() => {
    let isMounted = true;

    const createAlertItemsFromPrediction = (
      predData: any,
      scope: 'HOME' | 'LIVE_GPS' | 'MONITORED_CORRIDOR',
      targetLocality: string
    ): EnhancedAlertItem[] => {
      if (!predData || !predData.prediction_points || !Array.isArray(predData.prediction_points)) {
        return [];
      }

      const weather = predData.weather_input || {};
      const rain24h = weather.precipitation_next_24h_mm || 0;
      const peakRain = weather.peak_hourly_intensity_mm_h || 0;
      const rainText = `${rain24h.toFixed(1)} mm (${peakRain.toFixed(1)} mm/h peak forecast)`;

      const items: EnhancedAlertItem[] = [];

      predData.prediction_points.forEach((pt: any, index: number) => {
        const spotName = pt.spot_name || 'Waterlogging Spot';
        const lat = pt.latitude || 22.7214;
        const lon = pt.longitude || 88.4821;
        const depthCm = pt.numeric_depth_cm ?? 0;
        const depthRange = pt.predicted_depth_range || `${Math.round(depthCm)} cm`;
        const riskLevel = pt.risk_level || 'LOW';

        const areaObj = resolveAreaForLocation({ lat, lon }, spotName) || resolveAreaForLocation(null, targetLocality);
        const areaKey = areaObj ? areaObj.key : (scope === 'HOME' ? 'HOME_AREA' : 'GENERIC');

        const isCurrent = depthCm >= 35 || riskLevel === 'CRITICAL' || pt.status === 'ACTIVE' || pt.is_predicted === false;

        const alertType = isCurrent ? 'ACTIVE_AFTER_WATERLOGGING' : 'PREDICTIVE_BEFORE_WATERLOGGING';
        const severity = (riskLevel === 'CRITICAL' || riskLevel === 'CLOSED') ? 'CRITICAL' : (riskLevel === 'HIGH' ? 'WARNING' : 'ADVISORY');

        const title = isCurrent
          ? `CURRENT WATERLOGGING: ${spotName}, ${targetLocality}`
          : `PREDICTIVE WATERLOGGING WARNING: ${spotName}, ${targetLocality}`;

        const expectedWindow = isCurrent
          ? 'Active Now (Observed Inundation)'
          : (pt.prediction_window || 'Next 1–3 Hours (T-Nowcast Horizon)');

        const whyLikelyReason = pt.explanation ||
          (isCurrent
            ? `Active waterlogging accumulated on road surface (${depthRange} depth). Terrain elevation and drainage capacity surcharge following rainfall.`
            : `Heavy rainfall forecast (${rainText}). Urban runoff accumulation increases waterlogging possibility at ${spotName}.`);

        const recommendedAction = isCurrent
          ? `Exercise caution or take elevated bypass corridor around ${spotName}.`
          : `Monitor JALDRISHTI live warnings when travelling near ${spotName}.`;

        const confidenceStr = `HIGH (${pt.data_states?.weather_source || 'Open-Meteo'} + ${pt.data_states?.terrain_state || 'Terrain GIS'})`;

        items.push({
          id: `ALT-${scope}-${pt.prediction_id || index}-${areaKey}-${spotName.replace(/\s+/g, '_')}`,
          lat,
          lon,
          areaKey,
          title,
          alertType,
          severity,
          riskLevel: riskLevel as any,
          locationScope: scope,
          cityLocality: targetLocality,
          specificSpotName: spotName,
          locationName: `${spotName}, ${targetLocality}`,
          forecastRainfallMm: rainText,
          possibleDepthCm: depthRange,
          expectedWindow,
          whyLikelyReason,
          recommendedAction,
          dateGroup: isCurrent ? 'TODAY' : 'UPCOMING',
          timestamp: isCurrent ? 'Active Now (Live Map Telemetry)' : 'Live Nowcast + Forecast',
          confidence: confidenceStr,
          affectedRoads: [spotName, `${targetLocality} Access Link`],
          specificSpotsList: [
            { name: spotName, depthCm: depthRange, riskLevel: riskLevel as any, reason: pt.explanation || 'Lowland runoff pooling' },
          ],
          primaryDriver: pt.factors?.matched_zone ? `Zone ${pt.factors.matched_zone} Surface Runoff + Drainage Surcharge` : 'Urban Surface Runoff',
          elevationMeters: pt.factors?.elevation_m || 5.0,
          drainUtilizationPct: pt.factors?.drainage_load_pct || 80,
          isPredicted: !isCurrent,
          sourceFile: pt.source_file || null,
          sourceRecordId: pt.source_record_id || null,
          originalLocationName: pt.original_location_name || null,
          originalDepthCm: pt.original_depth_cm ?? null,
          sourceType: pt.source_type || 'MODEL',
          provenance: pt.provenance || 'MODEL_PREDICTION',
        });
      });

      return items;
    };

    const loadAlertsData = async () => {
      setIsLoading(true);
      try {
        if (!isMounted) return;

        // Resolve locality name for Live GPS
        if (liveCoords) {
          const resolved = resolveAreaForLocation(liveCoords, null);
          if (resolved) {
            setLiveLocationName(`${resolved.name}, ${resolved.city}`);
          } else {
            setLiveLocationName(`Live Location (${liveCoords.lat.toFixed(4)}°N, ${liveCoords.lon.toFixed(4)}°E)`);
          }
        }

        const promises: Promise<any>[] = [];

        // 1. Home location prediction
        if (homeCoords) {
          const homeLocality = savedHome?.locality || savedHome?.address || 'Saved Home';
          promises.push(JaldrishtiApi.getWaterloggingPrediction(homeCoords.lat, homeCoords.lon, homeLocality).catch(() => null));
        } else {
          promises.push(Promise.resolve(null));
        }

        // 2. Live GPS location prediction
        if (liveCoords) {
          promises.push(JaldrishtiApi.getWaterloggingPrediction(liveCoords.lat, liveCoords.lon, liveLocationName).catch(() => null));
        } else {
          promises.push(Promise.resolve(null));
        }

        // 3. Digital Twin Coverage Predictions for ALL Scope (Ballygunge, Shibpur, Barasat)
        promises.push(JaldrishtiApi.getWaterloggingPrediction(22.5280, 88.3650, 'Ballygunge, Kolkata').catch(() => null));
        promises.push(JaldrishtiApi.getWaterloggingPrediction(22.5650, 88.3190, 'Shibpur, Howrah').catch(() => null));
        promises.push(JaldrishtiApi.getWaterloggingPrediction(22.7214, 88.4821, 'Barasat').catch(() => null));

        const [homePred, livePred, ballyPred, shibpurPred, barasatPred] = await Promise.all(promises);

        if (!isMounted) return;

        const generated: EnhancedAlertItem[] = [];

        if (homePred && homeCoords) {
          const homeLocality = savedHome?.locality || savedHome?.address || 'Saved Home';
          generated.push(...createAlertItemsFromPrediction(homePred, 'HOME', homeLocality));
        }

        if (livePred && liveCoords) {
          generated.push(...createAlertItemsFromPrediction(livePred, 'LIVE_GPS', liveLocationName));
        }

        // Digital Twin Coverage predictions for ALL scope
        if (ballyPred) generated.push(...createAlertItemsFromPrediction(ballyPred, 'MONITORED_CORRIDOR', 'Ballygunge, Kolkata'));
        if (shibpurPred) generated.push(...createAlertItemsFromPrediction(shibpurPred, 'MONITORED_CORRIDOR', 'Shibpur, Howrah'));
        if (barasatPred) generated.push(...createAlertItemsFromPrediction(barasatPred, 'MONITORED_CORRIDOR', 'Barasat'));

        setAlertsList(generated);
      } catch (err) {
        console.warn('Error constructing alerts list:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadAlertsData();

    return () => {
      isMounted = false;
    };
  }, [savedHome, userGpsCoords, currentTimestep]);

  // ---------------------------------------------------------------------
  // AREA-BASED LOCATION SCOPE EVALUATION
  // ---------------------------------------------------------------------
  const homeArea = resolveAreaForLocation(homeCoords, savedHome?.locality || savedHome?.address);
  const liveArea = resolveAreaForLocation(liveCoords, liveLocationName);

  const isAlertRelevantToHome = (alert: EnhancedAlertItem): boolean => {
    if (alert.locationScope === 'HOME') return true;
    if (homeArea && alert.areaKey === homeArea.key) return true;
    if (homeCoords && calcDistanceKm(homeCoords.lat, homeCoords.lon, alert.lat, alert.lon) <= 4.0) return true;
    return false;
  };

  const isAlertRelevantToLiveGps = (alert: EnhancedAlertItem): boolean => {
    if (alert.locationScope === 'LIVE_GPS') return true;
    if (liveArea && alert.areaKey === liveArea.key) return true;
    if (liveCoords && calcDistanceKm(liveCoords.lat, liveCoords.lon, alert.lat, alert.lon) <= 4.0) return true;
    return false;
  };

  const isNotificationAllowedBySettings = (alert: EnhancedAlertItem): boolean => {
    if (!notificationSettings) return true;
    if (alert.alertType === 'ACTIVE_AFTER_WATERLOGGING' && !notificationSettings.currentWaterlogging) {
      return false;
    }
    if (alert.alertType === 'PREDICTIVE_BEFORE_WATERLOGGING' && !notificationSettings.predictedFloodRisk) {
      return false;
    }
    if (alert.locationScope === 'MONITORED_CORRIDOR' && !notificationSettings.routeFloodRisk) {
      return false;
    }
    if (alert.forecastRainfallMm && alert.forecastRainfallMm.includes('peak') && !notificationSettings.heavyRainfallWarning && alert.severity !== 'CRITICAL') {
      return false;
    }
    return true;
  };

  // Compute scope-filtered, deduplicated and notification-filtered alerts for any date group
  const getFilteredAlertsForGroup = (group: 'TODAY' | 'UPCOMING' | 'RESOLVED'): EnhancedAlertItem[] => {
    const groupFiltered = alertsList.filter((a) => a.dateGroup === group);
    let scoped: EnhancedAlertItem[] = [];

    if (scopeFilter === 'HOME') {
      scoped = groupFiltered.filter(isAlertRelevantToHome);
    } else if (scopeFilter === 'LIVE_GPS') {
      scoped = groupFiltered.filter(isAlertRelevantToLiveGps);
    } else {
      scoped = groupFiltered;
    }

    const seenIds = new Set<string>();
    return scoped.filter((a) => {
      if (seenIds.has(a.id)) return false;
      if (!isNotificationAllowedBySettings(a)) return false;
      seenIds.add(a.id);
      return true;
    });
  };

  const todayAlerts = getFilteredAlertsForGroup('TODAY');
  const upcomingAlerts = getFilteredAlertsForGroup('UPCOMING');
  const resolvedAlerts = getFilteredAlertsForGroup('RESOLVED');

  const filteredAlerts = dateTab === 'TODAY' ? todayAlerts : dateTab === 'UPCOMING' ? upcomingAlerts : resolvedAlerts;

  const getRiskBadgeColor = (riskLevel: EnhancedAlertItem['riskLevel']) => {
    switch (riskLevel) {
      case 'CLOSED':
      case 'CRITICAL':
        return 'bg-rose-600 text-white border-rose-700';
      case 'HIGH':
        return 'bg-red-500 text-white border-red-600';
      case 'MODERATE':
        return 'bg-amber-500 text-slate-950 border-amber-600';
      case 'LOW':
      default:
        return 'bg-blue-600 text-white border-blue-700';
    }
  };

  const homeLocalityTitle = savedHome?.locality || savedHome?.name || savedHome?.address || 'Saved Home Location';

  return (
    <div id="jaldrishti-alerts-view" className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 select-none">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Bell className="w-7 h-7 text-blue-600" />
                <span>Flood &amp; Waterlogging Early Warnings</span>
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Authoritative multi-factor predictive alerts before waterlogging &amp; active road status after rainfall.
              </p>
            </div>

            {/* Filter Controls: Date Group Tabs & Location Scope Switcher */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Group Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  id="alert-tab-today"
                  onClick={() => setDateTab('TODAY')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateTab === 'TODAY'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  TODAY ({todayAlerts.length})
                </button>

                <button
                  id="alert-tab-upcoming"
                  onClick={() => setDateTab('UPCOMING')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateTab === 'UPCOMING'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  UPCOMING ({upcomingAlerts.length})
                </button>

                <button
                  id="alert-tab-resolved"
                  onClick={() => setDateTab('RESOLVED')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    dateTab === 'RESOLVED'
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  RESOLVED ({resolvedAlerts.length})
                </button>
              </div>

              {/* Location Scope Selector */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
                <button
                  id="alert-scope-all"
                  onClick={() => setScopeFilter('ALL')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    scopeFilter === 'ALL'
                      ? 'bg-slate-900 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>

                <button
                  id="alert-scope-home"
                  onClick={() => setScopeFilter('HOME')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    scopeFilter === 'HOME'
                      ? 'bg-slate-900 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🏠 Home
                </button>

                <button
                  id="alert-scope-live"
                  onClick={() => setScopeFilter('LIVE_GPS')}
                  className={`px-2.5 py-1.5 rounded-lg transition-all ${
                    scopeFilter === 'LIVE_GPS'
                      ? 'bg-slate-900 text-white font-bold shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  📍 Live GPS
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Alerts Feed */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
            <CloudRain className="w-10 h-10 text-blue-600 animate-bounce mx-auto" />
            <h3 className="text-base font-bold text-slate-900">Evaluating Proactive Flood Warnings...</h3>
            <p className="text-xs text-slate-500">
              Integrating Doppler Weather Radar, 1D/2D SWMM Hydrodynamics &amp; Saved Home/Live GPS context.
            </p>
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-sm">
            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
            <h3 className="text-base font-bold text-slate-900">
              {scopeFilter === 'HOME'
                ? 'No Flood Warnings for Saved Home Location'
                : scopeFilter === 'LIVE_GPS'
                ? 'No Flood Warnings for Live GPS Location'
                : 'No Active Alerts for Selected Location Scope'}
            </h3>
            <p className="text-xs text-slate-500">
              {scopeFilter === 'HOME'
                ? 'No authoritative flood predictions or active waterlogging reported for your Saved Home area.'
                : scopeFilter === 'LIVE_GPS'
                ? 'No authoritative flood predictions or active waterlogging reported for your Current Live GPS area.'
                : 'All monitored road corridors and saved home locations are currently within low risk limits.'}
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const relHome = isAlertRelevantToHome(alert);
            const relLive = isAlertRelevantToLiveGps(alert);

            return (
              <div
                key={alert.id}
                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 hover:border-slate-300 transition-all"
              >
                {/* Top Banner: Location Scope + Alert Type + Severity & Provenance Badges */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Dynamic Location Scope Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1">
                      {relHome && relLive ? (
                        <>🏠 SAVED HOME LOCATION &amp; 📍 CURRENT LIVE GPS</>
                      ) : relHome ? (
                        <>🏠 SAVED HOME LOCATION</>
                      ) : relLive ? (
                        <>📍 CURRENT LIVE GPS</>
                      ) : (
                        <>🛣️ MONITORED CORRIDOR</>
                      )}
                    </span>

                    {/* Predictive vs Active Badge */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        alert.alertType === 'PREDICTIVE_BEFORE_WATERLOGGING'
                          ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {alert.alertType === 'PREDICTIVE_BEFORE_WATERLOGGING'
                        ? 'PREDICTIVE FLOOD WARNING (BEFORE WATERLOGGING)'
                        : 'ACTIVE WATERLOGGING ALERT (AFTER RAINFALL)'}
                    </span>

                    {/* Risk Level Badge */}
                    <span
                      className={`px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRiskBadgeColor(
                        alert.riskLevel
                      )}`}
                    >
                      {alert.riskLevel === 'CRITICAL'
                        ? 'CRITICAL RISK'
                        : alert.riskLevel === 'HIGH'
                        ? 'HIGH RISK'
                        : alert.riskLevel === 'MODERATE'
                        ? 'MODERATE RISK'
                        : alert.riskLevel === 'CLOSED'
                        ? 'CLOSED / IMPASSABLE'
                        : 'LOW RISK'}
                    </span>

                    {/* Source Provenance Badge */}
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                      {alert.sourceType === 'HISTORICAL'
                        ? `SOURCE: Historical Flood Record (${alert.sourceRecordId || 'Dataset'})`
                        : alert.sourceType === 'CITIZEN_REPORT'
                        ? `SOURCE: Verified Citizen Report (${alert.sourceRecordId || 'Dataset'})`
                        : 'SOURCE: Flood Prediction Model'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-xs text-slate-400 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{alert.timestamp}</span>
                  </div>
                </div>

                {/* Title & Specific Location Name */}
                <div>
                  <h2 className="text-lg font-bold text-slate-900 tracking-tight">{alert.title}</h2>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-500 mt-1">
                    <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-bold text-slate-800">{alert.locationName}</span>
                  </div>
                </div>

                {/* WHY WATERLOGGING IS LIKELY / HAS OCCURRED */}
                <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center space-x-2 text-amber-900 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="uppercase tracking-wider">
                      WHY WATERLOGGING IS LIKELY (PHYSICAL CAUSAL DRIVERS):
                    </span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">{alert.whyLikelyReason}</p>
                  <div className="pt-1 text-[11px] text-amber-800 font-medium">
                    <strong>Recommended Action:</strong> {alert.recommendedAction}
                  </div>
                </div>

                {/* SPECIFIC FLOOD / WATERLOGGING SPOTS WITHIN AREA */}
                {alert.specificSpotsList && alert.specificSpotsList.length > 0 && (
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        SPECIFIC FLOOD / WATERLOGGING SPOTS AT RISK:
                      </span>
                    </span>
                    <div className="space-y-1.5">
                      {alert.specificSpotsList.map((spot, idx) => (
                        <div
                          key={idx}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-2 rounded-xl bg-white border border-slate-200/70 text-xs gap-1"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                            <span className="font-bold text-slate-900">{spot.name}</span>
                            {spot.distanceKm !== undefined && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                ({spot.distanceKm} km away)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 shrink-0">
                            <span className="text-xs font-mono font-bold text-rose-600">
                              Predicted Depth: {spot.depthCm}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadgeColor(
                                spot.riskLevel
                              )}`}
                            >
                              {spot.riskLevel}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-blue-50/60 rounded-2xl p-3 border border-blue-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Rainfall Context</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                      {alert.forecastRainfallMm}
                    </span>
                  </div>

                  <div className="bg-rose-50/60 rounded-2xl p-3 border border-rose-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Predicted Depth</span>
                    <span className="text-xs sm:text-sm font-bold text-rose-700 font-mono mt-0.5 block">
                      {alert.possibleDepthCm}
                    </span>
                  </div>

                  <div className="bg-amber-50/60 rounded-2xl p-3 border border-amber-100">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Risk Level</span>
                    <span className="text-xs sm:text-sm font-bold text-amber-900 font-mono mt-0.5 block">
                      {alert.riskLevel}
                    </span>
                  </div>

                  <div className="bg-slate-100/70 rounded-2xl p-3 border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Expected Window</span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">
                      {alert.expectedWindow}
                    </span>
                  </div>
                </div>

                {/* Potentially Affected Road Segments */}
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider block">
                    Potentially Affected Mapped Road Segments:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {alert.affectedRoads.map((road) => (
                      <span
                        key={road}
                        className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5"
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-600" />
                        <span>{road}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Info Bar (Provenance & Confidence) */}
                <div className="pt-2 flex items-center justify-between border-t border-slate-100 text-[11px] text-slate-400 font-mono">
                  <span>Data Provenance: {alert.isPredicted ? 'MODEL-PREDICTED FORECAST' : 'LIVE TELEMETRY'}</span>
                  <span>Confidence: {alert.confidence}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
