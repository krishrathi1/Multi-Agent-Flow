import { prisma } from '../lib/prisma.js';

export async function addMemory(boardId: string, data: {
  content: string;
  tags?: string[];
  isChat?: boolean;
  source?: string;
}) {
  return prisma.boardMemory.create({
    data: {
      boardId,
      content: data.content,
      tags: data.tags ?? [],
      isChat: data.isChat ?? false,
      source: data.source,
    },
  });
}

export async function listMemory(boardId: string, options?: {
  limit?: number;
  offset?: number;
  since?: Date;
  isChat?: boolean;
}) {
  return prisma.boardMemory.findMany({
    where: {
      boardId,
      ...(options?.since && { createdAt: { gte: options.since } }),
      ...(options?.isChat !== undefined && { isChat: options.isChat }),
    },
    orderBy: { createdAt: 'desc' },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });
}

export async function deleteMemory(id: string, boardId: string) {
  return prisma.boardMemory.delete({ where: { id, boardId } });
}
