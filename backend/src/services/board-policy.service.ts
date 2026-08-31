import { prisma } from '../lib/prisma.js';
import type { TaskStatus } from '@prisma/client';

interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function enforcePolicies(
  taskId: string,
  boardId: string,
  newStatus: TaskStatus,
  agentId?: string | null
): Promise<PolicyCheckResult> {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  if (!board) return { allowed: true };

  // Policy: requireReviewBeforeDone — task must pass through REVIEW before DONE
  if (board.requireReviewBeforeDone && newStatus === 'DONE') {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (task && task.status !== 'REVIEW') {
      return { allowed: false, reason: 'Task must be in REVIEW status before marking as DONE' };
    }
  }

  // Policy: blockStatusChangesWithPendingApproval
  if (board.blockStatusChangesWithPendingApproval) {
    const pendingApproval = await prisma.approval.findFirst({
      where: { taskId, status: 'PENDING' },
    });
    if (pendingApproval) {
      return { allowed: false, reason: 'Cannot change status while an approval is pending' };
    }
  }

  // Policy: onlyLeadCanChangeStatus
  if (board.onlyLeadCanChangeStatus && agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (agent && !agent.isBoardLead) {
      return { allowed: false, reason: 'Only the board lead can change task status' };
    }
  }

  // Policy: requireApprovalForDone
  if (board.requireApprovalForDone && newStatus === 'DONE') {
    const approvedApproval = await prisma.approval.findFirst({
      where: { taskId, status: 'APPROVED' },
    });
    if (!approvedApproval) {
      return { allowed: false, reason: 'Task requires an approved approval before marking as DONE' };
    }
  }

  return { allowed: true };
}
