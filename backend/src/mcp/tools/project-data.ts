import { prisma } from '../../lib/prisma.js';

/**
 * Database lookup tool: read-only queries over this production's own records
 * in PostgreSQL — its runs, agents, blackboard and tool calls. Every query is
 * scoped to one organization and one production; nothing is written.
 */

export const LOOKUPS = ['summary', 'runs', 'agents', 'blackboard', 'tool_calls'] as const;
export type Lookup = (typeof LOOKUPS)[number];

/** Numeric run metrics the forecast tool can read straight from run history. */
export const RUN_METRICS = ['duration_seconds', 'tokens', 'cost_usd'] as const;
export type RunMetric = (typeof RUN_METRICS)[number];

export async function runMetricSeries(organizationId: string, processId: string, metric: RunMetric, limit = 30): Promise<number[]> {
  const runs = await prisma.processRun.findMany({
    where: { organizationId, processId, state: 'COMPLETED' },
    orderBy: { startedAt: 'desc' },
    take: limit,
    select: { durationMs: true, totalTokens: true, totalCostUsd: true },
  });
  return runs
    .reverse()
    .map((r) => (metric === 'duration_seconds' ? (r.durationMs ?? NaN) / 1000 : metric === 'tokens' ? r.totalTokens : r.totalCostUsd))
    .filter((v) => Number.isFinite(v));
}

export async function projectLookup(organizationId: string, processId: string, lookup: Lookup, limit = 10): Promise<unknown> {
  const take = Math.max(1, Math.min(50, Math.round(limit)));
  const scope = { organizationId, processId };

  switch (lookup) {
    case 'summary': {
      const process = await prisma.process.findFirst({
        where: { id: processId, organizationId },
        select: { name: true, status: true, messagingMode: true, createdAt: true, _count: { select: { agents: true, runs: true, blackboard: true, toolCalls: true } } },
      });
      if (!process) throw new Error('Production not found');
      const byState = await prisma.processRun.groupBy({ by: ['state'], where: scope, _count: true });
      const totals = await prisma.processRun.aggregate({ where: scope, _sum: { totalTokens: true, totalCostUsd: true }, _avg: { durationMs: true } });
      return {
        name: process.name,
        status: process.status,
        messagingMode: process.messagingMode,
        createdAt: process.createdAt,
        agents: process._count.agents,
        runs: Object.fromEntries(byState.map((s) => [s.state, s._count])),
        blackboardEntries: process._count.blackboard,
        toolCalls: process._count.toolCalls,
        totalTokens: totals._sum.totalTokens ?? 0,
        totalCostUsd: Number((totals._sum.totalCostUsd ?? 0).toFixed(4)),
        avgRunSeconds: totals._avg.durationMs ? Math.round(totals._avg.durationMs / 1000) : null,
      };
    }
    case 'runs':
      return (await prisma.processRun.findMany({
        where: scope,
        orderBy: { startedAt: 'desc' },
        take,
        select: { id: true, state: true, trigger: true, startedAt: true, durationMs: true, totalTokens: true, totalCostUsd: true, messagingMode: true, error: true, _count: { select: { steps: true, toolCalls: true } } },
      })).map((r) => ({
        id: r.id.slice(0, 8), state: r.state, trigger: r.trigger, startedAt: r.startedAt,
        seconds: r.durationMs ? Math.round(r.durationMs / 1000) : null, tokens: r.totalTokens,
        costUsd: Number(r.totalCostUsd.toFixed(4)), messagingMode: r.messagingMode,
        steps: r._count.steps, toolCalls: r._count.toolCalls, error: r.error?.slice(0, 200) ?? undefined,
      }));
    case 'agents':
      return prisma.agent.findMany({
        where: { organizationId, processId },
        orderBy: [{ processStage: 'asc' }, { displayName: 'asc' }],
        take,
        select: { displayName: true, processRole: true, processStage: true, status: true },
      });
    case 'blackboard':
      return (await prisma.blackboardEntry.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take,
        select: { kind: true, topic: true, content: true, authorName: true, toRole: true, status: true, createdAt: true },
      })).map((e) => ({ ...e, content: e.content.slice(0, 400) }));
    case 'tool_calls':
      return (await prisma.toolCall.findMany({
        where: scope,
        orderBy: { createdAt: 'desc' },
        take,
        select: { server: true, tool: true, caller: true, ok: true, durationMs: true, createdAt: true },
      }));
    default:
      throw new Error(`Unknown lookup "${lookup}"; use one of ${LOOKUPS.join(', ')}`);
  }
}
