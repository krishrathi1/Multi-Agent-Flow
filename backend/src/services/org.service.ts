import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { generateApiKey, decryptField } from '../lib/crypto.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { OrgRole } from '@prisma/client';
const tracer = trace.getTracer('nexus-org');

export async function getOrganization(orgId: string) {
  return prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      _count: {
        select: { members: true, agents: true },
      },
    },
  });
}

export async function updateOrganization(orgId: string, data: { name?: string; settings?: Record<string, unknown> }) {
  return prisma.organization.update({
    where: { id: orgId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.settings !== undefined && { settings: data.settings as any }),
    },
  });
}

export async function getMembers(orgId: string) {
  return prisma.orgMember.findMany({
    where: { organizationId: orgId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      boardAccess: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'asc' },
  });
}

export async function inviteMember(orgId: string, email: string, role: OrgRole) {
  return tracer.startActiveSpan('org.inviteMember', async (span) => {
    try {
      span.setAttribute('org.id', orgId);
      span.setAttribute('member.role', role);
      // Check if user exists
      let user = await prisma.user.findUnique({ where: { email } });

      if (!user) {
        // Create user with random password (they'll need to use forgot password or sign up separately)
        const randomPassword = randomBytes(32).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, 12);
        user = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
            name: email.split('@')[0],
          },
        });
      }

      // Check if already a member
      const existingMember = await prisma.orgMember.findUnique({
        where: { organizationId_userId: { organizationId: orgId, userId: user.id } },
      });
      if (existingMember) {
        throw new Error('User is already a member of this organization');
      }

      const isAdminOrOwner = role === 'OWNER' || role === 'ADMIN';
      const member = await prisma.orgMember.create({
        data: {
          organizationId: orgId,
          userId: user.id,
          role,
          allBoardsRead: isAdminOrOwner,
          allBoardsWrite: isAdminOrOwner,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
          boardAccess: true,
        },
      });
      logger.info({ orgId, userId: user.id, role }, 'Member invited to organization');
      return member;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function updateMemberRole(memberId: string, orgId: string, role: OrgRole) {
  // Verify member belongs to the caller's organization (prevents IDOR)
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId: orgId },
  });
  if (!member) throw new Error('Member not found in this organization');

  return prisma.orgMember.update({
    where: { id: memberId },
    data: { role },
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function removeMember(memberId: string, orgId: string) {
  return tracer.startActiveSpan('org.removeMember', async (span) => {
    try {
      span.setAttribute('org.id', orgId);
      span.setAttribute('member.id', memberId);
      // Verify member belongs to the caller's organization (prevents IDOR)
      const member = await prisma.orgMember.findFirst({
        where: { id: memberId, organizationId: orgId },
      });
      if (!member) throw new Error('Member not found in this organization');

      // Delete board access records first, then member
      await prisma.orgMemberBoardAccess.deleteMany({ where: { memberId } });
      const result = await prisma.orgMember.delete({ where: { id: memberId } });
      logger.info({ orgId, memberId }, 'Member removed from organization');
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getApiKeys(orgId: string) {
  return prisma.orgApiKey.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createApiKey(orgId: string, name: string) {
  return tracer.startActiveSpan('org.createApiKey', async (span) => {
    try {
      span.setAttribute('org.id', orgId);
      span.setAttribute('apiKey.name', name);
      const { key, prefix, hash } = generateApiKey();

      const apiKey = await prisma.orgApiKey.create({
        data: {
          organizationId: orgId,
          name,
          keyHash: hash,
          keyPrefix: prefix,
        },
      });

      logger.info({ orgId, apiKeyId: apiKey.id, prefix }, 'API key created');
      // Return the full key only once
      return {
        id: apiKey.id,
        name: apiKey.name,
        key, // full key — only returned at creation time
        prefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt,
      };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function revokeApiKey(keyId: string, orgId: string) {
  // Verify API key belongs to the caller's organization (prevents IDOR)
  const key = await prisma.orgApiKey.findFirst({
    where: { id: keyId, organizationId: orgId },
  });
  if (!key) throw new Error('API key not found in this organization');

  return prisma.orgApiKey.delete({ where: { id: keyId } });
}

/** Centralized helper to securely retrieve and decrypt organization integration credentials */
export async function getOrganizationIntegrationToken(
  orgId: string,
  provider: 'github' | 'vercel',
): Promise<string | undefined> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { settings: true },
  });
  if (!org?.settings) return undefined;
  const settings = org.settings as Record<string, unknown>;

  const encryptedKey = provider === 'github' ? 'githubTokenEncrypted' : 'vercelTokenEncrypted';
  const legacyKey = provider === 'github' ? 'githubToken' : 'vercelToken';

  if (typeof settings[encryptedKey] === 'string' && settings[encryptedKey]) {
    try {
      return decryptField(settings[encryptedKey] as string);
    } catch (err) {
      logger.error({ orgId, provider, err }, 'Failed to decrypt organization integration credential');
      throw new Error(`Failed to decrypt ${provider} integration credentials. Please reconnect the integration in Settings.`);
    }
  }

  // Fallback to legacy plaintext during transitional period
  if (typeof settings[legacyKey] === 'string' && settings[legacyKey]) {
    return settings[legacyKey] as string;
  }

  return undefined;
}
