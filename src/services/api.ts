/**
 * API Service Client for JALDRISHTI MongoDB Atlas Backend.
 * Handles authenticated API calls for accounts, profile locations, and community feedback.
 */

const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return `http://${host}:8000/api/v1`;
    }
    return '/api/v1';
  }
  return 'http://127.0.0.1:8000/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

export const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('jaldrishti_auth_token');
};

export const setAuthToken = (token: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem('jaldrishti_auth_token', token);
    localStorage.setItem('jaldrishti_auth_session', 'true');
    localStorage.setItem('jaldrishti_onboarding_status', 'true');
  } else {
    localStorage.removeItem('jaldrishti_auth_token');
    localStorage.removeItem('jaldrishti_auth_session');
  }
};

const authHeaders = () => {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const api = {
  // Authentication
  register: async (email: string, pass: string, name?: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass, name }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Registration failed');
    }
    if (data.token) setAuthToken(data.token);
    return data;
  },

  login: async (email: string, pass: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || data.message || 'Invalid email or password.');
    }
    if (data.token) setAuthToken(data.token);
    return data;
  },

  logout: async () => {
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      });
    } catch (e) {
      // Best effort
    }
    setAuthToken(null);
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE_URL}/auth/me`, {
      method: 'GET',
      headers: authHeaders(),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user;
  },

  // Profile Preferences
  updateHome: async (home: any) => {
    const res = await fetch(`${API_BASE_URL}/profile/home`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(home),
    });
    return res.json();
  },

  updateWork: async (work: any) => {
    const res = await fetch(`${API_BASE_URL}/profile/work`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(work),
    });
    return res.json();
  },

  updateNotifications: async (settings: any) => {
    const res = await fetch(`${API_BASE_URL}/profile/notifications`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(settings),
    });
    return res.json();
  },

  // Community Feedback
  getAllFeedbacks: async () => {
    const res = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'GET',
      headers: authHeaders(),
    });
    if (!res.ok) return {};
    const data = await res.json();
    return data.communityFeedbacks || {};
  },

  createFeedback: async (spotId: string, text: string, photoUrl?: string | null) => {
    const res = await fetch(`${API_BASE_URL}/feedback`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ spotId, text, photoUrl }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to save feedback right now.');
    }
    return res.json();
  },

  deleteFeedback: async (feedbackId: string) => {
    const res = await fetch(`${API_BASE_URL}/feedback/${feedbackId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to delete feedback right now.');
    }
    return res.json();
  },

  addReply: async (feedbackId: string, text: string) => {
    const res = await fetch(`${API_BASE_URL}/feedback/${feedbackId}/replies`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to post reply right now.');
    }
    return res.json();
  },

  deleteReply: async (feedbackId: string, replyId: string) => {
    const res = await fetch(`${API_BASE_URL}/feedback/${feedbackId}/replies/${replyId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to delete reply right now.');
    }
    return res.json();
  },

  toggleFeedbackReaction: async (feedbackId: string, reactionType: 'LIKE' | 'DISLIKE') => {
    const res = await fetch(`${API_BASE_URL}/feedback/${feedbackId}/reaction`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reactionType }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to toggle reaction right now.');
    }
    return res.json();
  },

  toggleReplyReaction: async (feedbackId: string, replyId: string, reactionType: 'LIKE' | 'DISLIKE') => {
    const res = await fetch(`${API_BASE_URL}/feedback/${feedbackId}/replies/${replyId}/reaction`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ reactionType }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Unable to toggle reply reaction right now.');
    }
    return res.json();
  },

  // GIS Digital Twin & Navigation APIs
  getWaterloggingPrediction: async (lat: number, lon: number, name?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/prediction/waterlogging?lat=${lat}&lon=${lon}&name=${encodeURIComponent(name || '')}&location_name=${encodeURIComponent(name || '')}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getFloodNowcast: async (lat: number, lon: number, name?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/flood/nowcast?lat=${lat}&lon=${lon}&location_name=${encodeURIComponent(name || '')}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getRadarRainfall: async (lat: number, lon: number, name?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/radar/rainfall?lat=${lat}&lon=${lon}&location_name=${encodeURIComponent(name || '')}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  get2DSurfaceFlow: async (lat: number, lon: number, name?: string, horizonOffsetHours: number = 0) => {
    try {
      const res = await fetch(`${API_BASE_URL}/flood/surface-flow?lat=${lat}&lon=${lon}&location_name=${encodeURIComponent(name || '')}&horizon_offset_hours=${horizonOffsetHours}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getDrainageHydraulics: async (lat: number, lon: number, name?: string, horizonOffsetHours: number = 1, simulationBlockagePct?: number) => {
    try {
      let url = `${API_BASE_URL}/flood/drainage-hydraulics?lat=${lat}&lon=${lon}&location_name=${encodeURIComponent(name || '')}&horizon_offset_hours=${horizonOffsetHours}`;
      if (simulationBlockagePct !== undefined) {
        url += `&simulation_blockage_pct=${simulationBlockagePct}`;
      }
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getGisDashboard: async (lat: number, lon: number, name?: string, horizonOffsetHours: number = 0, simulationBlockagePct?: number) => {
    try {
      let url = `${API_BASE_URL}/flood/gis-dashboard?lat=${lat}&lon=${lon}&location_name=${encodeURIComponent(name || '')}&horizon_offset_hours=${horizonOffsetHours}`;
      if (simulationBlockagePct !== undefined) {
        url += `&simulation_blockage_pct=${simulationBlockagePct}`;
      }
      const res = await fetch(url);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },



  getHomeStatus: async (lat: number, lon: number, locality?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/home/status?lat=${lat}&lon=${lon}&locality=${encodeURIComponent(locality || '')}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  searchGeocoding: async (q: string, signal?: AbortSignal) => {
    try {
      const res = await fetch(`${API_BASE_URL}/home/geocode/search?q=${encodeURIComponent(q)}`, { signal });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e: any) {
      if (e.name === 'AbortError') {
        return null;
      }
      console.warn('[searchGeocoding] Fetch error:', e);
    }
    return [];
  },

  getHotspots: async (timestep?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/navigation/hotspots?timestep=${timestep || 0}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  getWeatherStations: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/home/weather`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  getMunicipalAlerts: async (timestep?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/navigation/alerts?timestep=${timestep || 0}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  getCriticalInfrastructure: async (timestep?: any, mode?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/navigation/infrastructure?timestep=${timestep || 0}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  getCityDecisionSupport: async (timestep?: any, mode?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/agent/decision-support?timestep=${timestep || 0}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getDataHealthFeeds: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/health`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getCatchmentSummary: async (timestep?: any, mode?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/navigation/catchment-summary?timestep=${timestep || 0}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getHistoricalReplayEvents: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/navigation/replay-events`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return [];
  },

  getModelHealthTelemetry: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/telemetry`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getPredictionProvenance: async (predId?: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/prediction/provenance/${predId || ''}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  evaluateRoutesDetailed: async (
    origin: any,
    destination: any,
    vehicleType?: string,
    originLat?: number | string,
    originLon?: number | string,
    destLat?: number | string,
    destLon?: number | string,
    signal?: AbortSignal
  ) => {
    try {
      const nOLat = originLat !== undefined ? Number(originLat) : undefined;
      const nOLon = originLon !== undefined ? Number(originLon) : undefined;
      const nDLat = destLat !== undefined ? Number(destLat) : undefined;
      const nDLon = destLon !== undefined ? Number(destLon) : undefined;

      if (
        nOLat !== undefined && !isNaN(nOLat) &&
        nOLon !== undefined && !isNaN(nOLon) &&
        nDLat !== undefined && !isNaN(nDLat) &&
        nDLon !== undefined && !isNaN(nDLon)
      ) {
        const payload = {
          from: { name: String(origin || 'Origin'), latitude: nOLat, longitude: nOLon },
          to: { name: String(destination || 'Destination'), latitude: nDLat, longitude: nDLon },
          profile: String(vehicleType || 'CAR').toLowerCase(),
        };
        const res = await fetch(`${API_BASE_URL}/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal,
        });
        if (res.ok) return await res.json();
      }

      const params = new URLSearchParams({
        origin: String(origin || 'Origin'),
        destination: String(destination || 'Destination'),
        vehicle_type: String(vehicleType || 'CAR'),
        ...(nOLat !== undefined ? { origin_lat: String(nOLat) } : {}),
        ...(nOLon !== undefined ? { origin_lon: String(nOLon) } : {}),
        ...(nDLat !== undefined ? { dest_lat: String(nDLat) } : {}),
        ...(nDLon !== undefined ? { dest_lon: String(nDLon) } : {}),
      });

      const res2 = await fetch(`${API_BASE_URL}/navigation/routes/evaluate-detailed?${params.toString()}`, { signal });
      if (res2.ok) return await res2.json();
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        console.warn('evaluateRoutesDetailed failed:', e);
      }
    }
    return null;
  },

  calculateSafeRoute: async (req: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getValidationLabData: async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/system/validation-lab`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },

  getLocationExplanation: async (selectedLocationId?: string, mode?: any) => {
    try {
      const res = await fetch(`${API_BASE_URL}/explainability/location/${selectedLocationId || 'road_102'}`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  },
};

export const JaldrishtiApi = api;
export default api;
