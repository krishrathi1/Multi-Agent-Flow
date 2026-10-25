import { Router } from 'express';
import * as commandService from '../services/command.service.js';

const router = Router();

router.get('/:id/config', async (req, res) => {
  const agent = await commandService.getAgentConfig(req.params.id, req.organizationId!);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

router.patch('/:id/config', async (req, res) => {
  const { soulMd, enabled, heartbeatInterval } = req.body as {
    soulMd?: string;
    enabled?: boolean;
    heartbeatInterval?: number;
  };
  const agent = await commandService.updateAgentConfig(req.params.id, req.organizationId!, {
    soulMd,
    enabled,
    heartbeatInterval,
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:config', agent);
  res.json(agent);
});

export default router;
