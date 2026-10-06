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

/**
 * Runtime configuration. Values are read lazily so importing a service in a
 * test does not require every production-only integration to be configured.
 * The server fails fast when a required value is actually needed.
 */
export const config = {
  get port() { return integer('PORT'); },
  get corsOrigins() { return list('CORS_ORIGINS'); },
  get appUrl() { return required('APP_URL').replace(/\/$/, ''); },
  get localLlmEndpoints() { return list('LOCAL_LLM_ENDPOINTS').map(v => v.replace(/\/$/, '')); },
  get localLlmModel() { return required('LOCAL_LLM_MODEL'); },
  get localLlmRequestTimeoutMs() { return integer('LOCAL_LLM_REQUEST_TIMEOUT_MS'); },
  get defaultAgentRunModel() { return required('AGENT_RUN_MODEL'); },
  get geminiModel() { return required('GEMINI_MODEL'); },
  get geminiModels() { return list('GEMINI_MODELS'); },
  get geminiApiBaseUrl() { return required('GEMINI_API_BASE_URL').replace(/\/$/, ''); },
  get promptModels() { return JSON.parse(required('PROMPT_MODELS_JSON')) as Record<string, string[]>; },
  get providerModelMap() { return JSON.parse(required('LLM_PROVIDER_MODEL_MAP_JSON')) as Record<string, string>; },
  get opencodeModel() { return process.env.OPENCODE_MODEL?.trim() ?? ''; },
  get opencodeTimeoutMs() { return integer('OPENCODE_TIMEOUT_MS'); },
  get opencodeInstallTimeoutMs() { return integer('OPENCODE_INSTALL_TIMEOUT_MS'); },
  get defaultGithubOwner() { return process.env.DEFAULT_GITHUB_OWNER?.trim() ?? ''; },
  get smtp() {
    return {
      host: required('SMTP_HOST'),
      port: integer('SMTP_PORT'),
      secure: boolean('SMTP_SECURE'),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: required('SMTP_FROM'),
    };
  },
  get otel() {
    return {
      enabled: boolean('OTEL_ENABLED'),
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, '') ?? '',
      serviceName: process.env.OTEL_SERVICE_NAME?.trim() ?? '',
    };
  },
} as const;
