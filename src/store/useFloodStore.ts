/**
 * Zustand Global State Store for JALDRISHTI Flood Command & Navigation Platform
 */

import { create } from 'zustand';
import { api } from '../services/api';
import {
  OperationMode,
  VehicleType,
  MapLayerVisibility,
  SafeRouteResponse,
  FloodHotspot,
  ViewExperience,
  MapFocusPreset,
  AppNavTab,
  ConsumerSearchMode,
  SavedLocation,
  UsualRoute,
  ConsumerAlert,
  HospitalAccessNode,
  FireStationNode,
  LocationSearchResult,
  CommunityFeedback,
  CommunityFeedbackReply,
} from '../types';

export const FORECAST_TIMESTEPS = [0, 15, 30, 45, 60, 90, 120, 180] as const;
export type ForecastTimestep = (typeof FORECAST_TIMESTEPS)[number];

interface FloodStoreState {
  // Real Session & Authentication
  isAuthenticated: boolean;
  userEmail: string;
  hasCompletedOnboarding: boolean;
  login: (email: string, pass: string, name?: string) => boolean;
  logout: () => void;
  completeOnboarding: () => void;

  // Navigation & Consumer Platform Experience
  activeNavTab: AppNavTab;
  consumerSearchMode: ConsumerSearchMode;
  consumerTheme: 'LIGHT' | 'DARK';

  // Saved User Data
  savedHome: SavedLocation;
  savedWork: SavedLocation;
  notificationSettings: {
    currentWaterlogging: boolean;
    predictedFloodRisk: boolean;
    heavyRainfallWarning: boolean;
    routeFloodRisk: boolean;
  };
  setSavedWork: (work: SavedLocation) => void;
  setNotificationSettings: (settings: Partial<{
    currentWaterlogging: boolean;
    predictedFloodRisk: boolean;
    heavyRainfallWarning: boolean;
    routeFloodRisk: boolean;
  }>) => void;
  savedLocations: SavedLocation[];
  usualRoutes: UsualRoute[];
  consumerAlerts: ConsumerAlert[];

  // Search & Navigation Parameters
  selectedFromLocation: LocationSearchResult | null;
  selectedToLocation: LocationSearchResult | null;
  searchQueryFrom: string;
  searchQueryTo: string;
  selectedHospitalNode: HospitalAccessNode | null;
  selectedFireNode: FireStationNode | null;

  // View Experience Modes: CONSUMER (Default Light App), COMMAND_CENTER (Pro GIS), FOCUS_MODE (Quick Ops HUD)
  viewExperience: ViewExperience;

  // SIH Interactive Demo Mode
  sihDemoActive: boolean;
  sihDemoStep: number;

  // Horizon & Simulation
  currentTimestep: ForecastTimestep;
  isPlaying: boolean;
  playbackSpeed: number; // 1x, 2x, 5x
  operationMode: OperationMode;

  // 0–3h Urban Flood Nowcast Layer
  nowcastSelectedOffset: number; // 0, 1, 2, 3
  nowcastData: any | null;
  setNowcastOffset: (offset: number) => void;
  setNowcastData: (data: any) => void;

  // Selected Location for Deep Explainability Panel
  selectedLocationId: string | null;
  selectedHotspot: FloodHotspot | null;
  explainabilityPanelOpen: boolean;
  locationDetailsExpanded: boolean;

  // GIS Map Layers & Preset Focus
  layers: MapLayerVisibility;
  mapFocusPreset: MapFocusPreset;

  // Live GPS Navigation State
  isLiveNavActive: boolean;
  userGpsCoords: [number, number] | null;
  userSpeedKmh: number;
  remainingDistanceKm: number;
  remainingDurationMin: number;
  isOffRoute: boolean;
  floodWarningAhead: string | null;
  startLiveNav: () => void;
  stopLiveNav: () => void;
  updateLiveGpsState: (coords: [number, number], speedKmh: number, remainingKm: number, remainingMin: number, offRoute: boolean, warning: string | null) => void;

  // Emergency Mobility & Routing
  routingModalOpen: boolean;
  selectedVehicleType: VehicleType;
  originCoords: [number, number]; // [lat, lon]
  activeRouteResponse: SafeRouteResponse | null;
  setActiveRouteResponse: (res: SafeRouteResponse | null) => void;
  routeEvaluationData: any | null;
  setRouteEvaluationData: (data: any | null) => void;
  selectedRouteIndex: number;
  setSelectedRouteIndex: (idx: number) => void;
  isCalculatingRoute: boolean;

  // UI Panels
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  activeRightTab: 'decisions' | 'intelligence' | 'infrastructure' | 'hotspots' | 'alerts';
  selectedInfraId: string | null;
  telemetryExpanded: boolean;

  // Citizen Feedback Modal
  citizenReportModalOpen: boolean;

  // SIH Flagship Demonstration Modals & Panels
  historicalReplayOpen: boolean;
  validationLabOpen: boolean;
  dataHealthOpen: boolean;
  modelHealthOpen: boolean;
  predictionProvenanceOpen: boolean;
  selectedPredictionId: string | null;

  // Actions
  setNavTab: (tab: AppNavTab) => void;
  setConsumerSearchMode: (mode: ConsumerSearchMode) => void;
  setConsumerTheme: (theme: 'LIGHT' | 'DARK') => void;
  setSavedHome: (home: SavedLocation) => void;
  setSearchQueryFrom: (from: string) => void;
  setSearchQueryTo: (to: string) => void;
  setSelectedFromLocation: (loc: LocationSearchResult | null) => void;
  setSelectedToLocation: (loc: LocationSearchResult | null) => void;
  resetSearchState: () => void;
  setSelectedHospitalNode: (hospital: HospitalAccessNode | null) => void;
  setSelectedFireNode: (station: FireStationNode | null) => void;
  startNavigationTo: (from?: string, to?: string, vehicle?: VehicleType) => void;

  setViewExperience: (exp: ViewExperience) => void;
  startSIHDemo: () => void;
  exitSIHDemo: () => void;
  nextSIHDemoStep: () => void;
  prevSIHDemoStep: () => void;
  setSIHDemoStep: (step: number) => void;

  setTimestep: (step: ForecastTimestep) => void;
  nextTimestep: () => void;
  prevTimestep: () => void;
  togglePlay: () => void;
  setPlaybackSpeed: (speed: number) => void;
  setOperationMode: (mode: OperationMode) => void;

  setSelectedLocationId: (id: string | null) => void;
  setSelectedHotspot: (hotspot: FloodHotspot | null) => void;
  setSelectedInfraId: (id: string | null) => void;
  setExplainabilityPanelOpen: (open: boolean) => void;
  setLocationDetailsExpanded: (expanded: boolean) => void;
  setTelemetryExpanded: (expanded: boolean) => void;

  toggleLayer: (layerKey: keyof MapLayerVisibility) => void;
  setAllLayers: (layers: Partial<MapLayerVisibility>) => void;
  setMapFocusPreset: (preset: MapFocusPreset) => void;

  setRoutingModalOpen: (open: boolean) => void;
  setSelectedVehicleType: (vehicle: VehicleType) => void;
  setOriginCoords: (coords: [number, number]) => void;
  setDestinationCoords: (coords: [number, number]) => void;
  setActiveRouteResponse: (route: SafeRouteResponse | null) => void;
  routeEvaluationData: any | null;
  setRouteEvaluationData: (data: any | null) => void;
  setIsCalculatingRoute: (loading: boolean) => void;

  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setActiveRightTab: (tab: 'decisions' | 'intelligence' | 'infrastructure' | 'hotspots' | 'alerts') => void;

  setCitizenReportModalOpen: (open: boolean) => void;

  // SIH demonstration actions
  setHistoricalReplayOpen: (open: boolean) => void;
  setValidationLabOpen: (open: boolean) => void;
  setDataHealthOpen: (open: boolean) => void;
  setModelHealthOpen: (open: boolean) => void;
  setPredictionProvenanceOpen: (open: boolean) => void;
  setSelectedPredictionId: (id: string | null) => void;

  // Persistent Community Feedback for Active Waterlogging Spots
  communityFeedbacks: Record<string, CommunityFeedback[]>;
  addCommunityFeedback: (spotId: string, text: string, photoUrl?: string | null) => void;
  deleteCommunityFeedback: (spotId: string, feedbackId: string) => void;
  toggleLikeCommunityFeedback: (spotId: string, feedbackId: string) => void;
  toggleDislikeCommunityFeedback: (spotId: string, feedbackId: string) => void;
  addCommunityFeedbackReply: (spotId: string, feedbackId: string, text: string) => void;
  deleteCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => void;
  toggleLikeCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => void;
  toggleDislikeCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => void;
}

interface UserAccountData {
  email: string;
  password: string;
  name?: string;
  savedHome?: SavedLocation;
  savedWork?: SavedLocation;
  notificationSettings?: {
    currentWaterlogging: boolean;
    predictedFloodRisk: boolean;
    heavyRainfallWarning: boolean;
    routeFloodRisk: boolean;
  };
}

const getStoredAccounts = (): Record<string, UserAccountData> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem('jaldrishti_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  return {};
};

const saveStoredAccounts = (accounts: Record<string, UserAccountData>) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('jaldrishti_accounts', JSON.stringify(accounts));
  } catch (e) {}
};

const getInitialUserEmail = (): string => {
  if (typeof window === 'undefined') return 'sourav@example.com';
  return localStorage.getItem('jaldrishti_user_email') || 'sourav@example.com';
};

const getInitialActiveAccount = (): UserAccountData | null => {
  if (typeof window === 'undefined') return null;
  const email = getInitialUserEmail().trim().toLowerCase();
  let accounts = getStoredAccounts();

  if (!accounts[email]) {
    let defaultHome: SavedLocation | undefined;
    let defaultWork: SavedLocation | undefined;
    let defaultNotifs: any;

    try {
      const rawHome = localStorage.getItem('jaldrishti_saved_home');
      if (rawHome) defaultHome = JSON.parse(rawHome);
    } catch (e) {}

    try {
      const rawWork = localStorage.getItem('jaldrishti_saved_work');
      if (rawWork) defaultWork = JSON.parse(rawWork);
    } catch (e) {}

    try {
      const rawNotifs = localStorage.getItem('jaldrishti_notification_settings');
      if (rawNotifs) defaultNotifs = JSON.parse(rawNotifs);
    } catch (e) {}

    accounts[email] = {
      email,
      password: 'password123',
      name: 'Sourav Kumar',
      savedHome: defaultHome || {
        id: 'LOC-HOME-DEFAULT',
        name: 'Home',
        address: 'Ballygunge, Kolkata, West Bengal, India',
        locality: 'Ballygunge',
        coordinates: [22.5280, 88.3650],
        type: 'HOME',
        isSet: true,
      },
      savedWork: defaultWork || {
        id: 'LOC-WORK-DEFAULT',
        name: 'Work Office',
        address: 'Sector V, Salt Lake Electronics Complex, Kolkata, West Bengal, India',
        locality: 'Salt Lake Sector V',
        coordinates: [22.5726, 88.4331],
        type: 'WORK',
        isSet: true,
      },
      notificationSettings: defaultNotifs || {
        currentWaterlogging: true,
        predictedFloodRisk: true,
        heavyRainfallWarning: true,
        routeFloodRisk: true,
      },
    };
    saveStoredAccounts(accounts);
  }

  return accounts[email] || null;
};

export const useFloodStore = create<FloodStoreState>((set, get) => ({
  // Real Session & Authentication Initial State
  isAuthenticated: typeof window !== 'undefined' ? (localStorage.getItem('jaldrishti_auth_session') === 'true' || !!localStorage.getItem('jaldrishti_auth_token')) : false,
  userEmail: getInitialUserEmail(),
  hasCompletedOnboarding: typeof window !== 'undefined' ? (localStorage.getItem('jaldrishti_onboarding_status') === 'true' || !!localStorage.getItem('jaldrishti_auth_token')) : false,

  login: (email: string, pass: string, name?: string) => {
    if (!email || !email.includes('@')) return false;
    if (!pass || pass.length < 8) return false;

    const normalizedKey = email.trim().toLowerCase();
    const accounts = getStoredAccounts();

    if (accounts[normalizedKey]) {
      // Existing account - check password match
      if (accounts[normalizedKey].password !== pass) {
        return false; // Wrong password - fail authentication
      }

      // Password matched
      try {
        localStorage.setItem('jaldrishti_auth_session', 'true');
        localStorage.setItem('jaldrishti_user_email', normalizedKey);
        localStorage.setItem('jaldrishti_onboarding_status', 'true');
      } catch (e) {}

      const userHome = accounts[normalizedKey].savedHome || {
        id: 'LOC-HOME-DEFAULT',
        name: 'Home',
        address: 'Ballygunge, Kolkata, West Bengal, India',
        locality: 'Ballygunge',
        coordinates: [22.5280, 88.3650],
        type: 'HOME',
        isSet: true,
      };
      const userWork = accounts[normalizedKey].savedWork || {
        id: 'LOC-WORK-DEFAULT',
        name: 'Work Office',
        address: 'Sector V, Salt Lake Electronics Complex, Kolkata, West Bengal, India',
        locality: 'Salt Lake Sector V',
        coordinates: [22.5726, 88.4331],
        type: 'WORK',
        isSet: true,
      };
      const userNotifs = accounts[normalizedKey].notificationSettings || {
        currentWaterlogging: true,
        predictedFloodRisk: true,
        heavyRainfallWarning: true,
        routeFloodRisk: true,
      };

      set({
        isAuthenticated: true,
        userEmail: normalizedKey,
        savedHome: userHome,
        savedWork: userWork,
        notificationSettings: userNotifs,
        hasCompletedOnboarding: true,
      });

      // Async backend MongoDB Atlas sync
      api.login(email, pass).then((res) => {
        if (res?.user) {
          if (res.user.savedHome) set({ savedHome: res.user.savedHome });
          if (res.user.savedWork) set({ savedWork: res.user.savedWork });
          if (res.user.notificationPreferences) set({ notificationSettings: res.user.notificationPreferences });
        }
        api.getAllFeedbacks().then((fbs) => {
          if (fbs && Object.keys(fbs).length > 0) set({ communityFeedbacks: fbs });
        }).catch(() => {});
      }).catch(() => {
        api.register(email, pass, name).then((res) => {
          api.getAllFeedbacks().then((fbs) => {
            if (fbs && Object.keys(fbs).length > 0) set({ communityFeedbacks: fbs });
          }).catch(() => {});
        }).catch(() => {});
      });

      return true;
    } else {
      // New account creation
      const newHome: SavedLocation = {
        id: `LOC-HOME-${Date.now()}`,
        name: 'Home',
        address: 'Ballygunge, Kolkata, West Bengal, India',
        locality: 'Ballygunge',
        coordinates: [22.5280, 88.3650],
        type: 'HOME',
        isSet: true,
      };
      const newWork: SavedLocation = {
        id: `LOC-WORK-${Date.now()}`,
        name: 'Work Office',
        address: 'Sector V, Salt Lake Electronics Complex, Kolkata, West Bengal, India',
        locality: 'Salt Lake Sector V',
        coordinates: [22.5726, 88.4331],
        type: 'WORK',
        isSet: true,
      };
      const newNotifs = {
        currentWaterlogging: true,
        predictedFloodRisk: true,
        heavyRainfallWarning: true,
        routeFloodRisk: true,
      };

      const newAccount: UserAccountData = {
        email: normalizedKey,
        password: pass,
        name: name || normalizedKey.split('@')[0],
        savedHome: newHome,
        savedWork: newWork,
        notificationSettings: newNotifs,
      };

      accounts[normalizedKey] = newAccount;
      saveStoredAccounts(accounts);

      try {
        localStorage.setItem('jaldrishti_auth_session', 'true');
        localStorage.setItem('jaldrishti_user_email', normalizedKey);
        localStorage.setItem('jaldrishti_onboarding_status', 'true');
        localStorage.setItem('jaldrishti_saved_home', JSON.stringify(newHome));
        localStorage.setItem('jaldrishti_saved_work', JSON.stringify(newWork));
        localStorage.setItem('jaldrishti_notification_settings', JSON.stringify(newNotifs));
      } catch (e) {}

      set({
        isAuthenticated: true,
        userEmail: normalizedKey,
        savedHome: newHome,
        savedWork: newWork,
        notificationSettings: newNotifs,
        hasCompletedOnboarding: true,
      });

      // Async MongoDB registration
      api.register(email, pass, name).then(() => {
        api.getAllFeedbacks().then((fbs) => {
          if (fbs && Object.keys(fbs).length > 0) set({ communityFeedbacks: fbs });
        }).catch(() => {});
      }).catch(() => {});

      return true;
    }
  },

  logout: () => {
    try {
      localStorage.removeItem('jaldrishti_auth_session');
    } catch (e) {}
    api.logout().catch(() => {});
    set({ isAuthenticated: false, activeNavTab: 'HOME' });
  },

  completeOnboarding: () => {
    try {
      localStorage.setItem('jaldrishti_onboarding_status', 'true');
    } catch (e) {
      // Storage fallback
    }
    set({ hasCompletedOnboarding: true, activeNavTab: 'HOME' });
  },

  // Navigation & Consumer Defaults
  activeNavTab: 'HOME',
  consumerSearchMode: 'NORMAL',
  consumerTheme: 'LIGHT',

  savedHome: (() => {
    const activeAccount = getInitialActiveAccount();
    if (activeAccount?.savedHome) return activeAccount.savedHome;
    return {
      id: 'LOC-HOME-DEFAULT',
      name: 'Home',
      address: 'Ballygunge, Kolkata, West Bengal, India',
      locality: 'Ballygunge',
      coordinates: [22.5280, 88.3650],
      type: 'HOME',
      isSet: true,
    };
  })(),
  savedWork: (() => {
    const activeAccount = getInitialActiveAccount();
    if (activeAccount?.savedWork) return activeAccount.savedWork;
    return {
      id: 'LOC-WORK-DEFAULT',
      name: 'Work Office',
      address: 'Sector V, Salt Lake Electronics Complex, Kolkata, West Bengal, India',
      locality: 'Salt Lake Sector V',
      coordinates: [22.5726, 88.4331],
      type: 'WORK',
      isSet: true,
    };
  })(),
  notificationSettings: (() => {
    const activeAccount = getInitialActiveAccount();
    if (activeAccount?.notificationSettings) return activeAccount.notificationSettings;
    return {
      currentWaterlogging: true,
      predictedFloodRisk: true,
      heavyRainfallWarning: true,
      routeFloodRisk: true,
    };
  })(),
  savedLocations: [
    {
      id: 'LOC-HOME-01',
      name: 'Home',
      address: 'Jessore Road, Champadali More, Barasat',
      locality: 'Barasat Ward 4',
      coordinates: [22.7214, 88.4821],
      type: 'HOME',
    },
    {
      id: 'LOC-WORK-01',
      name: 'Work Office',
      address: 'Sector V, Salt Lake Electronics Complex, Kolkata',
      locality: 'Salt Lake Sector V',
      coordinates: [22.5726, 88.4331],
      type: 'WORK',
    },
    {
      id: 'LOC-FAV-01',
      name: 'Barasat Medical College',
      address: 'Kachhari Road, Barasat',
      locality: 'Ward 1',
      coordinates: [22.7265, 88.4785],
      type: 'FAVORITE',
    },
  ],

  usualRoutes: [
    {
      id: 'ROUTE-UW-01',
      name: 'Home → Work Office',
      originName: 'Barasat (Home)',
      destinationName: 'Salt Lake Sector V',
      riskLevel: 'HIGH',
      travelTimeMin: 42,
      extraTimeMin: 14,
      maxWaterDepthCm: 34,
      affectedRoadsCount: 3,
      recommendedAlternative: 'NH-12 Elevated Bypass Corridor (+7 min, Max 8cm depth)',
    },
    {
      id: 'ROUTE-UW-02',
      name: 'Home → Howrah Railway Station',
      originName: 'Barasat (Home)',
      destinationName: 'Howrah Station',
      riskLevel: 'CAUTION',
      travelTimeMin: 50,
      extraTimeMin: 6,
      maxWaterDepthCm: 18,
      affectedRoadsCount: 1,
      recommendedAlternative: 'Kalyani Expressway Link (+4 min, Max 5cm depth)',
    },
  ],

  consumerAlerts: [
    {
      id: 'ALT-C01',
      title: 'HEAVY RAINFALL FLOOD EARLY WARNING',
      severity: 'CRITICAL',
      locationName: 'Barasat Ward 4 & Champadali More',
      forecastRainfallMm: '80–100 mm',
      possibleDepthCm: '20–35 cm',
      expectedWindow: '4:00 PM – 7:00 PM IST Today',
      recommendedAction: 'Jessore Road has a high probability of waterlogging. Consider leaving early or taking NH-12 Bypass.',
      dateGroup: 'TODAY',
      timestamp: 'Today, 2:15 PM',
      confidence: 'HIGH (Historical Pattern + DWR Radar)',
      affectedRoads: ['Jessore Road', 'Champadali Bus Stand Approach', 'Station Road Link'],
    },
    {
      id: 'ALT-C02',
      title: 'DRAINAGE SURCHARGE ADVISORY',
      severity: 'WARNING',
      locationName: 'Kachhari Road & Hospital Gate',
      forecastRainfallMm: '45–60 mm',
      possibleDepthCm: '12–18 cm',
      expectedWindow: '5:30 PM – 8:00 PM IST Today',
      recommendedAction: 'Approach hospital via Kazipara Link Gate 2 to avoid lower basin accumulation.',
      dateGroup: 'TODAY',
      timestamp: 'Today, 1:45 PM',
      confidence: 'HIGH',
      affectedRoads: ['Kachhari Road', 'Hospital Gate 1 Entrance'],
    },
    {
      id: 'ALT-C03',
      title: 'MONSOON CONVECTIVE CELL PROJECTION',
      severity: 'ADVISORY',
      locationName: 'Barasat Municipality (All Wards)',
      forecastRainfallMm: '110 mm total 24h',
      possibleDepthCm: '15–40 cm localized',
      expectedWindow: 'Tomorrow Morning 6:00 AM',
      recommendedAction: 'Monitor real-time nowcasts before morning commute.',
      dateGroup: 'UPCOMING',
      timestamp: 'Tomorrow Forecast',
      confidence: 'MEDIUM',
      affectedRoads: ['Jessore Road', 'Kalyani Expressway Ramp', 'Pioneer College Road'],
    },
  ],

  selectedFromLocation: null,
  selectedToLocation: null,
  searchQueryFrom: '',
  searchQueryTo: '',
  selectedHospitalNode: null,
  selectedFireNode: null,

  // Persistent Community Feedback state
  communityFeedbacks: typeof window !== 'undefined' && localStorage.getItem('jaldrishti_community_feedbacks')
    ? (() => {
        try {
          const parsed = JSON.parse(localStorage.getItem('jaldrishti_community_feedbacks')!);
          return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (e) {
          return {};
        }
      })()
    : {},

  // Default values
  viewExperience: 'COMMAND_CENTER',
  sihDemoActive: false,
  sihDemoStep: 1,

  currentTimestep: 30,
  isPlaying: false,
  playbackSpeed: 1,
  operationMode: 'SIMULATION',

  nowcastSelectedOffset: 0,
  nowcastData: null,

  selectedLocationId: 'road_102',
  selectedHotspot: null,
  selectedInfraId: 'INFRA-HOSP-01',
  explainabilityPanelOpen: true,
  locationDetailsExpanded: false,
  telemetryExpanded: false,

  layers: {
    roads: true,
    floodDepth: true,
    floodExtent: true,
    rainfall: true,
    drainageNetwork: true,
    drainageStress: true,
    criticalInfra: true,
    safeRoutes: true,
  },
  mapFocusPreset: 'ALL',

  isLiveNavActive: false,
  userGpsCoords: null,
  userSpeedKmh: 0,
  remainingDistanceKm: 0,
  remainingDurationMin: 0,
  isOffRoute: false,
  floodWarningAhead: null,
  startLiveNav: () => set({ isLiveNavActive: true }),
  stopLiveNav: () => set({ isLiveNavActive: false, userGpsCoords: null, isOffRoute: false, floodWarningAhead: null }),
  updateLiveGpsState: (coords, speedKmh, remainingKm, remainingMin, offRoute, warning) => set({
    userGpsCoords: coords,
    userSpeedKmh: speedKmh,
    remainingDistanceKm: remainingKm,
    remainingDurationMin: remainingMin,
    isOffRoute: offRoute,
    floodWarningAhead: warning,
  }),

  routingModalOpen: false,
  selectedVehicleType: 'CAR',
  originCoords: [22.7195, 88.4815],
  destinationCoords: [22.7265, 88.4785],
  activeRouteResponse: null,
  routeEvaluationData: null,
  setRouteEvaluationData: (data: any | null) => set({ routeEvaluationData: data }),
  selectedRouteIndex: 0,
  setSelectedRouteIndex: (idx: number) => set({ selectedRouteIndex: idx }),
  isCalculatingRoute: false,

  leftPanelOpen: true,
  rightPanelOpen: true,
  activeRightTab: 'decisions',

  citizenReportModalOpen: false,

  historicalReplayOpen: false,
  validationLabOpen: false,
  dataHealthOpen: false,
  modelHealthOpen: false,
  predictionProvenanceOpen: false,
  selectedPredictionId: 'PRED-20260901-0945-T30-SWMM-GNN',

  // Consumer Platform Actions
  setNavTab: (tab: AppNavTab) => set({ activeNavTab: tab }),
  setConsumerSearchMode: (mode: ConsumerSearchMode) => set({ consumerSearchMode: mode }),
  setConsumerTheme: (theme: 'LIGHT' | 'DARK') => set({ consumerTheme: theme }),
  setSavedHome: (home: SavedLocation) => {
    const currentEmail = get().userEmail?.trim().toLowerCase();
    try {
      localStorage.setItem('jaldrishti_saved_home', JSON.stringify(home));
      if (currentEmail) {
        const accounts = getStoredAccounts();
        if (accounts[currentEmail]) {
          accounts[currentEmail].savedHome = home;
          saveStoredAccounts(accounts);
        }
      }
    } catch (e) {}
    api.updateHome(home).catch(() => {});
    set({ savedHome: home });
  },
  setSavedWork: (work: SavedLocation) => {
    const currentEmail = get().userEmail?.trim().toLowerCase();
    try {
      localStorage.setItem('jaldrishti_saved_work', JSON.stringify(work));
      if (currentEmail) {
        const accounts = getStoredAccounts();
        if (accounts[currentEmail]) {
          accounts[currentEmail].savedWork = work;
          saveStoredAccounts(accounts);
        }
      }
    } catch (e) {}
    api.updateWork(work).catch(() => {});
    set({ savedWork: work });
  },
  setNotificationSettings: (settings: Partial<{ currentWaterlogging: boolean; predictedFloodRisk: boolean; heavyRainfallWarning: boolean; routeFloodRisk: boolean }>) => {
    const updated = { ...get().notificationSettings, ...settings };
    const currentEmail = get().userEmail?.trim().toLowerCase();
    try {
      localStorage.setItem('jaldrishti_notification_settings', JSON.stringify(updated));
      if (currentEmail) {
        const accounts = getStoredAccounts();
        if (accounts[currentEmail]) {
          accounts[currentEmail].notificationSettings = updated;
          saveStoredAccounts(accounts);
        }
      }
    } catch (e) {}
    api.updateNotifications(updated).catch(() => {});
    set({ notificationSettings: updated });
  },
  setSelectedFromLocation: (loc: LocationSearchResult | null) => {
    set({
      selectedFromLocation: loc,
      searchQueryFrom: loc ? (loc.locality || loc.display_name) : '',
      activeRouteResponse: null,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
    });
  },
  setSelectedToLocation: (loc: LocationSearchResult | null) => {
    set({
      selectedToLocation: loc,
      searchQueryTo: loc ? (loc.locality || loc.display_name) : '',
      activeRouteResponse: null,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
    });
  },
  setSearchQueryFrom: (from: string) => {
    const curLoc = get().selectedFromLocation;
    const isSameText = curLoc && (curLoc.locality === from || curLoc.display_name === from);
    set({
      searchQueryFrom: from,
      selectedFromLocation: isSameText ? curLoc : null,
      activeRouteResponse: null,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
    });
  },
  setSearchQueryTo: (to: string) => {
    const curLoc = get().selectedToLocation;
    const isSameText = curLoc && (curLoc.locality === to || curLoc.display_name === to);
    set({
      searchQueryTo: to,
      selectedToLocation: isSameText ? curLoc : null,
      activeRouteResponse: null,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
    });
  },
  resetSearchState: () => {
    set({
      selectedFromLocation: null,
      selectedToLocation: null,
      searchQueryFrom: '',
      searchQueryTo: '',
      activeRouteResponse: null,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
    });
  },
  setSelectedHospitalNode: (hospital: HospitalAccessNode | null) => set({ selectedHospitalNode: hospital }),
  setSelectedFireNode: (station: FireStationNode | null) => set({ selectedFireNode: station }),

  startNavigationTo: (from?: string, to?: string, vehicle: VehicleType = 'CAR') => {
    const state = get();
    const homeLoc = state.savedHome;
    const workLoc = state.savedWork;

    const fromLoc = from || homeLoc?.locality || homeLoc?.address || 'Bishnupur, Bankura';
    const toLoc = to || workLoc?.locality || (state.usualRoutes && state.usualRoutes.length > 0 ? state.usualRoutes[0].destinationName : 'Howrah Station');

    // Carry over exact saved coordinates when the caller didn't override the from/to text
    // (i.e. this really is "navigate between my saved home/work"), so the route uses the
    // user's precise saved location instead of re-geocoding the locality name later and
    // possibly landing on a different nearby point with the same name.
    const fromLocation: LocationSearchResult | null =
      (!from && homeLoc?.coordinates && (homeLoc.coordinates[0] !== 0 || homeLoc.coordinates[1] !== 0))
        ? {
            display_name: homeLoc.address || homeLoc.locality,
            locality: homeLoc.locality,
            address: homeLoc.address,
            lat: homeLoc.coordinates[0],
            lon: homeLoc.coordinates[1],
            source: 'saved_home',
          }
        : null;
    const toLocation: LocationSearchResult | null =
      (!to && workLoc?.coordinates && (workLoc.coordinates[0] !== 0 || workLoc.coordinates[1] !== 0))
        ? {
            display_name: workLoc.address || workLoc.locality,
            locality: workLoc.locality,
            address: workLoc.address,
            lat: workLoc.coordinates[0],
            lon: workLoc.coordinates[1],
            source: 'saved_work',
          }
        : null;

    set({
      activeNavTab: 'SEARCH',
      searchQueryFrom: fromLoc,
      searchQueryTo: toLoc,
      selectedFromLocation: fromLocation,
      selectedToLocation: toLocation,
      selectedVehicleType: vehicle,
      selectedRouteIndex: 0,
      isLiveNavActive: false,
      userGpsCoords: null,
      userSpeedKmh: 0,
      remainingDistanceKm: 0,
      remainingDurationMin: 0,
      isOffRoute: false,
      floodWarningAhead: null,
      routingModalOpen: false,
    });
  },

  // Pro Command Experience Reducers
  setViewExperience: (exp: ViewExperience) => set({ viewExperience: exp }),

  startSIHDemo: () => {
    set({
      sihDemoActive: true,
      sihDemoStep: 1,
      viewExperience: 'COMMAND_CENTER',
      currentTimestep: 0,
      leftPanelOpen: true,
      rightPanelOpen: false,
      isLiveNavActive: false,
      userGpsCoords: null,
      userSpeedKmh: 0,
      remainingDistanceKm: 0,
      remainingDurationMin: 0,
      isOffRoute: false,
      floodWarningAhead: null,
      routingModalOpen: false,
      layers: {
        roads: true,
        floodDepth: true,
        floodExtent: false,
        rainfall: true,
        drainageNetwork: false,
        drainageStress: false,
        criticalInfra: true,
        safeRoutes: false,
      },
    });
  },

  exitSIHDemo: () => {
    set({
      sihDemoActive: false,
      sihDemoStep: 1,
      isLiveNavActive: false,
      userGpsCoords: null,
      userSpeedKmh: 0,
      remainingDistanceKm: 0,
      remainingDurationMin: 0,
      isOffRoute: false,
      floodWarningAhead: null,
      routingModalOpen: false,
    });
  },

  setSIHDemoStep: (step: number) => {
    const clamped = Math.max(1, Math.min(8, step));
    set({ sihDemoStep: clamped });

    switch (clamped) {
      case 1:
        set({
          currentTimestep: 0,
          leftPanelOpen: true,
          rightPanelOpen: false,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: false,
            rainfall: true,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: true,
            safeRoutes: false,
          },
        });
        break;
      case 2:
        set({
          currentTimestep: 45,
          leftPanelOpen: true,
          rightPanelOpen: false,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: true,
            rainfall: true,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: true,
            safeRoutes: false,
          },
        });
        break;
      case 3:
        set({
          currentTimestep: 30,
          selectedLocationId: 'road_102',
          activeRightTab: 'hotspots',
          leftPanelOpen: true,
          rightPanelOpen: true,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
        });
        break;
      case 4:
        set({
          currentTimestep: 30,
          selectedLocationId: 'road_102',
          leftPanelOpen: true,
          rightPanelOpen: false,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
        });
        break;
      case 5:
        set({
          currentTimestep: 30,
          selectedLocationId: 'road_102',
          activeRightTab: 'intelligence',
          leftPanelOpen: false,
          rightPanelOpen: true,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
        });
        break;
      case 6:
        set({
          currentTimestep: 45,
          layers: {
            roads: true,
            floodDepth: false,
            floodExtent: false,
            rainfall: false,
            drainageNetwork: true,
            drainageStress: true,
            criticalInfra: true,
            safeRoutes: false,
          },
          leftPanelOpen: true,
          rightPanelOpen: false,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
        });
        break;
      case 7:
        set({
          currentTimestep: 30,
          activeRightTab: 'decisions',
          leftPanelOpen: false,
          rightPanelOpen: true,
          isLiveNavActive: false,
          userGpsCoords: null,
          userSpeedKmh: 0,
          remainingDistanceKm: 0,
          remainingDurationMin: 0,
          isOffRoute: false,
          floodWarningAhead: null,
          routingModalOpen: false,
        });
        break;
      case 8:
        set({
          currentTimestep: 30,
          selectedVehicleType: 'AMBULANCE',
          routingModalOpen: true,
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: true,
            rainfall: false,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: true,
            safeRoutes: true,
          },
        });
        break;
    }
  },

  nextSIHDemoStep: () => {
    const { sihDemoStep, setSIHDemoStep } = get();
    if (sihDemoStep < 8) {
      setSIHDemoStep(sihDemoStep + 1);
    }
  },

  prevSIHDemoStep: () => {
    const { sihDemoStep, setSIHDemoStep } = get();
    if (sihDemoStep > 1) {
      setSIHDemoStep(sihDemoStep - 1);
    }
  },

  setTimestep: (step: ForecastTimestep) => {
    let offset = 0;
    if (step >= 150) offset = 3;
    else if (step >= 90) offset = 2;
    else if (step >= 45) offset = 1;
    else offset = 0;
    set({ currentTimestep: step, nowcastSelectedOffset: offset });
  },
  nextTimestep: () => {
    const { currentTimestep, setTimestep } = get();
    const idx = FORECAST_TIMESTEPS.indexOf(currentTimestep);
    if (idx < FORECAST_TIMESTEPS.length - 1) {
      setTimestep(FORECAST_TIMESTEPS[idx + 1]);
    } else {
      setTimestep(FORECAST_TIMESTEPS[0]);
    }
  },
  prevTimestep: () => {
    const { currentTimestep, setTimestep } = get();
    const idx = FORECAST_TIMESTEPS.indexOf(currentTimestep);
    if (idx > 0) {
      setTimestep(FORECAST_TIMESTEPS[idx - 1]);
    }
  },
  togglePlay: () => set((state: FloodStoreState) => ({ isPlaying: !state.isPlaying })),
  setPlaybackSpeed: (speed: number) => set({ playbackSpeed: speed }),
  setOperationMode: (mode: OperationMode) => set({ operationMode: mode }),

  setNowcastOffset: (offset: number) => {
    const stepMap: Record<number, ForecastTimestep> = { 0: 0, 1: 60, 2: 120, 3: 180 };
    const step = stepMap[offset] ?? 0;
    set({ nowcastSelectedOffset: offset, currentTimestep: step });
  },
  setNowcastData: (data: any) => set({ nowcastData: data }),

  setSelectedLocationId: (id: string | null) =>
    set({
      selectedLocationId: id,
      activeRightTab: 'intelligence',
      rightPanelOpen: true,
      explainabilityPanelOpen: true,
    }),
  setSelectedHotspot: (hotspot: FloodHotspot | null) =>
    set({
      selectedHotspot: hotspot,
      selectedLocationId: hotspot ? hotspot.id : null,
      activeRightTab: 'intelligence',
      rightPanelOpen: true,
      explainabilityPanelOpen: true,
    }),
  setSelectedInfraId: (id: string | null) =>
    set({
      selectedInfraId: id,
      activeRightTab: 'infrastructure',
      rightPanelOpen: true,
    }),
  setExplainabilityPanelOpen: (open: boolean) => set({ explainabilityPanelOpen: open }),
  setLocationDetailsExpanded: (expanded: boolean) => set({ locationDetailsExpanded: expanded }),
  setTelemetryExpanded: (expanded: boolean) => set({ telemetryExpanded: expanded }),

  toggleLayer: (layerKey: keyof MapLayerVisibility) =>
    set((state: FloodStoreState) => ({
      layers: {
        ...state.layers,
        [layerKey]: !state.layers[layerKey],
      },
    })),
  setAllLayers: (layers: Partial<MapLayerVisibility>) =>
    set((state: FloodStoreState) => ({
      layers: {
        ...state.layers,
        ...layers,
      },
    })),

  setMapFocusPreset: (preset: MapFocusPreset) => {
    set({ mapFocusPreset: preset });
    switch (preset) {
      case 'ALL':
        set({
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: true,
            rainfall: true,
            drainageNetwork: true,
            drainageStress: true,
            criticalInfra: true,
            safeRoutes: true,
          },
        });
        break;
      case 'FLOOD':
        set({
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: true,
            rainfall: false,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: false,
            safeRoutes: false,
          },
        });
        break;
      case 'RAIN':
        set({
          layers: {
            roads: true,
            floodDepth: false,
            floodExtent: false,
            rainfall: true,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: false,
            safeRoutes: false,
          },
        });
        break;
      case 'ROADS':
        set({
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: false,
            rainfall: false,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: false,
            safeRoutes: false,
          },
        });
        break;
      case 'DRAINAGE':
        set({
          layers: {
            roads: true,
            floodDepth: false,
            floodExtent: false,
            rainfall: false,
            drainageNetwork: true,
            drainageStress: true,
            criticalInfra: false,
            safeRoutes: false,
          },
        });
        break;
      case 'INFRA':
        set({
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: false,
            rainfall: false,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: true,
            safeRoutes: false,
          },
        });
        break;
      case 'ROUTES':
        set({
          layers: {
            roads: true,
            floodDepth: true,
            floodExtent: true,
            rainfall: false,
            drainageNetwork: false,
            drainageStress: false,
            criticalInfra: true,
            safeRoutes: true,
          },
        });
        break;
    }
  },

  setRoutingModalOpen: (open: boolean) => set({ routingModalOpen: open }),
  setSelectedVehicleType: (vehicle: VehicleType) => set({ selectedVehicleType: vehicle }),
  setOriginCoords: (coords: [number, number]) => set({ originCoords: coords }),
  setDestinationCoords: (coords: [number, number]) => set({ destinationCoords: coords }),
  setActiveRouteResponse: (route: SafeRouteResponse | null) => set({ activeRouteResponse: route }),
  setIsCalculatingRoute: (loading: boolean) => set({ isCalculatingRoute: loading }),

  setLeftPanelOpen: (open: boolean) => set({ leftPanelOpen: open }),
  setRightPanelOpen: (open: boolean) => set({ rightPanelOpen: open }),
  setActiveRightTab: (tab: 'decisions' | 'intelligence' | 'infrastructure' | 'hotspots' | 'alerts') => set({ activeRightTab: tab, rightPanelOpen: true }),

  setCitizenReportModalOpen: (open: boolean) => set({ citizenReportModalOpen: open }),

  setHistoricalReplayOpen: (open: boolean) => set({ historicalReplayOpen: open }),
  setValidationLabOpen: (open: boolean) => set({ validationLabOpen: open }),
  setDataHealthOpen: (open: boolean) => set({ dataHealthOpen: open }),
  setModelHealthOpen: (open: boolean) => set({ modelHealthOpen: open }),
  setPredictionProvenanceOpen: (open: boolean) => set({ predictionProvenanceOpen: open }),
  setSelectedPredictionId: (id: string | null) => set({ selectedPredictionId: id }),

  // Persistent Community Feedback Actions
  addCommunityFeedback: (spotId: string, text: string, photoUrl?: string | null) => {
    if (!spotId || (!text.trim() && !photoUrl)) return;
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    const userName = currentUserEmail.split('@')[0] || 'User';
    const newFeedback: CommunityFeedback = {
      id: `FB-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      spotId,
      userEmail: currentUserEmail,
      userName,
      text: text.trim(),
      photoUrl: photoUrl || null,
      timestamp: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      dislikes: 0,
      dislikedBy: [],
      replies: [],
    };
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = [newFeedback, ...existing];
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.createFeedback(spotId, text.trim(), photoUrl).then(() => {
      api.getAllFeedbacks().then((fbs) => {
        if (fbs && Object.keys(fbs).length > 0) set({ communityFeedbacks: fbs });
      }).catch(() => {});
    }).catch(() => {});
  },

  deleteCommunityFeedback: (spotId: string, feedbackId: string) => {
    const currentUserEmail = get().userEmail;
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const target = existing.find((f) => f.id === feedbackId);
      if (!target || target.userEmail !== currentUserEmail) return state;

      const updatedList = existing.filter((f) => f.id !== feedbackId);
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.deleteFeedback(feedbackId).catch(() => {});
  },

  toggleLikeCommunityFeedback: (spotId: string, feedbackId: string) => {
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        const likedBy = f.likedBy || [];
        const dislikedBy = f.dislikedBy || [];
        const alreadyLiked = likedBy.includes(currentUserEmail);

        let updatedLikedBy: string[];
        let updatedDislikedBy: string[];

        if (alreadyLiked) {
          updatedLikedBy = likedBy.filter((e) => e !== currentUserEmail);
          updatedDislikedBy = dislikedBy;
        } else {
          updatedLikedBy = [...likedBy, currentUserEmail];
          updatedDislikedBy = dislikedBy.filter((e) => e !== currentUserEmail);
        }

        return {
          ...f,
          likes: updatedLikedBy.length,
          likedBy: updatedLikedBy,
          dislikes: updatedDislikedBy.length,
          dislikedBy: updatedDislikedBy,
        };
      });
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.toggleFeedbackReaction(feedbackId, 'LIKE').catch(() => {});
  },

  toggleDislikeCommunityFeedback: (spotId: string, feedbackId: string) => {
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        const likedBy = f.likedBy || [];
        const dislikedBy = f.dislikedBy || [];
        const alreadyDisliked = dislikedBy.includes(currentUserEmail);

        let updatedLikedBy: string[];
        let updatedDislikedBy: string[];

        if (alreadyDisliked) {
          updatedDislikedBy = dislikedBy.filter((e) => e !== currentUserEmail);
          updatedLikedBy = likedBy;
        } else {
          updatedDislikedBy = [...dislikedBy, currentUserEmail];
          updatedLikedBy = likedBy.filter((e) => e !== currentUserEmail);
        }

        return {
          ...f,
          likes: updatedLikedBy.length,
          likedBy: updatedLikedBy,
          dislikes: updatedDislikedBy.length,
          dislikedBy: updatedDislikedBy,
        };
      });
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.toggleFeedbackReaction(feedbackId, 'DISLIKE').catch(() => {});
  },

  addCommunityFeedbackReply: (spotId: string, feedbackId: string, text: string) => {
    if (!text.trim()) return;
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    const userName = currentUserEmail.split('@')[0] || 'User';
    const newReply: CommunityFeedbackReply = {
      id: `REPLY-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userEmail: currentUserEmail,
      userName,
      text: text.trim(),
      timestamp: new Date().toISOString(),
      likes: 0,
      likedBy: [],
      dislikes: 0,
      dislikedBy: [],
    };
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        return {
          ...f,
          replies: [...(f.replies || []), newReply],
        };
      });
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.addReply(feedbackId, text.trim()).catch(() => {});
  },

  deleteCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => {
    const currentUserEmail = get().userEmail;
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        const targetReply = (f.replies || []).find((r) => r.id === replyId);
        if (!targetReply || targetReply.userEmail !== currentUserEmail) return f;
        return {
          ...f,
          replies: f.replies.filter((r) => r.id !== replyId),
        };
      });
      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.deleteReply(feedbackId, replyId).catch(() => {});
  },

  toggleLikeCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => {
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        const updatedReplies = (f.replies || []).map((r) => {
          if (r.id !== replyId) return r;
          const likedBy = r.likedBy || [];
          const dislikedBy = r.dislikedBy || [];
          const alreadyLiked = likedBy.includes(currentUserEmail);

          let updatedLikedBy: string[];
          let updatedDislikedBy: string[];

          if (alreadyLiked) {
            updatedLikedBy = likedBy.filter((e) => e !== currentUserEmail);
            updatedDislikedBy = dislikedBy;
          } else {
            updatedLikedBy = [...likedBy, currentUserEmail];
            updatedDislikedBy = dislikedBy.filter((e) => e !== currentUserEmail);
          }

          return {
            ...r,
            likes: updatedLikedBy.length,
            likedBy: updatedLikedBy,
            dislikes: updatedDislikedBy.length,
            dislikedBy: updatedDislikedBy,
          };
        });

        return { ...f, replies: updatedReplies };
      });

      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.toggleReplyReaction(feedbackId, replyId, 'LIKE').catch(() => {});
  },

  toggleDislikeCommunityFeedbackReply: (spotId: string, feedbackId: string, replyId: string) => {
    const currentUserEmail = get().userEmail || 'user@jaldrishti.org';
    set((state) => {
      const existing = state.communityFeedbacks[spotId] || [];
      const updatedList = existing.map((f) => {
        if (f.id !== feedbackId) return f;
        const updatedReplies = (f.replies || []).map((r) => {
          if (r.id !== replyId) return r;
          const likedBy = r.likedBy || [];
          const dislikedBy = r.dislikedBy || [];
          const alreadyDisliked = dislikedBy.includes(currentUserEmail);

          let updatedLikedBy: string[];
          let updatedDislikedBy: string[];

          if (alreadyDisliked) {
            updatedDislikedBy = dislikedBy.filter((e) => e !== currentUserEmail);
            updatedLikedBy = likedBy;
          } else {
            updatedDislikedBy = [...dislikedBy, currentUserEmail];
            updatedLikedBy = likedBy.filter((e) => e !== currentUserEmail);
          }

          return {
            ...r,
            likes: updatedLikedBy.length,
            likedBy: updatedLikedBy,
            dislikes: updatedDislikedBy.length,
            dislikedBy: updatedDislikedBy,
          };
        });

        return { ...f, replies: updatedReplies };
      });

      const updatedAll = { ...state.communityFeedbacks, [spotId]: updatedList };
      try {
        localStorage.setItem('jaldrishti_community_feedbacks', JSON.stringify(updatedAll));
      } catch (e) {}
      return { communityFeedbacks: updatedAll };
    });

    api.toggleReplyReaction(feedbackId, replyId, 'DISLIKE').catch(() => {});
  },
}));

if (typeof window !== 'undefined') {
  (window as any).useFloodStore = useFloodStore;
}
