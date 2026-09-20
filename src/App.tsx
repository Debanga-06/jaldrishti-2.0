/**
 * JALDRISHTI - Flood-Aware Navigation & Early Warning Platform
 * Tagline: "Know the Flood Before You Reach It."
 * Supports Primary Consumer Experience (Home, Search, Alerts, Profile)
 * + Municipal Command Center (Pro GIS Mode) 
 */

import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  MapPin,
  HelpCircle,
  Layers,
  Navigation,
} from 'lucide-react';
import { Navbar } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { SearchView } from './components/SearchView';
import { AlertsView } from './components/AlertsView';
import { ProfileView } from './components/ProfileView';
import { CommandHeader } from './components/CommandHeader';
import { FloodStatusPanel } from './components/FloodStatusPanel';
import { FloodCountdown } from './components/FloodCountdown';
import { DataStatusIndicator } from './components/DataStatusIndicator';
import { LayerControl } from './components/LayerControl';
import { DrainageLayerControl } from './components/DrainageLayerControl';
import { AlertPanel } from './components/AlertPanel';
import { HotspotPanel } from './components/HotspotPanel';
import { StreetIntelligencePanel } from './components/StreetIntelligencePanel';
import { CityDecisionEngine } from './components/CityDecisionEngine';
import { CriticalInfrastructurePanel } from './components/CriticalInfrastructurePanel';
import { ForecastTimeline } from './components/ForecastTimeline';
import { CitizenReportModal } from './components/CitizenReportModal';
import { CitizenMobileView } from './components/CitizenMobileView';
import { FocusModeOverlay } from './components/FocusModeOverlay';
import { MapFocusControls } from './components/MapFocusControls';
import { SIHDemoPresenter } from './components/SIHDemoPresenter';
import { HistoricalFloodReplayModal } from './components/HistoricalFloodReplayModal';
import { ValidationLabModal } from './components/ValidationLabModal';
import { DataHealthModal } from './components/DataHealthModal';
import { ModelHealthModal } from './components/ModelHealthModal';
import { PredictionProvenanceModal } from './components/PredictionProvenanceModal';
import { FloodMap } from './components/FloodMap';
import { useFloodStore } from './store/useFloodStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 10000,
    },
  },
});

import { LoginView } from './components/LoginView';
import { OnboardingView } from './components/OnboardingView';

const MainPlatformLayout: React.FC = () => {
  const {
    isAuthenticated,
    hasCompletedOnboarding,
    activeNavTab,
    syncCommunityFeedbacks,
  } = useFloodStore();

  // Pull the latest community feedback from the server on load, and keep it fresh with a
  // periodic re-sync. Without this, a signed-in session only ever shows feedback that was
  // cached locally at login/register/post time — comments other users add later never show
  // up until the next full re-login.
  useEffect(() => {
    if (!isAuthenticated) return;
    syncCommunityFeedbacks();
    const intervalId = window.setInterval(syncCommunityFeedbacks, 30000);
    return () => window.clearInterval(intervalId);
  }, [isAuthenticated, syncCommunityFeedbacks]);

  // 1. REAL AUTHENTICATION GUARD
  if (!isAuthenticated) {
    return <LoginView />;
  }

  // 2. LOCATION & HOME SETUP ONBOARDING GUARD
  if (!hasCompletedOnboarding) {
    return <OnboardingView />;
  }

  // 3. PRIMARY FROZEN CONSUMER EXPERIENCE (HOME, SEARCH, ALERTS, PROFILE)
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Navbar />
      <main className="flex-1">
        {activeNavTab === 'HOME' && <HomeView />}
        {activeNavTab === 'SEARCH' && <SearchView />}
        {activeNavTab === 'ALERTS' && <AlertsView />}
        {activeNavTab === 'PROFILE' && <ProfileView />}
      </main>
      <CitizenReportModal />
    </div>
  );
};

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public props: ErrorBoundaryProps;
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('JALDRISHTI UI Error Boundary caught an exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 text-slate-100 font-sans">
          <div className="bg-slate-950 border border-rose-500/50 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-4 text-left">
            <div className="flex items-center space-x-3 text-rose-400">
              <h1 className="text-xl font-bold font-mono">JALDRISHTI Render Diagnostics</h1>
            </div>
            <div className="p-4 bg-slate-900 border border-slate-800 text-rose-300 text-xs font-mono rounded-2xl overflow-x-auto whitespace-pre-wrap">
              {this.state.error?.stack || this.state.error?.message || 'Unknown render exception'}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <MainPlatformLayout />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
