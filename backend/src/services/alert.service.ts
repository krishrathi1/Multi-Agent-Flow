import { prisma } from '../lib/prisma.js';

export async function getAlertRules(organizationId: string) {
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
