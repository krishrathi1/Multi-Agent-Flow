import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';

export async function listAgentSkills(agentId: string, organizationId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
    select: { id: true },
  });
  if (!agent) throw new Error('Agent not found');

  return prisma.agentSkill.findMany({
    where: { agentId },
    include: { skill: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function assignSkill(agentId: string, skillId: string, organizationId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId } });
  if (!agent) throw new Error('Agent not found');
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  return prisma.agentSkill.create({
    data: { agentId, skillId },
    include: { skill: true },
  });
}

export async function removeSkill(agentId: string, skillId: string, organizationId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId } });
  if (!agent) throw new Error('Agent not found');

  return prisma.agentSkill.delete({
    where: { agentId_skillId: { agentId, skillId } },
  });
}

export async function updateAgentSkill(
  agentId: string,
  skillId: string,
  organizationId: string,
  data: { customName?: string; customDescription?: string; customConfig?: Record<string, unknown>; enabled?: boolean }
) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId } });
  if (!agent) throw new Error('Agent not found');

  const updateData: Record<string, unknown> = {};
  if (data.customName !== undefined) updateData.customName = data.customName;
  if (data.customDescription !== undefined) updateData.customDescription = data.customDescription;
  if (data.customConfig !== undefined) updateData.customConfig = data.customConfig as Prisma.InputJsonValue;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;

  return prisma.agentSkill.update({
    where: { agentId_skillId: { agentId, skillId } },
    data: updateData as any,
    include: { skill: true },
  });
}

export async function bulkAssignSkills(agentId: string, skillIds: string[], organizationId: string) {
  const agent = await prisma.agent.findFirst({ where: { id: agentId, organizationId } });
  if (!agent) throw new Error('Agent not found');

  // Verify all skills belong to org
  const skills = await prisma.marketplaceSkill.findMany({
    where: { id: { in: skillIds }, organizationId },
    select: { id: true },
  });
  const validIds = new Set(skills.map(s => s.id));

  const data = skillIds
    .filter(id => validIds.has(id))
    .map(skillId => ({ agentId, skillId }));

  await prisma.agentSkill.createMany({ data, skipDuplicates: true });

  return prisma.agentSkill.findMany({
    where: { agentId },
    include: { skill: true },
    orderBy: { createdAt: 'asc' },
  });
}
