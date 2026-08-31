import { Router } from 'express';
import * as taskService from '../services/task.service.js';
import * as fingerprintService from '../services/task-fingerprint.service.js';
import * as policyService from '../services/board-policy.service.js';
import type { TaskStatus } from '@prisma/client';

const router = Router();

router.get('/', async (req, res) => {
  const tasks = await taskService.getAllTasks(req.organizationId!);
  res.json(tasks);
});

router.post('/', async (req, res) => {
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

router.patch('/:id', async (req, res) => {
  // Enforce board policies if status is changing
  if (req.body.status) {
    const existing = await taskService.getAllTasks(req.organizationId!);
    const currentTask = existing.find(t => t.id === req.params.id);
    if (currentTask?.boardId) {
      const check = await policyService.enforcePolicies(
        req.params.id,
        currentTask.boardId,
        req.body.status as TaskStatus,
        req.body.agentId || currentTask.agentId
      );
      if (!check.allowed) {
        return res.status(403).json({ error: check.reason });
      }
    }
  }

  const task = await taskService.updateTask(req.params.id, req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:update', task);
  res.json(task);
});

router.delete('/:id', async (req, res) => {
  await taskService.deleteTask(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:delete', { id: req.params.id });
  res.status(204).end();
});

export default router;
