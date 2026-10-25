import { Router } from 'express';
import * as activityService from '../services/activity.service.js';
import type { ActivityType } from '@prisma/client';

const router = Router();

router.get('/', async (req, res) => {
  const { agentId, type, processId, limit, offset, since } = req.query;
  const result = await activityService.getActivities(req.organizationId!, {
    agentId: agentId as string | undefined,
    type: type as ActivityType | undefined,
    processId: processId as string | undefined,
    limit: limit ? parseInt(limit as string) : undefined,
    offset: offset ? parseInt(offset as string) : undefined,
    since: since ? new Date(since as string) : undefined,
  });
  res.json(result);
});

export default router;
