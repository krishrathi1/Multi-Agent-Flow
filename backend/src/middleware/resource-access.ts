import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

/**
 * Ownership gates for routes addressed by a nested resource id.
 *
 * Several board-scoped routers took `:boardId` straight from the URL and
 * passed it to a service that filtered on it alone. Since a board id is the
 * only thing standing between a caller and the data, any authenticated user
 * could read another organization's board memory and inbound webhook payloads
 * — and delete its webhooks — just by supplying the id. All four were proven
 * against a running server before these gates existed.
 *
 * Mounted as `router.use('/:boardId', requireBoardAccess)` so the check runs
 * before any handler in the router, rather than relying on each one to
 * remember.
 */

/** Express 5 types params as `string | string[]`; these routes take one id. */
function paramId(v: unknown): string | undefined {
  if (Array.isArray(v)) return typeof v[0] === 'string' ? v[0] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/**
 * A missing resource and one belonging to another organization both answer
 * 404 — telling them apart would confirm that an id exists, which is a
 * disclosure in its own right.
 */
const deny = (res: Response, what: string) =>
  res.status(404).json({ error: `${what} not found` });

export async function requireBoardAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const boardId = paramId(req.params.boardId);
  if (!boardId) return next();

  const board = await prisma.board.findFirst({
    where: { id: boardId, organizationId: req.organizationId },
    select: { id: true },
  });
  if (!board) return deny(res, 'Board');
  next();
}

export async function requireBoardGroupAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const groupId = paramId(req.params.groupId);
  if (!groupId) return next();

  const group = await prisma.boardGroup.findFirst({
    where: { id: groupId, organizationId: req.organizationId },
    select: { id: true },
  });
  if (!group) return deny(res, 'Board group');
  next();
}

/** Gate for routes keyed by a task id rather than a board id. */
export async function requireTaskAccess(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const taskId = paramId(req.params.taskId);
  if (!taskId) return next();

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: req.organizationId },
    select: { id: true },
  });
  if (!task) return deny(res, 'Task');
  next();
}
