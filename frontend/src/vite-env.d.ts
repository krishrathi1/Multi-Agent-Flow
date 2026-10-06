/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  readonly VITE_DEFAULT_OG_IMAGE?: string;
  readonly VITE_LOCAL_LLM_ENDPOINT?: string;
  readonly VITE_LOCAL_LLM_MODEL?: string;
  readonly VITE_LOCAL_LLM_MODELS_JSON?: string;
  readonly VITE_GATEWAY_ENDPOINT?: string;
  readonly VITE_MCP_PRESETS_JSON?: string;
  readonly VITE_DEFAULT_GITHUB_OWNER?: string;
  readonly VITE_DEFAULT_GITHUB_REPO?: string;
  readonly VITE_DEFAULT_GITHUB_BRANCH?: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
