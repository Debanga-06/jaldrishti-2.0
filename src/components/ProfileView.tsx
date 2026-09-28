import React, { useState } from 'react';
import {
  MapPin,
  Home,
  Briefcase,
  Bell,
  LogOut,
  UserCheck,
  Edit2,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';
import { LocationSearch, LocationSearchResult } from './common/LocationSearch';
import { SavedLocation } from '../types';

export const ProfileView: React.FC = () => {
  const {
    isAuthenticated,
    userEmail,
    savedHome,
    savedWork,
    setSavedHome,
    setSavedWork,
    notificationSettings,
    setNotificationSettings,
    logout,
    requireAuth,
  } = useFloodStore();

  const [isEditingHome, setIsEditingHome] = useState(false);
  const [isEditingWork, setIsEditingWork] = useState(false);

  const handleSaveHome = (loc: LocationSearchResult) => {
    const updatedHome: SavedLocation = {
      id: `LOC-HOME-${Date.now()}`,
      name: 'Home',
      address: loc.display_name,
      locality: loc.locality || loc.display_name,
      coordinates: [loc.lat, loc.lon],
      type: 'HOME',
      isSet: true,
    };
    setSavedHome(updatedHome);
    setIsEditingHome(false);
  };

  const handleSaveWork = (loc: LocationSearchResult) => {
    const updatedWork: SavedLocation = {
      id: `LOC-WORK-${Date.now()}`,
      name: 'Work Office',
      address: loc.display_name,
      locality: loc.locality || loc.display_name,
      coordinates: [loc.lat, loc.lon],
      type: 'WORK',
      isSet: true,
    };
    setSavedWork(updatedWork);
    setIsEditingWork(false);
  };

  return (
    <div id="jaldrishti-profile-view" className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-24 select-none">
      {!isAuthenticated ? (
        <div className="max-w-md mx-auto px-4 pt-24 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-md shadow-blue-600/20">
            <UserCheck className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Sign in to view your profile</h2>
          <p className="text-sm text-slate-500">
            Save your home and work locations, manage notification preferences, and pick up where you left off — all tied to your account.
          </p>
          <button
            type="button"
            onClick={() => requireAuth('Sign in to view and manage your profile.')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-blue-600/20 transition-all"
          >
            Sign In / Register
          </button>
        </div>
      ) : (
      <>
      {/* Header Banner */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md shadow-blue-600/20">
                {userEmail ? userEmail[0].toUpperCase() : 'U'}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>{userEmail || 'Sourav Kumar'}</span>
                  <UserCheck className="w-4 h-4 text-blue-600" />
                </h1>
                <p className="text-xs text-slate-500 font-medium">
                  User Profile &amp; Location Settings
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={logout}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-xs uppercase flex items-center space-x-1.5 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* 1. SAVED HOME LOCATION */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  SAVED HOME LOCATION
                </h2>
                <p className="text-[11px] text-slate-500">
                  Used for location-scoped flood early warnings and home safety monitoring.
                </p>
              </div>
            </div>
            <button
              id="change-saved-home-btn"
              onClick={() => setIsEditingHome(!isEditingHome)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all"
            >
              {isEditingHome ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
              <span>{isEditingHome ? 'Cancel' : 'Change Home'}</span>
            </button>
          </div>

          {isEditingHome ? (
            <div className="p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase">
                Search &amp; Select New Saved Home Location (Pan-India)
              </label>
              <LocationSearch
                placeholder="Type any location or address..."
                onSelectLocation={handleSaveHome}
                autoFocus={true}
              />
            </div>
          ) : (
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Home className="w-4 h-4 text-blue-600" />
                    <span>{savedHome?.locality || savedHome?.name || 'Saved Home'}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 uppercase">
                    ACTIVE HOME
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{savedHome?.address}</p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Coordinates: {savedHome?.coordinates ? `${savedHome.coordinates[0].toFixed(4)}°N, ${savedHome.coordinates[1].toFixed(4)}°E` : 'Not Set'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. WORK OFFICE LOCATION */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  WORK OFFICE LOCATION
                </h2>
                <p className="text-[11px] text-slate-500">
                  Used for workplace location context and route evaluation.
                </p>
              </div>
            </div>
            <button
              id="change-work-office-btn"
              onClick={() => setIsEditingWork(!isEditingWork)}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-all"
            >
              {isEditingWork ? <X className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
              <span>{isEditingWork ? 'Cancel' : 'Change Work'}</span>
            </button>
          </div>

          {isEditingWork ? (
            <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase">
                Search &amp; Select Work Office Location (Pan-India)
              </label>
              <LocationSearch
                placeholder="Type work office location or address..."
                onSelectLocation={handleSaveWork}
                autoFocus={true}
              />
            </div>
          ) : (
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <Briefcase className="w-4 h-4 text-indigo-600" />
                    <span>{savedWork?.locality || savedWork?.name || 'Work Office'}</span>
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase">
                    WORKPLACE
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{savedWork?.address}</p>
                <div className="text-[10px] text-slate-400 font-mono">
                  Coordinates: {savedWork?.coordinates ? `${savedWork.coordinates[0].toFixed(4)}°N, ${savedWork.coordinates[1].toFixed(4)}°E` : 'Not Set'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3. NOTIFICATION PREFERENCES */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  NOTIFICATION PREFERENCES
                </h2>
                <p className="text-[11px] text-slate-500">
                  Authoritative flood safety alert permissions based strictly on verified data.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 font-sans text-xs">
            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">A. Current Waterlogging Alerts</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Notify when verified/authoritative data indicates active waterlogging at a relevant location.
                </span>
              </div>
              <input
                id="toggle-current-waterlogging"
                type="checkbox"
                checked={notificationSettings?.currentWaterlogging ?? true}
                onChange={(e) => setNotificationSettings({ currentWaterlogging: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">B. Predicted Flood Risk</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Notify when prediction system predicts meaningful flood risk near saved Home or monitored location.
                </span>
              </div>
              <input
                id="toggle-predicted-flood-risk"
                type="checkbox"
                checked={notificationSettings?.predictedFloodRisk ?? true}
                onChange={(e) => setNotificationSettings({ predictedFloodRisk: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">C. Heavy Rainfall / Flood Risk Warning</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Notify when connected weather source provides strong rainfall/risk information.
                </span>
              </div>
              <input
                id="toggle-heavy-rainfall-warning"
                type="checkbox"
                checked={notificationSettings?.heavyRainfallWarning ?? true}
                onChange={(e) => setNotificationSettings({ heavyRainfallWarning: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
              />
            </div>

            <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 block text-xs">D. Route Flood-Risk Warning</span>
                <span className="text-slate-500 text-[11px] block mt-0.5">
                  Notify when an actively checked/monitored route has a meaningful flood-risk or waterlogging issue.
                </span>
              </div>
              <input
                id="toggle-route-flood-risk"
                type="checkbox"
                checked={notificationSettings?.routeFloodRisk ?? true}
                onChange={(e) => setNotificationSettings({ routeFloodRisk: e.target.checked })}
                className="w-5 h-5 accent-blue-600 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
