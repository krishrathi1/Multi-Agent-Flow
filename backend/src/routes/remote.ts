import { Router } from 'express';
import * as remoteService from '../services/remote.service.js';
import { sendError } from '../lib/http-error.js';

const router = Router();

// POST /api/remote/heartbeat
router.post('/heartbeat', async (req, res) => {
  try {
    const result = await remoteService.remoteHeartbeat(req.organizationId!, req.body);
    // Emit to org room
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:heartbeat', result.agent);
    if (result.activity) {
      req.app.get('io')?.to(`org:${req.organizationId}`).emit('activity:new', result.activity);
    }
    res.json(result);
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/remote/activity
router.post('/activity', async (req, res) => {
  try {
    const activity = await remoteService.remoteActivity(req.organizationId!, req.body);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('activity:new', activity);
    res.json(activity);
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

// POST /api/remote/metrics
router.post('/metrics', async (req, res) => {
  try {
    const result = await remoteService.remoteMetrics(req.organizationId!, req.body);
    res.json(result);
  } catch (error: any) {
    sendError(res, error, 400);
  }
});

export default router;
