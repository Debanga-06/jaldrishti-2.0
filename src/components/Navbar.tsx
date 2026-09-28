/**
 * JALDRISHTI Consumer Navigation Bar
 * White + Blue Premium Aesthetic (Google Maps & Apple Style Simplicity)
 * Primary Navigation ONLY: HOME | SEARCH | ALERTS | PROFILE
 */

import React from 'react';
import { Home, Search, Bell, User, Navigation } from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';

export const Navbar: React.FC = () => {
  const { activeNavTab, setNavTab, consumerAlerts, isAuthenticated, requireAuth } = useFloodStore();

  const unreadAlertsCount = consumerAlerts.filter((a) => a.dateGroup === 'TODAY').length;

  return (
    <header className="bg-white border-b border-slate-200 text-slate-900 sticky top-0 z-40 shadow-sm font-sans select-none">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <div
          onClick={() => setNavTab('HOME')}
          className="flex items-center space-x-3 cursor-pointer group shrink-0"
        >
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-md shadow-blue-600/25 group-hover:scale-105 transition-transform bg-blue-950 flex items-center justify-center">
            <img src="/logo.png" alt="JALDRISHTI Logo" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                JALDRISHTI
              </h1>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                FLOOD SAFETY
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Know the Flood Before You Reach It.
            </p>
          </div>
        </div>

        {/* Right Section: Desktop Navigation */}
        <div className="flex items-center space-x-3">
          {/* Primary Desktop Navigation Bar */}
          <nav className="hidden md:flex items-center space-x-1 bg-slate-100/80 p-1.5 rounded-2xl border border-slate-200/80">
            <button
              id="nav-tab-home"
              onClick={() => setNavTab('HOME')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeNavTab === 'HOME'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Home className="w-4 h-4" />
              <span>HOME</span>
            </button>

            <button
              id="nav-tab-search"
              onClick={() => setNavTab('SEARCH')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeNavTab === 'SEARCH'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>SEARCH</span>
            </button>

            <button
              id="nav-tab-alerts"
              onClick={() => setNavTab('ALERTS')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all relative ${
                activeNavTab === 'ALERTS'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>ALERTS</span>
              {unreadAlertsCount > 0 && (
                <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold ${
                  activeNavTab === 'ALERTS' ? 'bg-white text-blue-600' : 'bg-rose-600 text-white'
                }`}>
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            <button
              id="nav-tab-profile"
              onClick={() => setNavTab('PROFILE')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeNavTab === 'PROFILE'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <User className="w-4 h-4" />
              <span>PROFILE</span>
            </button>
          </nav>

          {!isAuthenticated && (
            <button
              onClick={() => requireAuth('Sign in to save your home, work, and preferences.')}
              className="hidden md:flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all"
            >
              <User className="w-4 h-4" />
              <span>SIGN IN</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 px-4 py-2.5 flex items-center justify-around shadow-lg">
        <button
          id="mobile-nav-tab-home"
          onClick={() => setNavTab('HOME')}
          className={`flex flex-col items-center space-y-1 text-[11px] font-semibold ${
            activeNavTab === 'HOME' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span>HOME</span>
        </button>

        <button
          id="mobile-nav-tab-search"
          onClick={() => setNavTab('SEARCH')}
          className={`flex flex-col items-center space-y-1 text-[11px] font-semibold ${
            activeNavTab === 'SEARCH' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Search className="w-5 h-5" />
          <span>SEARCH</span>
        </button>

        <button
          id="mobile-nav-tab-alerts"
          onClick={() => setNavTab('ALERTS')}
          className={`flex flex-col items-center space-y-1 text-[11px] font-semibold relative ${
            activeNavTab === 'ALERTS' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Bell className="w-5 h-5" />
          <span>ALERTS</span>
          {unreadAlertsCount > 0 && (
            <span className="absolute top-0 right-2 w-2 h-2 rounded-full bg-rose-600" />
          )}
        </button>

        <button
          id="mobile-nav-tab-profile"
          onClick={() => setNavTab('PROFILE')}
          className={`flex flex-col items-center space-y-1 text-[11px] font-semibold ${
            activeNavTab === 'PROFILE' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span>PROFILE</span>
        </button>
      </div>
    </header>
  );
};
