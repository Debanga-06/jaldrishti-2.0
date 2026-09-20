/**
 * JALDRISHTI Home Screen View
 * Location-Agnostic Real + Simulation Data-Driven Early Warning Dashboard
 * Answers within 5 seconds: "Is my home safe today?"
 */

import React, { useState, useEffect } from 'react';
import {
  MapPin,
  CloudRain,
  AlertTriangle,
  Navigation,
  ArrowRight,
  ChevronRight,
  Edit2,
  CheckCircle2,
  Info,
  Compass,
  Search,
  Check,
  RefreshCw,
} from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';
import { FloodMap } from './FloodMap';
import { JaldrishtiApi, API_BASE_URL } from '../services/api';
import { LocationSearch, LocationSearchResult } from './common/LocationSearch';

export const HomeView: React.FC = () => {
  const {
    savedHome,
    setSavedHome,
    setNavTab,
    startNavigationTo,
    usualRoutes,
  } = useFloodStore();

  const [homeData, setHomeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEditingHome, setIsEditingHome] = useState<boolean>(false);

  const isHomeSet = savedHome && savedHome.isSet !== false && savedHome.id !== 'UNSET' && (savedHome.coordinates[0] !== 0 || savedHome.coordinates[1] !== 0);
  const coords = isHomeSet ? savedHome.coordinates : [22.5280, 88.3650];

  // Fetch real Open-Meteo & Home evaluation API data dynamically whenever savedHome changes
  const fetchHomeEvaluation = async () => {
    if (!savedHome?.coordinates || (savedHome.coordinates[0] === 0 && savedHome.coordinates[1] === 0)) return;
    setIsLoading(true);
    try {
      const data = await JaldrishtiApi.getHomeStatus(savedHome.coordinates[0], savedHome.coordinates[1], savedHome.locality || 'Saved Home');
      setHomeData(data);
    } catch (e) {
      console.warn('Error fetching home status:', e);
      setHomeData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeEvaluation();
  }, [savedHome]);

  const handleSetHomeDirect = (loc: LocationSearchResult) => {
    setSavedHome({
      id: `LOC-${Date.now()}`,
      name: 'Home',
      address: loc.display_name,
      locality: loc.locality || loc.address,
      coordinates: [loc.lat, loc.lon],
      type: 'HOME',
      isSet: true,
    });

    setIsEditingHome(false);
  };

  const handleGPSLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          const res = await fetch(`${API_BASE_URL}/home/geocode/reverse?lat=${lat}&lon=${lon}`)
            .then((r) => r.json())
            .catch(() => null);

          handleSetHomeDirect({
            locality: res?.locality || 'Current GPS Area',
            display_name: res?.display_name || `GPS Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
            address: res?.display_name || 'GPS Location',
            lat,
            lon,
            source: 'GPS_LIVE',
          });
        },
        (error) => {
          console.warn('Geolocation failed:', error);
        },
        { timeout: 5000 }
      );
    }
  };

  const safety = homeData?.home_safety || {
    is_home_safe: true,
    flood_risk_level: 'LOW',
    predicted_depth_range: '<5 cm',
    time_window: 'Next 3–6 hours IST',
    early_warning_message: isLoading ? 'Evaluating live weather and flood risk...' : 'Weather and prediction telemetry unavailable.',
    agent_rationale: isLoading ? 'Fetching location data...' : 'Data telemetry unavailable for location.',
  };

  const weather = homeData?.weather || {
    precipitation_next_24h_mm: 0.0,
    peak_hourly_intensity_mm_h: 0.0,
    intensity_label: isLoading ? 'FETCHING...' : 'DATA UNAVAILABLE',
    data_state: isLoading ? 'FETCHING' : 'DATA_UNAVAILABLE',
    timestamp_ist: 'Now',
  };

  const bestWay = homeData?.best_way_home || {
    route_name: `${savedHome.locality || 'Home'} Elevated Bypass`,
    extra_time_min: 0,
    rationale: 'Primary route clear.',
  };

  const affectedRoads = homeData?.affected_roads || [];

  return (
    <div id="jaldrishti-home-view" className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24">
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2 text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">
                <span>Location Safety Monitor</span>
                <span>•</span>
                <span>{isHomeSet ? savedHome.locality : 'Unset Location'}</span>
              </div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                  {isHomeSet ? `Home: ${savedHome.locality}` : 'Home Location Unset'}
                </h1>
                <button
                  id="change-home-btn"
                  onClick={() => setIsEditingHome(!isEditingHome)}
                  className="px-3 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center space-x-1 border border-blue-200 transition-all shadow-sm"
                  title="Change saved Home location"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>{isHomeSet ? 'Change Home' : 'Set Home'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {isHomeSet ? savedHome.address : 'Please configure your primary home location to enable personalized early warnings.'}
              </p>
            </div>

            {/* Data Provenance & Real Weather State Badge */}
            {isHomeSet && (
              <div className="flex flex-col items-end space-y-1">
                <div className="flex items-center space-x-2 bg-blue-50/80 border border-blue-200 px-3.5 py-1.5 rounded-2xl">
                  <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="text-xs font-bold text-blue-900">
                    OPEN-METEO {weather.data_state} • Updated {weather.timestamp_ist || 'Now'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium font-mono">
                  Lat: {coords[0].toFixed(6)}°N • Lon: {coords[1].toFixed(6)}°E
                </span>
              </div>
            )}
          </div>

          {/* Edit Home Location Modal Widget */}
          {isEditingHome && (
            <div className="mt-4 p-5 bg-blue-50/80 border border-blue-200 rounded-3xl space-y-4 shadow-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wider">
                  Set Your Home Location (All-India OpenStreetMap / Photon Geocoding)
                </h3>
                <button
                  onClick={() => setIsEditingHome(false)}
                  className="text-xs text-slate-500 font-bold hover:text-slate-900"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handleGPSLocation}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-2 shadow-sm transition-all"
                >
                  <Compass className="w-4 h-4" />
                  <span>Use My Live GPS Location</span>
                </button>

                <LocationSearch
                  placeholder="Search any location in India (e.g. Joypur, Bishnupur, Barasat, Delhi, Kolkata, Mumbai...)"
                  onSelectLocation={handleSetHomeDirect}
                  onSubmitText={async (text) => {
                    try {
                      const results = await JaldrishtiApi.searchGeocoding(text);
                      if (results && results.length > 0) {
                        handleSetHomeDirect(results[0]);
                      }
                    } catch (e) {}
                  }}
                  autoFocus={true}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Unset Home Warning Banner */}
        {!isHomeSet && (
          <div className="p-6 bg-amber-50 border border-amber-200 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-amber-950 text-sm sm:text-base">Set your home location to continue</h3>
                <p className="text-xs text-amber-800 mt-0.5">Configure your home location to receive personalized flood warnings and safe route recommendations.</p>
              </div>
            </div>
            <button
              onClick={() => setIsEditingHome(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all shrink-0"
            >
              Configure Home Location
            </button>
          </div>
        )}

        {/* 1. EARLY WARNING TOP ALERT CARD */}
        {isHomeSet && (
          <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    {safety.flood_risk_level} FLOOD RISK FORECAST
                  </span>
                  <span className="text-slate-400 text-xs">• {safety.time_window}</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold leading-tight">
                  {safety.early_warning_message}
                </h2>

                <p className="text-xs text-slate-300 leading-relaxed bg-white/5 p-3.5 rounded-2xl border border-white/10">
                  <span className="font-bold text-blue-300">AI Safety Rationale: </span>
                  {safety.agent_rationale}
                </p>
              </div>

              {/* Best Way Home Quick Action */}
              <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-5 shrink-0 flex flex-col justify-between space-y-4 md:w-72">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-blue-200">
                    Recommended Safe Corridor
                  </div>
                  <div className="text-base font-bold text-white mt-1">
                    {bestWay.route_name}
                  </div>
                  <p className="text-xs text-emerald-300 mt-1 font-semibold">
                    +{bestWay.extra_time_min} min travel time • Max 4cm depth
                  </p>
                </div>

                <button
                  onClick={() => startNavigationTo(undefined, undefined)}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md flex items-center justify-center space-x-2 transition-all"
                >
                  <span>BEST WAY HOME</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. GRID: WEATHER & FLOOD METRICS */}
        {isHomeSet && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Rainfall Intensity</span>
                <CloudRain className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {weather.peak_hourly_intensity_mm_h} <span className="text-sm font-normal text-slate-500">mm/h</span>
                </div>
                <div className="text-xs font-bold text-blue-700 mt-1">{weather.intensity_label}</div>
              </div>
              <div className="text-[11px] text-slate-400">
                24h Forecast Total: {weather.precipitation_next_24h_mm} mm
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Predicted Water Depth</span>
                <AlertTriangle className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {safety.predicted_depth_range}
                </div>
                <div className="text-xs font-bold text-amber-600 mt-1">Waterlogging Expected</div>
              </div>
              <div className="text-[11px] text-slate-400">
                Peak Window: {safety.time_window}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase">
                <span>Usual Commute Safety</span>
                <Navigation className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {usualRoutes?.length || 2} <span className="text-sm font-normal text-slate-500">Monitored Routes</span>
                </div>
                <div className="text-xs font-bold text-emerald-600 mt-1">Alternative Corridor Available</div>
              </div>
              <button
                onClick={() => setNavTab('SEARCH')}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center space-x-1"
              >
                <span>Compare all commute routes</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* 3. INTERACTIVE FLOOD MAP */}
        <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span>Live Digital Twin Map • {isHomeSet ? (savedHome.locality || savedHome.name) : 'Kolkata (Ballygunge)'}</span>
            </h3>
            <span className="text-xs font-mono text-slate-400">
              Center: [{coords[0].toFixed(4)}, {coords[1].toFixed(4)}]
            </span>
          </div>
          <div className="h-[480px] rounded-2xl overflow-hidden border border-slate-200 relative">
            <FloodMap mode="HOME" />
          </div>
        </div>
      </div>
    </div>
  );
};
