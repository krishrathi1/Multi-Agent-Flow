import { Router } from 'express';
import * as webhookService from '../services/webhook.service.js';
import { requireBoardAccess } from '../middleware/resource-access.js';

const router = Router({ mergeParams: true });

// Payload bodies are whatever an external system posted in — often keys and
// customer data — and were reachable with only a webhook or payload id.
router.use('/:boardId', requireBoardAccess);

// All routes are under /api/boards/:boardId/webhooks
router.get('/:boardId/webhooks', async (req, res) => {
  const webhooks = await webhookService.listWebhooks(req.params.boardId, req.organizationId!);
  res.json(webhooks);
});

router.post('/:boardId/webhooks', async (req, res) => {
  const webhook = await webhookService.createWebhook(req.params.boardId, req.organizationId!, req.body);
  res.status(201).json(webhook);
});

router.patch('/:boardId/webhooks/:id', async (req, res) => {
  const webhook = await webhookService.updateWebhook(req.params.id, req.params.boardId, req.body);
  res.json(webhook);
});

router.delete('/:boardId/webhooks/:id', async (req, res) => {
  await webhookService.deleteWebhook(req.params.id, req.params.boardId);
  res.status(204).end();
});

router.get('/:boardId/webhooks/:id/payloads', async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;
  const payloads = await webhookService.listPayloads(req.params.id as string, req.params.boardId as string, { limit, offset });
  res.json(payloads);
});

router.get('/:boardId/webhooks/:id/payloads/:payloadId', async (req, res) => {
  const payload = await webhookService.getPayload(req.params.payloadId as string, req.params.boardId as string);
  if (!payload) return res.status(404).json({ error: 'Payload not found' });
  res.json(payload);
});

export default router;
