import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  CircleDot,
  FileCode2,
  GitCompareArrows,
  HelpCircle,
  Lightbulb,
  Network,
  NotebookPen,
  Plus,
  RefreshCw,
  Share2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { Tone } from '../../lib/design';
import type { BlackboardEntry, BlackboardKind, BlackboardView, MessagingMode, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { Input, Select, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';

const KIND: Record<BlackboardKind, { label: string; tone: Tone; icon: LucideIcon }> = {
  decision: { label: 'Decision', tone: 'brand', icon: Lightbulb },
  contract: { label: 'Contract', tone: 'accent', icon: Share2 },
  artifact: { label: 'Artifact', tone: 'success', icon: FileCode2 },
  issue: { label: 'Issue', tone: 'danger', icon: TriangleAlert },
  question: { label: 'Question', tone: 'warning', icon: HelpCircle },
  answer: { label: 'Answer', tone: 'info', icon: CheckCircle2 },
  note: { label: 'Note', tone: 'neutral', icon: NotebookPen },
};

type Filter = 'all' | 'open' | 'agreements' | 'artifacts' | 'issues';
const FILTERS: Record<Filter, (e: BlackboardEntry) => boolean> = {
  all: () => true,
  open: (e) => e.status === 'open',
  agreements: (e) => e.kind === 'decision' || e.kind === 'contract',
  artifacts: (e) => e.kind === 'artifact' || e.kind === 'note',
  issues: (e) => e.kind === 'issue' || e.kind === 'question' || e.kind === 'answer',
};

const MODE_INFO: Record<MessagingMode, { label: string; hint: string; icon: LucideIcon }> = {
  BLACKBOARD: {
    label: 'Blackboard (shared state)',
    hint: 'Every agent reads one shared board before working and posts decisions, contracts, artifacts and issues to it. Open issues send the responsible agent back to fix them.',
    icon: Network,
  },
  PEER_TO_PEER: {
    label: 'Peer-to-peer',
    hint: 'Each stage sends its summary directly to the next stage only. No shared state; later stages never see earlier ones first-hand.',
    icon: ArrowRight,
  },
};

const fmtDuration = (ms: number | null) => {
  if (!ms) return '—';
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
};
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/**
 * A production's blackboard: the shared state its agents read and post to,
 * live while a run works, with the switch between blackboard and
 * peer-to-peer messaging and a run-by-run comparison of the two.
 */
export function BlackboardModal({
  process,
  open,
  onClose,
  onModeChanged,
}: {
  process: Process;
  open: boolean;
  onClose: () => void;
  onModeChanged?: () => void;
}) {
  const toast = useToast();
  const [view, setView] = useState<BlackboardView | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'board' | 'compare'>('board');
  const [filter, setFilter] = useState<Filter>('all');
  const [savingMode, setSavingMode] = useState(false);
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState<{ kind: BlackboardKind; topic: string; content: string; to: string }>({
    kind: 'note', topic: '', content: '', to: '',
  });
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await api.processes.blackboard(process.id));
    } catch (err) {
      const msg = (err as Error).message || '';
      if (/404|not found/i.test(msg)) {
        setView((prev) => prev ?? {
          mode: process.messagingMode ?? 'BLACKBOARD',
          entries: [],
          runs: [],
        });
      } else {
        toast.error('Could not load the blackboard', msg);
      }
    } finally {
      setLoading(false);
    }
  }, [process.id, process.messagingMode, toast]);

  useEffect(() => {
    if (!open) return;
    load();
    const socket = getSocket();
    const onUpdate = (p: { processId?: string }) => { if (p?.processId === process.id) load(); };
    socket.on('blackboard:updated', onUpdate);
    socket.on('process:run:updated', onUpdate);
    return () => {
      socket.off('blackboard:updated', onUpdate);
      socket.off('process:run:updated', onUpdate);
    };
  }, [open, load, process.id]);

  const mode: MessagingMode = view?.mode ?? process.messagingMode ?? 'BLACKBOARD';
  const entries = view?.entries ?? [];
  const shown = useMemo(() => [...entries].filter(FILTERS[filter]).reverse(), [entries, filter]);
  const counts = useMemo(() => ({
    all: entries.length,
    open: entries.filter(FILTERS.open).length,
    agreements: entries.filter(FILTERS.agreements).length,
    artifacts: entries.filter(FILTERS.artifacts).length,
    issues: entries.filter(FILTERS.issues).length,
  }), [entries]);

  const setMode = async (next: MessagingMode) => {
    if (next === mode) return;
    setSavingMode(true);
    try {
      await api.processes.update(process.id, { messagingMode: next });
      setView((v) => (v ? { ...v, mode: next } : v));
      toast.success('Messaging mode saved', `The next run uses ${MODE_INFO[next].label.toLowerCase()}.`);
      onModeChanged?.();
    } catch (err) {
      toast.error('Could not change the mode', (err as Error).message);
    } finally {
      setSavingMode(false);
    }
  };

  const post = async () => {
    if (!draft.topic.trim() || !draft.content.trim()) return;
    setPosting(true);
    try {
      await api.processes.postToBlackboard(process.id, {
        kind: draft.kind, topic: draft.topic.trim(), content: draft.content.trim(), ...(draft.to.trim() ? { to: draft.to.trim() } : {}),
      });
      setDraft({ kind: 'note', topic: '', content: '', to: '' });
      setComposing(false);
      toast.success('Posted to the blackboard', 'Agents read it on their next step.');
      load();
    } catch (err) {
      toast.error('Could not post', (err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const runs = view?.runs ?? [];
  const byMode = (m: MessagingMode) => runs.filter((r) => (r.messagingMode ?? r.messaging?.mode) === m && r.messaging);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={Network}
      title={`Blackboard — ${process.name}`}
      description="The shared state this production's agents read before working and post to when done."
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        {/* Messaging mode */}
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">Context sharing</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(MODE_INFO) as MessagingMode[]).map((m) => {
              const info = MODE_INFO[m];
              const active = mode === m;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={savingMode}
                  onClick={() => setMode(m)}
                  aria-pressed={active}
                  className={
                    'flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors ' +
                    (active
                      ? 'border-brand-600/40 bg-brand-500/10 dark:border-brand-500/40'
                      : 'border-line bg-inset hover:border-line-strong')
                  }
                >
                  <info.icon size={16} className={active ? 'mt-0.5 text-brand-600 dark:text-brand-400' : 'mt-0.5 text-ink-faint'} aria-hidden />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-medium text-ink">
                      {info.label}
                      {active && <Badge tone="brand" size="sm">In use</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-subtle">{info.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <Tabs
            items={[
              { value: 'board', label: 'Board', icon: Network, count: entries.length },
              { value: 'compare', label: 'Compare runs', icon: GitCompareArrows, count: runs.filter((r) => r.messaging).length },
            ]}
            value={tab}
            onChange={setTab}
            aria-label="Blackboard sections"
          />
          <div className="flex items-center gap-1">
            {tab === 'board' && (
              <Button variant="secondary" size="xs" icon={Plus} onClick={() => setComposing((v) => !v)}>
                Post
              </Button>
            )}
            <Button variant="ghost" size="xs" iconOnly icon={RefreshCw} loading={loading} onClick={load} aria-label="Refresh blackboard" />
          </div>
        </div>

        {tab === 'board' && (
          <>
            {composing && (
              <div className="space-y-2 rounded-lg border border-line bg-inset p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Select
                    label="Kind"
                    value={draft.kind}
                    onChange={(e) => setDraft({ ...draft, kind: e.target.value as BlackboardKind })}
                    options={(Object.keys(KIND) as BlackboardKind[]).map((k) => ({ value: k, label: KIND[k].label }))}
                  />
                  <Input label="For (role, optional)" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} placeholder="e.g. Frontend Developer" />
                  <Input label="Topic" value={draft.topic} onChange={(e) => setDraft({ ...draft, topic: e.target.value })} placeholder="Short title" />
                </div>
                <Textarea label="Content" rows={3} value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} placeholder="What the agents should know or do" />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setComposing(false)}>Cancel</Button>
                  <Button variant="primary" size="sm" loading={posting} disabled={!draft.topic.trim() || !draft.content.trim()} onClick={post}>
                    Post to board
                  </Button>
                </div>
              </div>
            )}

            <Tabs
              items={[
                { value: 'all', label: 'All', count: counts.all },
                { value: 'open', label: 'Open', count: counts.open },
                { value: 'agreements', label: 'Decisions & contracts', count: counts.agreements },
                { value: 'artifacts', label: 'Artifacts', count: counts.artifacts },
                { value: 'issues', label: 'Issues & answers', count: counts.issues },
              ]}
              value={filter}
              onChange={setFilter}
              aria-label="Filter entries"
            />

            {shown.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-subtle">
                {entries.length === 0
                  ? mode === 'BLACKBOARD'
                    ? 'Nothing on the board yet. Run the production and agents will post here as they work.'
                    : 'This production uses peer-to-peer messaging, so agents do not post to a board. Switch to Blackboard to share state.'
                  : 'No entries match this filter.'}
              </p>
            ) : (
              <ul className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
                {shown.map((e) => {
                  const k = KIND[e.kind] ?? KIND.note;
                  return (
                    <li key={e.id} className="rounded-lg border border-line-subtle bg-surface p-3 shadow-2xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={k.tone} icon={k.icon}>{k.label}</Badge>
                        <span className="text-sm font-semibold text-ink">{e.topic}</span>
                        {e.status === 'open' && <Badge tone="warning" dot pulse>Open</Badge>}
                        {e.status === 'resolved' && <Badge tone="success" icon={CheckCircle2}>Resolved by {e.resolvedBy}</Badge>}
                      </div>
                      <p className="mt-1 text-2xs text-ink-faint">
                        {e.author}
                        {e.to ? <> <ArrowRight size={10} className="inline" aria-label="to" /> {e.to}</> : null}
                        {e.stage != null ? ` · stage ${e.stage}` : ''} · {new Date(e.createdAt).toLocaleString()} · <span className="font-mono">{e.id.slice(0, 8)}</span>
                      </p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-ink-muted">{e.content}</p>
                      {e.resolution && (
                        <p className="mt-2 flex gap-1.5 rounded-md bg-emerald-500/8 p-2 text-xs text-emerald-700 dark:text-emerald-300">
                          <CircleDot size={12} className="mt-0.5 shrink-0" aria-hidden />
                          <span className="whitespace-pre-wrap break-words">{e.resolution}</span>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}

        {tab === 'compare' && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {(['BLACKBOARD', 'PEER_TO_PEER'] as MessagingMode[]).map((m) => {
                const rs = byMode(m);
                return (
                  <div key={m} className="rounded-lg border border-line bg-inset p-3">
                    <p className="text-sm font-medium text-ink">{MODE_INFO[m].label}</p>
                    {rs.length === 0 ? (
                      <p className="mt-1 text-xs text-ink-subtle">No runs in this mode yet. Switch the mode above and run the production to compare.</p>
                    ) : (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <dt className="text-ink-faint">Runs</dt><dd className="text-right font-mono text-ink">{rs.length}</dd>
                        <dt className="text-ink-faint">Avg. time</dt><dd className="text-right font-mono text-ink">{fmtDuration(avg(rs.map((r) => r.durationMs ?? 0)))}</dd>
                        <dt className="text-ink-faint">Avg. tokens</dt><dd className="text-right font-mono text-ink">{avg(rs.map((r) => r.totalTokens)).toLocaleString()}</dd>
                        <dt className="text-ink-faint">Avg. context per agent</dt><dd className="text-right font-mono text-ink">{avg(rs.flatMap((r) => r.messaging!.contextChars)).toLocaleString()} chars</dd>
                        <dt className="text-ink-faint">Issues raised / resolved</dt><dd className="text-right font-mono text-ink">{rs.reduce((n, r) => n + r.messaging!.issuesRaised, 0)} / {rs.reduce((n, r) => n + r.messaging!.issuesResolved, 0)}</dd>
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>

            {runs.length === 0 ? (
              <p className="text-sm text-ink-subtle">No runs yet.</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-inset text-left text-2xs uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="px-2.5 py-2">Run</th>
                      <th className="px-2.5 py-2">Mode</th>
                      <th className="px-2.5 py-2">Result</th>
                      <th className="px-2.5 py-2 text-right">Time</th>
                      <th className="px-2.5 py-2 text-right">Tokens</th>
                      <th className="px-2.5 py-2 text-right">Avg. context</th>
                      <th className="px-2.5 py-2 text-right">Entries</th>
                      <th className="px-2.5 py-2 text-right">Issues</th>
                      <th className="px-2.5 py-2 text-right">Follow-ups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => {
                      const m = r.messaging;
                      const rm = r.messagingMode ?? m?.mode;
                      return (
                        <tr key={r.id} className="border-t border-line-subtle">
                          <td className="px-2.5 py-2 font-mono text-ink-subtle">{new Date(r.startedAt).toLocaleString()}</td>
                          <td className="px-2.5 py-2">{rm ? (rm === 'BLACKBOARD' ? 'Blackboard' : 'Peer-to-peer') : <span className="text-ink-faint">before modes</span>}</td>
                          <td className="px-2.5 py-2">{r.state.toLowerCase()}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{fmtDuration(r.durationMs)}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{r.totalTokens.toLocaleString()}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{m ? `${avg(m.contextChars).toLocaleString()} ch` : '—'}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{m ? m.entriesPosted : '—'}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{m ? `${m.issuesRaised} / ${m.issuesResolved}` : '—'}</td>
                          <td className="px-2.5 py-2 text-right font-mono">{m ? m.reworkSteps : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-2xs text-ink-faint">
              Avg. context is how much shared information each agent step received. Issues are those raised on the board and resolved through it;
              follow-ups are extra steps the blackboard controller ran to resolve them.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
