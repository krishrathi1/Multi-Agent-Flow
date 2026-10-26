import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { ApprovalStatus } from '@prisma/client';
const tracer = trace.getTracer('nexus-approval');

const APPROVAL_INCLUDE = {
  board: { select: { id: true, name: true, slug: true } },
  task: { select: { id: true, title: true, status: true } },
  agent: { select: { id: true, displayName: true, avatar: true } },
  taskLinks: {
    orderBy: { createdAt: 'asc' as const },
    include: { task: { select: { id: true, title: true, status: true } } },
  },
};

/**
 * Normalize task IDs from multiple sources (task_id, task_ids, payload).
 * Deduplicates while preserving order. Mirrors openclaw `normalize_task_ids()`.
 */
function normalizeTaskIds(
  taskId?: string | null,
  taskIds?: string[],
  payload?: Record<string, unknown> | null,
): string[] {
  const merged: string[] = [];

  // Add from task_ids array first
  if (taskIds) merged.push(...taskIds);

  // Add single task_id
  if (taskId) merged.push(taskId);

  // Extract from payload (taskId, task_id, taskIds, task_ids)
  if (payload && typeof payload === 'object') {
    for (const key of ['task_ids', 'taskIds', 'taskIDs']) {
      const raw = payload[key];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (typeof item === 'string' && item) merged.push(item);
        }
      }
    }
    for (const key of ['task_id', 'taskId', 'taskID']) {
      const raw = payload[key];
      if (typeof raw === 'string' && raw) merged.push(raw);
    }
  }

  // Deduplicate preserving order
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const id of merged) {
    if (!seen.has(id)) {
      seen.add(id);
      deduped.push(id);
    }
  }
  return deduped;
}

/**
 * Enrich an approval response with task_ids and task_titles from the links.
 */
function enrichApprovalResponse(approval: any) {
  const taskIds: string[] = [];
  const taskTitles: string[] = [];

  if (approval.taskLinks?.length > 0) {
    for (const link of approval.taskLinks) {
      taskIds.push(link.taskId);
      if (link.task?.title) taskTitles.push(link.task.title);
    }
  } else if (approval.taskId && approval.task) {
    // Legacy fallback: use direct taskId relation
    taskIds.push(approval.taskId);
    if (approval.task.title) taskTitles.push(approval.task.title);
  }

  return { ...approval, taskIds, taskTitles };
}

export async function getApprovals(organizationId: string, params?: {
  boardId?: string;
  status?: ApprovalStatus;
  limit?: number;
}) {
  const approvals = await prisma.approval.findMany({
    where: {
      board: { organizationId },
      ...(params?.boardId && { boardId: params.boardId }),
      ...(params?.status && { status: params.status }),
    },
    orderBy: { createdAt: 'desc' },
    take: params?.limit || 50,
    include: APPROVAL_INCLUDE,
  });
  return approvals.map(enrichApprovalResponse);
}

export async function getApprovalById(id: string, organizationId: string) {
  const approval = await prisma.approval.findFirst({
    where: { id, board: { organizationId } },
    include: {
      ...APPROVAL_INCLUDE,
      task: { select: { id: true, title: true, status: true, description: true } },
    },
  });
  if (!approval) return null;
  return enrichApprovalResponse(approval);
}

export async function createApproval(organizationId: string, data: {
  boardId: string;
  taskId?: string;
  taskIds?: string[];
  agentId?: string;
  actionType: string;
  payload?: Record<string, unknown>;
  confidence?: number;
  rubricScores?: Record<string, number>;
}) {
  return tracer.startActiveSpan('approval.create', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('board.id', data.boardId);
      span.setAttribute('approval.actionType', data.actionType);

      // Verify the board belongs to this org
      const board = await prisma.board.findFirst({ where: { id: data.boardId, organizationId } });
      if (!board) throw new Error('Board not found');

      // Normalize all task IDs from multiple sources
      const allTaskIds = normalizeTaskIds(data.taskId, data.taskIds, data.payload);
      const primaryTaskId = allTaskIds[0] || null;

      // Linked tasks are marked DONE when a COMPLETE_TASK approval passes, so
      // a task id from another org would let this org complete that org's work.
      if (allTaskIds.length > 0) {
        const unique = [...new Set(allTaskIds)];
        const owned = await prisma.task.count({ where: { id: { in: unique }, organizationId } });
        if (owned !== unique.length) throw Object.assign(new Error('Task not found'), { statusCode: 404 });
      }
      if (data.agentId) {
        const agent = await prisma.agent.findFirst({ where: { id: data.agentId, organizationId }, select: { id: true } });
        if (!agent) throw Object.assign(new Error('Agent not found'), { statusCode: 404 });
      }

      // Check for pending approval conflicts (one pending per task)
      if (allTaskIds.length > 0) {
        const conflicts = await findPendingConflicts(data.boardId, allTaskIds);
        if (Object.keys(conflicts).length > 0) {
          const conflictDetails = Object.entries(conflicts)
            .map(([tid, aid]) => `task ${tid} already has pending approval ${aid}`)
            .join('; ');
          throw Object.assign(
            new Error(`Pending approval conflict: ${conflictDetails}`),
            { statusCode: 409 },
          );
        }
      }

      // Create approval + task links in a transaction
      const approval = await prisma.$transaction(async (tx) => {
        const created = await tx.approval.create({
          data: {
            boardId: data.boardId,
            taskId: primaryTaskId,
            agentId: data.agentId || null,
            actionType: data.actionType,
            payload: data.payload ? (data.payload as Prisma.InputJsonValue) : Prisma.JsonNull,
            confidence: data.confidence ?? null,
            rubricScores: data.rubricScores ? (data.rubricScores as Prisma.InputJsonValue) : undefined,
            status: 'PENDING',
          },
        });

        // Create task links
        if (allTaskIds.length > 0) {
          await tx.approvalTaskLink.createMany({
            data: allTaskIds.map(taskId => ({
              approvalId: created.id,
              taskId,
            })),
          });
        }

        // Re-fetch with includes
        return tx.approval.findUnique({
          where: { id: created.id },
          include: APPROVAL_INCLUDE,
        });
      });

      logger.info(
        { approvalId: approval!.id, boardId: data.boardId, actionType: data.actionType, taskCount: allTaskIds.length },
        'Approval created',
      );
      return enrichApprovalResponse(approval);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function resolveApproval(id: string, organizationId: string, status: 'APPROVED' | 'REJECTED') {
  return tracer.startActiveSpan('approval.resolve', async (span) => {
    try {
      span.setAttribute('approval.id', id);
      span.setAttribute('org.id', organizationId);
      span.setAttribute('approval.resolution', status);

      // Verify org ownership
      const approval = await prisma.approval.findFirst({
        where: { id, board: { organizationId } },
        include: { taskLinks: true },
      });
      if (!approval) throw new Error('Approval not found');

      // A decision is final. The status filter makes the transition atomic, so
      // two concurrent approve/reject clicks can't both win.
      const decided = await prisma.approval.updateMany({
        where: { id, status: 'PENDING' },
        data: { status, resolvedAt: new Date() },
      });
      if (decided.count === 0) {
        throw Object.assign(new Error(`Approval already ${approval.status.toLowerCase()}`), { statusCode: 409 });
      }
      const updated = await prisma.approval.findUniqueOrThrow({
        where: { id },
        include: APPROVAL_INCLUDE,
      });

      // If approved and has linked tasks, handle COMPLETE_TASK action
      if (status === 'APPROVED' && updated.actionType === 'COMPLETE_TASK') {
        const linkedTaskIds = updated.taskLinks.map(l => l.taskId);
        // Fallback to legacy taskId if no links
        if (linkedTaskIds.length === 0 && updated.taskId) {
          linkedTaskIds.push(updated.taskId);
        }
        if (linkedTaskIds.length > 0) {
          await prisma.task.updateMany({
            // Links created before ownership was checked may still point elsewhere.
            where: { id: { in: linkedTaskIds }, organizationId },
            data: { status: 'DONE' },
          });
        }
      }

      logger.info({ approvalId: id, status }, 'Approval resolved');
      return enrichApprovalResponse(updated);
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getApprovalStats(organizationId: string) {
  const [pending, approved, rejected] = await Promise.all([
    prisma.approval.count({ where: { board: { organizationId }, status: 'PENDING' } }),
    prisma.approval.count({ where: { board: { organizationId }, status: 'APPROVED' } }),
    prisma.approval.count({ where: { board: { organizationId }, status: 'REJECTED' } }),
  ]);
  return { pending, approved, rejected, total: pending + approved + rejected };
}

/**
 * Find pending approval conflicts for given task IDs.
 * Returns map of taskId -> conflicting approvalId.
 * Checks both modern links and legacy taskId field.
 */
async function findPendingConflicts(boardId: string, taskIds: string[]): Promise<Record<string, string>> {
  const conflicts: Record<string, string> = {};

  // Check via ApprovalTaskLink (modern path)
  const linkedConflicts = await prisma.approvalTaskLink.findMany({
    where: {
      taskId: { in: taskIds },
      approval: { boardId, status: 'PENDING' },
    },
    select: { taskId: true, approvalId: true },
  });
  for (const row of linkedConflicts) {
    if (!conflicts[row.taskId]) conflicts[row.taskId] = row.approvalId;
  }

  // Check legacy approvals (taskId set but no links)
  const legacyConflicts = await prisma.approval.findMany({
    where: {
      boardId,
      status: 'PENDING',
      taskId: { in: taskIds },
      taskLinks: { none: {} },
    },
    select: { id: true, taskId: true },
  });
  for (const row of legacyConflicts) {
    if (row.taskId && !conflicts[row.taskId]) conflicts[row.taskId] = row.id;
  }

  return conflicts;
}

/**
 * Get approval counts (total, pending) per task for a board.
 * Mirrors openclaw `task_counts_for_board()`.
 */
export async function getTaskApprovalCounts(boardId: string, taskIds?: string[]): Promise<Record<string, { total: number; pending: number }>> {
  const where: any = { approval: { boardId } };
  if (taskIds) where.taskId = { in: taskIds };

  const links = await prisma.approvalTaskLink.findMany({
    where,
    include: { approval: { select: { status: true } } },
  });

  const counts: Record<string, { total: number; pending: number }> = {};
  for (const link of links) {
    if (!counts[link.taskId]) counts[link.taskId] = { total: 0, pending: 0 };
    counts[link.taskId].total++;
    if (link.approval.status === 'PENDING') counts[link.taskId].pending++;
  }

  return counts;
}
