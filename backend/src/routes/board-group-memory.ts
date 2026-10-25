import { Router } from 'express';
import * as memoryService from '../services/board-group-memory.service.js';
import { requireBoardGroupAccess } from '../middleware/resource-access.js';

const router = Router({ mergeParams: true });

router.use('/:groupId', requireBoardGroupAccess);

// Routes under /api/board-groups/:groupId/memory
router.post('/:groupId/memory', async (req, res) => {
  const memory = await memoryService.addMemory(req.params.groupId, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('memory:added', { boardGroupId: req.params.groupId, id: memory.id });
  res.status(201).json(memory);
});

router.get('/:groupId/memory', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const since = req.query.since ? new Date(req.query.since as string) : undefined;
  const memories = await memoryService.listMemory(req.params.groupId, { limit, offset, since });
  res.json(memories);
});

router.delete('/:groupId/memory/:id', async (req, res) => {
  await memoryService.deleteMemory(req.params.id, req.params.groupId);
  res.status(204).end();
});

export default router;
