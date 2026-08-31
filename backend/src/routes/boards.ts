import { Router } from 'express';
import * as boardService from '../services/board.service.js';

const router = Router();

// Board Groups
router.get('/groups', async (req, res) => {
  const groups = await boardService.getAllBoardGroups(req.organizationId!);
  res.json(groups);
});

router.post('/groups', async (req, res) => {
  const group = await boardService.createBoardGroup(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('boardGroup:created', group);
  res.status(201).json(group);
});

router.patch('/groups/:id', async (req, res) => {
  const group = await boardService.updateBoardGroup(req.params.id, req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('boardGroup:updated', group);
  res.json(group);
});

router.delete('/groups/:id', async (req, res) => {
  await boardService.deleteBoardGroup(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('boardGroup:deleted', { id: req.params.id });
  res.status(204).end();
});

// Boards
router.get('/', async (req, res) => {
  const boards = await boardService.getAllBoards(req.organizationId!);
  res.json(boards);
});

// Board Snapshot — full board state in one response
router.get('/:id/snapshot', async (req, res) => {
  const snapshot = await boardService.getBoardSnapshot(req.params.id, req.organizationId!);
  if (!snapshot) return res.status(404).json({ error: 'Board not found' });
  res.json(snapshot);
});

// Board Group Snapshot — cross-board summary for the board's group
router.get('/groups/:groupId/snapshot', async (req, res) => {
  const includeDone = req.query.includeDone === 'true';
  const perBoardTaskLimit = parseInt(req.query.perBoardTaskLimit as string) || 5;
  const snapshot = await boardService.getBoardGroupSnapshot(req.params.groupId, req.organizationId!, { includeDone, perBoardTaskLimit });
  if (!snapshot) return res.status(404).json({ error: 'Board group not found' });
  res.json(snapshot);
});

router.get('/:id', async (req, res) => {
  const board = await boardService.getBoardById(req.params.id, req.organizationId!);
  if (!board) return res.status(404).json({ error: 'Board not found' });
  res.json(board);
});

router.post('/', async (req, res) => {
  const board = await boardService.createBoard(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('board:created', board);
  res.status(201).json(board);
});

router.patch('/:id', async (req, res) => {
  const board = await boardService.updateBoard(req.params.id, req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('board:updated', board);
  res.json(board);
});

router.delete('/:id', async (req, res) => {
  await boardService.deleteBoard(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('board:deleted', { id: req.params.id });
  res.status(204).end();
});

// Board agent management
router.post('/:id/agents', async (req, res) => {
  try {
    const { agentId, isLead } = req.body;
    const agent = await boardService.addAgentToBoard(req.params.id, agentId, req.organizationId!, isLead);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('board:agentAdded', { boardId: req.params.id, agent });
    res.json(agent);
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

router.delete('/:id/agents/:agentId', async (req, res) => {
  await boardService.removeAgentFromBoard(req.params.agentId, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('board:agentRemoved', { boardId: req.params.id, agentId: req.params.agentId });
  res.status(204).end();
});

export default router;
