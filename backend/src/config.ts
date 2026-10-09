function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function list(name: string): string[] {
  return required(name).split(',').map(v => v.trim()).filter(Boolean);
}

function integer(name: string): number {
  const value = Number(required(name));
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  return value;
}

function boolean(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null || value.trim() === '') return fallback;
  return value.toLowerCase() === 'true';
}

const DEFAULT_PROMPT_MODELS: Record<string, string[]> = {
  'code-review': ['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-3-7-sonnet'],
  'bug-detection': ['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-3-7-sonnet'],
  'code-completion': ['gemini-2.5-flash', 'claude-3-7-sonnet'],
  'code-explanation': ['gemini-2.5-flash', 'claude-3-7-sonnet'],
  'refactoring': ['gemini-2.5-flash', 'gemini-2.5-pro', 'claude-3-7-sonnet'],
};

const DEFAULT_PROVIDER_MODEL_MAP: Record<string, string> = {
  anthropic: 'claude-3-7-sonnet',
  openai: 'gpt-4o',
  google: 'gemini-2.5-flash',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.3-70b-versatile',
  openrouter: 'anthropic/claude-3.7-sonnet',
};

/**
 * Runtime configuration. Values are read lazily so importing a service in a
 * test does not require every production-only integration to be configured.
 * Optional integrations have safe fallbacks to prevent crash-on-boot.
 */
export const config = {
  get port() { return process.env.PORT ? integer('PORT') : 4000; },
  get corsOrigins() { return process.env.CORS_ORIGINS ? list('CORS_ORIGINS') : ['http://localhost:5173', 'http://localhost:5174']; },
  get appUrl() { return (process.env.APP_URL?.trim() || 'http://localhost:5174').replace(/\/$/, ''); },
  get localLlmEndpoints() { return process.env.LOCAL_LLM_ENDPOINTS ? list('LOCAL_LLM_ENDPOINTS').map(v => v.replace(/\/$/, '')) : ['http://localhost:11434', 'http://127.0.0.1:11434', 'http://host.docker.internal:11434']; },
  get localLlmModel() { return process.env.LOCAL_LLM_MODEL?.trim() || 'qwen2.5-coder:7b'; },
  get localLlmRequestTimeoutMs() { return process.env.LOCAL_LLM_REQUEST_TIMEOUT_MS ? integer('LOCAL_LLM_REQUEST_TIMEOUT_MS') : 10000; },
  get defaultAgentRunModel() { return process.env.AGENT_RUN_MODEL?.trim() || 'claude-3-7-sonnet'; },
  get geminiModel() { return process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'; },
  get geminiModels() { return process.env.GEMINI_MODELS ? list('GEMINI_MODELS') : ['gemini-2.5-flash', 'gemini-2.5-pro']; },
  get geminiApiBaseUrl() { return (process.env.GEMINI_API_BASE_URL?.trim() || 'https://generativelanguage.googleapis.com').replace(/\/$/, ''); },
  get promptModels() {
    if (process.env.PROMPT_MODELS_JSON) {
      try { return JSON.parse(process.env.PROMPT_MODELS_JSON) as Record<string, string[]>; } catch { /* fallback */ }
    }
    return DEFAULT_PROMPT_MODELS;
  },
  get providerModelMap() {
    if (process.env.LLM_PROVIDER_MODEL_MAP_JSON) {
      try { return JSON.parse(process.env.LLM_PROVIDER_MODEL_MAP_JSON) as Record<string, string>; } catch { /* fallback */ }
    }
    return DEFAULT_PROVIDER_MODEL_MAP;
  },
  get opencodeModel() { return process.env.OPENCODE_MODEL?.trim() ?? ''; },
  get opencodeTimeoutMs() { return process.env.OPENCODE_TIMEOUT_MS ? integer('OPENCODE_TIMEOUT_MS') : 120000; },
  get opencodeInstallTimeoutMs() { return process.env.OPENCODE_INSTALL_TIMEOUT_MS ? integer('OPENCODE_INSTALL_TIMEOUT_MS') : 300000; },
  get defaultGithubOwner() { return process.env.DEFAULT_GITHUB_OWNER?.trim() ?? ''; },
  get smtp() {
    return {
      host: process.env.SMTP_HOST?.trim() || 'localhost',
      port: process.env.SMTP_PORT ? integer('SMTP_PORT') : 587,
      secure: boolean('SMTP_SECURE', false),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM?.trim() || 'noreply@example.local',
    };
  },
  get otel() {
    return {
      enabled: boolean('OTEL_ENABLED', false),
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '') ?? '',
      serviceName: process.env.OTEL_SERVICE_NAME?.trim() ?? 'nexus-backend',
    };
  },
} as const;

/**
 * Validates baseline production configuration and returns missing variables
 * in a single report without throwing on module import.
 */
export function validateConfig(isProduction = process.env.NODE_ENV === 'production'): {
  valid: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];

  const requiredProduction = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'ENCRYPTION_KEY'];
  for (const name of requiredProduction) {
    if (!process.env[name]?.trim()) {
      missing.push(name);
    }
  }

  if (!process.env.GIT_WEBHOOK_SECRET?.trim()) {
    warnings.push('GIT_WEBHOOK_SECRET is not set; Git push webhook HMAC authentication will reject unauthenticated triggers.');
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

