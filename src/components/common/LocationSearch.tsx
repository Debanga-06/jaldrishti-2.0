import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Siren, Building2 } from 'lucide-react';
import { JaldrishtiApi } from '../../services/api';
import { LocationSearchResult } from '../../types';

export interface NearbyHospital {
  name: string;
  address: string;
  locality: string;
  lat: number;
  lon: number;
  city: string;
  emergencyPhone?: string;
}

const REAL_HOSPITALS_DATABASE: NearbyHospital[] = [
  // Barasat
  {
    name: 'Barasat Govt Medical College & District Hospital',
    address: 'Kachhari Road, Barasat, Kolkata 700124',
    locality: 'Barasat',
    city: 'Barasat',
    lat: 22.7265,
    lon: 88.4785,
    emergencyPhone: '108',
  },
  {
    name: 'Barasat Sub-Divisional Hospital & Trauma Center',
    address: 'Station Road, Barasat, North 24 Parganas 700124',
    locality: 'Barasat',
    city: 'Barasat',
    lat: 22.7214,
    lon: 88.4821,
    emergencyPhone: '033-25523456',
  },
  {
    name: 'City Care Emergency Nursing Home',
    address: 'Champadali More, Jessore Rd, Barasat 700124',
    locality: 'Champadali, Barasat',
    city: 'Barasat',
    lat: 22.7160,
    lon: 88.4805,
    emergencyPhone: '033-25529999',
  },
  {
    name: 'Sethpukur Matri Sadan & Primary Health Centre',
    address: 'Sethpukur, Ward 33, Barasat 700124',
    locality: 'Sethpukur, Barasat',
    city: 'Barasat',
    lat: 22.7275,
    lon: 88.4895,
    emergencyPhone: '033-25521111',
  },
  {
    name: 'Care and Cure Hospital Barasat',
    address: 'Taki Road, Barasat, Kolkata 700124',
    locality: 'Barasat',
    city: 'Barasat',
    lat: 22.7090,
    lon: 88.4910,
    emergencyPhone: '033-25528888',
  },

  // Howrah
  {
    name: 'Howrah District Hospital',
    address: 'Biplabi Haren Ghosh Sarani, Howrah 711101',
    locality: 'Howrah',
    city: 'Howrah',
    lat: 22.5855,
    lon: 88.3307,
    emergencyPhone: '033-26418888',
  },
  {
    name: 'Shibpur General Hospital',
    address: 'Shibpur Road, Howrah 711102',
    locality: 'Shibpur, Howrah',
    city: 'Howrah',
    lat: 22.5656,
    lon: 88.3196,
    emergencyPhone: '033-26880000',
  },
  {
    name: 'Narayana Multispeciality Hospital, Howrah',
    address: 'Andul Road, Shibpur, Howrah 711109',
    locality: 'Shibpur, Howrah',
    city: 'Howrah',
    lat: 22.5601,
    lon: 88.3090,
    emergencyPhone: '033-71222222',
  },
  {
    name: 'Sanjiban Hospital, Howrah',
    address: 'Fuleswar, Howrah 711316',
    locality: 'Howrah',
    city: 'Howrah',
    lat: 22.5512,
    lon: 88.2915,
    emergencyPhone: '033-26315000',
  },

  // Kolkata (Central/South/East/North)
  {
    name: 'SSKM Hospital & IPGMER, Kolkata',
    address: '244 AJC Bose Road, Bhowanipore, Kolkata 700020',
    locality: 'Bhowanipore, Kolkata',
    city: 'Kolkata',
    lat: 22.5392,
    lon: 88.3432,
    emergencyPhone: '033-22231589',
  },
  {
    name: 'AMRI Hospital, Ballygunge / Dhakuria',
    address: 'P-263 Gariahat Rd, Dhakuria, Ballygunge, Kolkata 700031',
    locality: 'Ballygunge, Kolkata',
    city: 'Kolkata',
    lat: 22.5126,
    lon: 88.3698,
    emergencyPhone: '033-66800000',
  },
  {
    name: 'Calcutta National Medical College & Hospital',
    address: '32 Gorachand Rd, Beniapukur, Kolkata 700014',
    locality: 'Ballygunge / Park Circus, Kolkata',
    city: 'Kolkata',
    lat: 22.5458,
    lon: 88.3664,
    emergencyPhone: '033-22844834',
  },
  {
    name: 'Apollo Multispeciality Hospitals, Salt Lake',
    address: '58 Canal Circular Rd, Kadapara, Salt Lake, Kolkata 700054',
    locality: 'Salt Lake, Kolkata',
    city: 'Kolkata',
    lat: 22.5760,
    lon: 88.4042,
    emergencyPhone: '033-23203040',
  },
  {
    name: 'R. G. Kar Medical College & Hospital',
    address: '1 Kshudiram Bose Sarani, Belgachia, Kolkata 700004',
    locality: 'Shyambazar, Kolkata',
    city: 'Kolkata',
    lat: 22.6042,
    lon: 88.3789,
    emergencyPhone: '033-25557675',
  },

  // Mumbai
  {
    name: 'KEM Hospital, Mumbai',
    address: 'Acharya Donde Marg, Parel, Mumbai 400012',
    locality: 'Parel, Mumbai',
    city: 'Mumbai',
    lat: 19.0024,
    lon: 72.8423,
    emergencyPhone: '022-24107000',
  },
  {
    name: 'Lilavati Hospital & Research Centre, Mumbai',
    address: 'A-791, Bandra Reclamation, Bandra West, Mumbai 400050',
    locality: 'Bandra, Mumbai',
    city: 'Mumbai',
    lat: 19.0514,
    lon: 72.8286,
    emergencyPhone: '022-26751000',
  },
  {
    name: 'Bombay Hospital & Medical Research Centre',
    address: '12 Marine Lines, Mumbai 400020',
    locality: 'Marine Lines, Mumbai',
    city: 'Mumbai',
    lat: 18.9438,
    lon: 72.8283,
    emergencyPhone: '022-22067676',
  },
];

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export function getNearbyHospitalsForContext(refLat: number, refLon: number, limit = 3) {
  const sorted = REAL_HOSPITALS_DATABASE.map((hosp) => {
    const dist = getDistanceKm(refLat, refLon, hosp.lat, hosp.lon);
    return { ...hosp, distance_km: dist };
  }).sort((a, b) => a.distance_km - b.distance_km);

  return sorted.slice(0, limit);
}

interface LocationSearchProps {
  placeholder?: string;
  initialValue?: string;
  onSelectLocation: (location: LocationSearchResult) => void;
  onChangeText?: (text: string) => void;
  onSubmitText?: (text: string) => void;
  className?: string;
  autoFocus?: boolean;
  isMedicalMode?: boolean;
}

const GLOBAL_LOCATION_CACHE = new Map<string, LocationSearchResult[]>();

export const LocationSearch: React.FC<LocationSearchProps> = ({
  placeholder = 'Search location (e.g. Joypur, Bishnupur, Barasat, Delhi)...',
  initialValue = '',
  onSelectLocation,
  onChangeText,
  onSubmitText,
  className = '',
  autoFocus = false,
  isMedicalMode = false,
}) => {
  const [query, setQuery] = useState<string>(initialValue);
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Live GPS tracking state for Ambulance / Medical Mode nearby hospital suggestions
  const [userGpsCoords, setUserGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isAcquiringGps, setIsAcquiringGps] = useState<boolean>(false);

  const prevInitialValueRef = useRef(initialValue);
  useEffect(() => {
    if (initialValue !== undefined && initialValue !== prevInitialValueRef.current) {
      const oldInitial = prevInitialValueRef.current;
      prevInitialValueRef.current = initialValue;
      if (!isFocused && (query === oldInitial || query === '')) {
        setQuery(initialValue);
      }
    }
  }, [initialValue, isFocused, query]);

  // Live Geolocation Watcher for Ambulance Mode
  useEffect(() => {
    if (!isMedicalMode) {
      setUserGpsCoords(null);
      setGpsError(null);
      setIsAcquiringGps(false);
      return;
    }

    if (!('geolocation' in navigator)) {
      setGpsError('Enable location to see nearby hospitals');
      return;
    }

    setIsAcquiringGps(true);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserGpsCoords({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
        setGpsError(null);
        setIsAcquiringGps(false);
      },
      (err) => {
        console.warn('Ambulance LocationSearch Geolocation notice:', err);
        setUserGpsCoords(null);
        setGpsError('Enable location to see nearby hospitals');
        setIsAcquiringGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isMedicalMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const trimmed = (query || '').trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    const cacheKey = trimmed.toLowerCase();
    if (GLOBAL_LOCATION_CACHE.has(cacheKey)) {
      const cached = GLOBAL_LOCATION_CACHE.get(cacheKey)!;
      setSuggestions(cached);
      setIsOpen(cached.length > 0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const timer = setTimeout(async () => {
      try {
        const results = await JaldrishtiApi.searchGeocoding(trimmed, controller.signal);
        if (results === null) {
          return;
        }
        if (results && results.length > 0) {
          GLOBAL_LOCATION_CACHE.set(cacheKey, results);
        }
        setSuggestions(results || []);
        setIsOpen((results || []).length > 0);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setSuggestions([]);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setIsSearching(false);
        }
      }
    }, 150);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = (item: LocationSearchResult) => {
    const textVal = item.locality || item.display_name;
    setQuery(textVal);
    setIsOpen(false);
    setIsFocused(false);
    onSelectLocation(item);
    if (onChangeText) onChangeText(textVal);
  };

  const handleSelectHospital = (hosp: NearbyHospital & { distance_km: number }) => {
    const textVal = hosp.name;
    setQuery(textVal);
    setIsOpen(false);
    setIsFocused(false);
    const locResult: LocationSearchResult = {
      display_name: `${hosp.name}, ${hosp.address}`,
      locality: hosp.name,
      address: hosp.address,
      lat: hosp.lat,
      lon: hosp.lon,
      district: hosp.city,
      state: 'West Bengal',
      country: 'India',
      source: 'NEARBY_HOSPITAL_DATABASE',
    };
    onSelectLocation(locResult);
    if (onChangeText) onChangeText(textVal);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    if (onChangeText) onChangeText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (isOpen && suggestions.length > 0) {
        handleSelect(suggestions[0]);
      } else if (onSubmitText && query) {
        onSubmitText(query);
      }
    }
  };

  const nearbyHospitals =
    isMedicalMode && userGpsCoords
      ? getNearbyHospitalsForContext(userGpsCoords.lat, userGpsCoords.lon, 3)
      : [];

  const showHospitalSuggestions =
    isMedicalMode && isFocused && (!query || query.trim().length < 2);

  return (
    <div className={`relative w-full ${className}`} ref={dropdownRef}>
      <div className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            const val = e.target.value;
            setQuery(val);
            if (onChangeText) onChangeText(val);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
          className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-semibold text-xs placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white transition-all shadow-sm"
        />
        {isSearching ? (
          <Loader2 className="w-4 h-4 absolute right-3 text-blue-600 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-0.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      {/* Hospital Suggestions Dropdown (Medical/Ambulance Mode) */}
      {showHospitalSuggestions && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-rose-200 rounded-2xl shadow-2xl overflow-hidden divide-y divide-slate-100 font-sans">
          <div className="px-3 py-2 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
              <Siren className="w-3.5 h-3.5 text-rose-600 animate-pulse" />
              Nearby Emergency Hospitals
            </span>
            {userGpsCoords && (
              <span className="text-[9px] text-rose-600 font-semibold font-mono">
                GPS: {userGpsCoords.lat.toFixed(4)}°N, {userGpsCoords.lon.toFixed(4)}°E
              </span>
            )}
          </div>

          {userGpsCoords && nearbyHospitals.length > 0 ? (
            nearbyHospitals.map((hosp, idx) => (
              <button
                key={idx}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => handleSelectHospital(hosp)}
                className="w-full text-left p-3 hover:bg-rose-50/80 transition-colors flex items-start space-x-3 group"
              >
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 group-hover:bg-rose-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 text-xs truncate">
                      {hosp.name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 text-[10px] font-bold shrink-0">
                      {hosp.distance_km} km away
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {hosp.address}
                  </p>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {hosp.lat.toFixed(4)}°N, {hosp.lon.toFixed(4)}°E {hosp.emergencyPhone ? `• Emergency: ${hosp.emergencyPhone}` : ''}
                  </div>
                </div>
              </button>
            ))
          ) : isAcquiringGps ? (
            <div className="p-4 text-center text-xs text-rose-600 font-semibold flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Acquiring live GPS location...</span>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 font-medium">
              {gpsError || 'Enable location to see nearby hospitals'}
            </div>
          )}
        </div>
      )}

      {/* Normal Geocoding Suggestions Dropdown */}
      {(isOpen || isFocused) && suggestions.length > 0 && !showHospitalSuggestions && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto divide-y divide-slate-100 font-sans">
          {suggestions.map((item, idx) => (
            <button
              key={idx}
              id={`location-suggestion-${idx}`}
              data-testid="location-suggestion-item"
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
              }}
              onClick={() => handleSelect(item)}
              className="location-suggestion-btn w-full text-left p-3 hover:bg-blue-50/80 transition-colors flex items-start space-x-3 group"
            >
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-900 text-xs truncate">
                    {item.locality || item.address}
                  </span>
                  {item.state && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase shrink-0">
                      {item.state}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                  {item.display_name}
                </p>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {item.lat.toFixed(4)}°N, {item.lon.toFixed(4)}°E • {item.source}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};


