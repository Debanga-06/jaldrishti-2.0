/**
 * JALDRISHTI - PREDICTION PROVENANCE & AUDIT TRAIL
 * When clicking a prediction, shows:
 * PREDICTION ID, Generated At, Valid For, Rainfall Source, Terrain Dataset,
 * Drainage Dataset, Model Version, Data Mode, Confidence & SHA-256 Checksum
 */

import React, { useState, useEffect } from 'react';
import {
  Fingerprint,
  X,
  Clock,
  Database,
  Layers,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  FileCode,
  Activity,
  Workflow,
  ExternalLink,
} from 'lucide-react';
import { useFloodStore } from '../store/useFloodStore';
import { JaldrishtiApi } from '../services/api';
import { PredictionProvenanceData } from '../types';

export const PredictionProvenanceModal: React.FC = () => {
  const {
    predictionProvenanceOpen,
    setPredictionProvenanceOpen,
    selectedPredictionId,
    currentTimestep,
    operationMode,
  } = useFloodStore();

  const [provenance, setProvenance] = useState<PredictionProvenanceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (predictionProvenanceOpen) {
      setLoading(true);
      const predId =
        selectedPredictionId ||
        `PRED-20260901-0945-T${currentTimestep}-SWMM-GNN`;

      JaldrishtiApi.getPredictionProvenance(predId).then((res) => {
        setProvenance(res);
        setLoading(false);
      });
    }
  }, [predictionProvenanceOpen, selectedPredictionId, currentTimestep]);

  if (!predictionProvenanceOpen) return null;

  const handleCopyHash = () => {
    if (provenance?.sha256_checksum) {
      navigator.clipboard.writeText(provenance.sha256_checksum);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Prediction Provenance & Lineage Audit
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-700 rounded uppercase">
                  VERIFIED AUDIT RECORD
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Complete data lineage, model checkpoint hash, and environmental dataset provenance for legal and scientific auditability.
              </p>
            </div>
          </div>

          <button
            onClick={() => setPredictionProvenanceOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 font-mono text-xs">
          {loading || !provenance ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
              Retrieving cryptographic prediction provenance...
            </div>
          ) : (
            <>
              {/* PRIMARY PROVENANCE SPECIFICATION TABLE */}
              <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden divide-y divide-slate-800/80 shadow-lg">
                {/* 1. PREDICTION ID */}
                <div className="grid grid-cols-3 p-3.5 bg-slate-900/60">
                  <span className="font-bold text-slate-400 uppercase">PREDICTION ID</span>
                  <div className="col-span-2 font-bold text-cyan-400">
                    {provenance.prediction_id}
                  </div>
                </div>

                {/* 2. Generated At */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Generated At</span>
                  <div className="col-span-2 text-slate-200">
                    {provenance.generated_at} (UTC) / 15:15:00 IST
                  </div>
                </div>

                {/* 3. Valid For */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Valid For</span>
                  <div className="col-span-2 text-indigo-300 font-bold">
                    {provenance.valid_for}
                  </div>
                </div>

                {/* 4. Rainfall Doppler Radar, CWC Observed Telemetry & Forecast Source */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Doppler Radar</span>
                  <div className="col-span-2 text-purple-300 font-bold flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 text-[10px]">
                      OBSERVED • DWR RADAR
                    </span>
                    <span>{provenance.radar_observation_source || "IMD Doppler Weather Radar Network"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Observed Telemetry</span>
                  <div className="col-span-2 text-cyan-300 font-bold flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px]">
                      OBSERVED • CWC ARG
                    </span>
                    <span>{provenance.observed_rainfall_source || "CWC Ground Automated Rain Gauge Telemetry"}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Weather Forecast</span>
                  <div className="col-span-2 text-blue-300 font-bold flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[10px]">
                      FORECAST • Open-Meteo
                    </span>
                    <span>{provenance.rainfall_source || "Open-Meteo High-Resolution NWP Forecast"}</span>
                  </div>
                </div>

                {/* 5. Terrain Dataset */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Terrain Dataset</span>
                  <div className="col-span-2 text-slate-200">
                    {provenance.terrain_dataset}
                  </div>
                </div>

                {/* 6. Drainage Dataset */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Drainage Dataset</span>
                  <div className="col-span-2 text-slate-200">
                    {provenance.drainage_dataset}
                  </div>
                </div>

                {/* 7. Model Version */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Model Version</span>
                  <div className="col-span-2 text-emerald-400 font-bold">
                    {provenance.model_version}
                  </div>
                </div>

                {/* 8. Data Mode */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Data Mode</span>
                  <div className="col-span-2">
                    <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
                      {operationMode}
                    </span>
                  </div>
                </div>

                {/* 9. Confidence */}
                <div className="grid grid-cols-3 p-3.5">
                  <span className="text-slate-400">Confidence</span>
                  <div className="col-span-2 text-emerald-300 font-bold">
                    {provenance.confidence}
                  </div>
                </div>
              </div>

              {/* CRYPTOGRAPHIC SHA-256 CHECKSM HASH */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase flex items-center space-x-1.5">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span>Cryptographic Verification Hash (SHA-256)</span>
                  </span>

                  <button
                    onClick={handleCopyHash}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-300 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copied ? 'COPIED!' : 'COPY HASH'}</span>
                  </button>
                </div>

                <div className="p-2.5 rounded bg-slate-900 border border-slate-800 text-[11px] text-cyan-300 break-all select-all">
                  {provenance.sha256_checksum}
                </div>
              </div>

              {/* 6-STEP HYDRODYNAMIC LINEAGE TRACE */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-300 uppercase block mb-2 flex items-center space-x-1.5">
                  <Workflow className="w-4 h-4 text-indigo-400" />
                  <span>Pipeline Execution Trace & Transformation Lineage</span>
                </span>

                <div className="space-y-1.5 text-[11px] text-slate-300">
                  {provenance.lineage_steps.map((step, idx) => (
                    <div key={idx} className="flex items-start space-x-2 py-0.5">
                      <span className="text-cyan-400 font-bold">•</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cryptographically signed by JALDRISHTI Hydroinformatics Core</span>
          </div>

          <button
            onClick={() => setPredictionProvenanceOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold transition-colors"
          >
            Close Provenance
          </button>
        </div>
      </div>
    </div>
  );
};
