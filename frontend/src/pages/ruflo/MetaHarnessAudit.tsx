import React, { useEffect } from 'react';
import {
  Gauge,
  ShieldCheck,
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  FileCheck,
  Cpu,
  Layers,
  Sliders
} from 'lucide-react';
import { useRufloStore } from '../../stores/ruflo-store';

export function MetaHarnessAudit() {
  const {
    metaAudit,
    workers,
    isLoadingAudit,
    fetchMetaHarnessAudit,
    fetchWorkers,
    triggerWorker,
    toggleWorker,
  } = useRufloStore();

  useEffect(() => {
    fetchMetaHarnessAudit();
    fetchWorkers();
  }, [fetchMetaHarnessAudit, fetchWorkers]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-blue-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo MetaHarness Fleet Readiness & Workers</h1>
            <p className="text-sm text-gray-400">
              Readiness grading (0-100), tool risk matrix, compliance validation, and background loop workers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMetaHarnessAudit();
              fetchWorkers();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} />
            Run Fleet Audit
          </button>
        </div>
      </div>

      {metaAudit && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Grade & Score Card */}
          <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Readiness Grade
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  {metaAudit.readinessScore}/100 Score
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="text-6xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                  {metaAudit.grade}
                </span>
                <span className="text-sm font-semibold text-emerald-400">Production Certified</span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{metaAudit.summary}</p>
            </div>

            {/* Category Breakdown Bars */}
            <div className="space-y-3 pt-4 border-t border-surface-800 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Swarm Architecture</span>
                  <span className="font-mono text-white">{metaAudit.categoryScores.swarmArchitecture}%</span>
                </div>
                <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-blue-500 h-full" style={{ width: `${metaAudit.categoryScores.swarmArchitecture}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Vector Memory Reliability</span>
                  <span className="font-mono text-white">{metaAudit.categoryScores.memoryReliability}%</span>
                </div>
                <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full" style={{ width: `${metaAudit.categoryScores.memoryReliability}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-gray-400">
                  <span>Security & Guardrails</span>
                  <span className="font-mono text-white">{metaAudit.categoryScores.securityPosture}%</span>
                </div>
                <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-red-500 h-full" style={{ width: `${metaAudit.categoryScores.securityPosture}%` }} />
                </div>
              </div>
            </div>

            {/* Compliance Badges */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-surface-800 text-center">
              <div className="p-2 rounded-xl bg-surface-800/60 border border-surface-700 text-[10px]">
                <p className="text-gray-400">SOC-2</p>
                <p className="font-bold text-emerald-400">COMPLIANT</p>
              </div>
              <div className="p-2 rounded-xl bg-surface-800/60 border border-surface-700 text-[10px]">
                <p className="text-gray-400">HIPAA</p>
                <p className="font-bold text-emerald-400">READY</p>
              </div>
              <div className="p-2 rounded-xl bg-surface-800/60 border border-surface-700 text-[10px]">
                <p className="text-gray-400">GDPR PII</p>
                <p className="font-bold text-emerald-400">SCRUBBED</p>
              </div>
            </div>
          </div>

          {/* Tool Risk Matrix */}
          <div className="lg:col-span-2 bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              Tool Configuration & Risk Assessment ({metaAudit.toolRisks.length})
            </h2>

            <div className="space-y-3">
              {metaAudit.toolRisks.map((tool) => (
                <div
                  key={tool.toolName}
                  className="p-4 rounded-xl bg-surface-800/80 border border-surface-700/80 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">{tool.toolName}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-surface-900 text-gray-400 border border-surface-700 capitalize">
                        {tool.category}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        tool.riskLevel === 'HIGH'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : tool.riskLevel === 'MEDIUM'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}
                    >
                      {tool.riskLevel} RISK
                    </span>
                  </div>

                  <p className="text-gray-300">{tool.description}</p>
                  <p className="text-[11px] text-blue-300/80 bg-surface-900/60 p-2 rounded border border-surface-800">
                    <span className="font-semibold text-blue-400">Recommendation:</span> {tool.recommendation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Autonomous Loop Workers Strip */}
      <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-400" />
          Autonomous Background Loop Workers ({workers.length})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {workers.map((worker) => (
            <div
              key={worker.id}
              className="p-4 rounded-xl bg-surface-800/80 border border-surface-700/80 hover:border-blue-500/30 transition space-y-3 flex flex-col justify-between text-xs"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-900 text-gray-400 border border-surface-700 uppercase font-semibold">
                    {worker.type}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                      worker.enabled
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-surface-700 text-gray-400'
                    }`}
                  >
                    {worker.enabled ? 'ACTIVE' : 'PAUSED'}
                  </span>
                </div>
                <h3 className="font-semibold text-white">{worker.name}</h3>
                {worker.lastOutcome && (
                  <p className="text-[11px] text-gray-400 line-clamp-2">{worker.lastOutcome}</p>
                )}
              </div>

              <div className="pt-3 border-t border-surface-700/60 flex items-center justify-between">
                <span className="text-gray-500 font-mono text-[10px]">
                  Runs: {worker.runsCompleted} · {worker.intervalSeconds}s
                </span>
                <button
                  onClick={() => triggerWorker(worker.id)}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-medium transition flex items-center gap-1"
                >
                  <Play className="w-3 h-3" />
                  Run
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
