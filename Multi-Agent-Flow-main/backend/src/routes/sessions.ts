import { Router } from 'express';
import * as sessionService from '../services/session.service.js';

const router = Router();

// GET / — list sessions (query params: agentId, limit)
router.get('/', async (req, res) => {
  const agentId = req.query.agentId as string | undefined;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const sessions = await sessionService.getSessions(req.organizationId!, { agentId, limit });
  res.json(sessions);
});

// GET /timeline — timeline data grouped by agent
router.get('/timeline', async (req, res) => {
  const data = await sessionService.getTimelineData(req.organizationId!, {
    processId: req.query.processId as string | undefined,
    hours: req.query.hours ? parseInt(req.query.hours as string, 10) : undefined,
  });
  res.json(data);
});

export default router;
