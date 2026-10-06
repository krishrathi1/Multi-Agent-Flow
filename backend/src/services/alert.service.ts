import { prisma } from '../lib/prisma.js';
import { Severity } from '@prisma/client';

/**
 * Synchronizes alert rules and events with real active agents in the organization.
 */
async function syncLiveAlerts(organizationId: string) {
  const agents = await prisma.agent.findMany({
    where: { organizationId },
    select: { id: true, name: true, displayName: true, avatar: true, status: true, heartbeatInterval: true, updatedAt: true },
  });

  if (agents.length === 0) return;

  // 1. Clean up legacy seed alerts that reference obsolete agent names like 'core-engineer'
  const legacyEvents = await prisma.alertEvent.findMany({
    where: {
      organizationId,
      OR: [
        { message: { contains: 'core-engineer' } },
        { message: { contains: 'payment service' } },
        { message: { contains: 'external-engineer' } },
      ],
    },
    select: { id: true },
  });

  if (legacyEvents.length > 0) {
    await prisma.alertEvent.deleteMany({
      where: { id: { in: legacyEvents.map((e) => e.id) } },
    });
  }

  // 2. Ensure default alert rules exist for active agents
  const existingRules = await prisma.alertRule.findMany({
    where: { organizationId },
  });

  const defaultRuleSpecs = [
    {
      name: 'Agent Heartbeat Monitor',
      description: 'Trigger warning when an agent misses two consecutive heartbeat intervals',
      condition: 'HEARTBEAT_MISSED',
      threshold: 15,
      windowMinutes: 5,
    },
    {
      name: 'Agent Offline Guard',
      description: 'Trigger critical alert when an assigned agent disconnects unexpectedly',
      condition: 'AGENT_OFFLINE',
      threshold: 1,
      windowMinutes: 2,
    },
    {
      name: 'High Latency Telemetry',
      description: 'Trigger warning when agent response latency exceeds execution SLA',
      condition: 'RESPONSE_TIME_HIGH',
      threshold: 5.0,
      windowMinutes: 10,
    },
    {
      name: 'Production Step Failure',
      description: 'Trigger critical alert when an autonomous agent pipeline step fails',
      condition: 'STEP_FAILURE',
      threshold: 1,
      windowMinutes: 5,
    },
  ];

  for (const spec of defaultRuleSpecs) {
    const found = existingRules.find((r) => r.condition === spec.condition);
    if (!found) {
      const primaryAgent = agents[0];
      await prisma.alertRule.create({
        data: {
          organizationId,
          name: spec.name,
          description: spec.description,
          condition: spec.condition,
          threshold: spec.threshold,
          windowMinutes: spec.windowMinutes,
          agentId: primaryAgent?.id || null,
          enabled: true,
        },
      });
    }
  }

  // 3. Evaluate real live fleet conditions to generate real alert events
  const allRules = await prisma.alertRule.findMany({
    where: { organizationId, enabled: true },
  });

  const now = Date.now();
  for (const agent of agents) {
    // Check if agent status is OFFLINE
    if (agent.status === 'OFFLINE') {
      const offlineRule = allRules.find((r) => r.condition === 'AGENT_OFFLINE');
      if (offlineRule) {
        const existing = await prisma.alertEvent.findFirst({
          where: {
            organizationId,
            alertRuleId: offlineRule.id,
            message: { contains: agent.displayName },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!existing) {
          await prisma.alertEvent.create({
            data: {
              organizationId,
              alertRuleId: offlineRule.id,
              message: `${agent.displayName} is currently offline and unreachable`,
              severity: Severity.CRITICAL,
              acknowledged: false,
            },
          });
        }
      }
    }

    // Check if agent missed heartbeats (only if actively marked ONLINE)
    const timeSinceUpdate = (now - new Date(agent.updatedAt).getTime()) / 60000;
    const missedThreshold = (agent.heartbeatInterval || 30) * 2;
    if (agent.status === 'ONLINE' && timeSinceUpdate > missedThreshold) {
      const hbRule = allRules.find((r) => r.condition === 'HEARTBEAT_MISSED');
      if (hbRule) {
        const existing = await prisma.alertEvent.findFirst({
          where: {
            organizationId,
            alertRuleId: hbRule.id,
            message: { contains: agent.displayName },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!existing) {
          await prisma.alertEvent.create({
            data: {
              organizationId,
              alertRuleId: hbRule.id,
              message: `${agent.displayName} missed heartbeat — last signal received ${Math.round(timeSinceUpdate)} minutes ago`,
              severity: Severity.WARNING,
              acknowledged: false,
            },
          });
        }
      }
    }
  }
}

export async function getAlertRules(organizationId: string) {
  await syncLiveAlerts(organizationId);
  return prisma.alertRule.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { id: true, name: true, displayName: true, avatar: true } },
      _count: { select: { events: true } },
    },
  });
}

export async function createAlertRule(organizationId: string, data: {
  name: string;
  description?: string;
  agentId?: string;
  condition: string;
  threshold?: number;
  windowMinutes?: number;
  enabled?: boolean;
}) {
  return prisma.alertRule.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description,
      agentId: data.agentId || null,
      condition: data.condition,
      threshold: data.threshold ?? null,
      windowMinutes: data.windowMinutes ?? 5,
      enabled: data.enabled ?? true,
    },
    include: {
      agent: { select: { id: true, name: true, displayName: true, avatar: true } },
      _count: { select: { events: true } },
    },
  });
}

export async function updateAlertRule(
  id: string,
  organizationId: string,
  data: {
    name?: string;
    description?: string;
    agentId?: string | null;
    condition?: string;
    threshold?: number | null;
    windowMinutes?: number;
    enabled?: boolean;
  },
) {
  return prisma.alertRule.update({
    where: { id, organizationId },
    data,
    include: {
      agent: { select: { id: true, name: true, displayName: true, avatar: true } },
      _count: { select: { events: true } },
    },
  });
}

export async function getAlertEvents(organizationId: string, params?: {
  acknowledged?: boolean;
  limit?: number;
}) {
  await syncLiveAlerts(organizationId);
  const where: Record<string, unknown> = { organizationId };
  if (params?.acknowledged !== undefined) {
    where.acknowledged = params.acknowledged;
  }

  return prisma.alertEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: params?.limit || 100,
    include: {
      alertRule: {
        select: { id: true, name: true, condition: true, agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
      },
    },
  });
}

export async function acknowledgeEvent(id: string, organizationId: string) {
  return prisma.alertEvent.update({
    where: { id, organizationId },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
    include: {
      alertRule: {
        select: { id: true, name: true, condition: true, agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
      },
    },
  });
}

export async function clearAlertEvents(organizationId: string) {
  const deleted = await prisma.alertEvent.deleteMany({
    where: { organizationId },
  });
  return { success: true, count: deleted.count };
}

export async function acknowledgeAllEvents(organizationId: string) {
  const updated = await prisma.alertEvent.updateMany({
    where: { organizationId, acknowledged: false },
    data: {
      acknowledged: true,
      acknowledgedAt: new Date(),
    },
  });
  return { success: true, count: updated.count };
}

