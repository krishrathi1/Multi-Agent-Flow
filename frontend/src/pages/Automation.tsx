import { useCallback, useEffect, useState } from 'react';
import { getSocket } from '../lib/socket';
import {
  BookmarkPlus,
  Check,
  ShieldCheck,
  X as XIcon,
  CalendarClock,
  Layers,
  Play,
  Plus,
  Send,
  Trash2,
  Webhook,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import { useProcessStore } from '../stores/process-store';
import type {
  ChainGate,
  DeliveryOutcome,
  ProcessSchedule,
  ProcessTemplate,
  ProcessWebhookConfig,
  WebhookDelivery,
} from '../types';
import type { Tone } from '../lib/design';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea, Toggle } from '../components/ui/Input';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyState, Spinner } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import { ChainPortability } from '../components/process/ChainPortability';

/** Human-readable gloss for the common cron shapes. */
function describeCron(expr: string): string {
  const map: Record<string, string> = {
    '* * * * *': 'Every minute',
    '0 * * * *': 'Hourly, on the hour',
    '0 9 * * *': 'Daily at 09:00',
    '0 9 * * 1': 'Mondays at 09:00',
    '0 0 * * 0': 'Sundays at midnight',
    '*/15 * * * *': 'Every 15 minutes',
  };
  return map[expr.trim()] ?? expr;
}

const CRON_PRESETS = [
  { value: '0 * * * *', label: 'Hourly' },
  { value: '0 9 * * *', label: 'Daily at 09:00' },
  { value: '0 9 * * 1', label: 'Weekly (Mon 09:00)' },
  { value: '*/15 * * * *', label: 'Every 15 minutes' },
  { value: '0 0 * * 0', label: 'Weekly (Sun midnight)' },
];

/**
 * How each delivery outcome reads to an operator.
 *
 * "Blocked" and "failed" are deliberately distinct: one means we refused to
 * send, the other that sending didn't work, and the fixes have nothing in
 * common.
 */
const DELIVERY_META: Record<DeliveryOutcome, { label: string; tone: Tone }> = {
  DELIVERED: { label: 'delivered', tone: 'success' },
  REJECTED: { label: 'refused', tone: 'warning' },
  FAILED: { label: 'failed', tone: 'danger' },
  BLOCKED: { label: 'blocked', tone: 'danger' },
  REDIRECTED: { label: 'redirected', tone: 'warning' },
};

export function Automation() {
  const { processes, fetchProcesses } = useProcessStore();
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [schedules, setSchedules] = useState<ProcessSchedule[]>([]);
  const [webhooks, setWebhooks] = useState<ProcessWebhookConfig[]>([]);
  const [gates, setGates] = useState<ChainGate[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showTemplate, setShowTemplate] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [showWebhook, setShowWebhook] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const [t, s, w, g, d] = await Promise.all([
        api.orchestration.templates(),
        api.orchestration.schedules(),
        api.orchestration.webhooks(),
        api.orchestration.gates({ pendingOnly: true }),
        api.orchestration.webhookDeliveries({ limit: 20 }),
      ]);
      setTemplates(t);
      setSchedules(s);
      setWebhooks(w);
      setGates(g);
      setDeliveries(d);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProcesses();
    load();

    // Automation Hub is a live control surface: approvals, gate decisions,
    // scheduled runs and webhook deliveries can change without this page
    // being manually refreshed. Re-read the small orchestration payload when
    // those server events arrive.
    const socket = getSocket();
    const refresh = () => { void load(); };
    socket.on('approval:created', refresh);
    socket.on('approval:resolved', refresh);
    socket.on('gate:decided', refresh);
    socket.on('run:awaiting-approval', refresh);
    socket.on('process:run', refresh);
    socket.on('process:updated', refresh);
    return () => {
      socket.off('approval:created', refresh);
      socket.off('approval:resolved', refresh);
      socket.off('gate:decided', refresh);
      socket.off('run:awaiting-approval', refresh);
      socket.off('process:run', refresh);
      socket.off('process:updated', refresh);
    };
  }, [fetchProcesses, load]);

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={Zap}
        title="Automation"
        description="Approval gates, reusable blueprints, recurring runs, and outbound notifications."
        badge={
          gates.length > 0 ? (
            <Badge tone="warning" dot pulse>
              {gates.length} waiting
            </Badge>
          ) : undefined
        }
      />

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner size={22} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* ---- Approval gates: these block real work, so they lead ---- */}
          {gates.length > 0 && (
            <section>
              <SectionHeading
                title="Waiting for you"
                description="These chains are paused until someone decides."
              />
              <Card padding="none">
                <ul className="divide-y divide-line-subtle">
                  {gates.map((g) => (
                    <li key={g.id} className="flex flex-wrap items-start gap-3 p-3.5">
                      <ShieldCheck
                        size={16}
                        strokeWidth={1.75}
                        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-ink">
                          {g.title}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint">
                          <Chip>stage {g.stage}</Chip>
                          <span>paused {timeAgo(g.createdAt)}</span>
                        </span>
                        {g.description && (
                          <span className="mt-1.5 block whitespace-pre-wrap text-xs leading-relaxed text-ink-subtle line-clamp-3">
                            {g.description}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={XIcon}
                          loading={busy}
                          onClick={() =>
                            act(async () => {
                              await api.orchestration.decideGate(g.id, false);
                              toast.warning('Stage rejected', 'The chain stays paused.');
                            })
                          }
                        >
                          Reject
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Check}
                          loading={busy}
                          onClick={() =>
                            act(async () => {
                              await api.orchestration.decideGate(g.id, true);
                              toast.success(
                                'Approved',
                                `The chain resumes from stage ${g.stage}.`,
                              );
                            })
                          }
                        >
                          Approve &amp; resume
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}

          {/* ---- Portability ----
              Sits with templates: both are about reusing a roster, one inside
              this installation and one across installations. */}
          <section>
            <SectionHeading
              title="Portability"
              description="Carry a chain to another environment, or bring one in."
            />
            <ChainPortability
              processes={processes}
              onImported={() => {
                fetchProcesses();
                load();
              }}
            />
          </section>

          {/* ---- Templates ---- */}
          <section>
            <SectionHeading
              title="Templates"
              description="Save a proven roster and spin it up again without re-planning."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={BookmarkPlus}
                  onClick={() => setShowTemplate(true)}
                  disabled={processes.length === 0}
                >
                  Save a chain
                </Button>
              }
            />
            {templates.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  compact
                  icon={Layers}
                  title="No templates yet"
                  description="Save an existing production as a template to reuse its agent roster instantly."
                />
              </Card>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {templates.map((t) => (
                  <Card key={t.id} className="flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="min-w-0 truncate text-base font-semibold text-ink">
                        {t.name}
                      </h3>
                      {t.category && <Badge tone="neutral">{t.category}</Badge>}
                    </div>
                    {t.description && (
                      <p className="mt-1 line-clamp-2 text-sm text-ink-subtle">{t.description}</p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs text-ink-faint">
                      <Chip>{t.agentCount} agents</Chip>
                      <Chip>used {t.usageCount}×</Chip>
                    </div>
                    <div className="mt-auto flex items-center gap-2 border-t border-line-subtle pt-3 [&:not(:first-child)]:mt-4">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Play}
                        loading={busy}
                        onClick={() => act(() => api.orchestration.useTemplate(t.id))}
                      >
                        Use
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        iconOnly
                        icon={Trash2}
                        aria-label={`Delete template ${t.name}`}
                        className="ml-auto hover:text-red-500 dark:hover:text-red-300"
                        onClick={() => act(() => api.orchestration.deleteTemplate(t.id))}
                      />
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* ---- Schedules ---- */}
          <section>
            <SectionHeading
              title="Schedules"
              description="Run a chain on a recurring cron schedule."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowSchedule(true)}
                  disabled={processes.length === 0}
                >
                  Add schedule
                </Button>
              }
            />
            {schedules.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  compact
                  icon={CalendarClock}
                  title="Nothing scheduled"
                  description="Schedule a production to run automatically — hourly, daily, or on any cron."
                />
              </Card>
            ) : (
              <Card padding="none">
                <ul className="divide-y divide-line-subtle">
                  {schedules.map((s) => (
                    <li key={s.id} className="flex flex-wrap items-center gap-3 p-3.5">
                      <CalendarClock
                        size={16}
                        strokeWidth={1.75}
                        className="shrink-0 text-ink-faint"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-ink">
                          {s.process?.name ?? 'Production'}
                        </span>
                        <span className="mt-0.5 flex items-center gap-2 text-2xs text-ink-faint">
                          <code className="font-mono">{s.cron}</code>
                          <span>·</span>
                          {describeCron(s.cron)}
                          {s.lastRunAt && (
                            <>
                              <span>·</span>
                              <span>last {timeAgo(s.lastRunAt)}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <Badge tone={s.enabled ? 'success' : 'neutral'} dot>
                        {s.enabled ? 'enabled' : 'paused'}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          act(() =>
                            api.orchestration.updateSchedule(s.id, { enabled: !s.enabled }),
                          )
                        }
                      >
                        {s.enabled ? 'Pause' : 'Enable'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        iconOnly
                        icon={Trash2}
                        aria-label="Delete schedule"
                        className="hover:text-red-500 dark:hover:text-red-300"
                        onClick={() => act(() => api.orchestration.deleteSchedule(s.id))}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>

          {/* ---- Webhooks ---- */}
          <section>
            <SectionHeading
              title="Webhooks"
              description="POST the run outcome to your systems when a chain finishes."
              actions={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setShowWebhook(true)}
                  disabled={processes.length === 0}
                >
                  Add webhook
                </Button>
              }
            />
            {webhooks.length === 0 ? (
              <Card padding="none">
                <EmptyState
                  compact
                  icon={Webhook}
                  title="No webhooks"
                  description="Get notified in Slack, or trigger a deploy, when a production finishes."
                />
              </Card>
            ) : (
              <Card padding="none">
                <ul className="divide-y divide-line-subtle">
                  {webhooks.map((w) => (
                    <li key={w.id} className="flex flex-wrap items-center gap-3 p-3.5">
                      <Webhook
                        size={16}
                        strokeWidth={1.75}
                        className="shrink-0 text-ink-faint"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-sm text-ink">{w.url}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xs text-ink-faint">
                          {w.events.map((e) => (
                            <Chip key={e}>{e}</Chip>
                          ))}
                          {w.secret && <span>· signed</span>}
                          {w.lastFiredAt && <span>· last {timeAgo(w.lastFiredAt)}</span>}
                        </span>
                      </span>
                      {w.lastStatus != null && (
                        <Badge tone={w.lastStatus >= 200 && w.lastStatus < 300 ? 'success' : 'danger'}>
                          {w.lastStatus || 'failed'}
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="xs"
                        iconOnly
                        icon={Trash2}
                        aria-label="Delete webhook"
                        className="hover:text-red-500 dark:hover:text-red-300"
                        onClick={() => act(() => api.orchestration.deleteWebhook(w.id))}
                      />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* A webhook that has been failing quietly for a week used to look
                identical to one that had never fired. */}
            {deliveries.length > 0 && (
              <Card padding="none" className="mt-3">
                <CardHeader
                  bordered
                  icon={Send}
                  title="Recent deliveries"
                  description="Every attempt, including the retries."
                />
                <ul className="divide-y divide-line-subtle">
                  {deliveries.slice(0, 12).map((d) => {
                    const meta = DELIVERY_META[d.outcome] ?? DELIVERY_META.FAILED;
                    return (
                      <li key={d.id} className="flex flex-wrap items-center gap-2.5 px-3.5 py-2.5">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <span className="min-w-0 flex-1 truncate font-mono text-2xs text-ink-subtle">
                          {d.webhook?.url ?? d.webhookId}
                        </span>
                        <Chip>{d.event}</Chip>
                        {d.attempt > 1 && <Chip>attempt {d.attempt}</Chip>}
                        {d.status != null && (
                          <span className="text-2xs tabular-nums text-ink-faint">{d.status}</span>
                        )}
                        <span className="text-2xs tabular-nums text-ink-faint">
                          {d.durationMs}ms
                        </span>
                        <span className="text-2xs text-ink-faint">{timeAgo(d.createdAt)}</span>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </section>
        </div>
      )}

      <SaveTemplateModal
        open={showTemplate}
        onClose={() => setShowTemplate(false)}
        onSaved={load}
      />
      <ScheduleModal open={showSchedule} onClose={() => setShowSchedule(false)} onSaved={load} />
      <WebhookModal open={showWebhook} onClose={() => setShowWebhook(false)} onSaved={load} />
    </>
  );
}

/* ---- Modals ------------------------------------------------------------- */

function SaveTemplateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { processes } = useProcessStore();
  const [processId, setProcessId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!processId || !name.trim()) {
      setError('Pick a production and give the template a name.');
      return;
    }
    setBusy(true);
    try {
      await api.orchestration.saveTemplate({
        processId,
        name: name.trim(),
        description: description.trim() || undefined,
        category: category.trim() || undefined,
      });
      onSaved();
      onClose();
      setName('');
      setDescription('');
      setCategory('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={BookmarkPlus}
      title="Save as template"
      description="Captures the chain's agent roster so it can be recreated instantly."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Save template
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint mb-1.5">
            Production <span className="text-danger">*</span>
          </label>
          <CustomSelect
            value={processId}
            onChange={(val) => setProcessId(val)}
            options={processes.map((p) => ({
              value: p.id,
              label: `${p.name} (${p.agentCount} agents)`,
            }))}
            placeholder="Choose a production…"
          />
          {error && !processId && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
        <Input
          label="Template name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Marketing Site Builder"
        />
        <Input
          label="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. web, research, ops"
          hint="Optional — used to group templates."
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this chain is good for…"
        />
      </div>
    </Modal>
  );
}

function ScheduleModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { processes } = useProcessStore();
  const [processId, setProcessId] = useState('');
  const [cron, setCron] = useState('0 9 * * *');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!processId) {
      setError('Pick a production to schedule.');
      return;
    }
    setBusy(true);
    try {
      await api.orchestration.createSchedule({ processId, cron });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={CalendarClock}
      title="Schedule a production"
      description="The chain runs automatically on this cadence. Overlapping runs are skipped."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Create schedule
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint mb-1.5">
            Production <span className="text-danger">*</span>
          </label>
          <CustomSelect
            value={processId}
            onChange={(val) => setProcessId(val)}
            options={processes.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            placeholder="Choose a production…"
          />
          {error && !processId && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            Cadence
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {CRON_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setCron(p.value)}
                className={cn(
                  'inline-flex h-7 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
                  cron === p.value
                    ? 'border-brand-600/35 bg-brand-500/15 text-brand-700 dark:border-brand-500/35 dark:text-brand-200'
                    : 'border-line bg-raised text-ink-subtle hover:border-line-strong hover:text-ink',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Input
            label="Cron expression"
            value={cron}
            onChange={(e) => setCron(e.target.value)}
            className="font-mono"
            hint={`Standard 5 fields (min hour day month weekday) — ${describeCron(cron)}`}
          />
        </div>
      </div>
    </Modal>
  );
}

function WebhookModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { processes } = useProcessStore();
  const [processId, setProcessId] = useState('');
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [signed, setSigned] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const submit = async () => {
    if (!processId || !url.trim()) {
      setError('Pick a production and enter a destination URL.');
      return;
    }
    setBusy(true);
    try {
      await api.orchestration.createWebhook({
        processId,
        url: url.trim(),
        secret: signed && secret.trim() ? secret.trim() : undefined,
      });
      onSaved();
      onClose();
      setUrl('');
      setSecret('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Webhook}
      title="Add a webhook"
      description="MyceliumOps POSTs the run outcome when the chain finishes."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={submit}>
            Add webhook
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint mb-1.5">
            Production <span className="text-danger">*</span>
          </label>
          <CustomSelect
            value={processId}
            onChange={(val) => setProcessId(val)}
            options={processes.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            placeholder="Choose a production…"
          />
        </div>
        <Input
          label="Destination URL"
          required
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://hooks.example.com/webhook"
          error={error}
          hint="Must be a public address — private and loopback ranges are rejected."
        />
        <Toggle
          checked={signed}
          onChange={setSigned}
          label="Sign the payload"
          description="Adds an HMAC-SHA256 X-Nexus-Signature header so you can verify it came from MyceliumOps."
        />
        {signed && (
          <Input
            label="Signing secret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="A shared secret"
          />
        )}
      </div>
    </Modal>
  );
}
