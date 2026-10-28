import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Check,
  CheckCircle2,
  Coins,
  Copy,
  Download,
  FileCode,
  FileText,
  FolderTree,
  Info,
  Layers,
  ListChecks,
  Printer,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Terminal,
  Users,
  XCircle,
} from 'lucide-react';
import { api, fetchWithAuth } from '../../lib/api';
import type { Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Spinner } from '../ui/States';
import { useToast } from '../ui/Toast';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { cn } from '../../lib/utils';

/**
 * Production report. Shows only what the backend found in the workspace, run
 * history and git data — the previous version filled every gap with sample
 * endpoints, env vars, models, telemetry and "VERIFIED" checks, so a report
 * could describe a project nobody built.
 */

type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

interface Report {
  processId: string;
  processName: string;
  generatedAt: string;
  goal: string;
  status: string;
  models: string[];
  summary?: string;
  run: { state: string; startedAt: string; finishedAt: string | null; durationMs: number | null; totalTokens: number; totalCostUsd: number; error: string | null } | null;
  runsTotal: number;
  runsCompleted: number;
  usage: { totalTokens: number; totalCostUsd: number };
  stages: Array<{ stage: number; agent: string; role: string; state: string; durationMs: number | null; tokens: number | null; costUsd: number | null; files: string[]; outcome: string }>;
  stack: { languages: Array<{ name: string; lines: number; files: number; percent: number }>; dependencies: string[]; packageManager: string | null; totalFiles: number; totalLines: number; totalBytes: number };
  howToRun: { prerequisites: string[]; steps: Array<{ label: string; command: string }>; notes: string[] };
  apiEndpoints: Array<{ method: string; path: string; file: string }>;
  envVariables: Array<{ key: string; example: string | null; source: string }>;
  dataModels: Array<{ name: string; file: string; fields: Array<{ name: string; type: string; optional: boolean }> }>;
  files: Array<{ path: string; language: string; lines: number; bytes: number; description: string }>;
  git: {
    local: { branch: string; latestCommit: string; author: string; date: string; commitMessage: string; diffStat: string | null; commitCount: number } | null;
    github: { repoUrl: string; commitSha: string | null; branch: string; at: string } | null;
    targetRepo: string | null;
  };
  checks: Array<{ name: string; status: CheckStatus; detail: string }>;
  markdown: string;
}

type TabKey = 'overview' | 'run' | 'agents' | 'files' | 'checks' | 'markdown';

interface ProcessReportModalProps {
  process: Process;
  open: boolean;
  onClose: () => void;
}

const LIVE_STATES = new Set(['RUNNING', 'QUEUED', 'AWAITING_APPROVAL']);

const CHECK_STYLE: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: 'text-emerald-600 dark:text-emerald-400', label: 'Pass' },
  warn: { icon: AlertTriangle, className: 'text-amber-600 dark:text-amber-400', label: 'Needs attention' },
  fail: { icon: XCircle, className: 'text-red-600 dark:text-red-400', label: 'Problem' },
  info: { icon: Info, className: 'text-ink-muted', label: 'Info' },
};

const STATE_BADGE: Record<string, { tone: 'success' | 'danger' | 'info' | 'warning' | 'neutral'; label: string }> = {
  COMPLETED: { tone: 'success', label: 'Completed' },
  FAILED: { tone: 'danger', label: 'Failed' },
  RUNNING: { tone: 'info', label: 'Running' },
  QUEUED: { tone: 'info', label: 'Queued' },
  AWAITING_APPROVAL: { tone: 'warning', label: 'Awaiting approval' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
  NOT_RUN: { tone: 'neutral', label: 'Not run' },
  NO_RUN: { tone: 'neutral', label: 'Not run' },
};

function formatDuration(ms: number | null): string {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
const formatBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'production';

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function StateBadge({ state }: { state: string }) {
  const s = STATE_BADGE[state] ?? { tone: 'neutral' as const, label: state.toLowerCase().replace(/_/g, ' ') };
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

function Section({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{title}</h3>
        <div className="h-px flex-1 bg-line-subtle" />
      </div>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: any;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5 min-w-0 shadow-2xs hover:border-line-strong transition-all">
      <div className="flex items-center justify-between gap-1.5 mb-1.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{label}</span>
        {Icon && (
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-inset text-brand-600 dark:text-brand-400">
            <Icon size={13} />
          </span>
        )}
      </div>
      <div className="text-base font-bold text-ink truncate">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-muted truncate font-medium">{sub}</div>}
    </div>
  );
}

function CommandBlock({ command, onCopy }: { command: string; onCopy: (text: string) => void }) {
  return (
    <div className="group relative rounded-lg bg-slate-950 text-slate-100">
      <pre className="overflow-x-auto px-3.5 py-2.5 pr-10 text-[12px] leading-relaxed font-mono whitespace-pre">{command}</pre>
      <button
        type="button"
        onClick={() => onCopy(command)}
        className="absolute right-1.5 top-1.5 rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer"
        aria-label="Copy command"
      >
        <Copy size={13} />
      </button>
    </div>
  );
}

export function ProcessReportModal({ process, open, onClose }: ProcessReportModalProps) {
  const toast = useToast();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<TabKey>('overview');
  const [copied, setCopied] = useState(false);
  const [fileQuery, setFileQuery] = useState('');
  const [rawMarkdown, setRawMarkdown] = useState(false);
  const [preview, setPreview] = useState<{ path: string; content: string } | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      setReport(await api.processes.report(process.id));
      setError(null);
    } catch (err) {
      if (!quiet) setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }, [process.id]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setTab('overview');
    setPreview(null);
    load(true).finally(() => setLoading(false));
  }, [open, load]);

  // The report reads every file, so it only refreshes on its own while a run
  // is in progress (the old modal rebuilt it every 3.5s regardless).
  const live = !!report?.run && LIVE_STATES.has(report.run.state);
  useEffect(() => {
    if (!open || !live) return;
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, [open, live, load]);

  const copy = (text: string, what = 'Copied') => {
    navigator.clipboard.writeText(text).then(
      () => toast.success(what),
      () => toast.error('Copy failed', 'Your browser blocked clipboard access.'),
    );
  };

  const copyMarkdown = () => {
    if (!report) return;
    copy(report.markdown, 'Report copied as Markdown');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadMarkdown = () => report && saveBlob(new Blob([report.markdown], { type: 'text/markdown' }), `${slug(report.processName)}-report.md`);
  const downloadJson = () => {
    if (!report) return;
    const { markdown: _md, ...data } = report;
    saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${slug(report.processName)}-report.json`);
  };

  const downloadZip = async () => {
    try {
      const res = await fetchWithAuth(`/processes/${process.id}/artifacts.zip`);
      saveBlob(await res.blob(), `${slug(process.name)}.zip`);
    } catch (err) {
      toast.error('Download failed', (err as Error).message);
    }
  };

  const openPrintView = async () => {
    // Open the tab synchronously so the popup isn't blocked, then fill it.
    const tabRef = window.open('', '_blank');
    try {
      const res = await fetchWithAuth(`/processes/${process.id}/report/html`);
      const url = URL.createObjectURL(new Blob([await res.text()], { type: 'text/html' }));
      if (tabRef) tabRef.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      tabRef?.close();
      toast.error('Could not open the printable report', (err as Error).message);
    }
  };

  const openFile = async (path: string) => {
    try {
      const res = await api.processes.fileContent(process.id, path);
      setPreview({ path, content: res.content });
    } catch (err) {
      toast.error('Could not open file', (err as Error).message);
    }
  };

  const files = useMemo(() => {
    const q = fileQuery.trim().toLowerCase();
    const list = [...(report?.files ?? [])].sort((a, b) => a.path.localeCompare(b.path));
    return q ? list.filter((f) => f.path.toLowerCase().includes(q) || f.description.toLowerCase().includes(q)) : list;
  }, [report, fileQuery]);

  const stages = useMemo(() => [...(report?.stages ?? [])].sort((a, b) => a.stage - b.stage), [report]);
  const checkCounts = useMemo(() => {
    const c = { pass: 0, warn: 0, fail: 0, info: 0 };
    for (const k of report?.checks ?? []) c[k.status]++;
    return c;
  }, [report]);

  const tabs: Array<{ key: TabKey; label: string; icon: typeof FileText; count?: number }> = [
    { key: 'overview', label: 'Overview', icon: FileText },
    { key: 'run', label: 'How to run', icon: Terminal },
    { key: 'agents', label: 'Agents', icon: Users, count: report?.stages.length },
    { key: 'files', label: 'Files', icon: FolderTree, count: report?.files.length },
    { key: 'checks', label: 'Checks', icon: ListChecks, count: report ? checkCounts.warn + checkCounts.fail || undefined : undefined },
    { key: 'markdown', label: 'Markdown', icon: FileCode },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Report — ${process.name}`}
      description="What this production built, how to run it, and what each agent did."
      size="xl"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" icon={RefreshCw} onClick={() => load()} disabled={refreshing || loading}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={copied ? Check : Copy} onClick={copyMarkdown} disabled={!report}>
              {copied ? 'Copied' : 'Copy Markdown'}
            </Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadMarkdown} disabled={!report}>.md</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadJson} disabled={!report}>.json</Button>
            <Button variant="secondary" size="sm" icon={Download} onClick={downloadZip} disabled={!report?.files.length}>Code .zip</Button>
            <Button variant="primary" size="sm" icon={Printer} onClick={openPrintView} disabled={!report}>Print / PDF</Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Spinner size={26} />
          <p className="mt-3 text-xs text-ink-muted">Reading the workspace and run history…</p>
        </div>
      ) : !report ? (
        <div className="py-12 text-center">
          <p className="text-sm font-medium text-ink">The report couldn't be generated.</p>
          <p className="mt-1 text-xs text-ink-muted">{error}</p>
          <Button className="mt-4" variant="secondary" size="sm" icon={RefreshCw} onClick={() => load()}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div role="tablist" className="flex gap-1 overflow-x-auto no-scrollbar border-b border-line-subtle">
            {tabs.map((t) => (
              <button
                key={t.key}
                role="tab"
                aria-selected={tab === t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  '-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer',
                  tab === t.key ? 'border-brand-500 text-ink' : 'border-transparent text-ink-muted hover:text-ink',
                )}
              >
                <t.icon size={13} />
                {t.label}
                {t.count ? <span className="rounded-full bg-inset px-1.5 text-[10px] text-ink-muted">{t.count}</span> : null}
              </button>
            ))}
          </div>

          <div className="max-h-[62vh] overflow-y-auto pr-1 space-y-6 text-sm text-ink">
            {tab === 'overview' && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat
                    icon={Activity}
                    label="Latest run"
                    value={report.run ? <StateBadge state={report.run.state} /> : 'Not run yet'}
                    sub={report.run?.durationMs ? `took ${formatDuration(report.run.durationMs)}` : `${report.runsCompleted}/${report.runsTotal} runs completed`}
                  />
                  <Stat
                    icon={FileCode}
                    label="Code"
                    value={`${report.stack.totalFiles} files`}
                    sub={`${report.stack.totalLines.toLocaleString()} lines · ${formatBytes(report.stack.totalBytes)}`}
                  />
                  <Stat
                    icon={Users}
                    label="Team"
                    value={`${report.stages.length} agents`}
                    sub={`${new Set(report.stages.map((s) => s.stage)).size} stages`}
                  />
                  <Stat
                    icon={Coins}
                    label="Usage"
                    value={`${report.usage.totalTokens.toLocaleString()} tokens`}
                    sub={`$${report.usage.totalCostUsd.toFixed(4)}`}
                  />
                </div>

                {report.summary && (
                  <Section title="Executive Summary">
                    <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-4 shadow-2xs">
                      <div className="flex items-center gap-2 mb-2 font-bold text-xs text-brand-600 dark:text-brand-400">
                        <Sparkles size={14} />
                        <span>Execution Overview</span>
                      </div>
                      <MarkdownRenderer content={report.summary} />
                    </div>
                  </Section>
                )}

                <Section title="Project Goal & Specification">
                  <div className="rounded-xl border border-line bg-surface overflow-hidden shadow-2xs">
                    <div className="flex items-center justify-between border-b border-line-subtle bg-inset/50 px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                          <Target size={14} />
                        </span>
                        <span className="text-xs font-bold text-ink">Mission Briefing & Requirements</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={Copy}
                        onClick={() => copy(report.goal, 'Goal copied')}
                      >
                        Copy Goal
                      </Button>
                    </div>
                    <div className="max-h-96 overflow-y-auto p-4 leading-relaxed">
                      <MarkdownRenderer content={report.goal} />
                    </div>
                  </div>
                </Section>

                {report.run?.error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    <strong>Run error:</strong> {report.run.error}
                  </div>
                )}

                <Section title="Checks">
                  <button type="button" onClick={() => setTab('checks')} className="flex flex-wrap gap-3 text-xs cursor-pointer">
                    {(['pass', 'warn', 'fail', 'info'] as CheckStatus[]).filter((s) => checkCounts[s]).map((s) => {
                      const st = CHECK_STYLE[s];
                      return (
                        <span key={s} className={cn('inline-flex items-center gap-1 font-medium', st.className)}>
                          <st.icon size={14} /> {checkCounts[s]} {st.label.toLowerCase()}
                        </span>
                      );
                    })}
                  </button>
                </Section>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Section title="Languages">
                    {report.stack.languages.length ? (
                      <div className="space-y-1.5">
                        {report.stack.languages.slice(0, 6).map((l) => (
                          <div key={l.name} className="flex items-center gap-2 text-xs">
                            <span className="w-24 shrink-0 text-ink">{l.name}</span>
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-inset">
                              <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.max(l.percent, 2)}%` }} />
                            </div>
                            <span className="w-10 shrink-0 text-right tabular-nums text-ink-muted">{l.percent}%</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-ink-muted">No source files yet.</p>}
                  </Section>

                  <Section title="Built with">
                    <dl className="space-y-1.5 text-xs">
                      <div className="flex gap-2"><dt className="w-24 shrink-0 text-ink-muted">Model{report.models.length > 1 ? 's' : ''}</dt><dd className="min-w-0 break-words font-mono">{report.models.join(', ') || '—'}</dd></div>
                      <div className="flex gap-2"><dt className="w-24 shrink-0 text-ink-muted">Dependencies</dt><dd className="min-w-0 break-words">{report.stack.dependencies.length ? report.stack.dependencies.slice(0, 8).join(', ') : 'None declared'}</dd></div>
                      <div className="flex gap-2">
                        <dt className="w-24 shrink-0 text-ink-muted">Repository</dt>
                        <dd className="min-w-0 break-words">
                          {report.git.github ? <a className="text-brand-600 hover:underline" href={report.git.github.repoUrl} target="_blank" rel="noreferrer">{report.git.github.repoUrl.replace('https://github.com/', '')}</a>
                            : report.git.targetRepo ? `${report.git.targetRepo} (not pushed yet)` : 'Not pushed'}
                        </dd>
                      </div>
                      <div className="flex gap-2"><dt className="w-24 shrink-0 text-ink-muted">Commit</dt><dd className="min-w-0 break-words">{report.git.local ? <><span className="font-mono">{report.git.local.latestCommit.slice(0, 8)}</span> · {report.git.local.commitCount} commit{report.git.local.commitCount === 1 ? '' : 's'}</> : 'None yet'}</dd></div>
                    </dl>
                  </Section>
                </div>
              </>
            )}

            {tab === 'run' && (
              <>
                {report.howToRun.prerequisites.length > 0 && (
                  <Section title="You need">
                    <div className="flex flex-wrap gap-1.5">
                      {report.howToRun.prerequisites.map((p) => <Badge key={p} tone="neutral">{p}</Badge>)}
                    </div>
                  </Section>
                )}
                <Section title="Steps">
                  <ol className="space-y-3.5">
                    {report.howToRun.steps.map((s, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[11px] font-bold text-brand-600 dark:text-brand-400">{i + 1}</span>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="text-[13px] font-medium">{s.label}</div>
                          <CommandBlock command={s.command} onCopy={(t) => copy(t, 'Command copied')} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </Section>
                {report.howToRun.notes.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-xs text-ink-muted">
                    {report.howToRun.notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
                {report.envVariables.length > 0 && (
                  <Section title="Environment variables">
                    <Table head={['Variable', 'Example', 'Found in']} rows={report.envVariables.map((v) => [
                      <code key="k" className="font-mono text-[12px]">{v.key}</code>,
                      v.example ? <code key="e" className="font-mono text-[12px] break-all">{v.example}</code> : <span key="e" className="text-ink-muted">—</span>,
                      <span key="s" className="font-mono text-[11px] text-ink-muted">{v.source}</span>,
                    ])} />
                  </Section>
                )}
                {report.apiEndpoints.length > 0 && (
                  <Section title="API endpoints">
                    <Table head={['Method', 'Path', 'Defined in']} rows={report.apiEndpoints.map((e) => [
                      <Badge key="m" tone="brand">{e.method}</Badge>,
                      <code key="p" className="font-mono text-[12px]">{e.path}</code>,
                      <span key="f" className="font-mono text-[11px] text-ink-muted">{e.file}</span>,
                    ])} />
                  </Section>
                )}
              </>
            )}

            {tab === 'agents' && (
              <ol className="relative space-y-4 border-l border-line-subtle pl-5">
                {stages.map((s) => (
                  <li key={`${s.stage}-${s.agent}`} className="relative">
                    <span className="absolute -left-[27px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-surface bg-brand-500" />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Stage {s.stage}</span>
                      <span className="font-semibold">{s.agent}</span>
                      <StateBadge state={s.state} />
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      {[s.role, s.durationMs != null ? formatDuration(s.durationMs) : null, s.tokens ? `${s.tokens.toLocaleString()} tokens` : null].filter(Boolean).join(' · ')}
                    </div>
                    {s.outcome && (
                      <div className="mt-2 text-[13px] leading-relaxed rounded-xl border border-line-subtle bg-inset/40 p-3.5">
                        <MarkdownRenderer content={s.outcome} />
                      </div>
                    )}
                    {s.files.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {s.files.map((f) => (
                          <button key={f} type="button" onClick={() => { setTab('files'); openFile(f); }} className="rounded-md border border-line-subtle bg-inset px-1.5 py-0.5 font-mono text-[11px] text-ink-muted hover:text-ink cursor-pointer">
                            {f}
                          </button>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
                {stages.length === 0 && <li className="text-xs text-ink-muted">No agents in this production.</li>}
              </ol>
            )}

            {tab === 'files' && (
              <>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <input
                    value={fileQuery}
                    onChange={(e) => setFileQuery(e.target.value)}
                    placeholder="Filter files"
                    className="w-full rounded-lg border border-line bg-surface py-2 pl-8 pr-3 text-xs outline-none focus:border-brand-500"
                  />
                </div>
                {preview && (
                  <div className="rounded-lg border border-line">
                    <div className="flex items-center justify-between border-b border-line-subtle px-3 py-2">
                      <span className="font-mono text-xs">{preview.path}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" icon={Copy} onClick={() => copy(preview.content, 'File copied')}>Copy</Button>
                        <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>Close</Button>
                      </div>
                    </div>
                    <pre className="max-h-80 overflow-auto bg-slate-950 p-3 font-mono text-[11.5px] leading-relaxed text-slate-100">{preview.content}</pre>
                  </div>
                )}
                <Table
                  head={['File', 'Lines', 'Size', 'What it is']}
                  rows={files.map((f) => [
                    <button key="p" type="button" onClick={() => openFile(f.path)} className="text-left font-mono text-[12px] text-brand-600 hover:underline dark:text-brand-400 cursor-pointer break-all">{f.path}</button>,
                    <span key="l" className="tabular-nums">{f.lines ? f.lines.toLocaleString() : '—'}</span>,
                    <span key="s" className="tabular-nums whitespace-nowrap">{formatBytes(f.bytes)}</span>,
                    <span key="d" className="text-ink-muted">{f.description || '—'}</span>,
                  ])}
                  empty="No files match."
                />
                {report.dataModels.length > 0 && (
                  <Section title="Data models">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {report.dataModels.map((m) => (
                        <div key={`${m.file}:${m.name}`} className="rounded-lg border border-line-subtle p-3">
                          <div className="font-semibold">{m.name}</div>
                          <div className="mb-2 font-mono text-[11px] text-ink-muted">{m.file}</div>
                          <ul className="space-y-0.5 font-mono text-[11.5px]">
                            {m.fields.map((f) => (
                              <li key={f.name} className="flex gap-2"><span>{f.name}{f.optional ? '?' : ''}</span><span className="text-ink-muted break-all">{f.type}</span></li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}
              </>
            )}

            {tab === 'checks' && (
              <ul className="divide-y divide-line-subtle rounded-lg border border-line-subtle">
                {report.checks.map((c) => {
                  const st = CHECK_STYLE[c.status];
                  return (
                    <li key={c.name} className="flex gap-3 px-3.5 py-3">
                      <st.icon size={16} className={cn('mt-0.5 shrink-0', st.className)} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium">{c.name}</div>
                        <div className="text-xs text-ink-muted break-words">{c.detail}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {tab === 'markdown' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-ink-muted">The same document you get from Copy, .md and Print.</p>
                  <div className="flex rounded-lg border border-line p-0.5 text-xs">
                    {['Rendered', 'Source'].map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setRawMarkdown(i === 1)}
                        className={cn('rounded-md px-2.5 py-1 font-medium cursor-pointer', rawMarkdown === (i === 1) ? 'bg-inset text-ink' : 'text-ink-muted')}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {rawMarkdown
                  ? <pre className="whitespace-pre-wrap break-words rounded-lg border border-line-subtle bg-inset p-4 font-mono text-[12px] leading-relaxed">{report.markdown}</pre>
                  : <div className="rounded-lg border border-line-subtle p-4"><MarkdownRenderer content={report.markdown} /></div>}
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Table({ head, rows, empty }: { head: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line-subtle">
      <table className="w-full text-left text-xs">
        <thead className="bg-inset text-[11px] uppercase tracking-wider text-ink-muted">
          <tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-line-subtle">
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-2 align-top">{c}</td>)}</tr>)}
          {rows.length === 0 && <tr><td colSpan={head.length} className="px-3 py-6 text-center text-ink-muted">{empty ?? 'Nothing to show.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
