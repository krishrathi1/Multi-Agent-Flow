import { Router } from 'express';
import * as memoryService from '../services/board-memory.service.js';
import { requireBoardAccess } from '../middleware/resource-access.js';

const router = Router({ mergeParams: true });

// Every route here is keyed by a board id that the services filter on alone,
// so without this gate any authenticated user could read another org's board
// memory by supplying its id.
router.use('/:boardId', requireBoardAccess);

// Routes under /api/boards/:boardId/memory
router.post('/:boardId/memory', async (req, res) => {
  const memory = await memoryService.addMemory(req.params.boardId, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('boardMemory:added', { boardId: req.params.boardId, id: memory.id });
  res.status(201).json(memory);
});

router.get('/:boardId/memory', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const since = req.query.since ? new Date(req.query.since as string) : undefined;
  const isChat = req.query.isChat !== undefined ? req.query.isChat === 'true' : undefined;
  const memories = await memoryService.listMemory(req.params.boardId, { limit, offset, since, isChat });
  res.json(memories);
});

router.delete('/:boardId/memory/:id', async (req, res) => {
  await memoryService.deleteMemory(req.params.id, req.params.boardId);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('boardMemory:deleted', { boardId: req.params.boardId, id: req.params.id });
  res.status(204).end();
});

export default router;
