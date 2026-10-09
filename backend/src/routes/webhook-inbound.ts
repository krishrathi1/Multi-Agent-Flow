import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as webhookService from '../services/webhook.service.js';

const router = Router();

const inboundLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: 'Too many webhook requests. Please retry later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// PUBLIC endpoint — rate-limited and secret-authenticated
router.post('/:boardId/:webhookId', inboundLimiter, async (req, res) => {
  try {
    const payload = req.body;
    if (payload && JSON.stringify(payload).length > 500_000) {
      return res.status(413).json({ error: 'Payload exceeds maximum allowed size of 500KB' });
    }
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === 'string') headers[key] = value;
    }
    const sourceIp = (req.ip || req.socket.remoteAddress || '') as string;
    const rawContentType = req.headers['content-type'];
    const contentType = Array.isArray(rawContentType) ? (rawContentType[0] || '') : (rawContentType || '');

    const boardId = String(req.params.boardId);
    const webhookId = String(req.params.webhookId);

    const stored = await webhookService.handleInbound(
      boardId,
      webhookId,
      payload,
      headers,
      sourceIp,
      contentType
    );

    // Emit event scoped to organization room
    if (stored.organizationId) {
      req.app.get('io')?.to(`org:${stored.organizationId}`).emit('webhook:received', {
        boardId: req.params.boardId,
        webhookId: req.params.webhookId,
        payloadId: stored.id,
      });
    }

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
