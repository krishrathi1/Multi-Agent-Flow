import { useState } from 'react';
import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Clock, FileCode, Check, Copy, ChevronRight, FileText, AlertCircle, Wrench } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';

/** Clean up markdown fences or quotes from summary strings */
function formatSummaryText(raw: string): string {
  let text = raw.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '').trim();
  }
  return text;
}

export function ActivityItem({ activity }: { activity: Activity }) {
  const [open, setOpen] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const tone = activityToneFor(activity.type);
  const Icon = activityIconFor(activity.type);
  const t = tones[tone];
  const agentName = activity.agent?.displayName || 'System / Mother Core';

  const metadata = activity.metadata as Record<string, unknown> | null | undefined;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  // Extract common smart fields
  const summary = typeof metadata?.summary === 'string' && metadata.summary.trim().length > 0 ? metadata.summary : null;
  const metadataFiles = Array.isArray(metadata?.files) ? (metadata.files as string[]).filter(Boolean) : [];
  const error = typeof metadata?.error === 'string' && metadata.error.trim().length > 0 ? metadata.error : null;
  const toolName = typeof metadata?.tool === 'string' && metadata.tool.trim().length > 0 ? metadata.tool : null;

  const otherKeys = hasMetadata
    ? Object.keys(metadata).filter((k) => !['summary', 'files', 'error', 'tool'].includes(k))
    : [];

  // Parse message for files if formatted as "lead — created file1, file2..."
  let messageLead = activity.message;
  let inlineFiles: string[] = [];
  if (activity.message.includes(' — created ')) {
    const [lead, fileListStr] = activity.message.split(' — created ');
    messageLead = lead;
    inlineFiles = fileListStr
      .replace(/\.$/, '')
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
  }

  const allFiles = [...new Set([...inlineFiles, ...metadataFiles])];
  const hasExpandableContent = Boolean(summary || error || toolName || otherKeys.length > 0);

  const handleCopyRaw = () => {
    if (!metadata) return;
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const labelText = (activity.type && activityLabel[activity.type]) ||
    (activity.type ? String(activity.type).replace(/_/g, ' ') : 'EVENT');

  return (
    <div className="overflow-hidden rounded-2xl border border-line-subtle bg-surface shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
      {/* Header Row */}
      {hasExpandableContent ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex w-full items-center gap-3 p-3.5 sm:p-4 text-left transition-colors hover:bg-hover/50 cursor-pointer"
        >
          <ChevronRight
            size={16}
            className={cn(
              'shrink-0 text-ink-muted transition-transform duration-200',
              open && 'rotate-90 text-brand-500',
            )}
            aria-hidden
          />

          <div className={cn(
            'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs',
            t.soft,
            t.text,
          )}>
            <Icon size={16} strokeWidth={2.2} />
          </div>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs sm:text-[13px] font-bold text-ink" title={agentName}>
              {agentName}
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-muted font-medium font-mono">
              <Clock size={11} className="text-ink-faint" />
              <span>{timeAgo(activity.createdAt)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs',
              t.soft,
              t.text,
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {labelText}
            </span>
          </div>
        </button>
      ) : (
        <div className="flex w-full items-center gap-3 p-3.5 sm:p-4 text-left">
          <div className={cn(
            'w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs',
            t.soft,
            t.text,
          )}>
            <Icon size={16} strokeWidth={2.2} />
          </div>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-xs sm:text-[13px] font-bold text-ink" title={agentName}>
              {agentName}
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 text-2xs text-ink-muted font-medium font-mono">
              <Clock size={11} className="text-ink-faint" />
              <span>{timeAgo(activity.createdAt)}</span>
            </div>
          </div>

          <div className="shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-2xs',
              t.soft,
              t.text,
            )}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {labelText}
            </span>
          </div>
        </div>
      )}

      {/* Message summary & files */}
      <div className="px-4 pb-3.5 pt-0 space-y-2.5">
        {/* Main Message */}
        <div className={cn('space-y-2', hasExpandableContent ? 'pl-7 sm:pl-7.5' : 'pl-12 sm:pl-12')}>
          <p className="text-xs leading-relaxed text-ink/90 font-medium break-words">
            {messageLead}
          </p>

          {/* Files List as Clean Badges */}
          {allFiles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Created:</span>
              {allFiles.map((file, fIdx) => (
                <span
                  key={fIdx}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-inset border border-line-subtle text-[11px] font-mono font-semibold text-ink shadow-2xs hover:border-brand-500/40 transition-colors"
                  title={file}
                >
                  <FileCode size={11} className="text-brand-500 shrink-0" />
                  <span className="truncate max-w-[240px]">{file}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible extra details */}
        {open && hasExpandableContent && (
          <div className="border-t border-line-subtle pt-3 pl-7 sm:pl-7.5 space-y-2.5 animate-scale-in">
            {/* Deliverable Summary Box */}
            {summary && (
              <div className="rounded-xl border border-line-subtle bg-inset/70 p-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                    <FileText size={12} className="text-brand-500" />
                    <span>Deliverable Summary</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formatSummaryText(summary));
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1800);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer py-0.5 px-2 rounded-lg bg-surface border border-line-subtle shadow-2xs"
                  >
                    {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <MarkdownRenderer content={summary} maxHeight="max-h-52 sm:max-h-60" />
              </div>
            )}

            {/* Tool Calls */}
            {toolName && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[11px] font-mono font-semibold">
                <Wrench size={11} />
                <span>{toolName}</span>
              </div>
            )}

            {/* Error Alert Box */}
            {error && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span className="break-words font-mono text-[11px]">{error}</span>
              </div>
            )}

            {/* Collapsible Raw Payload for debugging */}
            {hasMetadata && otherKeys.length > 0 && (
              <div className="pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRaw(!showRaw)}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer py-0.5"
                  >
                    <span>{showRaw ? '▼ Hide Raw Details' : '▶ View Raw Details'}</span>
                  </button>

                  {showRaw && (
                    <button
                      type="button"
                      onClick={handleCopyRaw}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer py-0.5 ml-2"
                    >
                      {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      <span>{copied ? 'Copied' : 'Copy JSON'}</span>
                    </button>
                  )}
                </div>

                {showRaw && (
                  <div className="mt-1.5 rounded-xl bg-inset/90 border border-line-subtle p-3 overflow-x-auto no-scrollbar">
                    <pre className="text-[11px] font-mono text-ink leading-relaxed font-medium">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


