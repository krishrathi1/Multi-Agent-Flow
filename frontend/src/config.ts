function required(name: string, fallback?: string): string {
  const value = import.meta.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required frontend environment variable: ${name}`);
}

import { DEFAULT_MCP_PRESETS, type McpPreset } from './lib/mcp-presets';

function parseMcpPresets(): McpPreset[] {
  try {
    const raw = import.meta.env.VITE_MCP_PRESETS_JSON?.trim();
    if (!raw) return DEFAULT_MCP_PRESETS;
    const envList = JSON.parse(raw) as McpPreset[];
    // Merge: env overrides defaults with same id, and keeps any additional ones
    const map = new Map<string, McpPreset>();
    for (const p of DEFAULT_MCP_PRESETS) map.set(p.id, p);
    for (const p of envList) map.set(p.id, p);
    return Array.from(map.values());
  } catch {
    return DEFAULT_MCP_PRESETS;
  }
}

export const config = {
  siteUrl: required('VITE_SITE_URL', 'http://localhost:5173').replace(/\/$/, ''),
  defaultOgImage: required('VITE_DEFAULT_OG_IMAGE', '/opengraph-image.png'),
  localLlmEndpoint: required('VITE_LOCAL_LLM_ENDPOINT', 'http://localhost:11434'),
  localLlmModel: required('VITE_LOCAL_LLM_MODEL', 'qwen2.5-coder:1.5b'),
  localLlmModels: JSON.parse(required('VITE_LOCAL_LLM_MODELS_JSON', '[{"id":"qwen2.5-coder:1.5b","name":"qwen2.5-coder:1.5b (Local PC • Fast)"},{"id":"llama3.2:3b","name":"Llama 3.2 3B (Local PC • Balanced)"}]')) as Array<{ id: string; name: string }>,
  gatewayEndpoint: required('VITE_GATEWAY_ENDPOINT', 'ws://localhost:9090'),
  mcpPresets: parseMcpPresets(),
  defaultGithubOwner: import.meta.env.VITE_DEFAULT_GITHUB_OWNER?.trim() ?? '',
  defaultGithubRepo: import.meta.env.VITE_DEFAULT_GITHUB_REPO?.trim() ?? '',
  defaultGithubBranch: import.meta.env.VITE_DEFAULT_GITHUB_BRANCH?.trim() ?? '',
} as const;
