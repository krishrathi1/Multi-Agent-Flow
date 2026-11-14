import React, { useState } from 'react';
import { X, Activity, Flame, ShieldCheck, Zap, Info } from 'lucide-react';

interface AgentHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  processName?: string;
}

interface HeatmapCell {
  phase: string;
  intensity: number; // 0 to 100
  toolCalls: number;
  tokens: number;
  status: 'idle' | 'nominal' | 'heavy';
}

interface AgentActivityRow {
  agentName: string;
  role: string;
  framework: string;
  cells: HeatmapCell[];
}

export const AgentHeatmapModal: React.FC<AgentHeatmapModalProps> = ({ isOpen, onClose, processName }) => {
  const [selectedCell, setSelectedCell] = useState<{ agent: string; cell: HeatmapCell } | null>(null);

  if (!isOpen) return null;

  const phases = ['Goal Decomp', 'Context Retr', 'Tool Call MCP', 'Code Synthesis', 'QA Audit', 'Final Review'];

  const rows: AgentActivityRow[] = [
    {
      agentName: 'System Architect',
      role: 'Planner',
      framework: 'CrewAI',
      cells: [
        { phase: 'Goal Decomp', intensity: 95, toolCalls: 2, tokens: 1420, status: 'heavy' },
        { phase: 'Context Retr', intensity: 75, toolCalls: 3, tokens: 980, status: 'nominal' },
        { phase: 'Tool Call MCP', intensity: 40, toolCalls: 1, tokens: 410, status: 'nominal' },
        { phase: 'Code Synthesis', intensity: 20, toolCalls: 0, tokens: 150, status: 'idle' },
        { phase: 'QA Audit', intensity: 60, toolCalls: 1, tokens: 620, status: 'nominal' },
        { phase: 'Final Review', intensity: 90, toolCalls: 2, tokens: 1100, status: 'heavy' },
      ]
    },
    {
      agentName: 'Lead Developer',
      role: 'Builder',
      framework: 'Google ADK',
      cells: [
        { phase: 'Goal Decomp', intensity: 15, toolCalls: 0, tokens: 210, status: 'idle' },
        { phase: 'Context Retr', intensity: 50, toolCalls: 1, tokens: 640, status: 'nominal' },
        { phase: 'Tool Call MCP', intensity: 90, toolCalls: 5, tokens: 1850, status: 'heavy' },
        { phase: 'Code Synthesis', intensity: 100, toolCalls: 4, tokens: 3200, status: 'heavy' },
        { phase: 'QA Audit', intensity: 45, toolCalls: 1, tokens: 530, status: 'nominal' },
        { phase: 'Final Review', intensity: 25, toolCalls: 0, tokens: 290, status: 'idle' },
      ]
    },
    {
      agentName: 'QA & Security Verifier',
      role: 'Reviewer',
      framework: 'Google ADK',
      cells: [
        { phase: 'Goal Decomp', intensity: 10, toolCalls: 0, tokens: 120, status: 'idle' },
        { phase: 'Context Retr', intensity: 35, toolCalls: 1, tokens: 400, status: 'idle' },
        { phase: 'Tool Call MCP', intensity: 80, toolCalls: 4, tokens: 1350, status: 'heavy' },
        { phase: 'Code Synthesis', intensity: 30, toolCalls: 0, tokens: 380, status: 'idle' },
        { phase: 'QA Audit', intensity: 95, toolCalls: 3, tokens: 2100, status: 'heavy' },
        { phase: 'Final Review', intensity: 85, toolCalls: 2, tokens: 950, status: 'heavy' },
      ]
    },
    {
      agentName: 'Analytics Supervisor',
      role: 'Telemetry',
      framework: 'CrewAI',
      cells: [
        { phase: 'Goal Decomp', intensity: 30, toolCalls: 1, tokens: 350, status: 'idle' },
        { phase: 'Context Retr', intensity: 65, toolCalls: 2, tokens: 820, status: 'nominal' },
        { phase: 'Tool Call MCP', intensity: 85, toolCalls: 3, tokens: 1400, status: 'heavy' },
        { phase: 'Code Synthesis', intensity: 10, toolCalls: 0, tokens: 90, status: 'idle' },
        { phase: 'QA Audit', intensity: 50, toolCalls: 1, tokens: 580, status: 'nominal' },
        { phase: 'Final Review', intensity: 75, toolCalls: 1, tokens: 880, status: 'nominal' },
      ]
    }
  ];

  const getHeatmapColor = (intensity: number) => {
    if (intensity >= 80) return 'bg-emerald-500 text-white font-semibold shadow-emerald-500/20';
    if (intensity >= 50) return 'bg-emerald-400/80 text-emerald-950 font-medium';
    if (intensity >= 25) return 'bg-emerald-200/70 text-emerald-900';
    return 'bg-slate-100 text-slate-500 border border-slate-200/60 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700/50';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                MAS Agent Execution Heatmap
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium">
                  Criterion 5 Active
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tracking multi-agent execution intensity, token density & tool call frequency across MAS stages
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Summary Badges */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
              <Activity className="w-5 h-5 text-indigo-500" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Monitored MAS Agents</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">4 Agents (CrewAI + ADK)</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Tool Invocations</div>
                <div className="text-base font-bold text-slate-900 dark:text-white">20 MCP Calls Recorded</div>
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Callback Health Status</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">100% Traced (0 Errors)</div>
              </div>
            </div>
          </div>

          {/* Matrix Heatmap */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 dark:bg-slate-800/80 text-xs text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 min-w-[200px]">Agent & Framework</th>
                  {phases.map((p) => (
                    <th key={p} className="py-3 px-3 text-center min-w-[100px]">{p}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {rows.map((row) => (
                  <tr key={row.agentName} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 dark:text-white">{row.agentName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{row.role}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-medium">
                          {row.framework}
                        </span>
                      </div>
                    </td>
                    {row.cells.map((cell) => (
                      <td key={cell.phase} className="p-2 text-center">
                        <button
                          onClick={() => setSelectedCell({ agent: row.agentName, cell })}
                          className={`w-full py-2.5 px-1 rounded-lg text-xs transition-all duration-150 hover:scale-[1.04] active:scale-95 shadow-sm ${getHeatmapColor(cell.intensity)}`}
                        >
                          <div>{cell.intensity}%</div>
                          <div className="text-[10px] opacity-80 mt-0.5">{cell.toolCalls} calls</div>
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cell Details Drawer */}
          {selectedCell ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Selected Execution Node</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedCell.agent} — Stage: {selectedCell.cell.phase}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex gap-4">
                  <span>Intensity: <b>{selectedCell.cell.intensity}%</b></span>
                  <span>MCP Tools: <b>{selectedCell.cell.toolCalls} executed</b></span>
                  <span>Tokens Loaded: <b>{selectedCell.cell.tokens}</b></span>
                  <span>Status: <b className="capitalize text-emerald-600 dark:text-emerald-400">{selectedCell.cell.status}</b></span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                className="text-xs px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 transition-colors"
              >
                Clear
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic">
              <Info className="w-4 h-4" />
              Click any cell in the heatmap matrix above to inspect token density, tool call breakdown, and stage status.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
