import crypto from 'node:crypto';
import { DeliveryOutcome, Prisma, RunTrigger } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { safeFetch, validateExternalUrl } from '../lib/url-validator.js';

/**
 * Everything that hangs off a production chain but isn't the run itself:
 * run history, reusable templates, cron schedules, and outbound webhooks.
 */

/* ---- Run history -------------------------------------------------------- */

export async function listRuns(
  organizationId: string,
  opts: { processId?: string; limit?: number } = {},
) {
  return prisma.processRun.findMany({
    where: {
      organizationId,
      ...(opts.processId ? { processId: opts.processId } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: Math.min(opts.limit ?? 25, 100),
    include: {
      process: { select: { id: true, name: true, color: true } },
      _count: { select: { steps: true } },
    },
  });
}

export async function getRun(id: string, organizationId: string) {
  return prisma.processRun.findFirst({
    where: { id, organizationId },
    include: {
      steps: { orderBy: [{ stage: 'asc' }, { startedAt: 'asc' }] },
      process: { select: { id: true, name: true, color: true } },
    },
  });
}

/** Aggregate stats for the runs dashboard. */
export async function getRunStats(organizationId: string) {
  const [total, completed, failed, agg] = await Promise.all([
    prisma.processRun.count({ where: { organizationId } }),
    prisma.processRun.count({ where: { organizationId, state: 'COMPLETED' } }),
    prisma.processRun.count({ where: { organizationId, state: 'FAILED' } }),
    prisma.processRun.aggregate({
      where: { organizationId },
      _sum: { totalTokens: true, totalCostUsd: true },
      _avg: { durationMs: true },
    }),
  ]);

  return {
    total,
    completed,
    failed,
    successRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalTokens: agg._sum.totalTokens ?? 0,
    totalCostUsd: agg._sum.totalCostUsd ?? 0,
    avgDurationMs: Math.round(agg._avg.durationMs ?? 0),
  };
}

/* ---- Chain approval gates ----------------------------------------------- */

export async function listGates(
  organizationId: string,
  opts: { processId?: string; pendingOnly?: boolean } = {},
) {
  return prisma.chainApproval.findMany({
    where: {
      organizationId,
      ...(opts.processId ? { processId: opts.processId } : {}),
      ...(opts.pendingOnly ? { status: 'PENDING' } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { process: { select: { id: true, name: true, color: true } } },
  });
}

/** Records a decision. Returns null if the gate is missing or already decided. */
export async function decideGate(
  id: string,
  organizationId: string,
  approve: boolean,
  note?: string,
) {
  const gate = await prisma.chainApproval.findFirst({
    where: { id, organizationId, status: 'PENDING' },
  });
  if (!gate) return null;

  return prisma.chainApproval.update({
    where: { id },
    data: {
      status: approve ? 'APPROVED' : 'REJECTED',
      decidedAt: new Date(),
      note: note?.slice(0, 2000),
    },
  });
}

/* ---- Templates ---------------------------------------------------------- */

export async function listTemplates(organizationId: string) {
  return prisma.processTemplate.findMany({
    where: { organizationId },
    orderBy: [{ usageCount: 'desc' }, { createdAt: 'desc' }],
  });
}

/** Captures an existing chain's roster so it can be reused without replanning. */
export async function saveTemplate(
  organizationId: string,
  data: { processId?: string; name: string; description?: string; category?: string; prompt?: string; plan?: unknown },
) {
  let prompt = data.prompt ?? '';
  let plan = data.plan;
  let agentCount = 0;

  if (data.processId) {
    const proc = await prisma.process.findFirst({
      where: { id: data.processId, organizationId },
      include: { agents: true },
    });
    if (!proc) return null;
    prompt = proc.prompt;
    plan = proc.plan;
    agentCount = proc.agents.length;
  } else if (plan && typeof plan === 'object' && 'agents' in (plan as Record<string, unknown>)) {
    agentCount = ((plan as { agents?: unknown[] }).agents ?? []).length;
  }

  return prisma.processTemplate.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description,
      category: data.category,
      prompt,
      plan: (plan ?? {}) as Prisma.InputJsonValue,
      agentCount,
    },
  });
}

export async function deleteTemplate(id: string, organizationId: string) {
  const existing = await prisma.processTemplate.findFirst({ where: { id, organizationId } });
  if (!existing) return false;
  await prisma.processTemplate.delete({ where: { id } });
  return true;
}

/** Bumps usage so the list can rank by what people actually reuse. */
export async function markTemplateUsed(id: string, organizationId: string) {
  await prisma.processTemplate
    .updateMany({ where: { id, organizationId }, data: { usageCount: { increment: 1 } } })
    .catch(() => {});
}

/* ---- Schedules ----------------------------------------------------------
   A tiny cron implementation supporting the 5 standard fields with wildcards,
   step values, ranges and comma lists — enough for "every day at 9" without
   pulling in a dependency.
   ------------------------------------------------------------------------ */

function matchField(field: string, value: number, min: number, max: number): boolean {
  if (field === '*') return true;
  for (const part of field.split(',')) {
    if (part.startsWith('*/')) {
      const step = Number(part.slice(2));
      if (step > 0 && (value - min) % step === 0) return true;
    } else if (part.includes('-')) {
      const [a, b] = part.split('-').map(Number);
      if (value >= a && value <= b) return true;
    } else if (Number(part) === value) {
      return true;
    }
  }
  return false;
}

export function cronMatches(expr: string, at: Date): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [min, hour, dom, mon, dow] = fields;
  return (
    matchField(min, at.getMinutes(), 0, 59) &&
    matchField(hour, at.getHours(), 0, 23) &&
    matchField(dom, at.getDate(), 1, 31) &&
    matchField(mon, at.getMonth() + 1, 1, 12) &&
    matchField(dow, at.getDay(), 0, 6)
  );
}

/** Legal value range for each cron field, in order. */
const CRON_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6],  // day of week
];

/**
 * Validates shape *and* range. A shape-only check accepts "99 99 * * *",
 * which would then silently never fire.
 */
export function isValidCron(expr: string): boolean {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) return false;

  return fields.every((field, i) => {
    const [min, max] = CRON_RANGES[i];
    const inRange = (n: number) => Number.isInteger(n) && n >= min && n <= max;

    return field.split(',').every((part) => {
      if (part === '*') return true;

      const step = part.match(/^\*\/(\d+)$/);
      if (step) {
        const n = Number(step[1]);
        return n > 0 && n <= max;
      }

      const range = part.match(/^(\d+)-(\d+)$/);
      if (range) {
        const a = Number(range[1]);
        const b = Number(range[2]);
        return inRange(a) && inRange(b) && a <= b;
      }

      return /^\d+$/.test(part) && inRange(Number(part));
    });
  });
}

export async function listSchedules(organizationId: string, processId?: string) {
  return prisma.processSchedule.findMany({
    where: { organizationId, ...(processId ? { processId } : {}) },
    orderBy: { createdAt: 'desc' },
    include: { process: { select: { id: true, name: true, color: true } } },
  });
}

export async function createSchedule(
  organizationId: string,
  data: { processId: string; cron: string; timezone?: string; enabled?: boolean },
) {
  const proc = await prisma.process.findFirst({
    where: { id: data.processId, organizationId },
  });
  if (!proc) return null;

  return prisma.processSchedule.create({
    data: {
      organizationId,
      processId: data.processId,
      cron: data.cron,
      timezone: data.timezone ?? 'UTC',
      enabled: data.enabled ?? true,
    },
  });
}

export async function updateSchedule(
  id: string,
  organizationId: string,
  data: { cron?: string; enabled?: boolean; timezone?: string },
) {
  const existing = await prisma.processSchedule.findFirst({ where: { id, organizationId } });
  if (!existing) return null;
  return prisma.processSchedule.update({ where: { id }, data });
}

export async function deleteSchedule(id: string, organizationId: string) {
  const existing = await prisma.processSchedule.findFirst({ where: { id, organizationId } });
  if (!existing) return false;
  await prisma.processSchedule.delete({ where: { id } });
  return true;
}

/**
 * Ticks every minute; starts any chain whose cron matches and that isn't
 * already running. Returns the schedules it fired.
 */
export async function dueSchedules(now = new Date()) {
  const schedules = await prisma.processSchedule.findMany({
    where: { enabled: true },
    include: { process: { select: { id: true, name: true } } },
  });

  return schedules.filter((s) => {
    // Never fire twice inside the same minute.
    if (s.lastRunAt && now.getTime() - s.lastRunAt.getTime() < 60_000) return false;
    return cronMatches(s.cron, now);
  });
}

export async function markScheduleFired(id: string) {
  await prisma.processSchedule
    .update({ where: { id }, data: { lastRunAt: new Date() } })
    .catch(() => {});
}

/**
 * Atomically claims a due schedule, returning false if someone else got it.
 *
 * The scheduler used to read the due list, start the run, and only then record
 * the firing — so two backend instances ticking the same minute would both see
 * the schedule as due and both start a run, double-billing the chain. This is
 * a compare-and-swap on the `lastRunAt` we read: the UPDATE only matches while
 * that value is unchanged, so exactly one instance can win.
 *
 * Claiming happens *before* the run starts, which makes a crash between claim
 * and start lose that firing rather than duplicate it — the safe direction
 * when the alternative is paying twice.
 */
export async function claimSchedule(
  id: string,
  lastRunAt: Date | null,
  now = new Date(),
): Promise<boolean> {
  const { count } = await prisma.processSchedule.updateMany({
    where: { id, enabled: true, lastRunAt },
    data: { lastRunAt: now },
  });
  return count === 1;
}

/* ---- Webhooks ----------------------------------------------------------- */

export async function listWebhooks(organizationId: string, processId?: string) {
  return prisma.processWebhook.findMany({
    where: { organizationId, ...(processId ? { processId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createWebhook(
  organizationId: string,
  data: { processId: string; url: string; secret?: string; events?: string[] },
) {
  // Block SSRF into internal networks before we ever call the URL.
  try {
    validateExternalUrl(data.url, 'Webhook URL');
  } catch {
    return null;
  }

  const proc = await prisma.process.findFirst({
    where: { id: data.processId, organizationId },
  });
  if (!proc) return null;

  return prisma.processWebhook.create({
    data: {
      organizationId,
      processId: data.processId,
      url: data.url,
      secret: data.secret,
      ...(data.events ? { events: data.events } : {}),
    },
  });
}

export async function deleteWebhook(id: string, organizationId: string) {
  const existing = await prisma.processWebhook.findFirst({ where: { id, organizationId } });
  if (!existing) return false;
  await prisma.processWebhook.delete({ where: { id } });
  return true;
}

/**
 * POSTs a run outcome to every enabled webhook for the chain. Failures are
 * logged, never thrown — a bad endpoint must not fail the run.
 */
export async function fireWebhooks(
  processId: string,
  organizationId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const hooks = await prisma.processWebhook.findMany({
    where: { processId, organizationId, enabled: true },
  });
  if (hooks.length === 0) return;

  const event = payload.state === 'COMPLETED' ? 'run.completed' : 'run.failed';
  const body = JSON.stringify({ event, processId, ...payload, at: new Date().toISOString() });

  await Promise.all(
    hooks.filter((h) => h.events.includes(event)).map((h) => deliverWithRetry(h, event, body)),
  );
}

/** Attempts before a delivery is given up on, and the waits between them. */
const DELIVERY_ATTEMPTS = 3;
const BACKOFF_MS = [1_000, 5_000];

/**
 * How a delivery attempt is judged.
 *
 * Split out so the policy can be tested directly: the sender itself refuses
 * loopback addresses (correctly), which makes a local end-to-end webhook test
 * impossible without weakening the SSRF guard.
 */
export function classifyStatus(status: number): DeliveryOutcome {
  if (status >= 200 && status < 300) return DeliveryOutcome.DELIVERED;
  if (status >= 300 && status < 400) return DeliveryOutcome.REDIRECTED;
  // A 4xx means the receiver understood and refused — repeating it just
  // wastes both sides' time. A 5xx is usually transient.
  if (status < 500) return DeliveryOutcome.REJECTED;
  return DeliveryOutcome.FAILED;
}

/** Distinguishes "we refused to send" from "sending didn't work". */
export function classifyError(message: string): DeliveryOutcome {
  return /private\/internal|protocol|credentials|not a valid URL/i.test(message)
    ? DeliveryOutcome.BLOCKED
    : DeliveryOutcome.FAILED;
}

/** Only a transient failure is worth another go. */
export function isRetryable(outcome: DeliveryOutcome): boolean {
  return outcome === DeliveryOutcome.FAILED;
}

/** The send step, injectable so the retry loop can be exercised in tests. */
export type WebhookSender = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ status: number }>;

/**
 * Delivers one webhook, retrying the failures that are worth retrying.
 *
 * A 4xx means the receiver understood and refused — repeating it just wastes
 * both sides' time. A timeout, a network error or a 5xx is usually transient,
 * and losing a run-completed notification to a one-second blip is exactly the
 * failure this exists to prevent. Every attempt is recorded, so a webhook that
 * has been quietly failing for a week is visible rather than inferred.
 */
export async function deliverWithRetry(
  hook: { id: string; url: string; secret: string | null },
  event: string,
  body: string,
  send: WebhookSender = defaultSender,
  backoff: number[] = BACKOFF_MS,
): Promise<void> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (hook.secret) {
    // HMAC so the receiver can verify the payload really came from us.
    headers['X-Nexus-Signature'] =
      'sha256=' + crypto.createHmac('sha256', hook.secret).update(body).digest('hex');
  }

  for (let attempt = 1; attempt <= DELIVERY_ATTEMPTS; attempt++) {
    const started = Date.now();
    let outcome: DeliveryOutcome;
    let status: number | null = null;
    let error: string | null = null;

    try {
      const res = await send(hook.url, { method: 'POST', headers, body });
      status = res.status;
      outcome = classifyStatus(res.status);
    } catch (err) {
      error = (err as Error).message;
      outcome = classifyError(error);
    }

    const durationMs = Date.now() - started;

    await prisma.webhookDelivery
      .create({
        data: {
          webhookId: hook.id,
          event,
          outcome,
          status,
          error: error?.slice(0, 1000),
          attempt,
          durationMs,
        },
      })
      .catch(() => {
        /* the log must never break the delivery it describes */
      });

    await prisma.processWebhook
      .update({
        where: { id: hook.id },
        data: { lastFiredAt: new Date(), lastStatus: status ?? 0 },
      })
      .catch(() => {});

    if (!isRetryable(outcome) || attempt === DELIVERY_ATTEMPTS) {
      if (outcome !== DeliveryOutcome.DELIVERED) {
        logger.warn(
          { webhookId: hook.id, outcome, status, attempt },
          'Webhook delivery gave up',
        );
      }
      return;
    }

    await new Promise((r) => setTimeout(r, backoff[attempt - 1] ?? 5_000));
  }
}

/**
 * The real sender.
 *
 * safeFetch refuses private addresses at connect time and does not follow
 * redirects — a target that validated at creation could otherwise answer 307
 * and carry this POST, body included, to an internal service. It re-checks
 * the URL on every send, which is what catches a target that has since been
 * pointed somewhere internal.
 */
const defaultSender: WebhookSender = (url, init) => safeFetch(url, init);

/** Recent delivery attempts, newest first — the webhook's own audit trail. */
export async function listDeliveries(
  organizationId: string,
  opts: { webhookId?: string; limit?: number } = {},
) {
  return prisma.webhookDelivery.findMany({
    where: {
      webhook: { organizationId, ...(opts.webhookId ? { id: opts.webhookId } : {}) },
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 50, 200),
    include: { webhook: { select: { id: true, url: true, processId: true } } },
  });
}

/**
 * Drops delivery records past their usefulness.
 *
 * The log grows once per attempt per run per webhook, which on a scheduled
 * chain is unbounded. Kept deliberately simple: age alone, since a delivery
 * from last month tells you nothing you would act on.
 */
export async function pruneDeliveries(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60_000);
  const { count } = await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (count > 0) logger.info({ count }, 'Pruned old webhook deliveries');
  return count;
}

export { RunTrigger };
