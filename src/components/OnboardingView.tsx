/**
 * JALDRISHTI First-Time Onboarding & Home Setup
 * White + Blue Clean Aesthetic
 * Live GPS Location Request + Canonical LocationSearch Setup.
 */

import React, { useState } from 'react';
import { MapPin, Navigation, CheckCircle2, ArrowRight, Compass } from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';
import { LocationSearch, LocationSearchResult } from './common/LocationSearch';
import { API_BASE_URL } from '../services/api';

export const OnboardingView: React.FC = () => {
  const { setSavedHome, completeOnboarding } = useFloodStore();

  const [step, setStep] = useState<'LOCATION_PERMISSION' | 'SET_HOME'>('LOCATION_PERMISSION');
  const [gpsStatus, setGpsStatus] = useState<'IDLE' | 'LOCATING' | 'SUCCESS' | 'DENIED'>('IDLE');
  
  const [selectedLocation, setSelectedLocation] = useState<LocationSearchResult | null>(null);

  const handleRequestGPS = () => {
    setGpsStatus('LOCATING');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setGpsStatus('SUCCESS');

          try {
            const res = await fetch(`${API_BASE_URL}/home/geocode/reverse?lat=${lat}&lon=${lon}`)
              .then((r) => r.json())
              .catch(() => null);

            if (res) {
              setSelectedLocation({
                display_name: res.display_name || `GPS Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
                locality: res.locality || 'Current GPS Area',
                address: res.display_name || 'GPS Location',
                lat,
                lon,
                source: 'GPS_LIVE',
              });
            } else {
              setSelectedLocation({
                display_name: `GPS Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
                locality: 'Current Location',
                address: 'GPS Location',
                lat,
                lon,
                source: 'GPS_LIVE',
              });
            }
          } catch {
            setSelectedLocation({
              display_name: `GPS Location (${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E)`,
              locality: 'Current Location',
              address: 'GPS Location',
              lat,
              lon,
              source: 'GPS_LIVE',
            });
          }

          setTimeout(() => setStep('SET_HOME'), 600);
        },
        (error) => {
          console.warn('Geolocation permission denied:', error);
          setGpsStatus('DENIED');
          setTimeout(() => setStep('SET_HOME'), 600);
        },
        { timeout: 5000 }
      );
    } else {
      setGpsStatus('DENIED');
      setTimeout(() => setStep('SET_HOME'), 600);
    }
  };

  const handleFinishOnboarding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLocation) return;

    setSavedHome({
      id: `LOC-HOME-${Date.now()}`,
      name: 'Home',
      address: selectedLocation.display_name,
      locality: selectedLocation.locality,
      coordinates: [selectedLocation.lat, selectedLocation.lon],
      type: 'HOME',
      isSet: true,
    });
    completeOnboarding();
  };

  return (
    <div id="jaldrishti-onboarding-view" className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 font-sans">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto shadow-md shadow-blue-600/20 bg-blue-950 flex items-center justify-center p-0.5">
            <img src="/logo.png" alt="JALDRISHTI Logo" className="w-full h-full object-cover rounded-xl" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome to JALDRISHTI
          </h1>
          <p className="text-xs text-slate-500">
            {step === 'LOCATION_PERMISSION'
              ? 'Enable location services for real-time flood early warnings'
              : 'Confirm your primary Home location to personalize route safety'}
          </p>
        </div>

        {/* STEP 1: LOCATION PERMISSION */}
        {step === 'LOCATION_PERMISSION' && (
          <div className="space-y-4">
            <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2 text-xs text-slate-700">
              <div className="flex items-center space-x-2 font-bold text-blue-900">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Why is Location Permission needed?</span>
              </div>
              <p className="leading-relaxed">
                JALDRISHTI monitors flood risk along your daily routes, calculates vehicle clearance, and sends proactive warnings before you leave home.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleRequestGPS}
                className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
              >
                <Navigation className="w-4 h-4" />
                <span>
                  {gpsStatus === 'LOCATING'
                    ? 'GETTING GPS LOCATION...'
                    : gpsStatus === 'SUCCESS'
                    ? 'GPS LOCATION CONFIRMED ✓'
                    : 'USE MY LIVE GPS LOCATION'}
                </span>
              </button>

              <button
                onClick={() => setStep('SET_HOME')}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                ENTER LOCATION MANUALLY
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: SET HOME ADDRESS */}
        {step === 'SET_HOME' && (
          <form onSubmit={handleFinishOnboarding} className="space-y-4 text-xs">
            <div className="space-y-1">
              <label className="block font-bold text-slate-700 uppercase">
                Search Home Location (Pan-India)
              </label>
              <LocationSearch
                placeholder="Type location (e.g. Joypur, Bishnupur, Barasat, Delhi)..."
                onSelectLocation={(loc) => setSelectedLocation(loc)}
                autoFocus={true}
              />
            </div>

            {selectedLocation && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs rounded-2xl space-y-1 font-medium shadow-sm">
                <div className="flex items-center space-x-2 font-bold text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Selected Location: {selectedLocation.locality}</span>
                </div>
                <p className="text-[11px] text-emerald-800 line-clamp-2">
                  {selectedLocation.display_name}
                </p>
                <div className="text-[10px] text-emerald-700 font-mono">
                  Coordinates: {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E ({selectedLocation.source})
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!selectedLocation}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all flex items-center justify-center space-x-2"
            >
              <span>CONFIRM &amp; ENTER JALDRISHTI</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
