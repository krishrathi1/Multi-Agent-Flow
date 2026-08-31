import React, { useEffect, useState } from 'react';
import {
  Target,
  GitBranch,
  Play,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
  ArrowDown,
  Sparkles,
  Zap,
  RotateCcw
} from 'lucide-react';
import { useRufloStore } from '../../stores/ruflo-store';

export function GoalPlannerStudio() {
  const {
    goals,
    activeGoal,
    isLoadingGoals,
    fetchGoals,
    createGoalPlan,
    executeGoalStep,
    executeAllGoalSteps,
  } = useRufloStore();

  const [rawGoalInput, setRawGoalInput] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handlePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawGoalInput.trim()) return;
    setIsPlanning(true);
    try {
      await createGoalPlan(rawGoalInput);
      setRawGoalInput('');
    } finally {
      setIsPlanning(false);
    }
  };

  const handleStepExecute = async (planId: string, idx: number) => {
    setIsExecuting(true);
    try {
      await executeGoalStep(planId, idx);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleExecuteAll = async (planId: string) => {
    setIsExecuting(true);
    try {
      await executeAllGoalSteps(planId);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-amber-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-amber-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo GOAP Goal Planner</h1>
            <p className="text-sm text-gray-400">
              Goal-Oriented Action Planning: Decompose high-level requirements into A* state graphs with dynamic replanning.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchGoals()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingGoals ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Goal Decomposition Input */}
      <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
        <form onSubmit={handlePlanSubmit} className="space-y-3">
          <label className="text-sm font-semibold text-white block">
            Declare High-Level Objective (Natural Language)
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="e.g. Build and deploy a real-time notification microservice with Redis Pub/Sub and automated unit tests"
              value={rawGoalInput}
              onChange={(e) => setRawGoalInput(e.target.value)}
              className="flex-1 bg-surface-800 border border-surface-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500"
            />
            <button
              type="submit"
              disabled={isPlanning || !rawGoalInput.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20"
            >
              {isPlanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Generate A* Plan Tree
            </button>
          </div>
        </form>
      </div>

      {/* Active Goal Plan Visualizer */}
      {activeGoal ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">{activeGoal.title}</h2>
                  <p className="text-xs text-gray-400 mt-1">{activeGoal.rawGoal}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase font-semibold">
                    {activeGoal.status}
                  </span>
                  <p className="text-xs text-gray-400 mt-1 font-mono">{activeGoal.progressPercent}% Complete</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-surface-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full transition-all duration-500"
                  style={{ width: `${activeGoal.progressPercent}%` }}
                />
              </div>

              {/* Action Graph Nodes */}
              <div className="space-y-4 pt-2">
                {activeGoal.nodes.map((node, idx) => (
                  <div
                    key={node.id}
                    className={`p-4 rounded-xl border transition space-y-3 ${
                      node.status === 'completed'
                        ? 'bg-surface-800/80 border-emerald-500/30'
                        : node.status === 'in_progress'
                        ? 'bg-amber-500/10 border-amber-500/40 animate-pulse'
                        : 'bg-surface-800/40 border-surface-700/60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                            node.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : node.status === 'in_progress'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-surface-700 text-gray-400'
                          }`}
                        >
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{node.name}</p>
                          <span className="text-xs text-gray-400 capitalize">Assigned: {node.agentRole}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono text-gray-400">Cost: {node.cost} tokens</span>
                        {node.status !== 'completed' && (
                          <button
                            onClick={() => handleStepExecute(activeGoal.id, idx)}
                            disabled={isExecuting}
                            className="px-3 py-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition flex items-center gap-1.5"
                          >
                            <Play className="w-3 h-3" />
                            Run Node
                          </button>
                        )}
                        {node.status === 'completed' && (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Done
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-gray-300 pl-10">{node.description}</p>
                    {node.output && (
                      <div className="ml-10 p-2.5 rounded-lg bg-surface-900 border border-surface-800 text-[11px] font-mono text-gray-300">
                        {node.output}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Execution Actions */}
              <div className="pt-4 border-t border-surface-800 flex items-center justify-end gap-3">
                <button
                  onClick={() => handleExecuteAll(activeGoal.id)}
                  disabled={isExecuting || activeGoal.status === 'completed'}
                  className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition flex items-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  <Zap className="w-4 h-4" />
                  Execute Full Plan
                </button>
              </div>
            </div>
          </div>

          {/* Goal List & State Predicates */}
          <div className="space-y-6">
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="text-md font-semibold text-white flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-amber-400" />
                Goal Plans ({goals.length})
              </h3>
              <div className="space-y-2">
                {goals.map((g) => (
                  <button
                    key={g.id}
                    className={`w-full p-3 rounded-xl border text-left transition space-y-1 ${
                      activeGoal.id === g.id
                        ? 'bg-amber-500/15 border-amber-500/40 text-white'
                        : 'bg-surface-800/60 border-surface-700 text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <p className="font-semibold text-sm line-clamp-1">{g.title}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="capitalize">{g.status}</span>
                      <span className="font-mono">{g.nodes.length} nodes</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-surface-900 border border-surface-800 rounded-2xl">
          <p className="text-gray-400">No active goal plans found. Enter a goal above to generate an A* plan tree.</p>
        </div>
      )}
    </div>
  );
}
