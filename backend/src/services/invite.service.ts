import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import type { OrgRole } from '@prisma/client';

export async function createInvite(organizationId: string, data: {
  invitedEmail: string;
  role?: OrgRole;
  allBoardsRead?: boolean;
  allBoardsWrite?: boolean;
  boardAccess?: Array<{ boardId: string; canRead?: boolean; canWrite?: boolean }>;
  createdByUserId?: string;
}) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const invite = await prisma.orgInvite.create({
    data: {
      organizationId,
      invitedEmail: data.invitedEmail.toLowerCase().trim(),
      token,
      role: data.role ?? 'MEMBER',
      allBoardsRead: data.allBoardsRead ?? false,
      allBoardsWrite: data.allBoardsWrite ?? false,
      createdByUserId: data.createdByUserId,
      expiresAt,
      boardAccess: data.boardAccess?.length ? {
        create: data.boardAccess.map(ba => ({
          boardId: ba.boardId,
          canRead: ba.canRead ?? true,
          canWrite: ba.canWrite ?? false,
        })),
      } : undefined,
    },
    include: { boardAccess: true },
  });

  logger.info({ inviteId: invite.id, email: data.invitedEmail, orgId: organizationId }, 'Invite created');
  return invite;
}

export async function listInvites(organizationId: string) {
  return prisma.orgInvite.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: { boardAccess: true },
  });
}

export async function revokeInvite(inviteId: string, organizationId: string) {
  return prisma.orgInvite.update({
    where: { id: inviteId, organizationId },
    data: { status: 'REVOKED' },
  });
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { boardAccess: true },
  });

  if (!invite) throw new Error('Invite not found');
  if (invite.status !== 'PENDING') throw new Error('Invite is no longer valid');
  if (invite.expiresAt && invite.expiresAt < new Date()) throw new Error('Invite has expired');

  // Check if user is already a member
  const existing = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId: invite.organizationId, userId } },
  });
  if (existing) throw new Error('User is already a member of this organization');

  // Create membership, copy board access, and update invite in a transaction
  const member = await prisma.$transaction(async (tx) => {
    const newMember = await tx.orgMember.create({
      data: {
        organizationId: invite.organizationId,
        userId,
        role: invite.role,
        allBoardsRead: invite.allBoardsRead,
        allBoardsWrite: invite.allBoardsWrite,
      },
    });

    // Copy invite board access rows to member board access
    if (!invite.allBoardsRead && !invite.allBoardsWrite && invite.boardAccess.length > 0) {
      await tx.orgMemberBoardAccess.createMany({
        data: invite.boardAccess.map(ba => ({
          memberId: newMember.id,
          boardId: ba.boardId,
          canRead: ba.canRead,
          canWrite: ba.canWrite,
        })),
      });
    }

    await tx.orgInvite.update({
      where: { id: invite.id },
      data: {
        status: 'ACCEPTED',
        acceptedByUserId: userId,
        acceptedAt: new Date(),
      },
    });

    return newMember;
  });

  logger.info({ inviteId: invite.id, userId, orgId: invite.organizationId }, 'Invite accepted');
  return member;
}
