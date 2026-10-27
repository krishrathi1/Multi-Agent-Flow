import { Router } from 'express';
import * as commandService from '../services/command.service.js';

const router = Router();

router.post('/', async (req, res) => {
  const { agentId, type, payload, issuedBy } = req.body as {
    agentId: string;
    type: string;
    payload?: Record<string, unknown>;
    issuedBy?: string;
  };
  if (typeof agentId !== 'string' || typeof type !== 'string' || !type.trim() || type.length > 50) {
    return res.status(400).json({ error: 'agentId and type are required' });
  }
  const command = await commandService.sendCommand(req.organizationId!, { agentId, type, payload, issuedBy });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('command:sent', command);
  res.status(201).json(command);
});

router.get('/', async (req, res) => {
  const { agentId } = req.query;
  const commands = await commandService.getCommands(req.organizationId!, agentId as string | undefined);
  res.json(commands);
});

export default router;
