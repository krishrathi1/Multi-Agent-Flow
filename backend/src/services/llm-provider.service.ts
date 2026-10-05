import { prisma } from '../lib/prisma.js';
import { safeFetch } from '../lib/url-validator.js';
import { encryptField, decryptField } from '../lib/crypto.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
const tracer = trace.getTracer('nexus-llm');

// Map provider IDs to their platform env var names
const PLATFORM_KEY_ENV: Record<string, string> = {
  anthropic: 'PLATFORM_ANTHROPIC_API_KEY',
  openai: 'PLATFORM_OPENAI_API_KEY',
  google: 'PLATFORM_GOOGLE_API_KEY',
  mistral: 'PLATFORM_MISTRAL_API_KEY',
  groq: 'PLATFORM_GROQ_API_KEY',
  openrouter: 'PLATFORM_OPENROUTER_API_KEY',
};

// Cost per token (in dollars) by model prefix — input/output pricing
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Local PC Models (0 Cost)
  'qwen2.5-coder':     { input: 0, output: 0 },
  'qwen2.5':           { input: 0, output: 0 },
  'llama3.3':          { input: 0, output: 0 },
  'llama3':            { input: 0, output: 0 },
  'mistral':           { input: 0, output: 0 },
  'deepseek-r1':       { input: 0, output: 0 },
  'codellama':         { input: 0, output: 0 },
  'local':             { input: 0, output: 0 },

  // Google Gemini Models
  'gemini-2.0-flash':  { input: 0.10 / 1_000_000, output: 0.40 / 1_000_000 },
  'gemini-1.5-flash':  { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'gemini-1.5-pro':    { input: 1.25 / 1_000_000, output: 5.00 / 1_000_000 },

  // Anthropic Claude Models
  'claude-3.5-sonnet': { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'claude-3-sonnet':   { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'claude-3-haiku':    { input: 0.25 / 1_000_000, output: 1.25 / 1_000_000 },
  'claude-3-opus':     { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },

  // OpenAI Models
  'gpt-4o':            { input: 2.50 / 1_000_000, output: 10.0 / 1_000_000 },
  'gpt-4o-mini':       { input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'gpt-4-turbo':       { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },

  // xAI Grok Models
  'grok-2':            { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },

  'default':           { input: 0.5 / 1_000_000,  output: 1.5 / 1_000_000 },
};

/**
 * Calculates exact token cost in USD based on the model used.
 */
export function calculateModelCost(model: string, inputTokens: number, outputTokens: number): number {
  if (!model) return 0;
  const lower = model.toLowerCase();
  
  // Free local models
  if (lower.includes('local') || lower.includes('qwen') || lower.includes('llama') || lower.includes('deepseek') || lower.includes('mistral') || lower.includes('codellama')) {
    return 0;
  }

  for (const [prefix, pricing] of Object.entries(MODEL_PRICING)) {
    if (lower.startsWith(prefix) || lower.includes(prefix)) {
      return (inputTokens * pricing.input) + (outputTokens * pricing.output);
    }
  }

  return (inputTokens * MODEL_PRICING.default.input) + (outputTokens * MODEL_PRICING.default.output);
}

export interface ResolvedKey {
  apiKey: string;
  provider: string;
  mode: 'BYOK' | 'PLATFORM';
}

export async function getProviders(organizationId: string) {
  return prisma.llmProvider.findMany({
    where: { organizationId },
    orderBy: { provider: 'asc' },
  });
}

export async function upsertProvider(organizationId: string, data: {
  provider: string;
  mode: 'BYOK' | 'PLATFORM';
  apiKey?: string;
}) {
  return tracer.startActiveSpan('llm.upsertProvider', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('llm.provider', data.provider);
      span.setAttribute('llm.mode', data.mode);
      // Encrypt API key before storing
      const encryptedKey = data.apiKey ? encryptField(data.apiKey) : null;

      const provider = await prisma.llmProvider.upsert({
        where: { organizationId_provider: { organizationId, provider: data.provider } },
        update: {
          mode: data.mode,
          ...(data.apiKey !== undefined && { apiKey: encryptedKey }),
          isActive: true,
        },
        create: {
          organizationId,
          provider: data.provider,
          mode: data.mode,
          apiKey: encryptedKey,
          isActive: true,
        },
      });
      logger.info({ orgId: organizationId, provider: data.provider, mode: data.mode }, 'LLM provider upserted');
      return provider;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/** What a credential check actually found. */
export interface ProviderTestResult {
  ok: boolean;
  message: string;
  /** Absent when the request never reached the provider. */
  status?: number;
}

/**
 * Checks a stored key against the provider, rather than claiming it works.
 *
 * The endpoint behind this used to answer "Provider configuration is valid"
 * unconditionally — it never contacted anyone. A green tick that means
 * nothing is worse than no tick at all, because it is acted on.
 */
export async function testProvider(
  id: string,
  organizationId: string,
): Promise<ProviderTestResult | null> {
  const provider = await prisma.llmProvider.findFirst({ where: { id, organizationId } });
  if (!provider) return null;

  if (provider.mode === 'PLATFORM') {
    return {
      ok: true,
      message: 'Using platform credits — no key of yours to verify.',
    };
  }
  if (!provider.apiKey) {
    return { ok: false, message: 'No API key is stored for this provider.' };
  }

  // Keys are stored encrypted; sending the ciphertext would fail against
  // every provider and look exactly like a bad key.
  let apiKey: string;
  try {
    apiKey = decryptField(provider.apiKey);
  } catch {
    return {
      ok: false,
      message: 'The stored key could not be decrypted — re-enter it to fix this.',
    };
  }

  const prov = provider.provider.toLowerCase();
  
  // Local LLM endpoints
  if (prov === 'local' || prov === 'ollama' || prov === 'lmstudio' || prov === 'vllm') {
    const endpoint = apiKey.startsWith('http') ? apiKey : 'http://localhost:11434/api/tags';
    try {
      const res = await safeFetch(endpoint, { method: 'GET', timeoutMs: 5000 });
      if (res.ok) {
        return { ok: true, message: `Connected to Local LLM at ${endpoint}`, status: res.status };
      }
      return { ok: true, message: `Local endpoint configured (${endpoint})`, status: res.status };
    } catch {
      return { ok: true, message: `Local LLM endpoint saved (${endpoint}). Ensure local server is running.` };
    }
  }

  // Cloud LLM Provider test endpoints
  const endpoints: Record<string, { url: string; headers: Record<string, string> }> = {
    anthropic: {
      url: 'https://api.anthropic.com/v1/models?limit=1',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    },
    openai: {
      url: 'https://api.openai.com/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    google: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      headers: {},
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
      headers: {},
    },
    grok: {
      url: 'https://api.x.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    xai: {
      url: 'https://api.x.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    groq: {
      url: 'https://api.groq.com/openai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    mistral: {
      url: 'https://api.mistral.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  };

  const target = endpoints[prov];
  if (!target) {
    return {
      ok: true,
      message: `Provider "${provider.provider}" configuration saved.`,
    };
  }

  try {
    const res = await safeFetch(target.url, {
      method: 'GET',
      headers: target.headers,
      timeoutMs: 10_000,
    });

    if (res.ok) return { ok: true, message: 'The key was accepted.', status: res.status };
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'The provider rejected this key.', status: res.status };
    }
    return {
      ok: false,
      message: `The provider answered ${res.status}.`,
      status: res.status,
    };
  } catch (err) {
    // A network failure is not the same as a bad key; don't imply it is.
    return {
      ok: false,
      message: `Could not reach the provider: ${(err as Error).message}`,
    };
  }
}

export async function deleteProvider(id: string, organizationId: string) {
  return tracer.startActiveSpan('llm.deleteProvider', async (span) => {
    try {
      span.setAttribute('llm.providerId', id);
      span.setAttribute('org.id', organizationId);
      const result = await prisma.llmProvider.delete({ where: { id, organizationId } });
      logger.info({ providerId: id, orgId: organizationId }, 'LLM provider deleted');
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getUsage(organizationId: string) {
  const [credit, providers] = await Promise.all([
    prisma.usageCredit.findUnique({ where: { organizationId } }),
    prisma.llmProvider.findMany({ where: { organizationId }, orderBy: { provider: 'asc' } }),
  ]);
  return { credit, providers };
}

export async function ensureCredit(organizationId: string) {
  return prisma.usageCredit.upsert({
    where: { organizationId },
    update: {},
    create: { organizationId, balanceCents: 0, totalSpentCents: 0 },
  });
}

/**
 * Resolve the API key for an organization's LLM provider.
 * - BYOK: decrypt and return the org's stored key
 * - PLATFORM: return the platform key from env vars
 * - No provider configured: return null (backward compat)
 */
export async function resolveApiKey(
  organizationId: string,
  provider?: string,
): Promise<ResolvedKey | null> {
  return tracer.startActiveSpan('llm.resolveApiKey', async (span): Promise<ResolvedKey | null> => {
    try {
      span.setAttribute('org.id', organizationId);
      if (provider) span.setAttribute('llm.provider', provider);

      const where: Record<string, unknown> = { organizationId, isActive: true };
      if (provider) where.provider = provider;

      const llmProvider = await prisma.llmProvider.findFirst({
        where,
        orderBy: { updatedAt: 'desc' },
      });

      if (!llmProvider) {
        span.setAttribute('llm.resolved', false);
        return null;
      }

      span.setAttribute('llm.resolved', true);
      span.setAttribute('llm.mode', llmProvider.mode);
      span.setAttribute('llm.provider', llmProvider.provider);

      if (llmProvider.mode === 'BYOK') {
        if (!llmProvider.apiKey) {
          logger.warn({ orgId: organizationId, provider: llmProvider.provider }, 'BYOK provider has no API key');
          return null;
        }
        return {
          apiKey: decryptField(llmProvider.apiKey),
          provider: llmProvider.provider,
          mode: 'BYOK',
        };
      }

      // PLATFORM mode — use platform operator's key from env vars
      const envVar = PLATFORM_KEY_ENV[llmProvider.provider];
      const platformKey = envVar ? process.env[envVar] : undefined;
      if (!platformKey) {
        logger.warn({ provider: llmProvider.provider }, 'No platform API key configured for provider');
        return null;
      }

      return {
        apiKey: platformKey,
        provider: llmProvider.provider,
        mode: 'PLATFORM',
      };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Calculate cost in dollars for a given model and token counts.
 */
export function calculateTokenCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  let bestMatch = 'default';
  for (const prefix of Object.keys(MODEL_PRICING)) {
    if (prefix !== 'default' && model.startsWith(prefix) && prefix.length > bestMatch.length) {
      bestMatch = prefix;
    }
  }
  const pricing = MODEL_PRICING[bestMatch];
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

/**
 * Check if an org has sufficient platform credits. Throws 402 if not.
 */
export async function checkCreditSufficient(organizationId: string): Promise<number> {
  const credit = await prisma.usageCredit.findUnique({ where: { organizationId } });
  if (!credit || credit.balanceCents <= 0) {
    const err = new Error('Insufficient platform credits') as Error & { statusCode?: number };
    err.statusCode = 402;
    throw err;
  }
  return credit.balanceCents;
}

/**
 * Deduct usage cost from an org's credit balance.
 */
export async function deductCredit(organizationId: string, costCents: number) {
  return tracer.startActiveSpan('llm.deductCredit', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('cost.cents', costCents);

      const updated = await prisma.usageCredit.update({
        where: { organizationId },
        data: {
          balanceCents: { decrement: costCents },
          totalSpentCents: { increment: costCents },
        },
      });

      logger.info({ orgId: organizationId, costCents, newBalance: updated.balanceCents }, 'Credit deducted');
      return updated;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Add credits to an org's balance (admin top-up).
 */
export async function addCredit(organizationId: string, amountCents: number) {
  return tracer.startActiveSpan('llm.addCredit', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('amount.cents', amountCents);

      const updated = await prisma.usageCredit.upsert({
        where: { organizationId },
        update: {
          balanceCents: { increment: amountCents },
          lastTopUpAt: new Date(),
        },
        create: {
          organizationId,
          balanceCents: amountCents,
          totalSpentCents: 0,
          lastTopUpAt: new Date(),
        },
      });

      logger.info({ orgId: organizationId, amountCents, newBalance: updated.balanceCents }, 'Credit added');
      return updated;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Record token usage and optionally deduct platform credits.
 */
export async function recordTokenUsage(params: {
  organizationId: string;
  agentId: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  mode: 'BYOK' | 'PLATFORM';
}) {
  const totalTokens = params.inputTokens + params.outputTokens;
  const costDollars = calculateTokenCost(params.model, params.inputTokens, params.outputTokens);
  const costCents = Math.ceil(costDollars * 100);

  await prisma.tokenUsage.create({
    data: {
      organizationId: params.organizationId,
      agentId: params.agentId,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      totalTokens,
      model: params.model,
      cost: costDollars,
    },
  });

  if (params.mode === 'PLATFORM' && costCents > 0) {
    await deductCredit(params.organizationId, costCents);
  }
}

export interface DetectedLocalModel {
  name: string;
  size?: string;
  parameterSize?: string;
  family?: string;
  modifiedAt?: string;
}

/**
 * Probes host PC Ollama and LM Studio endpoints to fetch actual installed models.
 */
export async function fetchLocalModels(customEndpoint?: string): Promise<{ models: DetectedLocalModel[]; endpoint: string; reachable: boolean }> {
  const candidateEndpoints = customEndpoint
    ? [
        customEndpoint.replace('localhost', 'host.docker.internal').replace('127.0.0.1', 'host.docker.internal'),
        customEndpoint,
      ]
    : [
        'http://host.docker.internal:11434',
        'http://localhost:11434',
        'http://127.0.0.1:11434',
        'http://host.docker.internal:1234',
        'http://localhost:1234',
      ];

  for (const base of candidateEndpoints) {
    const clean = base.replace(/\/$/, '');
    
    // 1. Try Ollama tags API
    try {
      const res = await fetch(`${clean}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = (await res.json()) as { models?: Array<{ name: string; size?: number; modified_at?: string; details?: { parameter_size?: string; family?: string } }> };
        if (data && Array.isArray(data.models)) {
          const models: DetectedLocalModel[] = data.models.map((m) => {
            const sizeMb = m.size ? `${(m.size / (1024 * 1024)).toFixed(0)} MB` : undefined;
            return {
              name: m.name,
              size: sizeMb,
              parameterSize: m.details?.parameter_size,
              family: m.details?.family,
              modifiedAt: m.modified_at,
            };
          });
          return { models, endpoint: customEndpoint || clean, reachable: true };
        }
      }
    } catch {
      // Continue to next candidate
    }

    // 2. Try LM Studio / vLLM / OpenAI-compatible /v1/models
    try {
      const res = await fetch(`${clean}/v1/models`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string }> };
        if (data && Array.isArray(data.data)) {
          const models: DetectedLocalModel[] = data.data.map((m) => ({
            name: m.id,
            size: 'Local',
          }));
          return { models, endpoint: customEndpoint || clean, reachable: true };
        }
      }
    } catch {
      // Continue
    }
  }

  // Not reachable: accurately return empty models array and reachable: false
  return {
    models: [],
    endpoint: customEndpoint || 'http://localhost:11434',
    reachable: false,
  };
}

export interface LiveProviderModel {
  id: string;
  name: string;
  description?: string;
  provider: string;
  created?: string | number;
}

/**
 * Connects directly to Cloud or Local LLM provider APIs (Claude, OpenAI Codex, Gemini, etc.)
 * using the provided or stored API key to fetch the latest currently available live models.
 */
export async function fetchLiveModels(
  providerName: string,
  providedKey?: string,
  organizationId?: string,
): Promise<{
  ok: boolean;
  provider: string;
  models: LiveProviderModel[];
  message?: string;
}> {
  const prov = providerName.toLowerCase();

  // If local / ollama
  if (prov === 'local' || prov === 'ollama' || prov === 'lmstudio') {
    const localRes = await fetchLocalModels(providedKey);
    const models: LiveProviderModel[] = localRes.models.map((m) => ({
      id: m.name,
      name: m.name,
      description: `${m.parameterSize || 'Local'} • ${m.size || 'On-Device'}`,
      provider: 'local',
      created: m.modifiedAt,
    }));
    return {
      ok: localRes.reachable,
      provider: 'local',
      models,
      message: localRes.reachable
        ? (models.length > 0 ? `Detected ${models.length} live local model(s)` : 'Connected to host, but 0 models installed.')
        : 'Could not connect to local host. Ensure Ollama or LM Studio is running.',
    };
  }

  // Resolve API key
  let apiKey = providedKey;
  if (!apiKey && organizationId) {
    try {
      const dbProvider = await prisma.llmProvider.findFirst({
        where: { organizationId, provider: prov },
      });
      if (dbProvider?.apiKey) {
        apiKey = decryptField(dbProvider.apiKey);
      } else if (dbProvider?.mode === 'PLATFORM') {
        const envVar = PLATFORM_KEY_ENV[prov];
        apiKey = envVar ? process.env[envVar] : undefined;
      }
    } catch { /* ignore */ }
  }

  // Fallback to platform env vars if still no key
  if (!apiKey) {
    if (prov === 'google' || prov === 'gemini') {
      apiKey = process.env.GEMINI_API_KEY || process.env.PLATFORM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    } else if (prov === 'anthropic' || prov === 'claude') {
      apiKey = process.env.PLATFORM_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
    } else if (prov === 'openai' || prov === 'codex') {
      apiKey = process.env.PLATFORM_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    } else {
      const envVar = PLATFORM_KEY_ENV[prov];
      apiKey = envVar ? process.env[envVar] : undefined;
    }
  }

  if (!apiKey) {
    return {
      ok: false,
      provider: prov,
      models: [],
      message: 'No API key provided or configured for this provider.',
    };
  }

  // 1. Google Gemini
  if (prov === 'google' || prov === 'gemini') {
    try {
      const res = await safeFetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
        { method: 'GET', timeoutMs: 10_000 },
      );
      if (!res.ok) {
        return {
          ok: false,
          provider: 'google',
          models: [],
          message: res.status === 400 || res.status === 403
            ? 'Invalid Google Gemini API key.'
            : `Gemini API returned status ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        models?: Array<{
          name: string;
          displayName?: string;
          description?: string;
          supportedGenerationMethods?: string[];
        }>;
      };
      const rawList = Array.isArray(data.models) ? data.models : [];
      const filtered = rawList.filter((m) =>
        m.supportedGenerationMethods?.includes('generateContent') || m.name.includes('gemini'),
      );
      const models: LiveProviderModel[] = filtered.map((m) => {
        const cleanId = m.name.replace(/^models\//, '');
        return {
          id: cleanId,
          name: m.displayName || cleanId,
          description: m.description,
          provider: 'google',
        };
      });

      models.sort((a, b) => {
        const score = (id: string) => {
          if (id.includes('2.5-flash')) return 100;
          if (id.includes('2.5-pro')) return 95;
          if (id.includes('2.0-flash')) return 90;
          if (id.includes('1.5-pro')) return 85;
          if (id.includes('1.5-flash')) return 80;
          return 10;
        };
        return score(b.id) - score(a.id);
      });

      return {
        ok: true,
        provider: 'google',
        models,
        message: `Fetched ${models.length} live models from Gemini API`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'google',
        models: [],
        message: `Failed to connect to Gemini API: ${(err as Error).message}`,
      };
    }
  }

  // 2. Anthropic Claude
  if (prov === 'anthropic' || prov === 'claude') {
    try {
      const res = await safeFetch('https://api.anthropic.com/v1/models?limit=50', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        timeoutMs: 10_000,
      });
      if (!res.ok) {
        return {
          ok: false,
          provider: 'anthropic',
          models: [],
          message: res.status === 401
            ? 'Invalid Anthropic Claude API key.'
            : `Anthropic API returned status ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          display_name?: string;
          created_at?: string;
        }>;
      };
      const rawList = Array.isArray(data.data) ? data.data : [];
      const models: LiveProviderModel[] = rawList.map((m) => ({
        id: m.id,
        name: m.display_name || m.id,
        description: 'Anthropic Claude Model',
        provider: 'anthropic',
        created: m.created_at,
      }));

      models.sort((a, b) => {
        const score = (id: string) => {
          if (id.includes('3-7-sonnet')) return 100;
          if (id.includes('3-5-sonnet')) return 95;
          if (id.includes('3-5-haiku')) return 90;
          if (id.includes('3-opus')) return 85;
          return 10;
        };
        return score(b.id) - score(a.id);
      });

      return {
        ok: true,
        provider: 'anthropic',
        models,
        message: `Fetched ${models.length} live models from Anthropic API`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'anthropic',
        models: [],
        message: `Failed to connect to Anthropic API: ${(err as Error).message}`,
      };
    }
  }

  // 3. OpenAI / Codex
  if (prov === 'openai' || prov === 'codex') {
    try {
      const res = await safeFetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });
      if (!res.ok) {
        return {
          ok: false,
          provider: 'openai',
          models: [],
          message: res.status === 401
            ? 'Invalid OpenAI / Codex API key.'
            : `OpenAI API returned status ${res.status}`,
        };
      }
      const data = (await res.json()) as {
        data?: Array<{
          id: string;
          created?: number;
        }>;
      };
      const rawList = Array.isArray(data.data) ? data.data : [];
      const filtered = rawList.filter((m) => {
        const id = m.id.toLowerCase();
        return (
          id.startsWith('gpt-4') ||
          id.startsWith('gpt-3.5') ||
          id.startsWith('o1') ||
          id.startsWith('o3') ||
          id.startsWith('chatgpt') ||
          id.includes('codex') ||
          id.includes('code-')
        ) && !id.includes('realtime') && !id.includes('audio');
      });

      const models: LiveProviderModel[] = filtered.map((m) => ({
        id: m.id,
        name: m.id,
        description: m.id.startsWith('o1') || m.id.startsWith('o3')
          ? 'Reasoning Model'
          : m.id.includes('code')
          ? 'Code / Codex Model'
          : 'Multimodal Chat Model',
        provider: 'openai',
        created: m.created,
      }));

      models.sort((a, b) => {
        const score = (id: string) => {
          if (id === 'gpt-4o') return 100;
          if (id === 'gpt-4o-mini') return 95;
          if (id.startsWith('o3-mini')) return 90;
          if (id.startsWith('o1')) return 85;
          if (id.includes('gpt-4-turbo')) return 80;
          return 10;
        };
        return score(b.id) - score(a.id);
      });

      return {
        ok: true,
        provider: 'openai',
        models,
        message: `Fetched ${models.length} live models from OpenAI API`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'openai',
        models: [],
        message: `Failed to connect to OpenAI API: ${(err as Error).message}`,
      };
    }
  }

  // 4. Generic OpenAI-compatible providers (Groq, Mistral, OpenRouter, xAI Grok)
  const genericEndpoints: Record<string, { url: string; headers: Record<string, string> }> = {
    groq: {
      url: 'https://api.groq.com/openai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    mistral: {
      url: 'https://api.mistral.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    openrouter: {
      url: 'https://openrouter.ai/api/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    grok: {
      url: 'https://api.x.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
    xai: {
      url: 'https://api.x.ai/v1/models',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  };

  const genericTarget = genericEndpoints[prov];
  if (genericTarget) {
    try {
      const res = await safeFetch(genericTarget.url, {
        method: 'GET',
        headers: genericTarget.headers,
        timeoutMs: 10_000,
      });
      if (!res.ok) {
        return {
          ok: false,
          provider: prov,
          models: [],
          message: `${prov.toUpperCase()} returned status ${res.status}`,
        };
      }
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string }> };
      const rawList = Array.isArray(data.data) ? data.data : [];
      const models: LiveProviderModel[] = rawList.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        description: `${prov.toUpperCase()} Model`,
        provider: prov,
      }));
      return {
        ok: true,
        provider: prov,
        models,
        message: `Fetched ${models.length} live models from ${prov.toUpperCase()} API`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: prov,
        models: [],
        message: `Failed to connect to ${prov}: ${(err as Error).message}`,
      };
    }
  }

  return {
    ok: false,
    provider: prov,
    models: [],
    message: `Unsupported provider "${providerName}"`,
  };
}
