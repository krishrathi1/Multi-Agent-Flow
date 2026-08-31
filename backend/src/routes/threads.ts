import { Router } from 'express';
import * as threadService from '../services/thread.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const threads = await threadService.getAllThreads(
    req.organizationId!,
    req.query.processId as string | undefined,
  );
  res.json(threads);
});

router.get('/graph', async (req, res) => {
  const graph = await threadService.getCommGraph(
    req.organizationId!,
    req.query.processId as string | undefined,
  );
  res.json(graph);
});

router.get('/:id', async (req, res) => {
  const thread = await threadService.getThreadById(req.params.id, req.organizationId!);
  if (!thread) return res.status(404).json({ error: 'Thread not found' });
  res.json(thread);
});

export default router;
