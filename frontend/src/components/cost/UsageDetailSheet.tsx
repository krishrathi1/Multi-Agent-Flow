import { TokenUsage } from '@/types';
import { formatCompact, formatCurrency } from '@/lib/design';
import { timeAgo } from '@/lib/utils';
import { X, Cpu, Clock, Bot, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface UsageDetailSheetProps {
  usage: TokenUsage | null;
  onClose: () => void;
}

export function UsageDetailSheet({ usage, onClose }: UsageDetailSheetProps) {
  if (!usage) return null;

  const agentName = usage.agent?.displayName || usage.agent?.name || 'Autonomous Agent';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs animate-fade-in p-0 sm:p-4">
      {/* Backdrop click */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Sheet Container */}
      <div className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-line bg-surface p-5 sm:p-6 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Handle for mobile pull down */}
        <div className="w-12 h-1.5 rounded-full bg-line-strong mx-auto mb-4 sm:hidden" />

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line-subtle pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-brand-500/10 border border-brand-500/20 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
              <Cpu size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-ink truncate">
                Usage Details
              </h3>
              <p className="text-2xs font-mono text-ink-muted flex items-center gap-1.5 mt-0.5">
                <Clock size={11} />
                <span>{timeAgo(usage.createdAt)}</span>
                <span>•</span>
                <span>{new Date(usage.createdAt).toLocaleTimeString()}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-inset hover:bg-hover flex items-center justify-center text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
            aria-label="Close details"
          >
            <X size={16} />
          </button>
        </div>

        {/* Primary Stat: Cost */}
        <div className="my-5 rounded-2xl bg-inset/70 border border-line-subtle p-4 flex items-center justify-between">
          <div>
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">
              Estimated Spend
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatCurrency(usage.cost)}
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
            {formatCompact(usage.totalTokens)} tokens
          </span>
        </div>

        {/* Breakdown Grid */}
        <div className="space-y-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">
            Execution Breakdown
          </span>

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-3 rounded-xl bg-surface border border-line-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-ink-muted text-2xs font-bold uppercase">
                <ArrowDownRight size={12} className="text-brand-500" />
                <span>Input Tokens</span>
              </div>
              <p className="text-sm font-bold font-mono text-ink">
                {formatCompact(usage.inputTokens)}
              </p>
              <span className="text-[10px] text-ink-faint font-mono">
                {usage.inputTokens.toLocaleString()} prompt
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-line-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-ink-muted text-2xs font-bold uppercase">
                <ArrowUpRight size={12} className="text-emerald-500" />
                <span>Output Tokens</span>
              </div>
              <p className="text-sm font-bold font-mono text-ink">
                {formatCompact(usage.outputTokens)}
              </p>
              <span className="text-[10px] text-ink-faint font-mono">
                {usage.outputTokens.toLocaleString()} completion
              </span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-line-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-ink-muted text-2xs font-bold uppercase">
                <Cpu size={12} className="text-purple-500" />
                <span>Model Engine</span>
              </div>
              <p className="text-xs font-bold font-mono text-ink truncate" title={usage.model}>
                {usage.model}
              </p>
              <span className="text-[10px] text-ink-faint font-mono">LLM Provider</span>
            </div>

            <div className="p-3 rounded-xl bg-surface border border-line-subtle space-y-1">
              <div className="flex items-center gap-1.5 text-ink-muted text-2xs font-bold uppercase">
                <Bot size={12} className="text-amber-500" />
                <span>Assigned Agent</span>
              </div>
              <p className="text-xs font-bold text-ink truncate" title={agentName}>
                {agentName}
              </p>
              <span className="text-[10px] text-ink-faint font-mono truncate block">
                {usage.agentId.slice(0, 8)}...
              </span>
            </div>
          </div>
        </div>

        {/* Telemetry ID Footer */}
        <div className="mt-5 pt-3 border-t border-line-subtle flex items-center justify-between text-2xs text-ink-muted font-mono">
          <span>Record ID</span>
          <span className="text-ink-faint">{usage.id}</span>
        </div>
      </div>
    </div>
  );
}
