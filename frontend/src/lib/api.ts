import type { Agent, AgentStats, Activity, Task, Thread, Message, Session, TokenUsage, MetricSnapshot, AlertRule, AlertEvent, Command, Gateway, GatewayHealth, ModelInfo, ChatHistory, ChatResponse, WorkspaceFile, LlmProvider, UsageCredit, Board, BoardGroup, Approval, Tag, TagAssignment, TaskCustomFieldDefinition, BoardTaskCustomField, TaskCustomFieldValue, MarketplaceSkill, SkillPack, AgentSkill, AgentIntegration, BoardWebhook, BoardWebhookPayload, BoardOnboardingSession, BoardGroupMemory, OrgInvite, SoulTemplate, Process, ProcessPlan, ProcessStats, ProcessStatus, ChainRunResult, WorkspaceArtifact, RunStatus, ProcessRun, RunStats, ProcessTemplate, ProcessSchedule, ProcessWebhookConfig, ChainGate, ApprovalMode, AppNotification, CostEstimate, AgentInsight, PreviewVisibility, RunComparison, ChainBundle, WebhookDelivery } from '../types';
import { useAuthStore } from '../stores/auth-store';

const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const { accessToken, organization } = useAuthStore.getState();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
  if (organization?.id) headers['X-Organization-Id'] = organization.id;

  let res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include', // send httpOnly cookies
    headers: { ...headers, ...options?.headers },
  });

  // On 401, try to refresh token via httpOnly cookie and retry once
  if (res.status === 401) {
    const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // refresh token is in httpOnly cookie
    });
    if (refreshRes.ok) {
      const data = await refreshRes.json();
      useAuthStore.getState().setAccessToken(data.accessToken);
      headers['Authorization'] = `Bearer ${data.accessToken}`;
      res = await fetch(`${BASE_URL}${path}`, {
        ...options,
        credentials: 'include',
        headers: { ...headers, ...options?.headers },
      });
    } else {
      // Clear auth state — ProtectedRoute will redirect to /login
      // without a hard page reload (preserves SPA navigation)
      useAuthStore.getState().clearAuth();
      throw new Error('Session expired');
    }
  }

  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

// For public endpoints (no auth needed)
async function requestPublic<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // receive httpOnly cookies from login/signup
    ...options,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(data.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  /** Generic typed request — used by feature modules for ad-hoc endpoints. */
  _request: request,
  orchestration: {
    notifications: (unreadOnly = false) =>
      request<{ items: AppNotification[]; unread: number }>(
        `/orchestration/notifications${unreadOnly ? '?unread=true' : ''}`,
      ),
    markNotificationsRead: (ids?: string[]) =>
      request<{ marked: number }>('/orchestration/notifications/read', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      }),
    /** Forecasts a run's spend from this chain's history. */
    estimate: (processId: string) =>
      request<CostEstimate>(`/orchestration/estimate/${processId}`),
    agentInsights: () => request<AgentInsight[]>('/orchestration/agent-insights'),
    /** Stage-by-stage diff of two runs, so a regression has an owner. */
    compareRuns: (baseId: string, headId: string) =>
      request<RunComparison>(`/orchestration/runs/${baseId}/compare/${headId}`),
    /** Every delivery attempt — a webhook failing quietly is now visible. */
    webhookDeliveries: (opts?: { webhookId?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (opts?.webhookId) q.set('webhookId', opts.webhookId);
      if (opts?.limit) q.set('limit', String(opts.limit));
      const qs = q.toString();
      return request<WebhookDelivery[]>(
        `/orchestration/webhook-deliveries${qs ? `?${qs}` : ''}`,
      );
    },
    /**
     * Fetches a chain as a portable bundle.
     *
     * Deliberately not a plain download link: orchestration routes authorise
     * with a Bearer header, which an `<a href>` cannot send, so the caller
     * saves the returned object as a Blob instead.
     */
    exportChain: (processId: string) =>
      request<ChainBundle>(`/orchestration/chains/${processId}/export`),
    importChain: (bundle: unknown) =>
      request<{ ok: boolean; processId: string; name: string }>(
        '/orchestration/chains/import',
        { method: 'POST', body: JSON.stringify(bundle) },
      ),
    annotateRun: (id: string, note: string) =>
      request<{ id: string; note: string | null }>(`/orchestration/runs/${id}/note`, {
        method: 'PATCH',
        body: JSON.stringify({ note }),
      }),
    setShare: (processId: string, visibility: PreviewVisibility, rotate = false) =>
      request<{ id: string; previewVisibility: PreviewVisibility; shareToken: string | null }>(
        `/orchestration/share/${processId}`,
        { method: 'POST', body: JSON.stringify({ visibility, rotate }) },
      ),

    /** Human gates blocking chains between stages. */
    gates: (opts?: { processId?: string; pendingOnly?: boolean }) => {
      const q = new URLSearchParams();
      if (opts?.processId) q.set('processId', opts.processId);
      if (opts?.pendingOnly) q.set('pending', 'true');
      const qs = q.toString();
      return request<ChainGate[]>(`/orchestration/gates${qs ? `?${qs}` : ''}`);
    },
    decideGate: (id: string, approve: boolean, note?: string) =>
      request<ChainGate>(`/orchestration/gates/${id}/${approve ? 'approve' : 'reject'}`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      }),

    runs: (params?: { processId?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.processId) q.set('processId', params.processId);
      if (params?.limit) q.set('limit', String(params.limit));
      const qs = q.toString();
      return request<ProcessRun[]>(`/orchestration/runs${qs ? `?${qs}` : ''}`);
    },
    runStats: () => request<RunStats>('/orchestration/runs/stats'),
    run: (id: string) => request<ProcessRun>(`/orchestration/runs/${id}`),

    templates: () => request<ProcessTemplate[]>('/orchestration/templates'),
    saveTemplate: (data: {
      name: string;
      description?: string;
      category?: string;
      processId?: string;
    }) =>
      request<ProcessTemplate>('/orchestration/templates', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteTemplate: (id: string) =>
      request<void>(`/orchestration/templates/${id}`, { method: 'DELETE' }),
    useTemplate: (id: string, name?: string) =>
      request<Process>(`/orchestration/templates/${id}/use`, {
        method: 'POST',
        body: JSON.stringify({ name }),
      }),

    schedules: (processId?: string) =>
      request<ProcessSchedule[]>(
        `/orchestration/schedules${processId ? `?processId=${processId}` : ''}`,
      ),
    createSchedule: (data: { processId: string; cron: string; timezone?: string }) =>
      request<ProcessSchedule>('/orchestration/schedules', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    updateSchedule: (id: string, data: { cron?: string; enabled?: boolean }) =>
      request<ProcessSchedule>(`/orchestration/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    deleteSchedule: (id: string) =>
      request<void>(`/orchestration/schedules/${id}`, { method: 'DELETE' }),

    webhooks: (processId?: string) =>
      request<ProcessWebhookConfig[]>(
        `/orchestration/webhooks${processId ? `?processId=${processId}` : ''}`,
      ),
    createWebhook: (data: { processId: string; url: string; secret?: string }) =>
      request<ProcessWebhookConfig>('/orchestration/webhooks', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deleteWebhook: (id: string) =>
      request<void>(`/orchestration/webhooks/${id}`, { method: 'DELETE' }),
  },

  processes: {
    list: () => request<Process[]>('/processes'),
    stats: () => request<ProcessStats>('/processes/stats'),
    get: (id: string) => request<Process>(`/processes/${id}`),
    /** Dry run — returns the roster without creating anything. */
    plan: (prompt: string, agentCount?: number, model?: string) =>
      request<ProcessPlan>('/processes/plan', {
        method: 'POST',
        body: JSON.stringify({ prompt, ...(agentCount ? { agentCount } : {}), ...(model ? { model } : {}) }),
      }),
    expandPrompt: (data: { prompt: string; model?: string }) =>
      request<{ expandedPrompt: string; model: string }>('/processes/expand-prompt', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    create: (data: {
      prompt: string;
      name?: string;
      agentCount?: number;
      plan?: ProcessPlan;
      gatewayId?: string;
      githubToken?: string;
      vercelToken?: string;
      model?: string;
    }) => {
      const ghToken = data.githubToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus:github_token') : null) || undefined;
      const vToken = data.vercelToken || (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus:vercel_token') : null) || undefined;
      return request<Process>('/processes', {
        method: 'POST',
        headers: {
          ...(ghToken ? { 'x-github-token': ghToken } : {}),
          ...(vToken ? { 'x-vercel-token': vToken } : {}),
        },
        body: JSON.stringify({ ...data, githubToken: ghToken, vercelToken: vToken }),
      });
    },
    start: (id: string) => request<Process>(`/processes/${id}/start`, { method: 'POST' }),
    /** Starts the chain. Returns immediately; poll `runStatus` for progress. */
    run: (id: string) => request<RunStatus>(`/processes/${id}/run`, { method: 'POST' }),
    runStatus: (id: string) => request<RunStatus>(`/processes/${id}/run`),
    /** Stops a run in flight — kills the executing step. */
    cancel: (id: string) => request<{ cancelled: boolean }>(`/processes/${id}/cancel`, { method: 'POST' }),
    /** Re-runs from the first stage that didn't complete. */
    retry: (id: string) =>
      request<RunStatus & { fromStage: number }>(`/processes/${id}/retry`, { method: 'POST' }),
    /** Direct download URL for everything the chain built. */
    artifactsZipUrl: (id: string) => `/api/processes/${id}/artifacts.zip`,
    files: (id: string) => request<WorkspaceArtifact[]>(`/processes/${id}/files`),
    /** Public URL where the chain's built site is served. */
    previewUrl: (id: string) => `/preview/${id}`,
    pause: (id: string) => request<Process>(`/processes/${id}/pause`, { method: 'POST' }),
    update: (
      id: string,
      data: {
        name?: string;
        prompt?: string;
        summary?: string;
        status?: ProcessStatus;
        budgetUsd?: number | null;
        maxTokens?: number | null;
        approvalMode?: ApprovalMode;
      },
    ) =>
      request<Process>(`/processes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    remove: (id: string, deleteAgents = false) =>
      request<void>(`/processes/${id}?deleteAgents=${deleteAgents}`, { method: 'DELETE' }),
    mcpServers: (id: string) => request<any[]>(`/processes/${id}/mcp-servers`),
    addMcpServer: (id: string, data: { name: string; url: string; transport?: string; existingServerId?: string }) =>
      request<any>(`/processes/${id}/mcp-servers`, { method: 'POST', body: JSON.stringify(data) }),
    updateMcpServer: (id: string, serverId: string, data: { name?: string; url?: string; transport?: string; enabled?: boolean }) =>
      request<any>(`/processes/${id}/mcp-servers/${serverId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteMcpServer: (id: string, serverId: string) =>
      request<void>(`/processes/${id}/mcp-servers/${serverId}`, { method: 'DELETE' }),
    gateways: (id: string) => request<any[]>(`/processes/${id}/gateways`),
    addGateway: (id: string, data: { gatewayId?: string; name?: string; url?: string; token?: string; workspaceRoot?: string }) =>
      request<any>(`/processes/${id}/gateways`, { method: 'POST', body: JSON.stringify(data) }),
    deleteGateway: (id: string, gatewayId: string) =>
      request<void>(`/processes/${id}/gateways/${gatewayId}`, { method: 'DELETE' }),
    testApi: (data: { url: string; method?: string; headers?: Record<string, string>; body?: string; apiKey?: string }) =>
      request<{ ok: boolean; status: number; statusText: string; latencyMs: number; snippet?: string }>('/processes/test-api', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    githubRepos: (token?: string) =>
      request<{ repos: Array<{ name: string; full_name: string; default_branch: string; description?: string; private?: boolean }>; connected: boolean }>('/processes/github-repos', {
        method: 'POST',
        body: JSON.stringify({ token }),
      }),
    githubCreateRepo: (data: { token?: string; name: string; description?: string; isPrivate?: boolean; autoInit?: boolean }) =>
      request<{ success: boolean; repo?: { name: string; full_name: string; html_url: string; clone_url: string; default_branch: string; private: boolean; description?: string }; error?: string }>('/processes/github-create-repo', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    deploymentLogs: (id: string) =>
      request<{
        deploymentId?: string;
        name: string;
        state: 'QUEUED' | 'BUILDING' | 'INITIALIZING' | 'READY' | 'ERROR' | 'UNKNOWN';
        previewUrl?: string;
        logs: Array<{ date: number; text: string; type: string }>;
        diagnosis?: string;
        error?: string;
      }>(`/processes/${id}/deployment-logs`),
    autoHeal: (id: string) =>
      request<{
        success: boolean;
        fixedFiles: string[];
        pushResult?: any;
        deployResult?: any;
        message: string;
      }>(`/processes/${id}/auto-heal`, { method: 'POST' }),
    askAiFix: (id: string, instruction?: string) =>
      request<{
        success: boolean;
        diagnosis: string;
        needsNewAgent: boolean;
        agentSpawned?: {
          id: string;
          displayName: string;
          avatar: string;
          processRole: string;
          processStage: number;
        };
        fixedFiles: string[];
        pushResult?: any;
        deployResult?: any;
        message: string;
      }>(`/processes/${id}/ask-ai-fix`, { method: 'POST', body: JSON.stringify({ instruction }) }),
    report: (id: string) => request<any>(`/processes/${id}/report`),
    reportHtmlUrl: (id: string) => `/api/processes/${id}/report/html`,
  },

  auth: {
    signup: (data: { email: string; password: string; name: string; orgName: string }) =>
      requestPublic<{ user: { id: string; email: string; name: string }; requiresVerification: boolean }>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      requestPublic('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    verifyEmail: (token: string) =>
      requestPublic<{ message: string }>('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
    resendVerification: (email: string) =>
      requestPublic<{ message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
    refresh: () =>
      requestPublic('/auth/refresh', { method: 'POST' }),
    me: () => request('/auth/me'),
  },
  org: {
    get: () => request('/org'),
    update: (data: Record<string, unknown>) => request('/org', { method: 'PATCH', body: JSON.stringify(data) }),
    members: () => request('/org/members'),
    invite: (email: string, role: string) =>
      request('/org/members/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
    updateMemberRole: (id: string, role: string) =>
      request(`/org/members/${id}`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    removeMember: (id: string) => request(`/org/members/${id}`, { method: 'DELETE' }),
    apiKeys: () => request('/org/api-keys'),
    createApiKey: (name: string) => request('/org/api-keys', { method: 'POST', body: JSON.stringify({ name }) }),
    revokeApiKey: (id: string) => request(`/org/api-keys/${id}`, { method: 'DELETE' }),
  },
  agents: {
    list: () => request<Agent[]>('/agents'),
    get: (id: string) => request<Agent>(`/agents/${id}`),
    stats: () => request<AgentStats>('/agents/stats'),
    updateConfig: (id: string, data: { soulMd?: string; enabled?: boolean; heartbeatInterval?: number }) =>
      request<Agent>(`/agents/${id}/config`, { method: 'PATCH', body: JSON.stringify(data) }),
    create: (data: Record<string, unknown>) => request('/agents', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request(`/agents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request(`/agents/${id}`, { method: 'DELETE' }),
    toggleA2a: (id: string, enabled: boolean) =>
      request<Agent>(`/agents/${id}/a2a`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    listSkills: (id: string) => request<AgentSkill[]>(`/agents/${id}/skills`),
    assignSkills: (id: string, skillIds: string[]) =>
      request<AgentSkill[]>(`/agents/${id}/skills`, { method: 'POST', body: JSON.stringify({ skillIds }) }),
    updateSkill: (id: string, skillId: string, data: Record<string, unknown>) =>
      request<AgentSkill>(`/agents/${id}/skills/${skillId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    removeSkill: (id: string, skillId: string) =>
      request<void>(`/agents/${id}/skills/${skillId}`, { method: 'DELETE' }),
    // Integrations
    listIntegrations: (id: string) =>
      request<AgentIntegration[]>(`/agents/${id}/integrations`),
    getIntegration: (id: string, channel: string) =>
      request<AgentIntegration>(`/agents/${id}/integrations/${channel}`),
    upsertIntegration: (id: string, channel: string, data: Record<string, unknown>) =>
      request<AgentIntegration>(`/agents/${id}/integrations/${channel}`, { method: 'PUT', body: JSON.stringify(data) }),
    toggleIntegration: (id: string, channel: string, enabled: boolean) =>
      request<AgentIntegration>(`/agents/${id}/integrations/${channel}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
    deleteIntegration: (id: string, channel: string) =>
      request<void>(`/agents/${id}/integrations/${channel}`, { method: 'DELETE' }),
  },
  mcp: {
    list: (agentId: string) => request(`/agents/${agentId}/mcp-servers`),
    add: (agentId: string, data: Record<string, unknown>) =>
      request(`/agents/${agentId}/mcp-servers`, { method: 'POST', body: JSON.stringify(data) }),
    update: (agentId: string, serverId: string, data: Record<string, unknown>) =>
      request(`/agents/${agentId}/mcp-servers/${serverId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (agentId: string, serverId: string) =>
      request(`/agents/${agentId}/mcp-servers/${serverId}`, { method: 'DELETE' }),
    refreshTools: (agentId: string, serverId: string) =>
      request(`/agents/${agentId}/mcp-servers/${serverId}/refresh-tools`, { method: 'POST' }),
    tools: (agentId: string, serverId: string) =>
      request(`/agents/${agentId}/mcp-servers/${serverId}/tools`),
    orgList: () => request<any[]>('/mcp'),
    orgAdd: (data: { name: string; url: string; transport?: string; agentId?: string; tools?: any[] }) =>
      request('/mcp', { method: 'POST', body: JSON.stringify(data) }),
    orgBatchAdd: (data: { servers: Array<{ name: string; url: string; transport?: string; tools?: any[] }>; agentId?: string }) =>
      request<{ results: Array<{ success: boolean; server?: any; error?: string }> }>('/mcp/batch', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    orgRefresh: (serverId: string) =>
      request(`/mcp/${serverId}/refresh`, { method: 'POST' }),
    refresh: (serverId: string) =>
      request<any[]>(`/mcp/${serverId}/refresh`, { method: 'POST' }),
    orgUpdate: (serverId: string, data: Record<string, unknown>) =>
      request(`/mcp/${serverId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    orgRemove: (serverId: string) =>
      request(`/mcp/${serverId}`, { method: 'DELETE' }),
    callTool: (serverId: string, toolName: string, args: Record<string, any> = {}) =>
      request<{ success: boolean; result?: any; error?: string; durationMs?: number; executedAt?: string }>(
        `/mcp/${serverId}/tools/${encodeURIComponent(toolName)}/call`,
        { method: 'POST', body: JSON.stringify({ arguments: args }) },
      ),
  },
  activities: {
    list: (params?: { agentId?: string; type?: string; processId?: string; limit?: number; offset?: number }) => {
      const query = new URLSearchParams();
      if (params?.agentId) query.set('agentId', params.agentId);
      if (params?.type) query.set('type', params.type);
      if (params?.processId) query.set('processId', params.processId);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.offset) query.set('offset', String(params.offset));
      const qs = query.toString();
      return request<{ activities: Activity[]; total: number }>(`/activities${qs ? `?${qs}` : ''}`);
    },
    search: (query: string, params?: { agentId?: string; type?: string; limit?: number }) => {
      const q = new URLSearchParams({ q: query });
      if (params?.agentId) q.set('agentId', params.agentId);
      if (params?.type) q.set('type', params.type);
      if (params?.limit) q.set('limit', String(params.limit));
      return request<{ activities: Activity[]; total: number }>(`/activities/search?${q.toString()}`);
    },
  },
  tasks: {
    list: () => request<Task[]>('/tasks'),
    create: (data: { title: string; description?: string; priority?: string; status?: string; agentId?: string; boardId?: string }) =>
      request<Task>('/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Task>) =>
      request<Task>(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  },
  threads: {
    list: (processId?: string) =>
      request<Thread[]>(`/threads${processId ? `?processId=${processId}` : ''}`),
    get: (id: string) => request<Thread>(`/threads/${id}`),
    graph: (processId?: string) =>
      request<{
        nodes: Array<{
          id: string; name: string; displayName: string; avatar: string | null;
          status: string; processId?: string | null; processRole?: string | null;
          processStage?: number | null;
        }>;
        edges: Array<{ source: string; target: string; messageCount: number; lastMessage: string }>;
      }>(`/threads/graph${processId ? `?processId=${processId}` : ''}`),
  },
  sessions: {
    list: (params?: { agentId?: string; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.agentId) query.set('agentId', params.agentId);
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return request<Session[]>(`/sessions${qs ? `?${qs}` : ''}`);
    },
    timeline: (params?: { processId?: string; hours?: number }) => {
      const q = new URLSearchParams();
      if (params?.processId) q.set('processId', params.processId);
      if (params?.hours) q.set('hours', String(params.hours));
      const qs = q.toString();
      return request<{
        timeline: Array<{
          agent: {
            id: string; name: string; displayName: string; avatar: string | null;
            status: string; processId?: string | null; processRole?: string | null;
            processStage?: number | null;
          };
          sessions: Session[];
        }>;
        windowStart: string;
        windowEnd: string;
      }>(`/sessions/timeline${qs ? `?${qs}` : ''}`);
    },
  },
  tokens: {
    usage: (params?: { agentId?: string; hours?: number; processId?: string; model?: string }) => {
      const query = new URLSearchParams();
      if (params?.agentId) query.set('agentId', params.agentId);
      if (params?.hours) query.set('hours', String(params.hours));
      if (params?.processId) query.set('processId', params.processId);
      if (params?.model) query.set('model', params.model);
      const qs = query.toString();
      return request<TokenUsage[]>(`/tokens${qs ? `?${qs}` : ''}`);
    },
    summary: (params?: { processId?: string; model?: string }) => {
      const query = new URLSearchParams();
      if (params?.processId) query.set('processId', params.processId);
      if (params?.model) query.set('model', params.model);
      const qs = query.toString();
      return request<{ totalTokens: number; totalCost: number; byAgent: Array<{ agentId: string; agentName: string; displayName: string; avatar: string; totalTokens: number; totalCost: number }> }>(`/tokens/summary${qs ? `?${qs}` : ''}`);
    },
  },
  metrics: {
    list: (params?: { agentId?: string; limit?: number; processId?: string; model?: string }) => {
      const query = new URLSearchParams();
      if (params?.agentId) query.set('agentId', params.agentId);
      if (params?.limit) query.set('limit', String(params.limit));
      if (params?.processId) query.set('processId', params.processId);
      if (params?.model) query.set('model', params.model);
      const qs = query.toString();
      return request<MetricSnapshot[]>(`/metrics${qs ? `?${qs}` : ''}`);
    },
    summary: (params?: { processId?: string; model?: string }) => {
      const query = new URLSearchParams();
      if (params?.processId) query.set('processId', params.processId);
      if (params?.model) query.set('model', params.model);
      const qs = query.toString();
      return request<{ byAgent: Array<{ agentId: string; agentName: string; displayName: string; avatar: string; avgResponseTime: number; p95ResponseTime: number; successRate: number; totalCalls: number }> }>(`/metrics/summary${qs ? `?${qs}` : ''}`);
    },
  },
  alerts: {
    rules: () => request<AlertRule[]>('/alerts/rules'),
    createRule: (data: Partial<AlertRule>) =>
      request<AlertRule>('/alerts/rules', { method: 'POST', body: JSON.stringify(data) }),
    updateRule: (id: string, data: Partial<AlertRule>) =>
      request<AlertRule>(`/alerts/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    events: (params?: { acknowledged?: boolean; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.acknowledged !== undefined) query.set('acknowledged', String(params.acknowledged));
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return request<AlertEvent[]>(`/alerts/events${qs ? `?${qs}` : ''}`);
    },
    acknowledge: (id: string) =>
      request<AlertEvent>(`/alerts/events/${id}/acknowledge`, { method: 'POST' }),
    clearAll: () =>
      request<{ success: boolean; count: number }>('/alerts/events', { method: 'DELETE' }),
    acknowledgeAll: () =>
      request<{ success: boolean; count: number }>('/alerts/events/acknowledge-all', { method: 'POST' }),
  },
  commands: {
    send: (data: { agentId: string; type: string; payload?: Record<string, unknown> }) =>
      request<Command>('/commands', { method: 'POST', body: JSON.stringify(data) }),
    list: (agentId?: string) => {
      const qs = agentId ? `?agentId=${agentId}` : '';
      return request<Command[]>(`/commands${qs}`);
    },
  },
  gateways: {
    list: () => request<Gateway[]>('/gateways'),
    get: (id: string) => request<Gateway>(`/gateways/${id}`),
    create: (data: { name: string; url: string; token: string; workspaceRoot?: string }) =>
      request<Gateway>('/gateways', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; url: string; token: string; workspaceRoot: string }>) =>
      request<Gateway>(`/gateways/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/gateways/${id}`, { method: 'DELETE' }),
    health: (id: string) => request<GatewayHealth>(`/gateways/${id}/health`),
    models: (id: string) => request<ModelInfo[]>(`/gateways/${id}/models`),
    sessions: (id: string) => request<unknown>(`/gateways/${id}/sessions`),
    defaults: () => request<{ hasDefaultConfig: boolean; gatewayCount: number }>('/gateways/defaults'),
  },
  chat: {
    history: (agentId: string) => request<ChatHistory>(`/agents/${agentId}/chat/history`),
    send: (agentId: string, message: string, model?: string) =>
      request<ChatResponse>(`/agents/${agentId}/chat`, { method: 'POST', body: JSON.stringify({ message, model }) }),
    motherHistory: (processId?: string) =>
      request<ChatHistory>(`/agents/mother/history${processId ? `?processId=${encodeURIComponent(processId)}` : ''}`),
    sendToMother: (message: string, processId?: string, model?: string) =>
      request<ChatResponse>('/agents/mother/chat', { method: 'POST', body: JSON.stringify({ message, processId, model }) }),
  },
  files: {
    list: (agentId: string) => request<WorkspaceFile[]>(`/agents/${agentId}/files`),
    get: (agentId: string, name: string) => request<WorkspaceFile>(`/agents/${agentId}/files/${encodeURIComponent(name)}`),
    update: (agentId: string, name: string, content: string) =>
      request<WorkspaceFile>(`/agents/${agentId}/files/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  },
  boards: {
    list: () => request<Board[]>('/boards'),
    get: (id: string) => request<Board>(`/boards/${id}`),
    create: (data: Record<string, unknown>) =>
      request<Board>('/boards', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<Board>(`/boards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/boards/${id}`, { method: 'DELETE' }),
    addAgent: (id: string, data: { agentId: string; isLead?: boolean }) =>
      request<Agent>(`/boards/${id}/agents`, { method: 'POST', body: JSON.stringify(data) }),
    removeAgent: (id: string, agentId: string) =>
      request<void>(`/boards/${id}/agents/${agentId}`, { method: 'DELETE' }),
  },
  boardGroups: {
    list: () => request<BoardGroup[]>('/boards/groups'),
    create: (data: { name: string; description?: string }) =>
      request<BoardGroup>('/boards/groups', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; description?: string }) =>
      request<BoardGroup>(`/boards/groups/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/boards/groups/${id}`, { method: 'DELETE' }),
  },
  approvals: {
    list: (params?: { boardId?: string; status?: string; limit?: number }) => {
      const query = new URLSearchParams();
      if (params?.boardId) query.set('boardId', params.boardId);
      if (params?.status) query.set('status', params.status);
      if (params?.limit) query.set('limit', String(params.limit));
      const qs = query.toString();
      return request<Approval[]>(`/approvals${qs ? `?${qs}` : ''}`);
    },
    stats: () => request<{ pending: number; approved: number; rejected: number; total: number }>('/approvals/stats'),
    get: (id: string) => request<Approval>(`/approvals/${id}`),
    approve: (id: string) => request<Approval>(`/approvals/${id}/approve`, { method: 'POST' }),
    reject: (id: string) => request<Approval>(`/approvals/${id}/reject`, { method: 'POST' }),
    create: (data: { boardId: string; taskId?: string; agentId?: string; actionType: string; payload?: Record<string, unknown>; confidence?: number }) =>
      request<Approval>('/approvals', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<{ success: boolean }>(`/approvals/${id}`, { method: 'DELETE' }),
    clear: (status?: string) => request<{ success: boolean }>(`/approvals${status ? `?status=${status}` : ''}`, { method: 'DELETE' }),
  },
  incidents: {
    list: () => request<any[]>('/incidents'),
    investigate: (data: { alertTitle?: string; symptom?: string; scenario?: string }) =>
      request<any>('/incidents/investigate', { method: 'POST', body: JSON.stringify(data) }),
    simulate: (scenario: string) =>
      request<any>('/incidents/simulate', { method: 'POST', body: JSON.stringify({ scenario }) }),
    clear: () => request<{ success: boolean }>('/incidents', { method: 'DELETE' }),
  },
  agentTokens: {
    generate: (agentId: string) =>
      request<{ token: string }>(`/agents/${agentId}/token`, { method: 'POST' }),
  },
  opencode: {
    status: () => request<{ installed: boolean; version: string | null; command: string; error?: string }>('/opencode/status'),
    models: () => request<{
      installed: boolean;
      output: string;
      models?: Array<{
        id: string;
        name: string;
        provider: string;
        family?: string;
        status?: string;
        context?: number;
        output?: number;
        free?: boolean;
      }>;
      error?: string;
    }>('/opencode/models'),
    install: () => request<{ output: string; status: { installed: boolean; version: string | null; command: string } }>('/opencode/install', { method: 'POST' }),
  },
  llmProviders: {
    list: () => request<LlmProvider[]>('/llm-providers'),
    availableModels: () => request<{ models: Array<{ id: string; name: string; provider: string; source: string }> }>('/llm-providers/available-models'),
    upsert: (data: { provider: string; mode: string; apiKey?: string }) =>
      request<LlmProvider>('/llm-providers', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/llm-providers/${id}`, { method: 'DELETE' }),
    test: (id: string) => request<{ success: boolean; message: string }>(`/llm-providers/${id}/test`, { method: 'POST' }),
    usage: () => request<{ credit: UsageCredit | null; providers: LlmProvider[] }>('/llm-providers/usage'),
    localModels: (endpoint?: string) =>
      request<{
        models: Array<{ name: string; size?: string; parameterSize?: string; family?: string; modifiedAt?: string }>;
        endpoint: string;
        reachable: boolean;
      }>(`/llm-providers/local-models${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`),
    liveModels: (provider: string, apiKey?: string) =>
      request<{
        ok: boolean;
        provider: string;
        models: Array<{ id: string; name: string; description?: string; provider: string; created?: string | number }>;
        message?: string;
      }>('/llm-providers/live-models', {
        method: 'POST',
        body: JSON.stringify({ provider, apiKey }),
      }),
    addCredit: (amountCents: number) =>
      request<UsageCredit>('/llm-providers/credits', { method: 'POST', body: JSON.stringify({ amountCents }) }),
  },

  // ─── Mission Control Features ──────────────────────
  tags: {
    list: () => request<Tag[]>('/tags'),
    create: (data: { name: string; color?: string; description?: string }) =>
      request<Tag>('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: { name?: string; color?: string; description?: string }) =>
      request<Tag>(`/tags/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/tags/${id}`, { method: 'DELETE' }),
    assign: (taskId: string, tagIds: string[]) =>
      request<TagAssignment[]>('/tags/assign', { method: 'POST', body: JSON.stringify({ taskId, tagIds }) }),
  },
  customFields: {
    list: () => request<TaskCustomFieldDefinition[]>('/custom-fields'),
    create: (data: { fieldKey: string; label: string; fieldType?: string; uiVisibility?: string; validationRegex?: string; defaultValue?: string }) =>
      request<TaskCustomFieldDefinition>('/custom-fields', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<TaskCustomFieldDefinition>(`/custom-fields/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/custom-fields/${id}`, { method: 'DELETE' }),
    attach: (id: string, boardIds: string[]) =>
      request<BoardTaskCustomField[]>(`/custom-fields/${id}/attach`, { method: 'POST', body: JSON.stringify({ boardIds }) }),
    boardFields: (boardId: string) => request<BoardTaskCustomField[]>(`/custom-fields/boards/${boardId}`),
    setValue: (taskId: string, definitionId: string, value: string) =>
      request<TaskCustomFieldValue>('/custom-fields/values', { method: 'POST', body: JSON.stringify({ taskId, definitionId, value }) }),
    getValues: (taskId: string) => request<TaskCustomFieldValue[]>(`/custom-fields/values/${taskId}`),
  },
  skills: {
    marketplace: (gatewayId?: string) => request<MarketplaceSkill[]>(`/skills/marketplace${gatewayId ? `?gatewayId=${gatewayId}` : ''}`),
    createSkill: (data: { name: string; description?: string; category?: string; risk?: string; sourceUrl?: string }) =>
      request<MarketplaceSkill>('/skills/marketplace', { method: 'POST', body: JSON.stringify(data) }),
    install: (skillId: string, gatewayId: string) =>
      request('/skills/marketplace/' + skillId + '/install', { method: 'POST', body: JSON.stringify({ gatewayId }) }),
    uninstall: (skillId: string, gatewayId: string) =>
      request('/skills/marketplace/' + skillId + '/uninstall', { method: 'POST', body: JSON.stringify({ gatewayId }) }),
    deleteSkill: (skillId: string) =>
      request<void>('/skills/marketplace/' + skillId, { method: 'DELETE' }),
    packs: () => request<SkillPack[]>('/skills/packs'),
    createPack: (data: { name: string; description?: string; sourceUrl: string; branch?: string }) =>
      request<SkillPack>('/skills/packs', { method: 'POST', body: JSON.stringify(data) }),
    syncPack: (packId: string) =>
      request('/skills/packs/' + packId + '/sync', { method: 'POST' }),
    deletePack: (packId: string) =>
      request<void>('/skills/packs/' + packId, { method: 'DELETE' }),
  },
  webhooks: {
    list: (boardId: string) => request<BoardWebhook[]>(`/boards/${boardId}/webhooks`),
    create: (boardId: string, data: { description?: string; agentId?: string; enabled?: boolean }) =>
      request<BoardWebhook>(`/boards/${boardId}/webhooks`, { method: 'POST', body: JSON.stringify(data) }),
    update: (boardId: string, webhookId: string, data: { description?: string; agentId?: string | null; enabled?: boolean }) =>
      request<BoardWebhook>(`/boards/${boardId}/webhooks/${webhookId}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (boardId: string, webhookId: string) =>
      request<void>(`/boards/${boardId}/webhooks/${webhookId}`, { method: 'DELETE' }),
    payloads: (boardId: string, webhookId: string, limit?: number) =>
      request<BoardWebhookPayload[]>(`/boards/${boardId}/webhooks/${webhookId}/payloads${limit ? `?limit=${limit}` : ''}`),
    payload: (boardId: string, webhookId: string, payloadId: string) =>
      request<BoardWebhookPayload>(`/boards/${boardId}/webhooks/${webhookId}/payloads/${payloadId}`),
  },
  onboarding: {
    start: (boardId: string) =>
      request<BoardOnboardingSession>(`/boards/${boardId}/onboarding/start`, { method: 'POST' }),
    message: (boardId: string, sessionId: string, content: string) =>
      request<BoardOnboardingSession>(`/boards/${boardId}/onboarding/message`, { method: 'POST', body: JSON.stringify({ sessionId, content }) }),
    get: (boardId: string) => request<BoardOnboardingSession | null>(`/boards/${boardId}/onboarding`),
    confirm: (boardId: string, sessionId: string) =>
      request<BoardOnboardingSession>(`/boards/${boardId}/onboarding/confirm`, { method: 'POST', body: JSON.stringify({ sessionId }) }),
  },
  boardGroupMemory: {
    list: (groupId: string, limit?: number) =>
      request<BoardGroupMemory[]>(`/board-groups/${groupId}/memory${limit ? `?limit=${limit}` : ''}`),
    add: (groupId: string, data: { content: string; tags?: string[]; isChat?: boolean; source?: string }) =>
      request<BoardGroupMemory>(`/board-groups/${groupId}/memory`, { method: 'POST', body: JSON.stringify(data) }),
    delete: (groupId: string, memoryId: string) =>
      request<void>(`/board-groups/${groupId}/memory/${memoryId}`, { method: 'DELETE' }),
  },
  soulTemplates: {
    list: (category?: string) => request<SoulTemplate[]>(`/soul-templates${category ? `?category=${category}` : ''}`),
    get: (id: string) => request<SoulTemplate>(`/soul-templates/${id}`),
    create: (data: { name: string; category?: string; description?: string; content: string }) =>
      request<SoulTemplate>('/soul-templates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Record<string, unknown>) =>
      request<SoulTemplate>(`/soul-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) => request<void>(`/soul-templates/${id}`, { method: 'DELETE' }),
    search: (q: string) => request<SoulTemplate[]>(`/soul-templates/search?q=${encodeURIComponent(q)}`),
  },
  invites: {
    list: () => request<OrgInvite[]>('/org/invites'),
    create: (data: { invitedEmail: string; role?: string; allBoardsRead?: boolean; allBoardsWrite?: boolean }) =>
      request<OrgInvite>('/org/invites', { method: 'POST', body: JSON.stringify(data) }),
    revoke: (id: string) => request<void>(`/org/invites/${id}`, { method: 'DELETE' }),
    accept: (token: string) => request('/org/invites/' + token + '/accept', { method: 'POST' }),
  },
};
