import { Router } from 'express';
import * as llmService from '../services/llm-provider.service.js';
import { requireRole } from '../middleware/auth.js';
import { config } from '../config.js';
import * as opencode from '../services/opencode.service.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.get('/', async (req, res) => {
  const providers = await llmService.getProviders(req.organizationId!);
  res.json(providers);
});


router.get('/available-models', async (req, res) => {
  const models = new Map<string, { id: string; name: string; provider: string; source: string }>();
  const templateCategories = new Set(['code-review', 'code-completion', 'code-explanation', 'refactoring']);

  // Fetch BYOK providers configured in the DB for this organization
  const orgProviders = req.organizationId
    ? await prisma.llmProvider.findMany({ where: { organizationId: req.organizationId, isActive: true } })
    : [];
  const configuredDbProviders = new Set(
    orgProviders
      .filter((p: { mode: string; apiKey: string | null }) => p.mode === 'PLATFORM' || Boolean(p.apiKey))
      .map((p: { provider: string }) => p.provider.toLowerCase())
  );

  const hasPlatformKey = (p: string) => {
    const pLower = p.toLowerCase();
    if (pLower === 'google' || pLower === 'gemini') {
      return Boolean(process.env.PLATFORM_GOOGLE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim());
    }
    if (pLower === 'openai') return Boolean(process.env.PLATFORM_OPENAI_API_KEY?.trim());
    if (pLower === 'anthropic') return Boolean(process.env.PLATFORM_ANTHROPIC_API_KEY?.trim());
    if (pLower === 'mistral') return Boolean(process.env.PLATFORM_MISTRAL_API_KEY?.trim());
    if (pLower === 'groq') return Boolean(process.env.PLATFORM_GROQ_API_KEY?.trim());
    if (pLower === 'openrouter') return Boolean(process.env.PLATFORM_OPENROUTER_API_KEY?.trim());
    return false;
  };

  for (const [provider, ids] of Object.entries(config.promptModels)) {
    if (templateCategories.has(provider)) continue;
    const pLower = provider.toLowerCase();
    if (!configuredDbProviders.has(pLower) && !hasPlatformKey(pLower)) {
      continue;
    }
    for (const id of ids) {
      const modelId = `${provider}/${id}`;
      models.set(modelId, { id: modelId, name: id, provider, source: 'nexus-config' });
    }
  }

  // OpenCode models
  const open = await opencode.models();
  if (open.installed && Array.isArray(open.models)) {
    for (const m of open.models) {
      models.set(m.id, { id: m.id, name: m.name, provider: m.provider, source: 'opencode' });
    }
  }

  // Local models (only if explicitly enabled in org settings)
  const localId = process.env.LOCAL_LLM_MODEL?.trim();
  if (localId && (configuredDbProviders.has('local') || configuredDbProviders.has('ollama'))) {
    models.set(`local/${localId}`, { id: `local/${localId}`, name: localId, provider: 'local', source: 'nexus-config' });
  }

  res.json({ models: Array.from(models.values()) });
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
