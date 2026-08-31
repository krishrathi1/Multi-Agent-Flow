import { useState } from 'react';
import type { Activity } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { activityIconFor, activityToneFor, activityLabel, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';
import { Clock, FileCode, Check, Copy, ChevronDown, ChevronUp, FileText, AlertCircle, Wrench } from 'lucide-react';

/** Clean up markdown fences or quotes from summary strings */
function formatSummaryText(raw: string): string {
  let text = raw.trim();
  // If it's wrapped in triple backticks e.g. ```json { ... } ``` or ```typescript ... ```
  if (text.startsWith('```')) {
    text = text.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/```$/, '').trim();
  }
  return text;
}

export function ActivityItem({ activity }: { activity: Activity }) {
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const tone = activityToneFor(activity.type);
  const Icon = activityIconFor(activity.type);
  const t = tones[tone];
  const agentName = activity.agent?.displayName || 'System / Mother Core';
  const agentAvatar = activity.agent?.avatar;

  const metadata = activity.metadata as Record<string, unknown> | null | undefined;
  const hasMetadata = metadata && Object.keys(metadata).length > 0;

  // Extract common smart fields
  const summary = typeof metadata?.summary === 'string' ? metadata.summary : null;
  const files = Array.isArray(metadata?.files) ? (metadata.files as string[]).filter(Boolean) : [];
  const error = typeof metadata?.error === 'string' ? metadata.error : null;
  const toolName = typeof metadata?.tool === 'string' ? metadata.tool : null;

  // Check if there are other keys beyond the handled smart fields
  const otherKeys = hasMetadata
    ? Object.keys(metadata).filter((k) => !['summary', 'files', 'error', 'tool'].includes(k))
    : [];

  const handleCopyRaw = () => {
    if (!metadata) return;
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div
      className={cn(
        'group relative flex items-start gap-3.5 rounded-2xl border border-line-subtle',
        'bg-inset/45 p-4 transition-all duration-150 hover:bg-inset/80 hover:border-line hover:shadow-xs shadow-2xs',
      )}
    >
      {/* Type icon badge */}
      <span
        className={cn(
          'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border shadow-2xs',
          t.soft,
          t.text,
        )}
      >
        <Icon size={15} strokeWidth={2.2} aria-hidden />
      </span>

      <div className="min-w-0 flex-1 space-y-2">
        {/* Top Header: Agent Avatar + Name + Type Badge + Time */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar
              name={agentName}
              emoji={agentAvatar}
              size="xs"
            />
            <span className="text-xs font-bold text-ink truncate">
              {agentName}
            </span>
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                t.soft,
                t.text,
              )}
            >
              {(activity.type && activityLabel[activity.type]) ||
                (activity.type ? String(activity.type).replace(/_/g, ' ') : 'EVENT')}
            </span>
          </div>

          <time
            className="shrink-0 whitespace-nowrap text-2xs tabular-nums text-ink-muted font-mono font-medium flex items-center gap-1"
            dateTime={activity.createdAt}
          >
            <Clock size={11} className="text-ink-faint" />
            {timeAgo(activity.createdAt)}
          </time>
        </div>

        {/* Message Content */}
        <p className="text-xs leading-relaxed text-ink font-medium break-words">
          {activity.message}
        </p>

        {/* Smart Deliverable / Output Summary Card */}
        {summary && (
          <div className="mt-2.5 rounded-xl bg-inset/70 border border-line-subtle p-3 space-y-1.5 transition-all">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                <FileText size={12} className="text-brand-500" />
                <span>Deliverable Summary</span>
              </div>
            </div>
            <p className="text-xs text-ink/90 font-sans leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto pr-1">
              {formatSummaryText(summary)}
            </p>
          </div>
        )}

        {/* Touched Files Pill List */}
        {files.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Files:</span>
            {files.map((file, fIdx) => (
              <span
                key={fIdx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-inset border border-line-subtle text-[11px] font-mono font-semibold text-ink"
              >
                <FileCode size={11} className="text-brand-500 shrink-0" />
                <span className="truncate max-w-[200px]">{file}</span>
              </span>
            ))}
          </div>
        )}

        {/* Tool Call Badge */}
        {toolName && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 text-[11px] font-mono font-semibold">
            <Wrench size={11} />
            <span>{toolName}</span>
          </div>
        )}

        {/* Error Alert Box */}
        {error && (
          <div className="mt-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-2.5 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span className="break-words font-mono text-[11px]">{error}</span>
          </div>
        )}

        {/* Collapsible Raw Payload for debugging / deep inspection */}
        {hasMetadata && (otherKeys.length > 0 || (!summary && !error)) && (
          <div className="pt-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRaw(!showRaw)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-ink-muted hover:text-ink transition-colors cursor-pointer py-0.5"
              >
                {showRaw ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                <span>{showRaw ? 'Hide Raw Details' : 'View Raw Details'}</span>
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
    </div>
  );
}


