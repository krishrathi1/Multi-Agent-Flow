import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, GitBranch, GitCompareArrows, Layers, ListOrdered, Network, RefreshCw, Sparkles, Split, type LucideIcon } from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { OrchestrationPattern, PatternWave, PatternsView, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { useToast } from '../ui/Toast';

const ORDER: OrchestrationPattern[] = ['SEQUENTIAL', 'PARALLEL', 'HIERARCHICAL', 'HYBRID'];
const ICON: Record<OrchestrationPattern, LucideIcon> = { SEQUENTIAL: ListOrdered, PARALLEL: Split, HIERARCHICAL: Network, HYBRID: Layers };
const KIND_LABEL: Record<string, string> = {
  stage: 'Stage', step: 'Step', workers: 'Workers (parallel)', join: 'Join', supervisor: 'Supervisor', assigned: 'Assigned tasks', 'follow-up': 'Follow-up',
};

const fmtDuration = (ms: number | null) => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};

/** The waves a pattern runs, left to right; agents stacked inside a wave run at the same time. */
function Topology({ waves }: { waves: PatternWave[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {waves.map((w, i) => (
        <div key={`${w.stage}-${i}`} className="flex items-center gap-1.5">
          {i > 0 && <ArrowRight size={12} className="shrink-0 text-ink-faint" aria-hidden />}
          <div className={`rounded-md border px-2 py-1 ${w.kind === 'supervisor' ? 'border-amber-500/40 bg-amber-500/10' : w.kind === 'workers' ? 'border-brand-500/40 bg-brand-500/8' : 'border-line bg-surface'}`}>
            <p className="text-[10px] uppercase tracking-wide text-ink-faint">{KIND_LABEL[w.kind] ?? w.kind}</p>
            {w.agents.map((a) => <p key={a} className="whitespace-nowrap text-2xs font-medium text-ink">{a}</p>)}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Agentic design patterns for a production: choose how its agents are
 * organised (sequential, parallel, hierarchical or hybrid), see what each
 * would run for this team, and compare the runs made under each.
 */
export function PatternsModal({ process, open, onClose, onChanged }: { process: Process; open: boolean; onClose: () => void; onChanged?: () => void }) {
  const toast = useToast();
  const [view, setView] = useState<PatternsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'patterns' | 'compare' | 'last'>('patterns');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await api.processes.patterns(process.id));
    } catch (err) {
      toast.error('Could not load the patterns', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [process.id, toast]);

  useEffect(() => {
    if (!open) return;
    load();
    const socket = getSocket();
    const onUpdate = (p: { processId?: string }) => { if (p?.processId === process.id) load(); };
    socket.on('process:run:updated', onUpdate);
    return () => { socket.off('process:run:updated', onUpdate); };
  }, [open, load, process.id]);

  const current = view?.pattern ?? process.orchestrationPattern ?? 'HYBRID';
  const choose = async (p: OrchestrationPattern) => {
    if (p === current) return;
    setSaving(true);
    try {
      await api.processes.update(process.id, { orchestrationPattern: p });
      setView((v) => (v ? { ...v, pattern: p } : v));
      toast.success('Pattern saved', `The next run uses ${view?.info[p].label ?? p}.`);
      onChanged?.();
    } catch (err) {
      toast.error('Could not change the pattern', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const runs = view?.runs ?? [];
  const measured = runs.filter((r) => r.orchestrationPattern);
  const last = measured[0];
  const rec = view?.recommendation;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={GitBranch}
      title={`Agentic pattern — ${process.name}`}
      description="How this production's agents are organised when it runs, and how the patterns compare."
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {rec && view && (
          <div className="flex items-start gap-2 rounded-lg border border-brand-500/30 bg-brand-500/8 p-3 text-xs">
            <Sparkles size={14} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-ink">
                Recommended: {view.info[rec.pattern].label}{' '}
                <span className="font-normal text-ink-subtle">({rec.basis === 'measured' ? 'from measured runs' : "from the team's structure"})</span>
              </p>
              <ul className="mt-1 list-disc pl-4 text-ink-muted">{rec.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            {rec.pattern !== current && (
              <Button variant="secondary" size="xs" loading={saving} onClick={() => choose(rec.pattern)}>Use it</Button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <Tabs
            items={[
              { value: 'patterns', label: 'Patterns', icon: GitBranch },
              { value: 'compare', label: 'Compare runs', icon: GitCompareArrows, count: measured.length },
              { value: 'last', label: 'Last run', icon: Network },
            ]}
            value={tab}
            onChange={setTab}
            aria-label="Pattern sections"
          />
          <Button variant="ghost" size="xs" iconOnly icon={RefreshCw} loading={loading} onClick={load} aria-label="Refresh patterns" />
        </div>

        {tab === 'patterns' && view && (
          <div className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
            {ORDER.map((p) => {
              const info = view.info[p];
              const Icon = ICON[p];
              const active = p === current;
              return (
                <button
                  key={p}
                  type="button"
                  disabled={saving}
                  onClick={() => choose(p)}
                  aria-pressed={active}
                  className={`block w-full rounded-lg border p-3 text-left transition-colors ${active ? 'border-brand-600/40 bg-brand-500/10 dark:border-brand-500/40' : 'border-line bg-inset hover:border-line-strong'}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={active ? 'text-brand-600 dark:text-brand-400' : 'text-ink-faint'} aria-hidden />
                    <span className="text-sm font-semibold text-ink">{info.label}</span>
                    {active && <Badge tone="brand" size="sm">In use</Badge>}
                    {rec?.pattern === p && <Badge tone="success" size="sm">Recommended</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">{info.summary}</p>
                  <p className="mt-0.5 text-2xs text-ink-faint">Worker nodes: {info.workers}</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p className="text-2xs text-emerald-700 dark:text-emerald-300">+ {info.strengths}</p>
                    <p className="text-2xs text-amber-700 dark:text-amber-300">− {info.weaknesses}</p>
                  </div>
                  <div className="mt-2 overflow-x-auto"><Topology waves={view.preview[p]} /></div>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'compare' && (
          measured.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-subtle">
              No runs with a recorded pattern yet. Choose a pattern, run the production, then switch patterns and run again to compare.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full text-xs">
                <thead className="bg-inset text-left text-2xs uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="px-2.5 py-2">Run</th><th className="px-2.5 py-2">Pattern</th><th className="px-2.5 py-2">Result</th>
                    <th className="px-2.5 py-2 text-right">Time</th><th className="px-2.5 py-2 text-right">Tokens</th><th className="px-2.5 py-2 text-right">Steps</th>
                    <th className="px-2.5 py-2 text-right">Waves</th><th className="px-2.5 py-2 text-right">Peak parallel</th><th className="px-2.5 py-2 text-right">Supervisor</th><th className="px-2.5 py-2">QA verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {measured.map((r) => (
                    <tr key={r.id} className="border-t border-line-subtle">
                      <td className="px-2.5 py-2 font-mono text-ink-subtle">{new Date(r.startedAt).toLocaleString()}</td>
                      <td className="px-2.5 py-2">{view?.info[r.orchestrationPattern!].label}</td>
                      <td className="px-2.5 py-2">{r.state.toLowerCase()}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{fmtDuration(r.durationMs)}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{r.totalTokens.toLocaleString()}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{r._count.steps}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{r.orchestration?.waves.length ?? '—'}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{r.orchestration?.maxParallel ?? '—'}</td>
                      <td className="px-2.5 py-2 text-right font-mono">{r.orchestration?.supervisorCalls ?? 0}</td>
                      <td className="px-2.5 py-2">{r.qaVerdict ? r.qaVerdict.replace('_', ' ') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'last' && (
          !last?.orchestration ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-subtle">No run with a recorded pattern yet.</p>
          ) : (
            <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1 text-xs">
              <p className="text-ink-subtle">
                {view?.info[last.orchestration.pattern].label} · {last.state.toLowerCase()} · {fmtDuration(last.durationMs)} · {last.orchestration.agentSteps} agent steps · peak {last.orchestration.maxParallel} in parallel
              </p>
              <div className="overflow-x-auto rounded-lg border border-line bg-inset p-3"><Topology waves={last.orchestration.waves} /></div>
              {last.orchestration.supervisorFallback && (
                <p className="rounded-md bg-amber-500/10 p-2 text-amber-700 dark:text-amber-300">Supervisor unavailable ({last.orchestration.supervisorFallback}); the staged plan ran instead.</p>
              )}
              {last.orchestration.plan && (
                <section>
                  <h3 className="mb-1 text-sm font-semibold text-ink">Supervisor's plan</h3>
                  <p className="mb-2 text-ink-muted">{last.orchestration.plan.rationale}</p>
                  <ul className="space-y-1">
                    {last.orchestration.plan.assignments.map((a) => (
                      <li key={a.id} className="rounded-md border border-line-subtle bg-surface p-2">
                        <span className="font-mono text-ink-faint">{a.id}</span> <span className="font-medium text-ink">{a.agent}</span>
                        {a.depends_on.length > 0 && <span className="text-ink-faint"> · after {a.depends_on.join(', ')}</span>}
                        <p className="mt-0.5 text-ink-muted">{a.task}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {last.orchestration.review && (
                <section>
                  <h3 className="mb-1 text-sm font-semibold text-ink">Supervisor's review</h3>
                  <p className="text-ink-muted"><Badge tone={last.orchestration.review.done ? 'success' : 'warning'} size="sm">{last.orchestration.review.done ? 'done' : 'follow-ups sent'}</Badge> {last.orchestration.review.assessment}</p>
                  {last.orchestration.review.follow_ups.map((f) => (
                    <p key={f.id} className="mt-1 text-ink-muted"><span className="font-medium text-ink">{f.agent}:</span> {f.task}</p>
                  ))}
                </section>
              )}
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
