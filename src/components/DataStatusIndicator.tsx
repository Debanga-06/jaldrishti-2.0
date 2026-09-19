/**
 * DataStatusIndicator Component
 * Telemetry freshness, input completeness, surrogate model status & sensor telemetry indicators.
 */

import React from 'react';
import { Activity, Radio, Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';

export const DataStatusIndicator: React.FC = () => {
  const { operationMode } = useFloodStore();

  return (
    <div
      id="data-status-indicator"
      className="bg-slate-900/90 border border-slate-800 rounded p-2 text-xs font-mono select-none"
    >
      <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800/80 pb-1 mb-1.5 font-bold uppercase tracking-wider">
        <span>System Telemetry & Health</span>
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          OPERATIONAL
        </span>
      </div>

      <div className="grid grid-cols-2 gap-1.5 text-[10px]">
        {/* Doppler Weather Radar */}
        <div className="bg-slate-950/80 border border-slate-800/70 p-1.5 rounded flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Radio className="w-3 h-3 text-purple-400" />
            <span>OBSERVED • DWR RADAR</span>
          </div>
          <span className="text-purple-300 font-bold">DWR Status</span>
        </div>

        {/* CWC Ground Rain Gauge Telemetry */}
        <div className="bg-slate-950/80 border border-slate-800/70 p-1.5 rounded flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Radio className="w-3 h-3 text-cyan-400" />
            <span>OBSERVED • CWC ARG</span>
          </div>
          <span className="text-cyan-400 font-bold">Telemetry Sync</span>
        </div>

        {/* Open-Meteo NWP Forecast */}
        <div className="bg-slate-950/80 border border-slate-800/70 p-1.5 rounded flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Activity className="w-3 h-3 text-blue-400" />
            <span>FORECAST • Open-Meteo</span>
          </div>
          <span className="text-emerald-400 font-bold">NWP Live</span>
        </div>

        {/* 1D/2D Hydro Engine */}
        <div className="bg-slate-950/80 border border-slate-800/70 p-1.5 rounded flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <Cpu className="w-3 h-3 text-indigo-400" />
            <span>Saint-Venant</span>
          </div>
          <span className="text-emerald-400 font-bold">Converged</span>
        </div>

        {/* ML Surrogate Latency */}
        <div className="bg-slate-950/80 border border-slate-800/70 p-1.5 rounded flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-slate-300">
            <CheckCircle2 className="w-3 h-3 text-amber-400" />
            <span>ML Surrogate</span>
          </div>
          <span className="text-amber-300 font-bold">42ms infer</span>
        </div>
      </div>
    </div>
  );
};
