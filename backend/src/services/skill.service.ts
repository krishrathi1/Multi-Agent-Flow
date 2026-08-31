import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listSkills(organizationId: string, gatewayId?: string) {
  const skills = await prisma.marketplaceSkill.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: { installedOn: { select: { gatewayId: true } } },
  });
  return skills.map(s => ({
    ...s,
    installedGatewayIds: s.installedOn.map(i => i.gatewayId),
    isInstalled: gatewayId ? s.installedOn.some(i => i.gatewayId === gatewayId) : undefined,
  }));
}

export async function createSkill(organizationId: string, data: {
  name: string;
  description?: string;
  category?: string;
  risk?: string;
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}) {
  return prisma.marketplaceSkill.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description,
      category: data.category,
      risk: data.risk,
      sourceUrl: data.sourceUrl,
      metadata: data.metadata as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listPacks(organizationId: string) {
  return prisma.skillPack.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
  });
}

export async function createPack(organizationId: string, data: {
  name: string;
  description?: string;
  sourceUrl: string;
  branch?: string;
}) {
  return prisma.skillPack.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description ?? '',
      sourceUrl: data.sourceUrl,
      branch: data.branch ?? 'main',
    },
  });
}

export async function syncPack(packId: string, organizationId: string) {
  const pack = await prisma.skillPack.findFirst({ where: { id: packId, organizationId } });
  if (!pack) throw new Error('Skill pack not found');

  // Update lastSyncedAt
  await prisma.skillPack.update({
    where: { id: packId },
    data: { lastSyncedAt: new Date() },
  });

  return { synced: true, packId };
}

export async function installSkill(skillId: string, gatewayId: string, organizationId: string) {
  // Verify skill and gateway belong to org
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  const gateway = await prisma.gateway.findFirst({ where: { id: gatewayId, organizationId } });
  if (!gateway) throw new Error('Gateway not found');

  return prisma.gatewayInstalledSkill.create({
    data: { gatewayId, skillId },
  });
}

export async function uninstallSkill(skillId: string, gatewayId: string, organizationId: string) {
  // Verify ownership
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  return prisma.gatewayInstalledSkill.delete({
    where: { gatewayId_skillId: { gatewayId, skillId } },
  });
}
