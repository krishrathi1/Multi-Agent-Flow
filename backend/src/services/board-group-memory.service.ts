import { prisma } from '../lib/prisma.js';

export async function addMemory(boardGroupId: string, data: {
  content: string;
  tags?: string[];
  isChat?: boolean;
  source?: string;
}) {
  return prisma.boardGroupMemory.create({
    data: {
      boardGroupId,
      content: data.content,
      tags: data.tags ?? [],
      isChat: data.isChat ?? false,
      source: data.source,
    },
  });
}

export async function listMemory(boardGroupId: string, options?: { limit?: number; offset?: number; since?: Date }) {
  return prisma.boardGroupMemory.findMany({
    where: {
      boardGroupId,
      ...(options?.since && { createdAt: { gte: options.since } }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

export async function deleteMemory(id: string, boardGroupId: string) {
  return prisma.boardGroupMemory.delete({ where: { id, boardGroupId } });
}

export async function addFromBoard(boardId: string, organizationId: string, data: {
  content: string;
  tags?: string[];
  isChat?: boolean;
  source?: string;
}) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, organizationId },
    select: { boardGroupId: true },
  });
  if (!board?.boardGroupId) throw new Error('Board is not part of a group');

  return addMemory(board.boardGroupId, data);
}

export async function listForBoard(boardId: string, organizationId: string, options?: { limit?: number; since?: Date }) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, organizationId },
    select: { boardGroupId: true },
  });
  if (!board?.boardGroupId) return [];

  return listMemory(board.boardGroupId, options);
}
