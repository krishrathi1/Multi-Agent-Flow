import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
const tracer = trace.getTracer('nexus-board');

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// Board Groups
export async function getAllBoardGroups(organizationId: string) {
  return prisma.boardGroup.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: { _count: { select: { boards: true } } },
  });
}

export async function createBoardGroup(organizationId: string, data: { name: string; description?: string }) {
  return prisma.boardGroup.create({
    data: {
      organizationId,
      name: data.name,
      slug: toSlug(data.name),
      description: data.description || '',
    },
    include: { _count: { select: { boards: true } } },
  });
}

export async function updateBoardGroup(id: string, organizationId: string, data: { name?: string; description?: string }) {
  return prisma.boardGroup.update({
    where: { id, organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name, slug: toSlug(data.name) }),
      ...(data.description !== undefined && { description: data.description }),
    },
    include: { _count: { select: { boards: true } } },
  });
}

export async function deleteBoardGroup(id: string, organizationId: string) {
  return prisma.boardGroup.delete({ where: { id, organizationId } });
}

// Boards
export async function getAllBoards(organizationId: string) {
  return prisma.board.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { tasks: true, agents: true, approvals: true } },
      boardGroup: { select: { id: true, name: true } },
    },
  });
}

export async function getBoardById(id: string, organizationId: string) {
  return prisma.board.findFirst({
    where: { id, organizationId },
    include: {
      tasks: {
        orderBy: { updatedAt: 'desc' },
        include: { agent: { select: { id: true, displayName: true, avatar: true } } },
      },
      agents: { select: { id: true, displayName: true, avatar: true, status: true, isBoardLead: true } },
      approvals: { orderBy: { createdAt: 'desc' }, take: 20 },
      boardGroup: true,
      _count: { select: { tasks: true, agents: true, approvals: true } },
    },
  });
}

export async function createBoard(organizationId: string, data: {
  name: string;
  description?: string;
  gatewayId?: string;
  boardGroupId?: string;
  boardType?: string;
  objective?: string;
  targetDate?: string;
  maxAgents?: number;
  requireApprovalForDone?: boolean;
}) {
  return tracer.startActiveSpan('board.create', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('board.name', data.name);
      const board = await prisma.board.create({
        data: {
          organizationId,
          name: data.name,
          slug: toSlug(data.name),
          description: data.description || '',
          gatewayId: data.gatewayId || null,
          boardGroupId: data.boardGroupId || null,
          boardType: data.boardType || 'goal',
          objective: data.objective || null,
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          maxAgents: data.maxAgents ?? 3,
          requireApprovalForDone: data.requireApprovalForDone ?? true,
        },
        include: {
          _count: { select: { tasks: true, agents: true, approvals: true } },
          boardGroup: { select: { id: true, name: true } },
        },
      });
      logger.info({ boardId: board.id, orgId: organizationId }, 'Board created');
      return board;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function updateBoard(id: string, organizationId: string, data: {
  name?: string;
  description?: string;
  gatewayId?: string;
  boardGroupId?: string;
  boardType?: string;
  objective?: string;
  targetDate?: string | null;
  maxAgents?: number;
  requireApprovalForDone?: boolean;
  requireReviewBeforeDone?: boolean;
  blockStatusChangesWithPendingApproval?: boolean;
  onlyLeadCanChangeStatus?: boolean;
}) {
  return tracer.startActiveSpan('board.update', async (span) => {
    try {
      span.setAttribute('board.id', id);
      span.setAttribute('org.id', organizationId);
      const board = await prisma.board.update({
        where: { id, organizationId },
        data: {
          ...(data.name !== undefined && { name: data.name, slug: toSlug(data.name) }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.gatewayId !== undefined && { gatewayId: data.gatewayId || null }),
          ...(data.boardGroupId !== undefined && { boardGroupId: data.boardGroupId || null }),
          ...(data.boardType !== undefined && { boardType: data.boardType }),
          ...(data.objective !== undefined && { objective: data.objective }),
          ...(data.targetDate !== undefined && { targetDate: data.targetDate ? new Date(data.targetDate) : null }),
          ...(data.maxAgents !== undefined && { maxAgents: data.maxAgents }),
          ...(data.requireApprovalForDone !== undefined && { requireApprovalForDone: data.requireApprovalForDone }),
          ...(data.requireReviewBeforeDone !== undefined && { requireReviewBeforeDone: data.requireReviewBeforeDone }),
          ...(data.blockStatusChangesWithPendingApproval !== undefined && { blockStatusChangesWithPendingApproval: data.blockStatusChangesWithPendingApproval }),
          ...(data.onlyLeadCanChangeStatus !== undefined && { onlyLeadCanChangeStatus: data.onlyLeadCanChangeStatus }),
        },
        include: {
          _count: { select: { tasks: true, agents: true, approvals: true } },
          boardGroup: { select: { id: true, name: true } },
        },
      });
      logger.info({ boardId: id, orgId: organizationId }, 'Board updated');
      return board;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function deleteBoard(id: string, organizationId: string) {
  return tracer.startActiveSpan('board.delete', async (span) => {
    try {
      span.setAttribute('board.id', id);
      span.setAttribute('org.id', organizationId);
      const result = await prisma.board.delete({ where: { id, organizationId } });
      logger.info({ boardId: id, orgId: organizationId }, 'Board deleted');
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

// Board Snapshot — full board state in a single response
export async function getBoardSnapshot(id: string, organizationId: string) {
  const board = await prisma.board.findFirst({
    where: { id, organizationId },
    include: {
      boardGroup: true,
    },
  });
  if (!board) return null;

  const [tasks, agents, approvals, chatMessages, pendingApprovalCount] = await Promise.all([
    prisma.task.findMany({
      where: { boardId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, displayName: true, avatar: true } },
        dependentOn: { select: { blockingTaskId: true } },
        blocking: { select: { dependentTaskId: true } },
        tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
        approvals: { select: { id: true, status: true } },
      },
    }),
    prisma.agent.findMany({
      where: { boardId: id, organizationId },
      select: { id: true, displayName: true, avatar: true, status: true, isBoardLead: true, lastHeartbeat: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.approval.findMany({
      where: { boardId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.boardMemory.findMany({
      where: { boardId: id, isChat: true },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    prisma.approval.count({
      where: { boardId: id, status: 'PENDING' },
    }),
  ]);

  // Enrich tasks with computed fields
  const doneTaskIds = new Set(tasks.filter(t => t.status === 'DONE').map(t => t.id));
  const enrichedTasks = tasks.map(task => {
    const blockedByIds = task.dependentOn
      .map(d => d.blockingTaskId)
      .filter(tid => !doneTaskIds.has(tid));
    return {
      ...task,
      assignee: task.agent?.displayName ?? null,
      approvalsCount: task.approvals.length,
      approvalsPendingCount: task.approvals.filter(a => a.status === 'PENDING').length,
      dependsOnTaskIds: task.dependentOn.map(d => d.blockingTaskId),
      blockedByTaskIds: blockedByIds,
      isBlocked: blockedByIds.length > 0,
      tagList: task.tags.map(ta => ta.tag),
    };
  });

  return {
    board,
    tasks: enrichedTasks,
    agents,
    approvals,
    chatMessages,
    pendingApprovalsCount: pendingApprovalCount,
  };
}

// Board Group Snapshot — cross-board summary
export async function getBoardGroupSnapshot(
  groupId: string,
  organizationId: string,
  options?: { includeDone?: boolean; perBoardTaskLimit?: number },
) {
  const group = await prisma.boardGroup.findFirst({
    where: { id: groupId, organizationId },
  });
  if (!group) return null;

  const boards = await prisma.board.findMany({
    where: { boardGroupId: groupId, organizationId },
    orderBy: { name: 'asc' },
  });
  if (boards.length === 0) return { group, boards: [] };

  const boardIds = boards.map(b => b.id);
  const includeDone = options?.includeDone ?? false;
  const perBoardLimit = options?.perBoardTaskLimit ?? 5;

  // Fetch all tasks for these boards in one query
  const allTasks = await prisma.task.findMany({
    where: {
      boardId: { in: boardIds },
      ...(!includeDone && { status: { not: 'DONE' } }),
    },
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      agent: { select: { id: true, displayName: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
    },
  });

  // Build task counts per board (including all statuses)
  const allTasksForCounts = await prisma.task.groupBy({
    by: ['boardId', 'status'],
    where: { boardId: { in: boardIds } },
    _count: true,
  });

  const taskCountsByBoard: Record<string, Record<string, number>> = {};
  for (const row of allTasksForCounts) {
    if (!taskCountsByBoard[row.boardId!]) taskCountsByBoard[row.boardId!] = {};
    taskCountsByBoard[row.boardId!][row.status] = row._count;
  }

  // Group tasks by board, limit per board
  const tasksByBoard: Record<string, typeof allTasks> = {};
  for (const task of allTasks) {
    if (!task.boardId) continue;
    if (!tasksByBoard[task.boardId]) tasksByBoard[task.boardId] = [];
    if (tasksByBoard[task.boardId].length < perBoardLimit) {
      tasksByBoard[task.boardId].push(task);
    }
  }

  const boardSnapshots = boards.map(board => ({
    board,
    taskCounts: taskCountsByBoard[board.id] ?? {},
    tasks: (tasksByBoard[board.id] ?? []).map(task => ({
      id: task.id,
      boardId: task.boardId,
      boardName: board.name,
      title: task.title,
      status: task.status,
      priority: task.priority,
      agentId: task.agentId,
      assignee: task.agent?.displayName ?? null,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      tags: task.tags.map(ta => ta.tag),
    })),
  }));

  return { group, boards: boardSnapshots };
}

export async function addAgentToBoard(boardId: string, agentId: string, organizationId: string, isLead?: boolean) {
  // Verify both agent and board belong to the same org
  const [agent, board] = await Promise.all([
    prisma.agent.findFirst({ where: { id: agentId, organizationId } }),
    prisma.board.findFirst({ where: { id: boardId, organizationId } }),
  ]);
  if (!agent) throw new Error('Agent not found');
  if (!board) throw new Error('Board not found');

  return prisma.agent.update({
    where: { id: agentId, organizationId },
    data: { boardId, isBoardLead: isLead ?? false },
  });
}

export async function removeAgentFromBoard(agentId: string, organizationId: string) {
  return prisma.agent.update({
    where: { id: agentId, organizationId },
    data: { boardId: null, isBoardLead: false },
  });
}
