function required(name: string, fallback?: string): string {
  const value = import.meta.env[name]?.trim();
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required frontend environment variable: ${name}`);
}

export const config = {
  siteUrl: required('VITE_SITE_URL', 'http://localhost:5173').replace(/\/$/, ''),
  defaultOgImage: required('VITE_DEFAULT_OG_IMAGE', '/opengraph-image.png'),
  localLlmEndpoint: required('VITE_LOCAL_LLM_ENDPOINT', 'http://localhost:11434'),
  localLlmModel: required('VITE_LOCAL_LLM_MODEL', 'qwen2.5-coder:1.5b'),
  localLlmModels: JSON.parse(required('VITE_LOCAL_LLM_MODELS_JSON', '[{"id":"qwen2.5-coder:1.5b","name":"qwen2.5-coder:1.5b (Local PC • Fast)"},{"id":"llama3.2:3b","name":"Llama 3.2 3B (Local PC • Balanced)"}]')) as Array<{ id: string; name: string }>,
  gatewayEndpoint: required('VITE_GATEWAY_ENDPOINT', 'ws://localhost:9090'),
  mcpPresets: JSON.parse(required('VITE_MCP_PRESETS_JSON', '[{"id":"vercel","name":"Vercel Deployment MCP","category":"DEPLOY","icon":"▲","badge":"Deploy","url":"https://mcp.vercel.com/sse","transport":"SSE","description":"Trigger instant frontend deployments.","tools":["deploy_project"]}]')) as Array<{ id: string; name: string; category: string; icon: string; badge: string; url: string; transport: 'SSE' | 'STREAMABLE_HTTP'; description: string; tools: string[] }>,
  defaultGithubOwner: import.meta.env.VITE_DEFAULT_GITHUB_OWNER?.trim() ?? '',
  defaultGithubRepo: import.meta.env.VITE_DEFAULT_GITHUB_REPO?.trim() ?? '',
  defaultGithubBranch: import.meta.env.VITE_DEFAULT_GITHUB_BRANCH?.trim() ?? '',
} as const;
