import { useEffect, useState } from 'react';
import {
  Archive,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Hammer,
  Image as ImageIcon,
  RotateCcw,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth-store';
import { cn } from '../../lib/utils';
import { formatCompact, formatCurrency } from '../../lib/design';
import type { CostEstimate, Process, RunStatus, WorkspaceArtifact } from '../../types';
import { Modal } from '../ui/Modal';
import { Button, ButtonLink } from '../ui/Button';
import { Badge, Chip } from '../ui/Badge';
import { EmptyState, Spinner } from '../ui/States';
import { useToast } from '../ui/Toast';

function fileIcon(path: string) {
  if (/\.(html?|css|js|mjs|json|ts|tsx|py|jsx)$/i.test(path)) return FileCode2;
  if (/\.(png|jpe?g|svg|gif|webp|ico)$/i.test(path)) return ImageIcon;
  return FileText;
}

import { MarkdownRenderer } from '../ui/MarkdownRenderer';

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Run report for a production chain: what each stage did, what it produced,
 * and options to read, preview, and download individual or all files.
 */
export function RunPanel({
  process,
  open,
  onClose,
}: {
  process: Process;
  open: boolean;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<RunStatus | null>(null);
  const [files, setFiles] = useState<WorkspaceArtifact[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [activeFile, setActiveFile] = useState<{ path: string; content: string } | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const running = status?.state === 'running';
  const result = status?.result ?? null;

  // Load whatever the chain produced on a previous run.
  useEffect(() => {
    if (!open) return;
    api.processes.files(process.id).then(setFiles).catch(() => setFiles([]));
    // Reattach to a run already in flight (e.g. the panel was reopened).
    api.processes.runStatus(process.id).then(setStatus).catch(() => setStatus(null));
    // Forecast the bill before anyone commits to paying it.
    api.orchestration.estimate(process.id).then(setEstimate).catch(() => setEstimate(null));
  }, [open, process.id]);

  // A chain run takes minutes — show elapsed time so it doesn't look stuck.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setElapsed((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  // The run happens server-side; poll for stage-by-stage progress.
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(async () => {
      try {
        const next = await api.processes.runStatus(process.id);
        setStatus(next);
        // Artifacts appear as each stage writes them.
        api.processes.files(process.id).then(setFiles).catch(() => {});
      } catch {
        /* transient — keep polling */
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [running, process.id]);

  const handleCancel = async () => {
    try {
      await api.processes.cancel(process.id);
      // Reflect the stop immediately; polling confirms the final state.
      setStatus((s) => (s ? { ...s, state: 'cancelled' } : s));
      toast.warning('Run cancelled', 'The executing step was stopped.');
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not cancel', (err as Error).message);
    }
  };

  const handleRetry = async () => {
    setError(null);
    setElapsed(0);
    try {
      const res = await api.processes.retry(process.id);
      setStatus(res);
      toast.info('Run resumed', 'Picking up after the last successful stage.');
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not resume', (err as Error).message);
    }
  };

  const handleStart = async () => {
    setError(null);
    setElapsed(0);
    try {
      const res = await api.processes.run(process.id);
      setStatus(res);
      toast.info('Run started', 'Executing stage by stage in the shared workspace.');
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not start', (err as Error).message);
    }
  };

  const openFileViewer = async (relPath: string) => {
    setReadingFile(true);
    try {
      const token = useAuthStore.getState().accessToken;
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/preview/${process.id}/${relPath}`, {
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setActiveFile({ path: relPath, content: text });
    } catch (err) {
      toast.error('Could not read file', (err as Error).message);
    } finally {
      setReadingFile(false);
    }
  };

  const copyFileContent = () => {
    if (!activeFile) return;
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied', 'File contents copied to clipboard');
  };

  const previewUrl = `/preview/${process.id}`;
  const hasPreview = files.some((f) => f.path.endsWith('.html'));

  const handleOpenPreview = async () => {
    try {
      await api.processes.preparePreview(process.id);
    } catch {
      // Best-effort
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={process.name}
        description={
          running
            ? `Running stage ${(status?.currentStage ?? 0) + 1} of ${status?.totalStages ?? 1} (${elapsed}s elapsed)`
            : 'Execution history, stage summaries, and workspace deliverables.'
        }
        size="lg"
        actions={
          <div className="flex items-center gap-2">
            {running && (
              <Button variant="danger" size="sm" icon={Ban} onClick={handleCancel}>
                Cancel run
              </Button>
            )}
            {!running && status?.state === 'failed' && (
              <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleRetry}>
                Resume after failure
              </Button>
            )}
            {!running && status?.state !== 'failed' && (
              <Button variant="primary" size="sm" icon={Hammer} onClick={handleStart}>
                Run chain
              </Button>
            )}
            {hasPreview && (
              <Button
                variant="secondary"
                size="sm"
                icon={ExternalLink}
                onClick={handleOpenPreview}
              >
                Open preview
              </Button>
            )}
            {files.length > 0 && (
              <a
                href={`/api/processes/${process.id}/download`}
                download={`${process.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-workspace.zip`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-line hover:bg-hover"
              >
                <Archive size={13} />
                Download ZIP
              </a>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {running && (
            <div className="flex items-center gap-3 rounded-lg border border-brand-500/25 bg-brand-500/10 p-3 text-sm text-brand-800 dark:text-brand-200">
              <Spinner size={16} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">Chain is executing...</p>
                <p className="text-xs text-brand-700/80 dark:text-brand-300/80">
                  Each stage writes files and hands its summary to the next.
                </p>
              </div>
            </div>
          )}

          {!running && estimate && ((estimate.expectedCostUsd ?? estimate.estimatedCostUsd ?? 0) > 0 || estimate.runsSampled > 0) && (
            <div className="flex items-center gap-2 rounded-lg border border-line-subtle bg-inset px-3 py-2 text-xs text-ink-muted">
              <TrendingUp size={13} className="shrink-0 text-ink-faint" aria-hidden />
              <p>
                Expected bill: <strong className="text-ink">{formatCurrency(estimate.expectedCostUsd ?? estimate.estimatedCostUsd ?? 0)}</strong>
                {estimate.minCostUsd !== estimate.maxCostUsd && (
                  <>
                    {' '}
                    (range: {formatCurrency(estimate.minCostUsd)} –{' '}
                    {formatCurrency(estimate.maxCostUsd)})
                  </>
                )}
              </p>
              <span className="ml-auto text-2xs text-ink-faint">
                {estimate.basis === 'history'
                  ? `from ${estimate.runsSampled} past run${estimate.runsSampled === 1 ? '' : 's'}`
                  : `estimated from ${estimate.runsSampled} similar chain${estimate.runsSampled === 1 ? '' : 's'}`}
              </span>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {result && (
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.steps.every((s) => s.ok) ? 'success' : 'danger'} icon={CheckCircle2}>
                {result.steps.filter((s) => s.ok).length}/{result.steps.length} stages
              </Badge>
              <Badge tone="neutral">{Math.round(result.durationMs / 1000)}s</Badge>
              <Badge tone="info">{formatCompact(result.totalTokens)} tokens</Badge>
              <Badge tone="accent">{formatCurrency(result.totalCostUsd)}</Badge>
            </div>
          )}

          {(status?.steps.length ?? 0) > 0 && (
            <section>
              <h4 className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                What each stage did
              </h4>
              <ul className="space-y-2">
                {(status?.steps ?? []).map((s) => (
                  <li
                    key={s.agentId}
                    className="rounded-lg border border-line-subtle bg-inset p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {s.ok ? (
                        <CheckCircle2 size={14} className="text-emerald-600 dark:text-emerald-400" aria-hidden />
                      ) : (
                        <XCircle size={14} className="text-red-600 dark:text-red-400" aria-hidden />
                      )}
                      <span className="text-sm font-medium text-ink">{s.agentName}</span>
                      <Chip>stage {s.stage}</Chip>
                      <span className="ml-auto text-2xs tabular-nums text-ink-faint">
                        {Math.round(s.durationMs / 1000)}s · {formatCompact(s.tokens)} tok
                      </span>
                    </div>
                    <div className="mt-2">
                      <MarkdownRenderer content={s.summary} maxHeight="max-h-40 sm:max-h-48" />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                Artifacts & Generated Files
                <Chip>{files.length}</Chip>
              </h4>
              {files.length > 0 && (
                <a
                  href={`/api/processes/${process.id}/download`}
                  download={`${process.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}-workspace.zip`}
                  className="inline-flex items-center gap-1 text-2xs font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
                >
                  <Download size={12} />
                  Download All ({files.length})
                </a>
              )}
            </div>

            {files.length === 0 ? (
              <EmptyState
                compact
                icon={FileText}
                title="Nothing built yet"
                description="Run the chain and its agents will write real files here."
              />
            ) : (
              <ul className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle">
                {files.map((f) => {
                  const Icon = fileIcon(f.path);
                  return (
                    <li key={f.path} className="flex items-center gap-2.5 bg-surface px-3 py-2">
                      <Icon size={14} strokeWidth={1.75} className="shrink-0 text-ink-faint" aria-hidden />
                      <button
                        type="button"
                        onClick={() => openFileViewer(f.path)}
                        className={cn(
                          'min-w-0 flex-1 truncate text-left font-mono text-xs text-ink-muted',
                          'transition-colors hover:text-brand-700 hover:underline dark:hover:text-brand-300',
                        )}
                        title={`Click to read ${f.path}`}
                      >
                        {f.path}
                      </button>
                      <span className="shrink-0 text-2xs tabular-nums text-ink-faint mr-2">
                        {formatBytes(f.size)}
                      </span>

                      {/* Action buttons: Read and Download */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openFileViewer(f.path)}
                          disabled={readingFile}
                          className="inline-flex items-center gap-1 rounded bg-inset px-2 py-1 text-2xs font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                          title="Read file contents"
                        >
                          <Eye size={12} />
                          Read
                        </button>
                        <a
                          href={`/preview/${process.id}/${f.path}?download=true`}
                          download={f.path.split('/').pop() || f.path}
                          className="inline-flex items-center gap-1 rounded bg-inset px-2 py-1 text-2xs font-medium text-ink-muted transition-colors hover:bg-hover hover:text-ink"
                          title="Download this file"
                        >
                          <Download size={12} />
                          Download
                        </a>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </Modal>

      {/* In-app File Reader Modal */}
      {activeFile && (
        <Modal
          open={!!activeFile}
          onClose={() => setActiveFile(null)}
          title={activeFile.path}
          description="Live workspace deliverable generated by autonomous agents"
          size="lg"
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={copyFileContent}
              >
                {copied ? 'Copied' : 'Copy code'}
              </Button>
              <a
                href={`/preview/${process.id}/${activeFile.path}?download=true`}
                download={activeFile.path.split('/').pop() || activeFile.path}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500 bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow transition-colors hover:bg-brand-500"
              >
                <Download size={13} />
                Download file
              </a>
            </div>
          }
        >
          <div className="relative rounded-lg border border-line-subtle bg-gray-950 p-4 font-mono text-xs text-gray-200 shadow-inner max-h-[60vh] overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words leading-relaxed">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </Modal>
      )}
    </>
  );
}
