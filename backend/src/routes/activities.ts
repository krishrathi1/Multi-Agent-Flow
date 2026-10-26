import { Router } from 'express';
import * as activityService from '../services/activity.service.js';
import { ActivityType } from '@prisma/client';
import { intParam, strParam } from '../lib/query.js';

const router = Router();

const ACTIVITY_TYPES = new Set<string>(Object.values(ActivityType));

router.get('/', async (req, res) => {
  const type = strParam(req.query.type);
  const since = strParam(req.query.since);
  const sinceDate = since ? new Date(since) : undefined;
  // parseInt('abc') used to reach Prisma as NaN and come back as a 500.
  if (sinceDate && Number.isNaN(sinceDate.getTime())) return res.status(400).json({ error: 'since must be a date' });
  if (type && !ACTIVITY_TYPES.has(type)) return res.status(400).json({ error: 'Unknown activity type' });

  const result = await activityService.getActivities(req.organizationId!, {
    agentId: strParam(req.query.agentId),
    type: type as ActivityType | undefined,
    processId: strParam(req.query.processId),
    limit: intParam(req.query.limit, { max: 500 }),
    offset: intParam(req.query.offset, { min: 0, max: 1_000_000 }),
    since: sinceDate,
  });
  res.json(result);
});

export default router;
