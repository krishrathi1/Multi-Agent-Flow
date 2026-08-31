import { Router } from 'express';
import * as commandService from '../services/command.service.js';
import type { ActivityType } from '@prisma/client';

const router = Router();

router.get('/', async (req, res) => {
  const { q, agentId, type, limit } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query "q" is required' });
  }

  const result = await commandService.searchActivities(req.organizationId!, q, {
    agentId: agentId as string | undefined,
    type: type as ActivityType | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
  });

  res.json(result);
});

export default router;
