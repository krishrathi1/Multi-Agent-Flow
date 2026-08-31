import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
const tracer = trace.getTracer('nexus-session');

export async function getSessions(organizationId: string, params?: { agentId?: string; limit?: number }) {
  const { agentId, limit = 100 } = params ?? {};

  const where: Record<string, unknown> = { organizationId };
  if (agentId) where.agentId = agentId;

  return prisma.session.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: {
      agent: {
        select: { id: true, name: true, displayName: true, avatar: true },
      },
    },
  });
}

export async function getTimelineData(organizationId: string, options: {
  processId?: string;
  hours?: number;
} = {}) {
  const { processId, hours = 4 } = options;
  const windowStart = new Date(Date.now() - hours * 60 * 60 * 1000);

  const sessions = await prisma.session.findMany({
    where: {
      organizationId,
      startedAt: { gte: windowStart },
      // Scope to one production chain when asked.
      ...(processId ? { agent: { processId } } : {}),
    },
    orderBy: { startedAt: 'asc' },
    include: {
      agent: {
        select: {
          id: true, name: true, displayName: true, avatar: true, status: true,
          processId: true, processRole: true, processStage: true,
        },
      },
    },
  });

  // Group sessions by agent
  const agentMap = new Map<string, {
    agent: (typeof sessions)[number]['agent'];
    sessions: typeof sessions;
  }>();

  for (const session of sessions) {
    const existing = agentMap.get(session.agentId);
    if (existing) {
      existing.sessions.push(session);
    } else {
      agentMap.set(session.agentId, {
        agent: session.agent,
        sessions: [session],
      });
    }
  }

  // Also include agents that have no sessions in the window (so all rows show)
  const allAgents = await prisma.agent.findMany({
    where: { organizationId },
    select: { id: true, name: true, displayName: true, avatar: true, status: true },
    orderBy: { name: 'asc' },
  });

  const timeline = allAgents.map((agent) => ({
    agent,
    sessions: agentMap.get(agent.id)?.sessions ?? [],
  }));

  return {
    timeline,
    windowStart: windowStart.toISOString(),
    windowEnd: new Date().toISOString(),
  };
}
