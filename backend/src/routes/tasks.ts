import { Router } from 'express';
import * as taskService from '../services/task.service.js';
import * as fingerprintService from '../services/task-fingerprint.service.js';
import * as policyService from '../services/board-policy.service.js';
import type { TaskStatus } from '@prisma/client';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { foreignReference } from '../middleware/resource-access.js';

const router = Router();

/** Accepts `in_progress` as well as `IN_PROGRESS`; Prisma enums are upper case. */
const upperEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(v => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(values));

const status = upperEnum(['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE']);
const priority = upperEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Only these fields reach Prisma — the body used to be passed through whole,
// so a PATCH could rewrite organizationId and move a task to another org.
const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500),
  description: z.string().max(20000).optional(),
  status: status.optional(),
  priority: priority.optional(),
  agentId: z.string().uuid().optional(),
  boardId: z.string().uuid().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(500).optional(),
  description: z.string().max(20000).nullable().optional(),
  status: status.optional(),
  priority: priority.optional(),
  agentId: z.string().uuid().nullable().optional(),
  boardId: z.string().uuid().nullable().optional(),
});

router.get('/', async (req, res) => {
  const tasks = await taskService.getAllTasks(req.organizationId!);
  res.json(tasks);
});

router.post('/', validate(createTaskSchema), async (req, res) => {
  const foreign = await foreignReference(req.organizationId!, req.body);
  if (foreign) return res.status(400).json({ error: `Unknown ${foreign}` });

  const task = await taskService.createTask(req.organizationId!, req.body);

  // Generate fingerprint hash for all tasks
  const hash = fingerprintService.generateFingerprint(task.title, task.description);
  await taskService.updateTask(task.id, req.organizationId!, { fingerprintHash: hash });
  (task as any).fingerprintHash = hash;

  // Check for duplicates within the board
  if (task.boardId) {
    const duplicate = await fingerprintService.findDuplicate(task.boardId, hash);
    if (!duplicate) {
      await fingerprintService.createFingerprint(task.boardId, task.id, hash);
    } else {
      (task as any).duplicateOf = duplicate.task;
    }
  }

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:update', task);
  res.status(201).json(task);
});

router.patch('/:id', validate(updateTaskSchema), async (req, res) => {
  const foreign = await foreignReference(req.organizationId!, req.body);
  if (foreign) return res.status(400).json({ error: `Unknown ${foreign}` });

  // Enforce board policies if status is changing
  if (req.body.status) {
    const existing = await taskService.getAllTasks(req.organizationId!);
    const currentTask = existing.find(t => t.id === req.params.id);
    if (currentTask?.boardId) {
      const check = await policyService.enforcePolicies(
        String(req.params.id),
        currentTask.boardId,
        req.body.status as TaskStatus,
        req.body.agentId || currentTask.agentId
      );
      if (!check.allowed) {
        return res.status(403).json({ error: check.reason });
      }
    }
  }

  const task = await taskService.updateTask(String(req.params.id), req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:update', task);
  res.json(task);
});

router.delete('/:id', async (req, res) => {
  await taskService.deleteTask(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:delete', { id: req.params.id });
  res.status(204).end();
});

export default router;
