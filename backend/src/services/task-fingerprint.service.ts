import { createHash } from 'crypto';
import { prisma } from '../lib/prisma.js';

export function generateFingerprint(title: string, description?: string | null): string {
  const content = `${title.trim().toLowerCase()}|${(description || '').trim().toLowerCase()}`;
  return createHash('sha256').update(content).digest('hex');
}

export async function findDuplicate(boardId: string, fingerprintHash: string) {
  return prisma.taskFingerprint.findUnique({
    where: { boardId_fingerprintHash: { boardId, fingerprintHash } },
    include: { task: { select: { id: true, title: true, status: true } } },
  });
}

export async function createFingerprint(boardId: string, taskId: string, fingerprintHash: string) {
  return prisma.taskFingerprint.create({
    data: { boardId, taskId, fingerprintHash },
  });
}
