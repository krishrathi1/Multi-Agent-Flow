import React, { useEffect } from 'react';
import {
  Sparkles,
  Zap,
  TrendingUp,
  BrainCircuit,
  RefreshCw,
  GitMerge,
  Cpu,
  Layers,
  Award
} from 'lucide-react';
import { useRufloStore } from '../../stores/ruflo-store';

export function NeuralLearningHub() {
  const {
    neuralPatterns,
    learningStats,
    trajectories,
    fetchLearning,
  } = useRufloStore();

  useEffect(() => {
    fetchLearning();
  }, [fetchLearning]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-purple-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-purple-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo SONA Neural Learning & ReasoningBank</h1>
            <p className="text-sm text-gray-400">
              Trajectory learning, pattern mining, and dynamic prompt self-optimization based on real task runs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchLearning()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      {learningStats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 backdrop-blur space-y-1">
            <p className="text-xs text-gray-400">Total Trajectories Logged</p>
            <p className="text-2xl font-bold text-white">{learningStats.totalTrajectoriesRecorded}</p>
          </div>
          <div className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 backdrop-blur space-y-1">
            <p className="text-xs text-gray-400">Mined Neural Patterns</p>
            <p className="text-2xl font-bold text-purple-400">{learningStats.totalNeuralPatterns}</p>
          </div>
          <div className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 backdrop-blur space-y-1">
            <p className="text-xs text-gray-400">Average Task Success Score</p>
            <p className="text-2xl font-bold text-emerald-400">{learningStats.averageTrajectoryScore}%</p>
          </div>
          <div className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 backdrop-blur space-y-1">
            <p className="text-xs text-gray-400">Avg Optimization Gain</p>
            <p className="text-2xl font-bold text-cyan-400">+{learningStats.averageOptimizationGainPercent}%</p>
          </div>
        </div>
      )}

      {/* Neural Pattern Cards */}
      <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-purple-400" />
          Active ReasoningBank Patterns ({neuralPatterns.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {neuralPatterns.map((pat) => (
            <div
              key={pat.id}
              className="p-5 rounded-2xl bg-surface-800/80 border border-surface-700/80 hover:border-purple-500/40 transition space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 uppercase font-semibold">
                    {pat.patternType}
                  </span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">
                    +{pat.improvementGainPercent}% gain
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white">{pat.name}</h3>
                <p className="text-xs text-gray-400 line-clamp-3">{pat.description}</p>
              </div>

              <div className="pt-3 border-t border-surface-700/60 space-y-1.5 text-[11px]">
                <p className="text-gray-500">
                  <span className="text-gray-400 font-medium">Trigger:</span> {pat.triggerCondition}
                </p>
                <div className="flex items-center justify-between text-gray-500 pt-1">
                  <span>Confidence: {(pat.confidence * 100).toFixed(0)}%</span>
                  <span>Used: {pat.occurrenceCount} times</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trajectories Stream */}
      <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Layers className="w-5 h-5 text-purple-400" />
          Recent Task Trajectories ({trajectories.length})
        </h2>

        <div className="space-y-3">
          {trajectories.map((traj) => (
            <div
              key={traj.id}
              className="p-4 rounded-xl bg-surface-800/80 border border-surface-700/80 hover:border-purple-500/30 transition space-y-2.5 text-xs"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">{traj.agentName}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-900 text-gray-400 border border-surface-700">
                    {traj.taskType}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 font-mono">{traj.totalDurationMs}ms</span>
                  <span className="text-emerald-400 font-bold font-mono">Score: {traj.score}/100</span>
                </div>
              </div>

              <p className="text-gray-300 italic">"{traj.prompt}"</p>

              {/* Trajectory Steps */}
              <div className="flex flex-wrap gap-2 pt-1">
                {traj.steps.map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="px-2.5 py-1 rounded-lg bg-surface-900 border border-surface-700 text-[11px] text-gray-300 flex items-center gap-1.5 font-mono"
                  >
                    <span className="text-purple-400 font-bold">#{s.stepNumber}</span>
                    <span>{s.action}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
