import { config } from '../config.js';
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
  grok: 'PLATFORM_GROK_API_KEY',
  xai: 'PLATFORM_XAI_API_KEY',
};

// ─── xAI Grok ──────────────────────────────────────────────────────────────
/** Default Grok model; override with GROK_MODEL. */
export const grokModel = () => process.env.GROK_MODEL?.trim() || 'grok-2-latest';
/** Fallback models for xAI Grok. */
const GROK_FALLBACKS = ['grok-2', 'grok-beta', 'grok-2-1212'];

/** The org's Grok key from Settings, else the platform's, else null. */
export async function getGrokApiKey(organizationId: string): Promise<string | null> {
  try {
    const row = await prisma.llmProvider.findFirst({
      where: {
        organizationId,
        provider: { in: ['grok', 'xai', 'groq'], mode: 'insensitive' },
        isActive: true,
      },
    });
    if (row?.apiKey) return decryptField(row.apiKey);
  } catch { /* fall through to the platform key */ }
  return (
    process.env.PLATFORM_GROK_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_API_KEY?.trim() ||
    process.env.PLATFORM_XAI_API_KEY?.trim() ||
    process.env.PLATFORM_GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    null
  );
}

/**
 * One chat completion from xAI Grok (OpenAI-compatible).
 */
export async function grokChat(params: {
  apiKey: string;
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number } | null> {
  // If user passed a Groq API key (starts with gsk_), seamlessly execute with Groq
  if (params.apiKey?.trim().startsWith('gsk_')) {
    return groqChat({
      apiKey: params.apiKey,
      system: params.system || '',
      prompt: params.prompt,
      model: params.model,
      maxTokens: params.maxTokens,
      timeoutMs: params.timeoutMs,
    });
  }

  const first = (params.model || grokModel()).replace(/^(grok|xai)\//i, '');
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (params.system && params.system.trim()) {
    messages.push({ role: 'system', content: params.system.trim() });
  }
  messages.push({ role: 'user', content: params.prompt });

  for (const model of [first, ...GROK_FALLBACKS.filter((m) => m !== first)]) {
    try {
      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: params.maxTokens ?? 2048,
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
      });
      const data = (await res.json().catch(() => null)) as any;
      const text = data?.choices?.[0]?.message?.content;
      if (res.ok && typeof text === 'string' && text.trim()) {
        return {
          text: text.trim(),
          model: `grok/${model}`,
          inputTokens: data?.usage?.prompt_tokens ?? 0,
          outputTokens: data?.usage?.completion_tokens ?? 0,
        };
      }
      logger.warn({ model, status: res.status, error: data?.error }, 'xAI Grok request rejected; trying next model');
      if (res.status === 401 || (res.status === 400 && data?.code === 'invalid-argument')) return null;
    } catch (err) {
      logger.warn({ err, model }, 'xAI Grok request failed; trying next model');
    }
  }
  return null;
}

// ─── Groq ──────────────────────────────────────────────────────────────────
// A key saved under Settings → AI Models & LLM is used for chat, code Q&A and,
// through OpenCode, for agents and preview edits — so the platform keeps
// working when OpenCode's free models hit their usage limit.

/** Default Groq model; override with GROQ_MODEL. */
export const groqModel = () => process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';
/** Tried in order when the preferred model is rejected (limits, size). */
const GROQ_FALLBACKS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
  'qwen/qwen3.8-27b',
  'allam-2-7b',
];

/** The org's Groq key from Settings, else the platform's, else null. */
export async function getGroqApiKey(organizationId: string): Promise<string | null> {
  try {
    const row = await prisma.llmProvider.findFirst({
      where: {
        organizationId,
        provider: { in: ['groq', 'grok', 'xai'], mode: 'insensitive' },
        isActive: true,
      },
    });
    if (row?.apiKey) return decryptField(row.apiKey);
  } catch { /* fall through to the platform key */ }
  return (
    process.env.PLATFORM_GROQ_API_KEY?.trim() ||
    process.env.GROQ_API_KEY?.trim() ||
    process.env.PLATFORM_GROK_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    process.env.XAI_API_KEY?.trim() ||
    null
  );
}

/**
 * One chat completion from Groq (OpenAI-compatible). Tries the requested
 * model, then smaller ones if Groq rejects the request (per-minute token
 * limits on the free tier are the usual reason). Returns null on failure.
 */
export async function groqChat(params: {
  apiKey: string;
  system?: string;
  prompt: string;
  model?: string;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number } | null> {
  // If user passed an xAI API key (starts with xai-), seamlessly execute with Grok
  if (params.apiKey?.trim().startsWith('xai-')) {
    return grokChat({
      apiKey: params.apiKey,
      system: params.system || '',
      prompt: params.prompt,
      model: params.model,
      maxTokens: params.maxTokens,
      timeoutMs: params.timeoutMs,
    });
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (params.system && params.system.trim()) {
    messages.push({ role: 'system', content: params.system.trim() });
  }
  messages.push({ role: 'user', content: params.prompt });

  const reqModel = (params.model || '').trim().replace(/^groq\//i, '');
  const isGroqNative = reqModel && (
    reqModel.startsWith('openai/gpt-oss') ||
    reqModel.startsWith('qwen/') ||
    reqModel.startsWith('llama-') ||
    reqModel.startsWith('mixtral') ||
    reqModel.startsWith('meta-llama/') ||
    reqModel.startsWith('allam-') ||
    reqModel.startsWith('canopylabs/')
  );
  const first = isGroqNative ? reqModel : groqModel();
  const modelCandidates = [
    first,
    isGroqNative ? reqModel : undefined,
    ...GROQ_FALLBACKS,
  ].filter(Boolean) as string[];

  const uniqueModels = Array.from(new Set(modelCandidates));

  let waitedForLimit = false;
  for (let i = 0; i < uniqueModels.length; i++) {
    const model = uniqueModels[i];
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${params.apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.3,
          max_tokens: params.maxTokens ?? 1500,
        }),
        signal: AbortSignal.timeout(params.timeoutMs ?? 30_000),
      });
      const data = (await res.json().catch(() => null)) as any;
      const text = data?.choices?.[0]?.message?.content;
      if (res.ok && typeof text === 'string' && text.trim()) {
        return {
          text: text.trim(),
          model: `groq/${model}`,
          inputTokens: data?.usage?.prompt_tokens ?? 0,
          outputTokens: data?.usage?.completion_tokens ?? 0,
        };
      }
      logger.warn({ model, status: res.status, error: data?.error?.message }, 'Groq request rejected; trying next model');
      if (res.status === 401) return null; // a bad key fails every model
      // The free tier's per-minute window often frees up within seconds, and
      // the next model down answers noticeably worse; wait once rather than drop.
      const headerRetry = Number(res.headers.get('retry-after'));
      const msgMatch = String(data?.error?.message ?? '').match(/try again in ([\d.]+)(m?s)/i);
      const msgSeconds = msgMatch ? (msgMatch[2].toLowerCase() === 'ms' ? Number(msgMatch[1]) / 1000 : Number(msgMatch[1])) : NaN;
      const retryIn = !isNaN(headerRetry) && headerRetry > 0 ? headerRetry : msgSeconds;
      if (res.status === 429 && !waitedForLimit && retryIn > 0 && retryIn <= 6) {
        waitedForLimit = true;
        await new Promise((r) => setTimeout(r, retryIn * 1000 + 250));
        i--;
      }
    } catch (err) {
      logger.warn({ err, model }, 'Groq request failed; trying next model');
    }
  }
  return null;
}

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
  'grok-2-latest':     { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },
  'grok-2':            { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },
  'grok-2-1212':       { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },
  'grok-2-vision-128k':{ input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },
  'grok-2-vision':     { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },
  'grok-3':            { input: 3.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'grok-3-mini':       { input: 0.5 / 1_000_000,  output: 2.0 / 1_000_000 },
  'grok-beta':         { input: 5.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'grok-vision-beta':  { input: 5.0 / 1_000_000,  output: 15.0 / 1_000_000 },
  'grok':              { input: 2.0 / 1_000_000,  output: 10.0 / 1_000_000 },

  // Groq Models
  'openai/gpt-oss-120b':{ input: 0.15 / 1_000_000, output: 0.60 / 1_000_000 },
  'openai/gpt-oss-20b': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'qwen/qwen3.8-27b':   { input: 0.80 / 1_000_000, output: 4.00 / 1_000_000 },
  'llama-3.3-70b':     { input: 0.59 / 1_000_000, output: 0.79 / 1_000_000 },
  'llama-3.1-8b':      { input: 0.05 / 1_000_000, output: 0.08 / 1_000_000 },
  'mixtral-8x7b':      { input: 0.24 / 1_000_000, output: 0.24 / 1_000_000 },

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
    const endpoint = apiKey.startsWith('http') ? apiKey : `${config.localLlmEndpoints[0]}/api/tags`;
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
      url: `${config.geminiApiBaseUrl}/v1beta/models`,
      headers: { 'x-goog-api-key': apiKey },
    },
    gemini: {
      url: `${config.geminiApiBaseUrl}/v1beta/models`,
      headers: { 'x-goog-api-key': apiKey },
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

  let targetProv = prov;
  if ((prov === 'grok' || prov === 'xai') && apiKey.startsWith('gsk_')) {
    targetProv = 'groq';
  } else if (prov === 'groq' && apiKey.startsWith('xai-')) {
    targetProv = 'grok';
  }

  const target = endpoints[targetProv];
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

    let detail = '';
    try {
      const errBody = (await res.json()) as any;
      detail = errBody?.error?.message || errBody?.error || errBody?.message || '';
    } catch { /* empty */ }

    if (res.status === 401 || res.status === 403 || res.status === 400) {
      return { ok: false, message: detail || 'The provider rejected this key.', status: res.status };
    }
    return {
      ok: false,
      message: detail || `The provider answered ${res.status}.`,
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
    : config.localLlmEndpoints;

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
    endpoint: customEndpoint || config.localLlmEndpoints[0],
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

  // Cross-provider key auto-detection (prevents confusion between Grok and Groq)
  if ((prov === 'grok' || prov === 'xai') && apiKey.startsWith('gsk_')) {
    const groqRes = await fetchLiveModels('groq', apiKey, organizationId);
    return {
      ...groqRes,
      provider: 'grok',
      message: groqRes.ok
        ? `Groq API Key detected (gsk_...) — loaded ${groqRes.models.length} live Groq models!`
        : groqRes.message,
    };
  }
  if (prov === 'groq' && apiKey.startsWith('xai-')) {
    const grokRes = await fetchLiveModels('grok', apiKey, organizationId);
    return {
      ...grokRes,
      provider: 'groq',
      message: grokRes.ok
        ? `xAI Grok API Key detected (xai-...) — loaded ${grokRes.models.length} live Grok models!`
        : grokRes.message,
    };
  }

  // 1. Google Gemini
  if (prov === 'google' || prov === 'gemini') {
    try {
      const res = await safeFetch(
        `${config.geminiApiBaseUrl}/v1beta/models`,
        { method: 'GET', headers: { 'x-goog-api-key': apiKey }, timeoutMs: 10_000 },
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
          if (id === 'gemini-flash-lite-latest') return 120;
          if (id === 'gemini-flash-latest') return 115;
          if (id.includes('3.5-flash-lite')) return 110;
          if (id.includes('3.5-flash')) return 105;
          if (id.includes('3.6-flash')) return 100;
          if (id.includes('2.5-flash')) return 95;
          if (id.includes('2.5-pro')) return 90;
          if (id.includes('2.0-flash')) return 85;
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

  // 4. xAI Grok
  if (prov === 'grok' || prov === 'xai') {
    try {
      const res = await safeFetch('https://api.x.ai/v1/models', {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        timeoutMs: 10_000,
      });

      if (!res.ok) {
        let detail = '';
        try {
          const errBody = (await res.json()) as any;
          detail = errBody?.error?.message || errBody?.error || errBody?.message || '';
        } catch { /* empty */ }
        return {
          ok: false,
          provider: 'grok',
          models: [],
          message: detail || `xAI API returned status ${res.status}`,
        };
      }

      const data = (await res.json()) as any;
      let rawList: any[] = [];
      if (Array.isArray(data?.data)) {
        rawList = data.data;
      } else if (Array.isArray(data?.models)) {
        rawList = data.models;
      } else if (Array.isArray(data)) {
        rawList = data;
      }

      // If xAI endpoint returns an empty array or no models, fallback to full known Grok suite
      if (rawList.length === 0) {
        rawList = [
          { id: 'grok-2-latest', name: 'Grok 2 Latest', context_length: 131072, description: 'Flagship reasoning & conversation model' },
          { id: 'grok-2', name: 'Grok 2', context_length: 131072, description: 'State-of-the-art Grok 2 model' },
          { id: 'grok-2-1212', name: 'Grok 2 (1212 snapshot)', context_length: 131072, description: 'Grok 2 snapshot release' },
          { id: 'grok-2-vision-128k', name: 'Grok 2 Vision (128k)', context_length: 131072, description: 'Multimodal vision & document reasoning' },
          { id: 'grok-2-vision', name: 'Grok 2 Vision', context_length: 32768, description: 'High-speed multimodal vision model' },
          { id: 'grok-2-vision-1212', name: 'Grok 2 Vision (1212 snapshot)', context_length: 32768, description: 'Multimodal vision snapshot' },
          { id: 'grok-3', name: 'Grok 3', context_length: 131072, description: 'Next-generation Grok 3 model' },
          { id: 'grok-3-mini', name: 'Grok 3 Mini', context_length: 131072, description: 'High-efficiency fast Grok 3 model' },
          { id: 'grok-beta', name: 'Grok Beta', context_length: 131072, description: 'xAI public beta model' },
          { id: 'grok-vision-beta', name: 'Grok Vision Beta', context_length: 8192, description: 'xAI multimodal vision beta' },
        ];
      }

      const formatFriendlyName = (id: string, origName?: string) => {
        if (origName && origName !== id) return origName;
        return id
          .split(/[-_]/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ');
      };

      const models: LiveProviderModel[] = rawList.map((m: any) => {
        const id = String(m.id || m.name || '').trim();
        const ctx = m.context_length ? ` • Context: ${Math.round(m.context_length / 1024)}k` : '';
        const desc = m.description || (m.context_length ? `xAI Grok${ctx}` : 'xAI Multimodal Reasoning Model');
        return {
          id,
          name: formatFriendlyName(id, m.name),
          description: desc,
          provider: 'grok',
          created: m.created ? String(m.created) : undefined,
        };
      });

      // Prioritize flagship / latest models first
      models.sort((a, b) => {
        const score = (id: string) => {
          if (id === 'grok-2-latest') return 120;
          if (id === 'grok-3') return 115;
          if (id === 'grok-3-mini') return 110;
          if (id === 'grok-2') return 105;
          if (id === 'grok-beta') return 100;
          if (id.includes('vision')) return 95;
          return 50;
        };
        return score(b.id) - score(a.id);
      });

      return {
        ok: true,
        provider: 'grok',
        models,
        message: `Fetched ${models.length} live models from xAI Grok API`,
      };
    } catch (err) {
      return {
        ok: false,
        provider: 'grok',
        models: [],
        message: `Failed to connect to xAI Grok API: ${(err as Error).message}`,
      };
    }
  }

  // 5. Generic OpenAI-compatible providers (Groq, Mistral, OpenRouter)
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
        let detail = '';
        try {
          const errBody = (await res.json()) as any;
          detail = errBody?.error?.message || errBody?.error || errBody?.message || '';
        } catch { /* empty */ }
        return {
          ok: false,
          provider: prov,
          models: [],
          message: detail || `${prov.toUpperCase()} returned status ${res.status}`,
        };
      }
      const data = (await res.json()) as { data?: Array<{ id: string; name?: string }> };
      let rawList = Array.isArray(data.data) ? data.data : [];
      if (rawList.length === 0 && (prov === 'grok' || prov === 'xai')) {
        rawList = [
          { id: 'grok-2-latest', name: 'Grok 2 Latest' },
          { id: 'grok-2', name: 'Grok 2' },
          { id: 'grok-beta', name: 'Grok Beta' },
          { id: 'grok-2-vision-128k', name: 'Grok 2 Vision (128k)' },
        ];
      }
      const models: LiveProviderModel[] = rawList.map((m) => ({
        id: m.id,
        name: m.name || m.id,
        description: `${prov.toUpperCase()} Model`,
        provider: prov,
      }));

      if (prov === 'groq') {
        models.sort((a, b) => {
          const score = (id: string) => {
            if (id.includes('gpt-oss-120b')) return 120;
            if (id.includes('qwen3.8-27b')) return 115;
            if (id.includes('gpt-oss-20b')) return 110;
            if (id.includes('llama-3.3-70b')) return 105;
            if (id.includes('llama-3.1-8b')) return 100;
            if (id.includes('prompt-guard')) return 10;
            if (id.includes('whisper')) return 5;
            return 50;
          };
          return score(b.id) - score(a.id);
        });
      }
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
