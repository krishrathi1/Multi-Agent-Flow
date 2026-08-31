import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { TaskStatus, Priority } from '@prisma/client';
const tracer = trace.getTracer('nexus-task');

export async function getAllTasks(organizationId: string) {
  return prisma.task.findMany({
    where: { organizationId },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
    include: { agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
  });
}

export async function createTask(organizationId: string, data: {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Priority;
  agentId?: string;
  boardId?: string;
}) {
  return tracer.startActiveSpan('task.create', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('task.title', data.title);
      if (data.agentId) span.setAttribute('agent.id', data.agentId);
      const task = await prisma.task.create({
        data: {
          organizationId,
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          agentId: data.agentId,
          boardId: data.boardId,
        },
        include: { agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
      });
      logger.info({ taskId: task.id, orgId: organizationId }, 'Task created');
      return task;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function updateTask(
  id: string,
  organizationId: string,
  data: {
    title?: string;
    description?: string;
    status?: TaskStatus;
    priority?: Priority;
    agentId?: string | null;
    boardId?: string | null;
    fingerprintHash?: string;
  }
) {
  return tracer.startActiveSpan('task.update', async (span) => {
    try {
      span.setAttribute('task.id', id);
      span.setAttribute('org.id', organizationId);
      if (data.status) span.setAttribute('task.status', data.status);
      const task = await prisma.task.update({
        where: { id, organizationId },
        data,
        include: { agent: { select: { id: true, name: true, displayName: true, avatar: true } } },
      });
      logger.info({ taskId: id, orgId: organizationId, status: data.status }, 'Task updated');
      return task;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function deleteTask(id: string, organizationId: string) {
  return tracer.startActiveSpan('task.delete', async (span) => {
    try {
      span.setAttribute('task.id', id);
      span.setAttribute('org.id', organizationId);
      const result = await prisma.task.delete({ where: { id, organizationId } });
      logger.info({ taskId: id, orgId: organizationId }, 'Task deleted');
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
