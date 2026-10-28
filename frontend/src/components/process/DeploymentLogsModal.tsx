import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { cn } from '@/lib/utils';
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

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
            LIVE &amp; READY
          </span>
        );
      case 'BUILDING':
      case 'INITIALIZING':
      case 'QUEUED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-brand-500/10 text-brand-700 dark:text-brand-400 border border-brand-500/25">
            <RefreshCw size={13} className="animate-spin text-brand-600 dark:text-brand-400" />
            {state}
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/25">
            <AlertTriangle size={13} className="text-rose-600 dark:text-rose-400" />
            BUILD ERROR
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-inset text-ink-muted border border-line">
            {state}
          </span>
        );
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Background Scrim */}
      <div
        className="absolute inset-0 animate-fade-in bg-black/65 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-line bg-surface text-ink shadow-e4 overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-line-subtle bg-surface">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
              <Cloud size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-ink tracking-tight">
                  Cloud Deployment &amp; Live Logs
                </h2>
                {getStateBadge()}
              </div>
              <p className="text-xs text-ink-subtle mt-0.5">
                Target: <span className="font-mono text-ink font-semibold">{process.name}</span> · Vercel &amp; GitHub Cloud Pipeline
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-2xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs',
                autoRefresh
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-inset border-line text-ink-muted hover:text-ink'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-emerald-500 animate-pulse' : 'bg-ink-faint')} />
              Auto-Stream
            </button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={X}
              onClick={onClose}
              aria-label="Close dialog"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* AI DevOps Diagnosis Card */}
          <div className="p-4 rounded-xl bg-brand-50/60 dark:bg-brand-950/20 border border-brand-200/80 dark:border-brand-500/25 space-y-2.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-brand-700 dark:text-brand-400 uppercase tracking-wider">
                <Bot size={15} />
                <span>DevOps Auto-Healer Intelligence</span>
              </div>
              {data?.previewUrl && (
                <a
                  href={data.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 underline underline-offset-2"
                >
                  <span>Open Live URL</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
            <p className="text-xs text-ink-muted leading-relaxed font-medium">
              {data?.diagnosis || 'Monitoring cloud build pipeline in real time.'}
            </p>

            {/* If an agent was recruited by Ask AI */}
            {aiFixResult?.agentSpawned && (
              <div className="p-3 rounded-lg bg-surface border border-brand-300/60 dark:border-brand-500/30 flex items-center justify-between gap-3 text-xs text-ink shadow-2xs animate-scale-in">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-lg">{aiFixResult.agentSpawned.avatar || '🤖'}</span>
                  <div>
                    <p className="font-bold text-ink flex items-center gap-1.5">
                      <span>Recruited: {aiFixResult.agentSpawned.displayName}</span>
                      <span className="px-1.5 py-0.5 rounded bg-brand-500/10 text-[10px] font-mono text-brand-700 dark:text-brand-300 border border-brand-500/20">
                        Stage {aiFixResult.agentSpawned.processStage}
                      </span>
                    </p>
                    <p className="text-[11px] text-ink-subtle">{aiFixResult.agentSpawned.processRole}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-2xs font-bold shrink-0">
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
                className="w-full max-w-xs bg-canvas border border-line rounded-lg px-3 py-1.5 text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors"
              />
              <span className="text-2xs font-mono text-ink-subtle">
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
                className="bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white font-bold shadow-sm"
              >
                {aiAnalyzing ? 'AI Diagnosing & Recruiting...' : 'Ask AI: Analyze & Recruit Agent'}
              </Button>

              <Button
                variant="secondary"
                size="xs"
                icon={Wrench}
                loading={healing}
                onClick={handleAutoHeal}
                className="text-brand-600 dark:text-brand-400 border-brand-500/30 hover:bg-brand-500/10 font-semibold"
              >
                {healing ? 'Healing...' : 'Fast Heal'}
              </Button>
            </div>
          </div>

          {/* Live Terminal Window */}
          <div className="rounded-xl border border-line-subtle bg-slate-950 shadow-inner overflow-hidden">
            <div className="flex items-center justify-between px-3.5 py-2 border-b border-slate-800 bg-slate-900/90 text-2xs font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-1 select-none">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                </div>
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <Terminal size={12} className="text-brand-400" />
                  Vercel CLI &amp; Build Stream
                </span>
              </div>
              <span className="text-slate-400 font-mono">
                {data?.deploymentId ? 'ID: ' + data.deploymentId.slice(0, 14) + '...' : 'Connecting...'}
              </span>
            </div>

            <div
              ref={logContainerRef}
              className="h-[320px] overflow-y-auto space-y-1 p-3.5 scrollbar-thin scrollbar-thumb-slate-800"
            >
              {loading && filteredLogs.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  <RefreshCw size={14} className="animate-spin mr-2 text-brand-400" />
                  Streaming live deployment events...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-slate-500 text-center py-12">
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
                          ? 'bg-rose-500/15 text-rose-300 border-l-2 border-rose-500'
                          : isSuccess
                          ? 'text-emerald-300 font-semibold'
                          : 'text-slate-300'
                      )}
                    >
                      <span className="text-slate-500 mr-2 text-[10px] select-none">
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
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-line-subtle bg-surface text-xs text-ink-subtle">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
            <span>Zero-Error Autonomous Engine active · Dynamic Agent Recruiter Online</span>
          </div>
          <Button variant="secondary" size="xs" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
