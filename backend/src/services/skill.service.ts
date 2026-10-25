import { prisma } from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import * as repoService from './repo.service.js';
import { logger } from '../lib/logger.js';

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
  const initialMeta: Record<string, any> = { ...(data.metadata || {}) };
  if (data.sourceUrl?.trim()) {
    initialMeta.cloneStatus = 'CLONING';
  }

  const skill = await prisma.marketplaceSkill.create({
    data: {
      organizationId,
      name: data.name,
      description: data.description,
      category: data.category,
      risk: data.risk,
      sourceUrl: data.sourceUrl?.trim() || null,
      metadata: initialMeta as Prisma.InputJsonValue,
    },
  });

  // Asynchronously clone repo if URL is present
  if (data.sourceUrl?.trim()) {
    repoService.cloneOrPullRepo(organizationId, 'skills', skill.id, data.sourceUrl.trim(), 'main')
      .then(async (details) => {
        await prisma.marketplaceSkill.update({
          where: { id: skill.id },
          data: {
            metadata: {
              ...initialMeta,
              cloneStatus: 'SUCCESS',
              ...details,
            } as Prisma.InputJsonValue,
          },
        });
      })
      .catch(async (err) => {
        logger.error({ skillId: skill.id, error: err.message }, 'Failed background git clone for skill');
        await prisma.marketplaceSkill.update({
          where: { id: skill.id },
          data: {
            metadata: {
              ...initialMeta,
              cloneStatus: 'FAILED',
              lastError: err.message,
            } as Prisma.InputJsonValue,
          },
        });
      });
  }

  return skill;
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
  const sourceUrl = repoService.validateGitUrl(data.sourceUrl);
  const branch = data.branch?.trim() || 'main';

  const pack = await prisma.skillPack.create({
    data: {
      organizationId,
      name: data.name.trim(),
      description: data.description ?? '',
      sourceUrl,
      branch,
      metadata: { cloneStatus: 'CLONING' } as Prisma.InputJsonValue,
    },
  });

  // Asynchronously trigger clone to VPS disk
  repoService.cloneOrPullRepo(organizationId, 'packs', pack.id, sourceUrl, branch)
    .then(async (details) => {
      await prisma.skillPack.update({
        where: { id: pack.id },
        data: {
          lastSyncedAt: new Date(),
          metadata: {
            cloneStatus: 'SUCCESS',
            ...details,
          } as Prisma.InputJsonValue,
        },
      });
    })
    .catch(async (err) => {
      logger.error({ packId: pack.id, error: err.message }, 'Failed background git clone for skill pack');
      await prisma.skillPack.update({
        where: { id: pack.id },
        data: {
          metadata: {
            cloneStatus: 'FAILED',
            lastError: err.message,
          } as Prisma.InputJsonValue,
        },
      });
    });

  return pack;
}

export async function syncPack(packId: string, organizationId: string) {
  const pack = await prisma.skillPack.findFirst({ where: { id: packId, organizationId } });
  if (!pack) throw new Error('Skill pack not found');

  // Trigger git pull/clone
  try {
    const details = await repoService.cloneOrPullRepo(
      organizationId,
      'packs',
      pack.id,
      pack.sourceUrl,
      pack.branch
    );

    const updated = await prisma.skillPack.update({
      where: { id: packId },
      data: {
        lastSyncedAt: new Date(),
        metadata: {
          cloneStatus: 'SUCCESS',
          ...details,
        } as Prisma.InputJsonValue,
      },
    });

    return { synced: true, pack: updated };
  } catch (err: any) {
    await prisma.skillPack.update({
      where: { id: packId },
      data: {
        metadata: {
          cloneStatus: 'FAILED',
          lastError: err.message,
        } as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}

export async function deletePack(packId: string, organizationId: string) {
  const pack = await prisma.skillPack.findFirst({ where: { id: packId, organizationId } });
  if (!pack) throw new Error('Skill pack not found');

  repoService.removeRepo(organizationId, 'packs', packId);

  return prisma.skillPack.delete({
    where: { id: packId },
  });
}

export async function getPackFiles(packId: string, organizationId: string, subPath?: string) {
  const pack = await prisma.skillPack.findFirst({ where: { id: packId, organizationId } });
  if (!pack) throw new Error('Skill pack not found');

  return repoService.getRepoFileTree(organizationId, 'packs', packId, subPath || '');
}

export async function getPackFileContent(packId: string, organizationId: string, filePath: string) {
  const pack = await prisma.skillPack.findFirst({ where: { id: packId, organizationId } });
  if (!pack) throw new Error('Skill pack not found');

  return repoService.getRepoFileContent(organizationId, 'packs', packId, filePath);
}

export async function getSkillFiles(skillId: string, organizationId: string, subPath?: string) {
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  return repoService.getRepoFileTree(organizationId, 'skills', skillId, subPath || '');
}

export async function getSkillFileContent(skillId: string, organizationId: string, filePath: string) {
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  return repoService.getRepoFileContent(organizationId, 'skills', skillId, filePath);
}

export async function installSkill(skillId: string, gatewayId: string, organizationId: string) {
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  const gateway = await prisma.gateway.findFirst({ where: { id: gatewayId, organizationId } });
  if (!gateway) throw new Error('Gateway not found');

  return prisma.gatewayInstalledSkill.create({
    data: { gatewayId, skillId },
  });
}

export async function uninstallSkill(skillId: string, gatewayId: string, organizationId: string) {
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  return prisma.gatewayInstalledSkill.delete({
    where: { gatewayId_skillId: { gatewayId, skillId } },
  });
}

export async function deleteSkill(skillId: string, organizationId: string) {
  const skill = await prisma.marketplaceSkill.findFirst({ where: { id: skillId, organizationId } });
  if (!skill) throw new Error('Skill not found');

  repoService.removeRepo(organizationId, 'skills', skillId);

  await prisma.gatewayInstalledSkill.deleteMany({
    where: { skillId },
  });

  return prisma.marketplaceSkill.delete({
    where: { id: skillId },
  });
}
