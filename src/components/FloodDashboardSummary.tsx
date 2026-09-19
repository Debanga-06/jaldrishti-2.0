import React from 'react';
import { Waves, CloudRain, ShieldAlert, Activity, GitBranch, Layers, CheckCircle2 } from 'lucide-react';
import { GisDashboardResponse } from '../types';

interface FloodDashboardSummaryProps {
  dashboardData: GisDashboardResponse | null;
  selectedHorizonOffset: number;
  onSelectHorizonOffset: (offset: number) => void;
  isLoading?: boolean;
}

export const FloodDashboardSummary: React.FC<FloodDashboardSummaryProps> = ({
  dashboardData,
  selectedHorizonOffset,
  onSelectHorizonOffset,
  isLoading = false,
}) => {
  const streetProjections = dashboardData?.street_projections || [];
  const maxDepthCm = streetProjections.length > 0
    ? Math.max(...streetProjections.map((s) => s.max_predicted_depth_cm))
    : 0;

  const highestSeverity = streetProjections.length > 0
    ? (streetProjections.some((s) => s.risk_level === 'CRITICAL')
        ? 'CRITICAL'
        : streetProjections.some((s) => s.risk_level === 'HIGH')
        ? 'HIGH'
        : 'MODERATE')
    : 'SAFE';

  const severityColorClass = highestSeverity === 'CRITICAL'
    ? 'text-red-700 bg-red-50 border-red-200'
    : highestSeverity === 'HIGH'
    ? 'text-purple-700 bg-purple-50 border-purple-200'
    : highestSeverity === 'MODERATE'
    ? 'text-yellow-700 bg-yellow-50 border-yellow-200'
    : 'text-emerald-700 bg-emerald-50 border-emerald-200';

  const horizons = [
    { label: 'T+0h (Now)', offset: 0 },
    { label: 'T+1h Forecast', offset: 1 },
    { label: 'T+2h Forecast', offset: 2 },
    { label: 'T+3h Forecast', offset: 3 },
  ];

  return (
    <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4 transition-all mb-4">
      {/* Top Header & Horizon Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
            <Waves className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Street-by-Street GIS Flood Intelligence
            </h3>
            <p className="text-xs text-slate-500">
              {dashboardData?.location?.name || 'Selected Area'} • 0–3h Forecast Window
            </p>
          </div>
        </div>

        {/* 0-3h Forecast Horizon Timeline Selector */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg gap-1">
          {horizons.map((h) => {
            const isActive = selectedHorizonOffset === h.offset;
            return (
              <button
                key={h.offset}
                onClick={() => onSelectHorizonOffset(h.offset)}
                disabled={isLoading}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {h.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Maximum Depth in CM */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>Max Predicted Depth</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {maxDepthCm > 0 ? `${maxDepthCm.toFixed(1)} cm` : '0.0 cm'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Authoritative Pipeline</div>
        </div>

        {/* Highest Severity */}
        <div className={`p-3 rounded-lg border ${severityColorClass}`}>
          <div className="flex items-center gap-1.5 text-xs mb-1 opacity-90">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Highest Risk Severity</span>
          </div>
          <div className="text-xl font-bold">{highestSeverity}</div>
          <div className="text-[10px] opacity-75 mt-0.5">Street Risk Classification</div>
        </div>

        {/* Affected Roads Count */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <Layers className="w-3.5 h-3.5 text-purple-500" />
            <span>Affected Roads</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {streetProjections.length} Segments
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Parts 3 & 4 Coupling</div>
        </div>

        {/* Rainfall Intensity */}
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
            <CloudRain className="w-3.5 h-3.5 text-indigo-500" />
            <span>Rainfall Nowcast</span>
          </div>
          <div className="text-xl font-bold text-slate-900">
            {dashboardData?.rainfall?.intensity_mm_h ? `${dashboardData.rainfall.intensity_mm_h.toFixed(1)} mm/h` : '0.0 mm/h'}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {dashboardData?.rainfall?.provenance_badge || 'DWR Radar / CWC Telemetry'}
          </div>
        </div>
      </div>

      {/* 5-Tier Data Provenance Badges */}
      <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1 text-[11px]">
          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Provenance:
        </span>
        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium text-[11px] border border-blue-100">
          {dashboardData?.provenance?.rainfall_provenance_badge || 'OBSERVED • DOPPLER WEATHER RADAR'}
        </span>
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded font-medium text-[11px] border border-indigo-100">
          {dashboardData?.provenance?.surface_model || '2D SURFACE FLOW MODEL (DEM)'}
        </span>
        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded font-medium text-[11px] border border-purple-100">
          {dashboardData?.provenance?.drainage_model || 'DIRECTED DRAINAGE GRAPH'}
        </span>
        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-medium text-[11px]">
          {dashboardData?.status || 'PREDICTED'}
        </span>
      </div>
    </div>
  );
};
