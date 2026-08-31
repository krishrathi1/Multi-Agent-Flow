import { Router } from 'express';
import * as webhookService from '../services/webhook.service.js';

const router = Router();

// PUBLIC endpoint — no auth required
router.post('/:boardId/:webhookId', async (req, res) => {
  try {
    const payload = req.body;
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }
    const sourceIp = (req.ip || req.socket.remoteAddress || '') as string;
    const contentType = req.headers['content-type'] || '';

    const stored = await webhookService.handleInbound(
      req.params.boardId,
      req.params.webhookId,
      payload,
      headers,
      sourceIp,
      contentType
    );

    // Emit event if io is available
    req.app.get('io')?.emit('webhook:received', {
      boardId: req.params.boardId,
      webhookId: req.params.webhookId,
      payloadId: stored.id,
    });

    res.json({ received: true, id: stored.id });
  } catch (err) {
    const message = (err as Error).message;
    if (message.includes('Invalid webhook secret')) {
      return res.status(401).json({ error: 'Invalid webhook secret' });
    }
    if (message.includes('not found') || message.includes('disabled')) {
      return res.status(404).json({ error: 'Webhook not found' });
    }
    res.status(500).json({ error: 'Internal error' });
  }
});

export default router;
