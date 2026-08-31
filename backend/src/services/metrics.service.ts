import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Prisma } from '@prisma/client';
import { logger } from '../lib/logger.js';
const tracer = trace.getTracer('nexus-metrics');

// ─── Dashboard Time-Series Analytics ────────────────────

type RangeKey = '24h' | '3d' | '7d' | '14d' | '1m' | '3m' | '6m' | '1y';
type BucketKey = 'hour' | 'day' | 'week' | 'month';

interface RangeSpec {
  key: RangeKey;
  start: Date;
  end: Date;
  bucket: BucketKey;
  durationMs: number;
}

const RANGE_SPECS: Record<RangeKey, { ms: number; bucket: BucketKey }> = {
  '24h': { ms: 24 * 60 * 60 * 1000, bucket: 'hour' },
  '3d':  { ms: 3 * 24 * 60 * 60 * 1000, bucket: 'day' },
  '7d':  { ms: 7 * 24 * 60 * 60 * 1000, bucket: 'day' },
  '14d': { ms: 14 * 24 * 60 * 60 * 1000, bucket: 'day' },
  '1m':  { ms: 30 * 24 * 60 * 60 * 1000, bucket: 'day' },
  '3m':  { ms: 90 * 24 * 60 * 60 * 1000, bucket: 'week' },
  '6m':  { ms: 180 * 24 * 60 * 60 * 1000, bucket: 'week' },
  '1y':  { ms: 365 * 24 * 60 * 60 * 1000, bucket: 'month' },
};

function resolveRange(key: RangeKey): RangeSpec {
  const spec = RANGE_SPECS[key];
  const now = new Date();
  return { key, start: new Date(now.getTime() - spec.ms), end: now, bucket: spec.bucket, durationMs: spec.ms };
}

function bucketStart(d: Date, bucket: BucketKey): Date {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  if (bucket === 'hour') return t;
  t.setUTCHours(0);
  if (bucket === 'day') return t;
  if (bucket === 'week') {
    const dayOfWeek = t.getUTCDay();
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // align to Monday
    t.setUTCDate(t.getUTCDate() - diff);
    return t;
  }
  // month
  t.setUTCDate(1);
  return t;
}

function generateBuckets(range: RangeSpec): Date[] {
  const buckets: Date[] = [];
  let current = bucketStart(range.start, range.bucket);
  while (current <= range.end) {
    buckets.push(new Date(current));
    if (range.bucket === 'hour') current = new Date(current.getTime() + 3600000);
    else if (range.bucket === 'day') current = new Date(current.getTime() + 86400000);
    else if (range.bucket === 'week') current = new Date(current.getTime() + 7 * 86400000);
    else {
      current = new Date(current);
      current.setUTCMonth(current.getUTCMonth() + 1);
    }
  }
  return buckets;
}

function fillSeries(buckets: Date[], dataMap: Map<string, number>): { period: string; value: number }[] {
  return buckets.map(b => ({ period: b.toISOString(), value: dataMap.get(b.toISOString()) ?? 0 }));
}

function fillWipSeries(
  buckets: Date[],
  dataMap: Map<string, Record<string, number>>,
): { period: string; BACKLOG: number; ASSIGNED: number; IN_PROGRESS: number; REVIEW: number; DONE: number }[] {
  return buckets.map(b => {
    const counts = dataMap.get(b.toISOString()) ?? {};
    return {
      period: b.toISOString(),
      BACKLOG: counts['BACKLOG'] ?? 0,
      ASSIGNED: counts['ASSIGNED'] ?? 0,
      IN_PROGRESS: counts['IN_PROGRESS'] ?? 0,
      REVIEW: counts['REVIEW'] ?? 0,
      DONE: counts['DONE'] ?? 0,
    };
  });
}

export async function getDashboardMetrics(
  organizationId: string,
  params?: { range?: string; boardId?: string; groupId?: string },
) {
  const rangeKey = (params?.range ?? '7d') as RangeKey;
  if (!RANGE_SPECS[rangeKey]) throw new Error(`Invalid range: ${rangeKey}`);
  const range = resolveRange(rangeKey);
  const compRange = resolveRange(rangeKey);
  compRange.start = new Date(range.start.getTime() - range.durationMs);
  compRange.end = new Date(range.end.getTime() - range.durationMs);

  // Resolve board filter
  let boardIds: string[] | undefined;
  if (params?.boardId) {
    boardIds = [params.boardId];
  } else if (params?.groupId) {
    const boards = await prisma.board.findMany({
      where: { boardGroupId: params.groupId, organizationId },
      select: { id: true },
    });
    boardIds = boards.map(b => b.id);
  }

  const taskWhere = {
    organizationId,
    ...(boardIds && { boardId: { in: boardIds } }),
  };

  const activityWhere = {
    organizationId,
    ...(boardIds && {
      agent: { boardId: { in: boardIds } },
    }),
  };

  // ── KPIs ──
  const [activeAgents, tasksInProgress, errorActivities, totalActivities, doneTasks] = await Promise.all([
    prisma.agent.count({
      where: { organizationId, status: { in: ['ONLINE', 'IDLE'] }, ...(boardIds && { boardId: { in: boardIds } }) },
    }),
    prisma.task.count({
      where: { ...taskWhere, status: 'IN_PROGRESS' },
    }),
    prisma.activity.count({
      where: { ...activityWhere, type: 'ERROR', createdAt: { gte: range.start, lte: range.end } },
    }),
    prisma.activity.count({
      where: { ...activityWhere, createdAt: { gte: range.start, lte: range.end } },
    }),
    // For median cycle time: tasks completed in last 7 days
    prisma.task.findMany({
      where: { ...taskWhere, status: 'DONE', updatedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
      select: { createdAt: true, updatedAt: true },
    }),
  ]);

  const cycleTimes = doneTasks.map(t => (t.updatedAt.getTime() - t.createdAt.getTime()) / 3600000);
  cycleTimes.sort((a, b) => a - b);
  const medianCycleTime = cycleTimes.length > 0
    ? cycleTimes[Math.floor(cycleTimes.length / 2)]
    : null;

  // ── Throughput (tasks completed per bucket) ──
  const throughputTasks = await prisma.task.findMany({
    where: { ...taskWhere, status: 'DONE', updatedAt: { gte: compRange.start, lte: range.end } },
    select: { updatedAt: true },
  });
  const primaryBuckets = generateBuckets(range);
  const compBuckets = generateBuckets(compRange);

  const buildSeriesFromDates = (dates: Date[], buckets: Date[], r: RangeSpec) => {
    const map = new Map<string, number>();
    for (const d of dates) {
      if (d < r.start || d > r.end) continue;
      const key = bucketStart(d, r.bucket).toISOString();
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return fillSeries(buckets, map);
  };

  const throughputDates = throughputTasks.map(t => t.updatedAt);
  const throughputPrimary = buildSeriesFromDates(throughputDates, primaryBuckets, range);
  const throughputComparison = buildSeriesFromDates(throughputDates, compBuckets, compRange);

  // ── Cycle Time (avg hours per bucket) ──
  const cycleTimeTasks = await prisma.task.findMany({
    where: { ...taskWhere, status: 'DONE', updatedAt: { gte: compRange.start, lte: range.end } },
    select: { createdAt: true, updatedAt: true },
  });

  const buildCycleTimeSeries = (tasks: { createdAt: Date; updatedAt: Date }[], buckets: Date[], r: RangeSpec) => {
    const sums = new Map<string, number>();
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.updatedAt < r.start || t.updatedAt > r.end) continue;
      const key = bucketStart(t.updatedAt, r.bucket).toISOString();
      const hours = (t.updatedAt.getTime() - t.createdAt.getTime()) / 3600000;
      sums.set(key, (sums.get(key) ?? 0) + hours);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const avgMap = new Map<string, number>();
    for (const [key, sum] of sums) avgMap.set(key, Math.round((sum / (counts.get(key) ?? 1)) * 100) / 100);
    return fillSeries(buckets, avgMap);
  };

  const cycleTimePrimary = buildCycleTimeSeries(cycleTimeTasks, primaryBuckets, range);
  const cycleTimeComparison = buildCycleTimeSeries(cycleTimeTasks, compBuckets, compRange);

  // ── Error Rate (% per bucket) ──
  const activities = await prisma.activity.findMany({
    where: { ...activityWhere, createdAt: { gte: compRange.start, lte: range.end } },
    select: { type: true, createdAt: true },
  });

  const buildErrorRateSeries = (activities: { type: string; createdAt: Date }[], buckets: Date[], r: RangeSpec) => {
    const errors = new Map<string, number>();
    const totals = new Map<string, number>();
    for (const a of activities) {
      if (a.createdAt < r.start || a.createdAt > r.end) continue;
      const key = bucketStart(a.createdAt, r.bucket).toISOString();
      totals.set(key, (totals.get(key) ?? 0) + 1);
      if (a.type === 'ERROR') errors.set(key, (errors.get(key) ?? 0) + 1);
    }
    const rateMap = new Map<string, number>();
    for (const [key, total] of totals) {
      rateMap.set(key, Math.round(((errors.get(key) ?? 0) / total) * 10000) / 100);
    }
    return fillSeries(buckets, rateMap);
  };

  const errorRatePrimary = buildErrorRateSeries(activities, primaryBuckets, range);
  const errorRateComparison = buildErrorRateSeries(activities, compBuckets, compRange);

  // ── WIP (tasks by status per bucket — snapshot at each bucket using task updatedAt) ──
  const allTasks = await prisma.task.findMany({
    where: { ...taskWhere, updatedAt: { gte: compRange.start, lte: range.end } },
    select: { status: true, updatedAt: true },
  });

  const buildWipSeries = (tasks: { status: string; updatedAt: Date }[], buckets: Date[], r: RangeSpec) => {
    const map = new Map<string, Record<string, number>>();
    for (const t of tasks) {
      if (t.updatedAt < r.start || t.updatedAt > r.end) continue;
      const key = bucketStart(t.updatedAt, r.bucket).toISOString();
      if (!map.has(key)) map.set(key, {});
      const counts = map.get(key)!;
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return fillWipSeries(buckets, map);
  };

  const wipPrimary = buildWipSeries(allTasks, primaryBuckets, range);
  const wipComparison = buildWipSeries(allTasks, compBuckets, compRange);

  return {
    range: rangeKey,
    generatedAt: new Date().toISOString(),
    kpis: {
      activeAgents,
      tasksInProgress,
      errorRatePct: totalActivities > 0 ? Math.round((errorActivities / totalActivities) * 10000) / 100 : 0,
      medianCycleTimeHours7d: medianCycleTime !== null ? Math.round(medianCycleTime * 100) / 100 : null,
    },
    throughput: {
      primary: { range: rangeKey, bucket: range.bucket, points: throughputPrimary },
      comparison: { range: rangeKey, bucket: range.bucket, points: throughputComparison },
    },
    cycleTime: {
      primary: { range: rangeKey, bucket: range.bucket, points: cycleTimePrimary },
      comparison: { range: rangeKey, bucket: range.bucket, points: cycleTimeComparison },
    },
    errorRate: {
      primary: { range: rangeKey, bucket: range.bucket, points: errorRatePrimary },
      comparison: { range: rangeKey, bucket: range.bucket, points: errorRateComparison },
    },
    wip: {
      primary: { range: rangeKey, bucket: range.bucket, points: wipPrimary },
      comparison: { range: rangeKey, bucket: range.bucket, points: wipComparison },
    },
  };
}

export async function getTokenUsage(organizationId: string, params?: { agentId?: string; hours?: number }) {
  const where: Record<string, unknown> = { organizationId };
  if (params?.agentId) where.agentId = params.agentId;
  if (params?.hours) {
    where.createdAt = { gte: new Date(Date.now() - params.hours * 60 * 60 * 1000) };
  }

  return prisma.tokenUsage.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: { agent: { select: { name: true, displayName: true, avatar: true } } },
  });
}

export async function getTokenSummary(organizationId: string) {
  const usages = await prisma.tokenUsage.findMany({
    where: { organizationId },
    include: { agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
  });

  const totalTokens = usages.reduce((sum, u) => sum + u.totalTokens, 0);
  const totalCost = usages.reduce((sum, u) => sum + u.cost, 0);

  const agentMap = new Map<string, {
    agentId: string;
    agentName: string;
    displayName: string;
    avatar: string | null;
    totalTokens: number;
    totalCost: number;
  }>();

  for (const u of usages) {
    const existing = agentMap.get(u.agentId);
    if (existing) {
      existing.totalTokens += u.totalTokens;
      existing.totalCost += u.cost;
    } else {
      agentMap.set(u.agentId, {
        agentId: u.agentId,
        agentName: u.agent.name,
        displayName: u.agent.displayName,
        avatar: u.agent.avatar,
        totalTokens: u.totalTokens,
        totalCost: u.cost,
      });
    }
  }

  return {
    totalTokens,
    totalCost,
    byAgent: Array.from(agentMap.values()),
  };
}

export async function getMetrics(organizationId: string, params?: { agentId?: string; limit?: number }) {
  const where: Record<string, unknown> = { organizationId };
  if (params?.agentId) where.agentId = params.agentId;

  return prisma.metricSnapshot.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params?.limit || 500,
    include: { agent: { select: { name: true, displayName: true, avatar: true } } },
  });
}

export async function getMetricsSummary(organizationId: string) {
  const metrics = await prisma.metricSnapshot.findMany({
    where: { organizationId },
    include: { agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
  });

  const agentMap = new Map<string, {
    agentId: string;
    agentName: string;
    displayName: string;
    avatar: string | null;
    responseTimes: number[];
    successCount: number;
    totalCalls: number;
  }>();

  for (const m of metrics) {
    const existing = agentMap.get(m.agentId);
    if (existing) {
      existing.responseTimes.push(m.responseTimeMs);
      if (m.success) existing.successCount++;
      existing.totalCalls++;
    } else {
      agentMap.set(m.agentId, {
        agentId: m.agentId,
        agentName: m.agent.name,
        displayName: m.agent.displayName,
        avatar: m.agent.avatar,
        responseTimes: [m.responseTimeMs],
        successCount: m.success ? 1 : 0,
        totalCalls: 1,
      });
    }
  }

  const byAgent = Array.from(agentMap.values()).map((a) => {
    const sorted = a.responseTimes.slice().sort((x, y) => x - y);
    const avg = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
    const p95Index = Math.ceil(sorted.length * 0.95) - 1;
    const p95 = sorted[Math.max(0, p95Index)] ?? 0;

    return {
      agentId: a.agentId,
      agentName: a.agentName,
      displayName: a.displayName,
      avatar: a.avatar,
      avgResponseTime: Math.round(avg),
      p95ResponseTime: p95,
      successRate: a.totalCalls > 0 ? Math.round((a.successCount / a.totalCalls) * 10000) / 100 : 0,
      totalCalls: a.totalCalls,
    };
  });

  return { byAgent };
}
