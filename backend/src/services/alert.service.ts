import { prisma } from '../lib/prisma.js';
import { Severity } from '@prisma/client';

/**
 * Synchronizes alert rules and events with real active agents in the organization.
 */
const liveAlertSyncs = new Map<string, Promise<void>>();

async function syncLiveAlerts(organizationId: string) {
  const inFlight = liveAlertSyncs.get(organizationId);
  if (inFlight) return inFlight;

  const sync = syncLiveAlertsOnce(organizationId);
  liveAlertSyncs.set(organizationId, sync);
  try {
    await sync;
  } finally {
    if (liveAlertSyncs.get(organizationId) === sync) liveAlertSyncs.delete(organizationId);
  }
}

async function syncLiveAlertsOnce(organizationId: string) {
  const agents = await prisma.agent.findMany({
    where: { organizationId },
    select: { id: true, name: true, displayName: true, avatar: true, status: true, heartbeatInterval: true, updatedAt: true },
  });

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
    if (agents.length === 0) continue;
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

  // Cost rules aggregate actual token usage over the configured rolling window.
  // Evaluate these even when the organization has no agents (for example after
  // an agent was deleted, while historical usage still exists).
  for (const rule of allRules.filter((candidate) => candidate.condition.toLowerCase() === 'high_cost')) {
    if (rule.threshold == null) continue;
    const since = new Date(Date.now() - Math.max(1, rule.windowMinutes) * 60_000);
    const usage = await prisma.tokenUsage.aggregate({
      where: {
        organizationId,
        ...(rule.agentId ? { agentId: rule.agentId } : {}),
        createdAt: { gte: since },
      },
      _sum: { cost: true },
    });
    const cost = usage._sum.cost ?? 0;
    if (cost < rule.threshold) continue;
    const recentDuplicate = await prisma.alertEvent.findFirst({
      where: { organizationId, alertRuleId: rule.id, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recentDuplicate) continue;
    await prisma.alertEvent.create({
      data: {
        organizationId,
        alertRuleId: rule.id,
        message: `${rule.name}: token spend of $${cost.toFixed(4)} exceeded the $${rule.threshold.toFixed(4)} threshold in ${rule.windowMinutes} minutes`,
        severity: Severity.WARNING,
        acknowledged: false,
      },
    });
    await prisma.alertRule.update({ where: { id: rule.id }, data: { lastTriggered: new Date() } });
  }

  // Only check agents that belong to real processes in this organization
  if (agents.length === 0) return;
  const activeProcesses = await prisma.process.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { id: true, name: true },
  });
  const activeProcessIds = new Set(activeProcesses.map((p) => p.id));

  for (const agent of agents) {
    // Only alert if an agent is in an actual ERROR state from a production failure
    if (agent.status === 'ERROR') {
      const stepRule = allRules.find((r) => r.condition === 'STEP_FAILURE') || allRules[0];
      if (stepRule) {
        const existing = await prisma.alertEvent.findFirst({
          where: {
            organizationId,
            message: { contains: agent.displayName },
            acknowledged: false,
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!existing) {
          await prisma.alertEvent.create({
            data: {
              organizationId,
              alertRuleId: stepRule.id,
              message: `${agent.displayName} failed execution in production process`,
              severity: Severity.CRITICAL,
              acknowledged: false,
            },
          });
        }
      }
    }
  }
}

export async function recordProductionAlert(params: {
  organizationId: string;
  agentId?: string;
  message: string;
  severity: Severity;
  io?: any;
}) {
  let rule = await prisma.alertRule.findFirst({
    where: {
      organizationId: params.organizationId,
      condition: 'STEP_FAILURE',
    },
  });
  if (!rule) {
    rule = await prisma.alertRule.findFirst({
      where: { organizationId: params.organizationId },
    });
  }
  if (!rule) {
    rule = await prisma.alertRule.create({
      data: {
        organizationId: params.organizationId,
        name: 'Production Process Failure Guard',
        description: 'Triggered when a production step execution fails or encounters a critical error',
        condition: 'STEP_FAILURE',
        threshold: 1,
        windowMinutes: 5,
      },
    });
  }
  const event = await prisma.alertEvent.create({
    data: {
      organizationId: params.organizationId,
      alertRuleId: rule.id,
      message: params.message,
      severity: params.severity,
      acknowledged: false,
    },
    include: {
      alertRule: {
        select: { id: true, name: true, condition: true, agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
      },
    },
  });
  params.io?.to(`org:${params.organizationId}`).emit('alert:event:created', event);
  return event;
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

