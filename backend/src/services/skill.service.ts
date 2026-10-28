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
  const rawUrl = data.sourceUrl?.trim();
  if (rawUrl) {
    initialMeta.cloneStatus = 'CLONING';
  }

  const skill = await prisma.marketplaceSkill.create({
    data: {
      organizationId,
      name: data.name.trim(),
      description: data.description?.trim(),
      category: data.category?.trim() || 'general',
      risk: data.risk?.trim() || 'low',
      sourceUrl: rawUrl || null,
      metadata: initialMeta as Prisma.InputJsonValue,
    },
  });

  // If a Git URL was provided, immediately download and store repository on VPS
  if (rawUrl) {
    try {
      const details = await repoService.cloneOrPullRepo(
        organizationId,
        'skills',
        skill.id,
        rawUrl,
        'main'
      );
      const updatedSkill = await prisma.marketplaceSkill.update({
        where: { id: skill.id },
        data: {
          metadata: {
            ...initialMeta,
            cloneStatus: 'SUCCESS',
            ...details,
          } as Prisma.InputJsonValue,
        },
      });
      return {
        ...updatedSkill,
        installedGatewayIds: [],
        isInstalled: false,
      };
    } catch (err: any) {
      logger.error({ skillId: skill.id, error: err.message }, 'Failed initial git clone for skill');
      const updatedSkill = await prisma.marketplaceSkill.update({
        where: { id: skill.id },
        data: {
          metadata: {
            ...initialMeta,
            cloneStatus: 'FAILED',
            lastError: err.message,
          } as Prisma.InputJsonValue,
        },
      });
      return {
        ...updatedSkill,
        installedGatewayIds: [],
        isInstalled: false,
      };
    }
  }

  return {
    ...skill,
    installedGatewayIds: [],
    isInstalled: false,
  };
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

export async function syncSkill(skillId: string, organizationId: string) {
  const skill = await prisma.marketplaceSkill.findFirst({
    where: { id: skillId, organizationId },
    include: { installedOn: { select: { gatewayId: true } } },
  });
  if (!skill) throw new Error('Skill not found');
  if (!skill.sourceUrl) throw new Error('Skill has no source repository URL configured');

  const existingMeta =
    typeof skill.metadata === 'object' && skill.metadata !== null
      ? (skill.metadata as Record<string, any>)
      : {};

  try {
    const details = await repoService.cloneOrPullRepo(
      organizationId,
      'skills',
      skill.id,
      skill.sourceUrl,
      'main'
    );

    const updated = await prisma.marketplaceSkill.update({
      where: { id: skillId },
      data: {
        metadata: {
          ...existingMeta,
          cloneStatus: 'SUCCESS',
          lastSyncedAt: new Date().toISOString(),
          ...details,
        } as Prisma.InputJsonValue,
      },
      include: { installedOn: { select: { gatewayId: true } } },
    });

    return {
      synced: true,
      skill: {
        ...updated,
        installedGatewayIds: updated.installedOn.map((i) => i.gatewayId),
      },
    };
  } catch (err: any) {
    logger.error({ skillId, error: err.message }, 'Failed manual sync for skill');
    await prisma.marketplaceSkill.update({
      where: { id: skillId },
      data: {
        metadata: {
          ...existingMeta,
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
