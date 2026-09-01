import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Cloud,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Wrench,
  Zap,
  Copy,
  Check,
  Sparkles,
  Bot,
  UserPlus,
  X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import type { Process } from '@/types';

interface DeploymentLogData {
  deploymentId?: string;
  name: string;
  state: 'QUEUED' | 'BUILDING' | 'INITIALIZING' | 'READY' | 'ERROR' | 'UNKNOWN';
  previewUrl?: string;
  logs: Array<{ date: number; text: string; type: string }>;
  diagnosis?: string;
  error?: string;
}

export function DeploymentLogsModal({
  process,
  isOpen,
  onClose,
}: {
  process: Process | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [data, setData] = useState<DeploymentLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [healing, setHealing] = useState(false);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiFixResult, setAiFixResult] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    if (!process?.id) return;
    try {
      const res = await api.processes.deploymentLogs(process.id);
      setData(res);
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [process?.id]);

  useEffect(() => {
    if (!isOpen || !process?.id) return;
    setLoading(true);
    fetchLogs();

    if (!autoRefresh) return;
    const timer = setInterval(fetchLogs, 4000);
    return () => clearInterval(timer);
  }, [isOpen, process?.id, fetchLogs, autoRefresh]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [data?.logs]);

  const handleAutoHeal = async () => {
    if (!process?.id || healing) return;
    setHealing(true);
    try {
      await api.processes.autoHeal(process.id);
      await fetchLogs();
    } catch (err: any) {
      console.error('Auto heal error:', err);
    } finally {
      setHealing(false);
    }
  };

  const handleAskAiFix = async () => {
    if (!process?.id || aiAnalyzing) return;
    setAiAnalyzing(true);
    setAiFixResult(null);
    try {
      const res = await api.processes.askAiFix(process.id);
      setAiFixResult(res);
      await fetchLogs();
    } catch (err: any) {
      console.error('Ask AI Fix error:', err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleCopyLogs = () => {
    if (!data?.logs) return;
    const text = data.logs.map((l) => l.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen || !process) return null;

  const state = data?.state || 'UNKNOWN';
  const filteredLogs = (data?.logs || []).filter((l) =>
    filterQuery ? l.text.toLowerCase().includes(filterQuery.toLowerCase()) : true
  );

  const getStateBadge = () => {
    switch (state) {
      case 'READY':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={13} className="text-emerald-500" />
            LIVE & READY
          </span>
        );
      case 'BUILDING':
      case 'INITIALIZING':
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            <RefreshCw size={13} className="animate-spin text-indigo-500" />
            {state}
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertTriangle size={13} className="text-rose-500" />
            BUILD ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-slate-800 text-slate-400 border border-slate-700">
            {state}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-900/95 text-slate-100 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-600/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Cloud size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Cloud Deployment & Live Logs
                </h2>
                {getStateBadge()}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Target: <span className="font-mono text-slate-300 font-semibold">{process.name}</span> · Vercel & GitHub Cloud Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'px-2.5 py-1 rounded-xl text-2xs font-bold border transition-all cursor-pointer flex items-center gap-1.5',
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
              Auto-Stream
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* AI DevOps Diagnosis Card */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
                <Bot size={15} />
                <span>DevOps Auto-Healer Intelligence</span>
              </div>
              {data?.previewUrl && (
                <a
                  href={data.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 underline"
                >
                  <span>Open Live URL</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <p className="text-xs text-slate-200 leading-relaxed font-medium">
              {data?.diagnosis || 'Monitoring cloud build pipeline in real time.'}
            </p>

            {/* If an agent was recruited by Ask AI */}
            {aiFixResult?.agentSpawned && (
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs text-indigo-300 animate-scale-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">{aiFixResult.agentSpawned.avatar || '🤖'}</span>
                  <div>
                    <p className="font-bold text-white flex items-center gap-1.5">
                      <span>Recruited: {aiFixResult.agentSpawned.displayName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-[10px] font-mono text-indigo-300">
                        Stage {aiFixResult.agentSpawned.processStage}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">{aiFixResult.agentSpawned.processRole}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-2xs font-bold shrink-0">
                  ✓ Task Dispatched
                </span>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Filter logs (e.g., error, build, vite)..."
                className="w-full max-w-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <span className="text-2xs font-mono text-slate-500">
                {filteredLogs.length} events
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary"
                size="xs"
                icon={copied ? Check : Copy}
                onClick={handleCopyLogs}
              >
                {copied ? 'Copied' : 'Copy Logs'}
              </Button>

              <Button
                variant="secondary"
                size="xs"
                icon={RefreshCw}
                loading={loading}
                onClick={fetchLogs}
              >
                Refresh
              </Button>

              {/* Ask AI Agent Specialist Button */}
              <Button
                variant="primary"
                size="xs"
                icon={Sparkles}
                loading={aiAnalyzing}
                onClick={handleAskAiFix}
                className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-extrabold shadow-md shadow-indigo-500/20"
              >
                {aiAnalyzing ? 'AI Diagnosing & Recruiting...' : 'Ask AI: Analyze & Recruit Agent'}
              </Button>

              <Button
                variant="secondary"
                size="xs"
                icon={Wrench}
                loading={healing}
                onClick={handleAutoHeal}
                className="text-indigo-400 border-indigo-500/30 hover:bg-indigo-500/10 font-bold"
              >
                {healing ? 'Healing...' : 'Fast Heal'}
              </Button>
            </div>
          </div>

          {/* Live Terminal Window */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-xs shadow-inner">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-2xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Terminal size={12} className="text-indigo-400" />
                Vercel CLI & Build Stream
              </span>
              <span>{data?.deploymentId ? 'ID: ' + data.deploymentId.slice(0, 14) + '...' : 'Connecting...'}</span>
            </div>

            <div
              ref={logContainerRef}
              className="h-[320px] overflow-y-auto space-y-1 pr-2 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {loading && filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  <RefreshCw size={14} className="animate-spin mr-2" />
                  Streaming live deployment events...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-slate-600 text-center py-12">
                  No log events matching filter.
                </div>
              ) : (
                filteredLogs.map((log, idx) => {
                  const isError = log.type === 'stderr' || log.text.toLowerCase().includes('error');
                  const isSuccess = log.text.includes('✓') || log.text.includes('built in') || log.text.includes('ready');
                  return (
                    <div
                      key={idx}
                      className={cn(
                        'py-0.5 px-1.5 rounded leading-relaxed text-[11px] break-all font-mono',
                        isError
                          ? 'bg-rose-500/10 text-rose-300 border-l-2 border-rose-500'
                          : isSuccess
                          ? 'text-emerald-300 font-semibold'
                          : 'text-slate-300'
                      )}
                    >
                      <span className="text-slate-600 mr-2 text-[10px] select-none">
                        [{new Date(log.date).toLocaleTimeString()}]
                      </span>
                      {log.text}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-950/50 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-400" />
            <span>Zero-Error Autonomous Engine active · Dynamic Agent Recruiter Online</span>
          </div>
          <Button variant="secondary" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
