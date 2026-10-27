import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { ActivityType, Prisma } from '@prisma/client';
const tracer = trace.getTracer('nexus-command');

const FLEET_EFFECTS: Record<string, Prisma.AgentUpdateInput> = {
  PAUSE: { enabled: false, status: 'IDLE', currentTask: null },
  RESUME: { enabled: true, status: 'ONLINE' },
};

export async function sendCommand(organizationId: string, data: {
  agentId: string;
  type: string;
  payload?: Record<string, unknown>;
  issuedBy?: string;
}) {
  return tracer.startActiveSpan('command.send', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('agent.id', data.agentId);
      span.setAttribute('command.type', data.type);

      const agent = await prisma.agent.findFirst({ where: { id: data.agentId, organizationId }, select: { id: true } });
      if (!agent) throw Object.assign(new Error('Agent not found'), { statusCode: 404 });

      // Commands were only ever stored: nothing consumed them, so Fleet
      // Controls reported "fleet paused" while every agent kept working.
      // PAUSE/RESUME take effect here; the runner skips disabled agents.
      const effect = FLEET_EFFECTS[data.type.toUpperCase()];
      if (effect) await prisma.agent.update({ where: { id: agent.id }, data: effect });

      const command = await prisma.command.create({
        data: {
          organizationId,
          agentId: data.agentId,
          type: data.type,
          payload: (data.payload as Prisma.InputJsonValue) ?? undefined,
          status: effect ? 'COMPLETED' : 'PENDING',
          issuedBy: data.issuedBy ?? null,
        },
        include: {
          agent: { select: { id: true, name: true, displayName: true, avatar: true } },
        },
      });
      logger.info({ commandId: command.id, agentId: data.agentId, type: data.type }, 'Command sent');
      return command;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getCommands(organizationId: string, agentId?: string) {
  const where: Record<string, unknown> = { organizationId };
  if (agentId) where.agentId = agentId;

  return prisma.command.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { id: true, name: true, displayName: true, avatar: true } },
    },
  });
}

export async function searchActivities(
  organizationId: string,
  query: string,
  params?: { agentId?: string; type?: ActivityType; limit?: number }
) {
  const { agentId, type, limit = 100 } = params ?? {};

  const where: Record<string, unknown> = {
    organizationId,
    message: { contains: query, mode: 'insensitive' },
  };
  if (agentId) where.agentId = agentId;
  if (type) where.type = type;

  const [activities, total] = await Promise.all([
    prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { agent: { select: { name: true, displayName: true, avatar: true } } },
    }),
    prisma.activity.count({ where }),
  ]);

  return { activities, total };
}

export async function getAgentConfig(id: string, organizationId: string) {
  return prisma.agent.findFirst({
    where: { id, organizationId },
    select: {
      id: true,
      name: true,
      displayName: true,
      workspace: true,
      description: true,
      status: true,
      avatar: true,
      enabled: true,
      soulMd: true,
      heartbeatInterval: true,
      currentTask: true,
      lastHeartbeat: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateAgentConfig(
  id: string,
  organizationId: string,
  data: { soulMd?: string; enabled?: boolean; heartbeatInterval?: number }
) {
  return tracer.startActiveSpan('command.updateAgentConfig', async (span) => {
    try {
      span.setAttribute('agent.id', id);
      span.setAttribute('org.id', organizationId);
      const agent = await prisma.agent.update({
        where: { id, organizationId },
        data: {
          ...(data.soulMd !== undefined && { soulMd: data.soulMd }),
          ...(data.enabled !== undefined && { enabled: data.enabled }),
          ...(data.heartbeatInterval !== undefined && { heartbeatInterval: data.heartbeatInterval }),
        },
      });
      logger.info({ agentId: id, orgId: organizationId }, 'Agent config updated');
      return agent;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
