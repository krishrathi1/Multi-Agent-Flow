import { useCallback, useEffect, useState } from 'react';
import { Braces, CheckCircle2, Copy, Download, FileText, RefreshCw, ShieldCheck, Table2, TriangleAlert } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { Tone } from '../../lib/design';
import type { FinalOutputView, OutputStatus, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { useToast } from '../ui/Toast';

const STATUS_TONE: Record<OutputStatus, Tone> = { completed: 'success', partial: 'warning', blocked: 'neutral', failed: 'danger' };
const SEVERITY_TONE: Record<string, Tone> = { critical: 'danger', major: 'danger', minor: 'warning', info: 'info' };

function saveText(text: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-2.5 py-2 ${right ? 'text-right' : 'text-left'}`}>{children}</th>
);

/**
 * A run's structured final output: every stage's validated StageOutput and
 * the run's FinalOutput, shown as tables, as the generated Markdown and as
 * JSON — all produced and validated by the Pydantic models on the server.
 */
export function FinalOutputModal({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [view, setView] = useState<FinalOutputView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'markdown' | 'json'>('overview');

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      setView(await api.processes.output(process.id, { refresh }));
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [process.id]);

  useEffect(() => {
    if (!open) return;
    load();
    const socket = getSocket();
    const onUpdate = (p: { processId?: string }) => { if (p?.processId === process.id) load(); };
    socket.on('process:output:updated', onUpdate);
    return () => { socket.off('process:output:updated', onUpdate); };
  }, [open, load, process.id]);

  const data = view?.data;
  const json = data ? JSON.stringify(data, null, 2) : '';
  const fileBase = `final-output-${(view?.runId ?? 'run').slice(0, 8)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={FileText}
      title={`Final output — ${process.name}`}
      description="The run's result in a structured form: validated against Pydantic models, rendered as tables, Markdown and JSON."
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {error && !view && (
          <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-subtle">{error}</p>
        )}

        {view && (
          <div className="flex flex-wrap items-center gap-2">
            {data ? (
              <Badge tone="success" icon={ShieldCheck}>Validated · Pydantic FinalOutput v{data.schema_version}</Badge>
            ) : (
              <Badge tone="danger" icon={TriangleAlert}>Failed validation</Badge>
            )}
            {data && <Badge tone={STATUS_TONE[data.status]}>{data.status}</Badge>}
            <span className="text-2xs text-ink-faint">
              Run <span className="font-mono">{view.runId.slice(0, 8)}</span> · {new Date(view.startedAt).toLocaleString()} · built {new Date(view.generatedAt).toLocaleTimeString()}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Button variant="secondary" size="xs" icon={Download} disabled={!view.markdown} onClick={() => saveText(view.markdown!, `${fileBase}.md`, 'text/markdown')}>.md</Button>
              <Button variant="secondary" size="xs" icon={Download} disabled={!data} onClick={() => saveText(json, `${fileBase}.json`, 'application/json')}>.json</Button>
              <Button variant="ghost" size="xs" iconOnly icon={RefreshCw} loading={loading} onClick={() => load(true)} aria-label="Rebuild final output" />
            </span>
          </div>
        )}

        {view?.errors && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/8 p-3 text-xs text-red-700 dark:text-red-300">
            <p className="font-semibold">The final output did not pass validation:</p>
            <ul className="mt-1 list-disc pl-4">
              {view.errors.map((e, i) => <li key={i}><span className="font-mono">{e.loc}</span>: {e.msg}</li>)}
            </ul>
          </div>
        )}

        {data && (
          <>
            <Tabs
              items={[
                { value: 'overview', label: 'Tables', icon: Table2 },
                { value: 'markdown', label: 'Markdown', icon: FileText },
                { value: 'json', label: 'JSON', icon: Braces },
              ]}
              value={tab}
              onChange={setTab}
              aria-label="Output format"
            />

            {tab === 'overview' && (
              <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-1">
                <div className="grid gap-2 sm:grid-cols-4">
                  {[
                    { label: 'QA verdict', value: data.qa_verdict ? data.qa_verdict.replace('_', ' ') : '—' },
                    { label: 'Duration', value: data.metrics.duration_seconds != null ? `${Math.round(data.metrics.duration_seconds)} s` : '—' },
                    { label: 'Tokens / cost', value: `${data.metrics.tokens.toLocaleString()} / $${data.metrics.cost_usd.toFixed(4)}` },
                    { label: 'Steps · tools · board', value: `${data.metrics.agent_steps} · ${data.metrics.tool_calls} · ${data.metrics.blackboard_entries}` },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-line bg-inset p-3">
                      <p className="text-2xs uppercase tracking-wide text-ink-faint">{s.label}</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold text-ink">{s.value}</p>
                    </div>
                  ))}
                </div>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Stages</h3>
                  <div className="overflow-x-auto rounded-lg border border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-inset text-2xs uppercase tracking-wide text-ink-faint">
                        <tr><Th>#</Th><Th>Agent</Th><Th>Status</Th><Th>Summary</Th><Th right>Files</Th><Th right>Issues</Th><Th>Tests</Th><Th>Source</Th></tr>
                      </thead>
                      <tbody>
                        {data.stages.map((s, i) => (
                          <tr key={i} className="border-t border-line-subtle align-top">
                            <td className="px-2.5 py-2 font-mono">{s.stage}</td>
                            <td className="px-2.5 py-2 font-medium text-ink">{s.agent}{s.verdict && <div className="text-2xs text-ink-faint">{s.verdict.replace('_', ' ')}</div>}</td>
                            <td className="px-2.5 py-2"><Badge tone={STATUS_TONE[s.status]} size="sm">{s.status}</Badge></td>
                            <td className="max-w-md px-2.5 py-2 text-ink-muted">{s.summary}</td>
                            <td className="px-2.5 py-2 text-right font-mono">{s.deliverables.length}</td>
                            <td className="px-2.5 py-2 text-right font-mono">{s.issues.length}</td>
                            <td className="px-2.5 py-2">{!s.tests ? '—' : !s.tests.ran ? 'not run' : s.tests.passed ? 'passed' : s.tests.passed === false ? 'failed' : 'ran'}</td>
                            <td className="px-2.5 py-2">
                              <Badge tone={s.source === 'agent' ? 'brand' : 'neutral'} size="sm">{s.source === 'agent' ? 'agent JSON' : 'derived'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-1 text-2xs text-ink-faint">
                    "agent JSON": the agent wrote its stage output and it passed validation. "derived": built from the agent's summary and files because it wrote none or it failed validation.
                  </p>
                </section>

                {data.stages.some((s) => s.decisions.length) && (
                  <section>
                    <h3 className="mb-2 text-sm font-semibold text-ink">Decisions</h3>
                    <ul className="space-y-1 text-xs text-ink-muted">
                      {data.stages.flatMap((s) => s.decisions.map((d, i) => (
                        <li key={`${s.agent}-${i}`} className="flex gap-1.5"><CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /><span><span className="text-ink-faint">{s.agent}:</span> {d}</span></li>
                      )))}
                    </ul>
                  </section>
                )}

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Deliverables ({data.deliverables.length})</h3>
                  <div className="max-h-56 overflow-auto rounded-lg border border-line">
                    <table className="w-full text-xs">
                      <thead className="bg-inset text-2xs uppercase tracking-wide text-ink-faint"><tr><Th>File</Th><Th>Description</Th></tr></thead>
                      <tbody>
                        {data.deliverables.map((d) => (
                          <tr key={d.path} className="border-t border-line-subtle"><td className="px-2.5 py-1.5 font-mono">{d.path}</td><td className="px-2.5 py-1.5 text-ink-muted">{d.description || '—'}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Open issues</h3>
                  {data.open_issues.length === 0 ? (
                    <p className="text-xs text-ink-subtle">None.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {data.open_issues.map((i, n) => (
                        <li key={n} className="flex items-start gap-2 text-xs text-ink-muted"><Badge tone={SEVERITY_TONE[i.severity]} size="sm">{i.severity}</Badge><span>{i.description}</span></li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            )}

            {(tab === 'markdown' || tab === 'json') && (
              <div className="relative">
                <Button
                  variant="secondary"
                  size="xs"
                  icon={Copy}
                  className="absolute right-2 top-2"
                  onClick={() => navigator.clipboard.writeText(tab === 'json' ? json : view!.markdown ?? '').then(() => toast.success('Copied'))}
                >
                  Copy
                </Button>
                <pre className="max-h-[56vh] overflow-auto rounded-lg bg-inset p-3 text-2xs leading-relaxed text-ink-muted">
                  {tab === 'json' ? json : view!.markdown}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
