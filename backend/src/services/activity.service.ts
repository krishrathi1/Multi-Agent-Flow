import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { ActivityType } from '@prisma/client';
const tracer = trace.getTracer('nexus-activity');

export async function getActivities(organizationId: string, options: {
  agentId?: string;
  type?: ActivityType;
  processId?: string;
  limit?: number;
  offset?: number;
  since?: Date;
}) {
  const { agentId, type, processId, limit = 50, offset = 0, since } = options;

  const where: Record<string, unknown> = { organizationId };
  if (agentId) where.agentId = agentId;
  if (type) where.type = type;
  if (since) where.createdAt = { gte: since };
  // Match rows tagged with the process directly, and also anything logged by
  // one of its agents — older rows predate the processId column.
  if (processId) {
    where.OR = [{ processId }, { agent: { processId } }];
  }

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            displayName: true,
            avatar: true,
            processId: true,
            processRole: true,
          },
        },
        process: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.activity.count({ where }),
  ]);

  return { activities, total, limit, offset };
}

export async function createActivity(organizationId: string, data: {
  agentId: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  return tracer.startActiveSpan('activity.create', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('agent.id', data.agentId);
      span.setAttribute('activity.type', data.type);
      // Stamp the owning process so the feed can filter without a join.
      const owner = await prisma.agent.findUnique({
        where: { id: data.agentId },
        select: { processId: true },
      });
      const activity = await prisma.activity.create({
        data: {
          agentId: data.agentId,
          organizationId,
          type: data.type,
          message: data.message,
          metadata: data.metadata as any,
          processId: owner?.processId ?? null,
        },
        include: { agent: { select: { name: true, displayName: true, avatar: true } } },
      });
      logger.info({ activityId: activity.id, agentId: data.agentId, type: data.type }, 'Activity created');
      return activity;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
