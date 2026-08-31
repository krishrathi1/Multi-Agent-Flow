import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * Check whether a member has board access for the requested mode.
 * Mirrors openclaw `has_board_access()`.
 */
export async function hasBoardAccess(
  memberId: string,
  boardId: string,
  write: boolean,
): Promise<boolean> {
  const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!member) return false;

  // Organization-wide access flags take precedence
  if (write && member.allBoardsWrite) return true;
  if (!write && (member.allBoardsRead || member.allBoardsWrite)) return true;

  // Check explicit board-level access
  const access = await prisma.orgMemberBoardAccess.findUnique({
    where: { memberId_boardId: { memberId, boardId } },
  });
  if (!access) return false;

  if (write) return access.canWrite;
  return access.canRead || access.canWrite;
}

/**
 * Require board access for a user — throws 403 if denied.
 * Returns the OrgMember record.
 * Mirrors openclaw `require_board_access()`.
 */
export async function requireBoardAccess(
  userId: string,
  organizationId: string,
  boardId: string,
  write: boolean,
) {
  const member = await prisma.orgMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!member) {
    throw Object.assign(new Error('No org access'), { statusCode: 403 });
  }

  const allowed = await hasBoardAccess(member.id, boardId, write);
  if (!allowed) {
    throw Object.assign(new Error('Board access denied'), { statusCode: 403 });
  }

  return member;
}

/**
 * List board IDs accessible to a member for read or write mode.
 * Mirrors openclaw `list_accessible_board_ids()`.
 */
export async function listAccessibleBoardIds(
  memberId: string,
  organizationId: string,
  write: boolean,
): Promise<string[]> {
  const member = await prisma.orgMember.findUnique({ where: { id: memberId } });
  if (!member) return [];

  // If org-wide access, return all boards
  if ((write && member.allBoardsWrite) || (!write && (member.allBoardsRead || member.allBoardsWrite))) {
    const boards = await prisma.board.findMany({
      where: { organizationId },
      select: { id: true },
    });
    return boards.map(b => b.id);
  }

  // Return explicitly granted boards
  const accessRows = await prisma.orgMemberBoardAccess.findMany({
    where: {
      memberId,
      ...(write ? { canWrite: true } : { OR: [{ canRead: true }, { canWrite: true }] }),
    },
    select: { boardId: true },
  });

  return accessRows.map(r => r.boardId);
}

/**
 * Replace a member's board access settings.
 * Mirrors openclaw `apply_member_access_update()` — uses "replace" semantics.
 */
export async function updateMemberAccess(
  memberId: string,
  organizationId: string,
  data: {
    allBoardsRead: boolean;
    allBoardsWrite: boolean;
    boardAccess: Array<{ boardId: string; canRead: boolean; canWrite: boolean }>;
  },
) {
  // Verify member belongs to the org
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!member) {
    throw Object.assign(new Error('Member not found in this organization'), { statusCode: 404 });
  }

  // Validate all board IDs belong to the org
  if (data.boardAccess.length > 0) {
    const boardIds = data.boardAccess.map(ba => ba.boardId);
    const validBoards = await prisma.board.findMany({
      where: { id: { in: boardIds }, organizationId },
      select: { id: true },
    });
    const validIds = new Set(validBoards.map(b => b.id));
    const invalidIds = boardIds.filter(id => !validIds.has(id));
    if (invalidIds.length > 0) {
      throw Object.assign(
        new Error(`Invalid board IDs: ${invalidIds.join(', ')}`),
        { statusCode: 422 },
      );
    }
  }

  // Transaction: update member flags + replace explicit board access rows
  const updated = await prisma.$transaction(async (tx) => {
    // Update org-wide flags
    const updatedMember = await tx.orgMember.update({
      where: { id: memberId },
      data: {
        allBoardsRead: data.allBoardsRead,
        allBoardsWrite: data.allBoardsWrite,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    // Delete all existing explicit board access
    await tx.orgMemberBoardAccess.deleteMany({ where: { memberId } });

    // If using org-wide access, don't add explicit rows
    if (!data.allBoardsRead && !data.allBoardsWrite && data.boardAccess.length > 0) {
      await tx.orgMemberBoardAccess.createMany({
        data: data.boardAccess.map(ba => ({
          memberId,
          boardId: ba.boardId,
          canRead: ba.canRead,
          canWrite: ba.canWrite,
        })),
      });
    }

    // Fetch the created access rows
    const boardAccess = await tx.orgMemberBoardAccess.findMany({
      where: { memberId },
      orderBy: { createdAt: 'asc' },
    });

    return { ...updatedMember, boardAccess };
  });

  logger.info(
    { memberId, orgId: organizationId, allBoardsRead: data.allBoardsRead, allBoardsWrite: data.allBoardsWrite, boardAccessCount: data.boardAccess.length },
    'Member board access updated',
  );

  return updated;
}

/**
 * Get a single member with their board access records.
 */
export async function getMemberWithAccess(memberId: string, organizationId: string) {
  const member = await prisma.orgMember.findFirst({
    where: { id: memberId, organizationId },
    include: {
      user: { select: { id: true, email: true, name: true } },
      boardAccess: { orderBy: { createdAt: 'asc' } },
    },
  });
  if (!member) {
    throw Object.assign(new Error('Member not found in this organization'), { statusCode: 404 });
  }
  return member;
}
