import crypto from 'node:crypto';
import { NotificationKind, PreviewVisibility } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Cross-cutting features that hang off runs: notifications, cost forecasting,
 * per-agent insight, run annotations and artifact sharing.
 */

/* ---- Notifications ------------------------------------------------------ */

export async function notify(
  organizationId: string,
  kind: NotificationKind,
  title: string,
  opts: { body?: string; link?: string; processId?: string } = {},
): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        organizationId,
        kind,
        title,
        body: opts.body?.slice(0, 2000),
        link: opts.link,
        processId: opts.processId,
      },
    });
  } catch (err) {
    // Never let a notification failure break the thing it was reporting on.
    logger.warn({ err, kind }, 'Could not record notification');
  }
}

/**
 * Notifications for a user, with read state that is theirs alone.
 *
 * Read state used to live on the notification itself, so whoever opened the
 * bell first marked every alert read for the whole organization and everyone
 * else silently lost the signal. A per-user receipt fixes that; a notification
 * dismissed org-wide (`readAt`) still counts as read for all.
 */
export async function listNotifications(
  organizationId: string,
  userId: string | undefined,
  opts: { unreadOnly?: boolean; limit?: number } = {},
) {
  const rows = await prisma.notification.findMany({
    where: {
      organizationId,
      ...(opts.unreadOnly
        ? { readAt: null, ...(userId ? { reads: { none: { userId } } } : {}) }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(opts.limit ?? 30, 100),
    include: userId
      ? { reads: { where: { userId }, select: { readAt: true }, take: 1 } }
      : undefined,
  });

  // Collapse the receipt into the flat `readAt` the client already renders,
  // so per-user state is invisible to the UI contract.
  return rows.map(({ reads, ...n }: (typeof rows)[number] & { reads?: Array<{ readAt: Date }> }) => ({
    ...n,
    readAt: reads?.[0]?.readAt ?? n.readAt,
  }));
}

export async function unreadCount(
  organizationId: string,
  userId?: string,
): Promise<number> {
  return prisma.notification.count({
    where: {
      organizationId,
      readAt: null,
      ...(userId ? { reads: { none: { userId } } } : {}),
    },
  });
}

/** Records read receipts for this user. Returns how many were newly read. */
export async function markRead(
  organizationId: string,
  userId: string | undefined,
  ids?: string[],
): Promise<number> {
  // No identified user (service token): fall back to the org-wide flag.
  if (!userId) {
    const { count } = await prisma.notification.updateMany({
      where: {
        organizationId,
        readAt: null,
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      data: { readAt: new Date() },
    });
    return count;
  }

  // Batched, and repeated until drained: a single capped pass left anyone with
  // a long backlog still showing a badge right after "mark all read".
  const BATCH = 500;
  const MAX_BATCHES = 40; // 20k receipts is far past any real backlog.
  let marked = 0;

  for (let pass = 0; pass < MAX_BATCHES; pass++) {
    const targets = await prisma.notification.findMany({
      where: {
        organizationId,
        reads: { none: { userId } },
        ...(ids && ids.length > 0 ? { id: { in: ids } } : {}),
      },
      select: { id: true },
      take: BATCH,
    });
    if (targets.length === 0) break;

    // skipDuplicates: two tabs opening the bell at once would otherwise collide
    // on the (notificationId, userId) unique constraint.
    const { count } = await prisma.notificationRead.createMany({
      data: targets.map((t) => ({ notificationId: t.id, userId })),
      skipDuplicates: true,
    });
    marked += count;

    // A full batch that marked nothing means every row was already read by a
    // concurrent request — stop rather than spin on the same page forever.
    if (count === 0 || targets.length < BATCH) break;
  }

  return marked;
}

/* ---- Cost forecasting ---------------------------------------------------
   A chain cost $4.61 before anyone could react. Past runs are the best
   available predictor, so surface an estimate *before* committing.
   ------------------------------------------------------------------------ */

export interface CostEstimate {
  /** How the number was derived, so the UI can be honest about confidence. */
  basis: 'history' | 'similar' | 'none';
  runsSampled: number;
  estimatedCostUsd: number;
  estimatedTokens: number;
  estimatedMs: number;
  /** Spread across sampled runs, for a range rather than a false precision. */
  minCostUsd: number;
  maxCostUsd: number;
}

const EMPTY: CostEstimate = {
  basis: 'none',
  runsSampled: 0,
  estimatedCostUsd: 0,
  estimatedTokens: 0,
  estimatedMs: 0,
  minCostUsd: 0,
  maxCostUsd: 0,
};

function summarise(
  runs: Array<{ totalCostUsd: number; totalTokens: number; durationMs: number | null }>,
  basis: CostEstimate['basis'],
): CostEstimate {
  if (runs.length === 0) return EMPTY;
  const costs = runs.map((r) => r.totalCostUsd);
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    basis,
    runsSampled: runs.length,
    estimatedCostUsd: Number(avg(costs).toFixed(4)),
    estimatedTokens: Math.round(avg(runs.map((r) => r.totalTokens))),
    estimatedMs: Math.round(avg(runs.map((r) => r.durationMs ?? 0))),
    minCostUsd: Number(Math.min(...costs).toFixed(4)),
    maxCostUsd: Number(Math.max(...costs).toFixed(4)),
  };
}

/**
 * Estimates a run's cost from this chain's own history, falling back to other
 * chains with the same agent count when it has never run.
 */
export async function estimateRunCost(
  processId: string,
  organizationId: string,
): Promise<CostEstimate> {
  const own = await prisma.processRun.findMany({
    where: {
      processId,
      organizationId,
      state: { in: ['COMPLETED', 'FAILED'] },
      totalCostUsd: { gt: 0 },
    },
    orderBy: { startedAt: 'desc' },
    take: 5,
    select: { totalCostUsd: true, totalTokens: true, durationMs: true },
  });
  if (own.length > 0) return summarise(own, 'history');

  // Never run — use chains of comparable size as a rough proxy.
  const proc = await prisma.process.findFirst({
    where: { id: processId, organizationId },
    select: { agentCount: true },
  });
  if (!proc) return EMPTY;

  const similar = await prisma.processRun.findMany({
    where: {
      organizationId,
      totalCostUsd: { gt: 0 },
      process: { agentCount: { gte: proc.agentCount - 1, lte: proc.agentCount + 1 } },
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
    select: { totalCostUsd: true, totalTokens: true, durationMs: true },
  });
  return summarise(similar, 'similar');
}

/* ---- Per-agent insight -------------------------------------------------- */

export interface AgentInsight {
  agentId: string;
  agentName: string;
  runs: number;
  failures: number;
  successRate: number;
  avgDurationMs: number;
  totalCostUsd: number;
  totalTokens: number;
}

/** Which agents are slow, expensive or unreliable — ranked by spend. */
export async function agentInsights(organizationId: string): Promise<AgentInsight[]> {
  const steps = await prisma.processRunStep.findMany({
    where: { run: { organizationId } },
    select: {
      agentId: true,
      agentName: true,
      state: true,
      durationMs: true,
      costUsd: true,
      tokens: true,
    },
  });

  const byAgent = new Map<string, AgentInsight & { _totalMs: number }>();
  for (const s of steps) {
    const cur =
      byAgent.get(s.agentId) ??
      {
        agentId: s.agentId,
        agentName: s.agentName,
        runs: 0,
        failures: 0,
        successRate: 0,
        avgDurationMs: 0,
        totalCostUsd: 0,
        totalTokens: 0,
        _totalMs: 0,
      };

    cur.runs += 1;
    if (s.state !== 'COMPLETED') cur.failures += 1;
    cur._totalMs += s.durationMs;
    cur.totalCostUsd += s.costUsd;
    cur.totalTokens += s.tokens;
    byAgent.set(s.agentId, cur);
  }

  return [...byAgent.values()]
    .map(({ _totalMs, ...a }) => ({
      ...a,
      successRate: a.runs > 0 ? Math.round(((a.runs - a.failures) / a.runs) * 100) : 0,
      avgDurationMs: a.runs > 0 ? Math.round(_totalMs / a.runs) : 0,
      totalCostUsd: Number(a.totalCostUsd.toFixed(4)),
    }))
    .sort((a, b) => b.totalCostUsd - a.totalCostUsd);
}

/* ---- Run comparison -----------------------------------------------------
   "It used to be faster" is only actionable if you can see *which stage*
   changed. Comparing two runs of the same chain attributes the delta to an
   agent rather than leaving it as a total.
   ------------------------------------------------------------------------ */

export interface RunSideSummary {
  id: string;
  state: string;
  startedAt: string;
  totalCostUsd: number;
  totalTokens: number;
  durationMs: number;
  steps: number;
}

export interface StageDelta {
  stage: number;
  agentName: string;
  /** Null when the stage only exists on one side (the roster changed). */
  baseCostUsd: number | null;
  headCostUsd: number | null;
  baseDurationMs: number | null;
  headDurationMs: number | null;
  costDelta: number;
  durationDelta: number;
  baseOk: boolean | null;
  headOk: boolean | null;
}

export interface RunComparison {
  base: RunSideSummary;
  head: RunSideSummary;
  costDelta: number;
  tokenDelta: number;
  durationDelta: number;
  /** Percent change in cost, or null when the baseline was free. */
  costPct: number | null;
  stages: StageDelta[];
}

const side = (r: {
  id: string;
  state: string;
  startedAt: Date;
  totalCostUsd: number;
  totalTokens: number;
  durationMs: number | null;
  steps: unknown[];
}): RunSideSummary => ({
  id: r.id,
  state: r.state,
  startedAt: r.startedAt.toISOString(),
  totalCostUsd: r.totalCostUsd,
  totalTokens: r.totalTokens,
  durationMs: r.durationMs ?? 0,
  steps: r.steps.length,
});

/**
 * Compares two runs stage by stage.
 *
 * Both must belong to the caller's org; they need not be the same chain, but
 * the stage-level diff only means anything when they are.
 */
export async function compareRuns(
  baseId: string,
  headId: string,
  organizationId: string,
): Promise<RunComparison | null> {
  const [base, head] = await Promise.all([
    prisma.processRun.findFirst({
      where: { id: baseId, organizationId },
      include: { steps: { orderBy: { stage: 'asc' } } },
    }),
    prisma.processRun.findFirst({
      where: { id: headId, organizationId },
      include: { steps: { orderBy: { stage: 'asc' } } },
    }),
  ]);
  if (!base || !head) return null;

  // Key by stage *and* agent: a chain can have several agents in one stage,
  // and collapsing them would attribute one agent's regression to another.
  type Step = (typeof base.steps)[number];
  const key = (s: Step) => `${s.stage}::${s.agentName}`;
  const baseByKey = new Map(base.steps.map((s) => [key(s), s]));
  const headByKey = new Map(head.steps.map((s) => [key(s), s]));

  const stages: StageDelta[] = [...new Set([...baseByKey.keys(), ...headByKey.keys()])]
    .map((k) => {
      const b = baseByKey.get(k);
      const h = headByKey.get(k);
      const ref = h ?? b!;
      return {
        stage: ref.stage,
        agentName: ref.agentName,
        baseCostUsd: b ? Number(b.costUsd.toFixed(4)) : null,
        headCostUsd: h ? Number(h.costUsd.toFixed(4)) : null,
        baseDurationMs: b ? b.durationMs : null,
        headDurationMs: h ? h.durationMs : null,
        costDelta: Number(((h?.costUsd ?? 0) - (b?.costUsd ?? 0)).toFixed(4)),
        durationDelta: (h?.durationMs ?? 0) - (b?.durationMs ?? 0),
        baseOk: b ? b.state === 'COMPLETED' : null,
        headOk: h ? h.state === 'COMPLETED' : null,
      };
    })
    // Biggest cost regression first — that's what someone opened this to find.
    .sort((a, z) => z.costDelta - a.costDelta || a.stage - z.stage);

  return {
    base: side(base),
    head: side(head),
    costDelta: Number((head.totalCostUsd - base.totalCostUsd).toFixed(4)),
    tokenDelta: head.totalTokens - base.totalTokens,
    durationDelta: (head.durationMs ?? 0) - (base.durationMs ?? 0),
    costPct:
      base.totalCostUsd > 0
        ? Math.round(((head.totalCostUsd - base.totalCostUsd) / base.totalCostUsd) * 100)
        : null,
    stages,
  };
}

/* ---- Run annotations ---------------------------------------------------- */

export async function annotateRun(id: string, organizationId: string, note: string) {
  const run = await prisma.processRun.findFirst({ where: { id, organizationId } });
  if (!run) return null;
  return prisma.processRun.update({
    where: { id },
    data: { note: note.slice(0, 4000) || null },
  });
}

/* ---- Artifact sharing ---------------------------------------------------
   The preview route is unauthenticated and keyed only by chain id, which is
   obscurity rather than access control. This lets an operator lock a chain
   down, or hand out a revocable token instead.
   ------------------------------------------------------------------------ */

export async function setPreviewVisibility(
  processId: string,
  organizationId: string,
  visibility: PreviewVisibility,
  rotate = false,
) {
  const proc = await prisma.process.findFirst({ where: { id: processId, organizationId } });
  if (!proc) return null;

  const needsToken = visibility === PreviewVisibility.TOKEN;
  const shareToken =
    needsToken && (rotate || !proc.shareToken)
      ? crypto.randomBytes(24).toString('base64url')
      : needsToken
        ? proc.shareToken
        : null;

  return prisma.process.update({
    where: { id: processId },
    data: { previewVisibility: visibility, shareToken },
    select: { id: true, previewVisibility: true, shareToken: true },
  });
}

// In-memory cache of authenticated preview session tokens with 4-hour TTL
const authorizedPreviewSessions = new Map<string, { processId: string; expiresAt: number }>();

export function recordAuthorizedPreviewSession(processId: string, token: string): void {
  authorizedPreviewSessions.set(token, {
    processId,
    expiresAt: Date.now() + 4 * 60 * 60 * 1000,
  });
}

export function isAuthorizedPreviewSession(processId: string, token?: string): boolean {
  if (!token) return false;
  const session = authorizedPreviewSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    authorizedPreviewSessions.delete(token);
    return false;
  }
  return session.processId === processId;
}

/** Decides whether a preview request may proceed. */
export async function canViewPreview(
  processId: string,
  token?: string,
  userOrgIds?: string[] | string,
): Promise<boolean> {
  const proc = await prisma.process.findUnique({
    where: { id: processId },
    select: { organizationId: true, previewVisibility: true, shareToken: true },
  });
  // Unknown or deleted chain: deny access by default (fail closed)
  if (!proc) return false;

  // 1. If user is authenticated and belongs to the owning organization, allow preview
  if (userOrgIds) {
    const orgs = Array.isArray(userOrgIds) ? userOrgIds : [userOrgIds];
    if (orgs.includes(proc.organizationId)) return true;
  }

  // 2. If token is an active authenticated preview session for this process, allow preview
  if (token && isAuthorizedPreviewSession(processId, token)) {
    return true;
  }

  // 3. If token is provided and matches shareToken, allow preview
  if (proc.shareToken && token) {
    const a = Buffer.from(proc.shareToken);
    const b = Buffer.from(token);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
      return true;
    }
  }

  // 4. PRIVATE or TOKEN without matching org or valid token: deny
  if (proc.previewVisibility === PreviewVisibility.PRIVATE || proc.previewVisibility === PreviewVisibility.TOKEN) {
    return false;
  }

  return proc.previewVisibility === PreviewVisibility.PUBLIC;
}
