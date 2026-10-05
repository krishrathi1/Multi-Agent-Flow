import { Router } from 'express';
import * as llmService from '../services/llm-provider.service.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req, res) => {
  const providers = await llmService.getProviders(req.organizationId!);
  res.json(providers);
});

router.get('/local-models', async (req, res) => {
  const endpoint = typeof req.query.endpoint === 'string' ? req.query.endpoint : undefined;
  const result = await llmService.fetchLocalModels(endpoint);
  res.json(result);
});

router.post('/live-models', async (req, res) => {
  const { provider, apiKey } = req.body;
  if (!provider) {
    return res.status(400).json({ error: 'provider is required' });
  }
  const result = await llmService.fetchLiveModels(provider, apiKey, req.organizationId);
  res.json(result);
});

router.get('/live-models/:provider', async (req, res) => {
  const { provider } = req.params;
  const result = await llmService.fetchLiveModels(provider, undefined, req.organizationId);
  res.json(result);
});

router.post('/', async (req, res) => {
  const { provider, mode, apiKey } = req.body;
  if (!provider || !mode) {
    return res.status(400).json({ error: 'provider and mode are required' });
  }
  const result = await llmService.upsertProvider(req.organizationId!, { provider, mode, apiKey });
  // Strip apiKey from response
  const { apiKey: _key, ...safe } = result as any;
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('llm:updated', safe);
  res.json(safe);
});

router.delete('/:id', async (req, res) => {
  await llmService.deleteProvider(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('llm:deleted', { id: req.params.id });
  res.status(204).end();
});

router.post('/:id/test', async (req, res) => {
  // This used to answer "valid" without contacting anyone. A green tick that
  // means nothing is worse than none, because people act on it.
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const result = await llmService.testProvider(id, req.organizationId!);
  if (!result) return res.status(404).json({ error: 'Provider not found' });
  res.json({ success: result.ok, message: result.message, status: result.status });
});

router.get('/usage', async (req, res) => {
  const usage = await llmService.getUsage(req.organizationId!);
  // Strip apiKeys
  const providers = usage.providers.map(({ apiKey, ...rest }: any) => rest);
  res.json({ credit: usage.credit, providers });
});

// ─── Admin Credit Management ────────────────────────────
router.post('/credits', requireRole('OWNER', 'ADMIN'), async (req, res) => {
  const { amountCents } = req.body;
  if (!amountCents || typeof amountCents !== 'number' || amountCents <= 0) {
    return res.status(400).json({ error: 'amountCents must be a positive number' });
  }
  const credit = await llmService.addCredit(req.organizationId!, amountCents);
  res.json(credit);
});

export default router;
