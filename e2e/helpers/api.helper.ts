import { request, type APIRequestContext } from '@playwright/test';

export class ApiHelper {
  private baseUrl: string;
  private token = '';

  constructor(baseUrl = process.env.E2E_API_URL || 'http://localhost:4000') {
    this.baseUrl = baseUrl;
  }

  /** Set the auth token directly (from shared-auth cache) */
  setToken(token: string) {
    this.token = token;
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  private async post(path: string, data?: unknown) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.post(path, { headers: this.headers, data });
    const json = await res.json();
    await ctx.dispose();
    return json;
  }

  private async get(path: string) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.get(path, { headers: this.headers });
    const json = await res.json();
    await ctx.dispose();
    return json;
  }

  private async patch(path: string, data: unknown) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.patch(path, { headers: this.headers, data });
    const json = await res.json();
    await ctx.dispose();
    return json;
  }

  private async del(path: string) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.delete(path, { headers: this.headers });
    await ctx.dispose();
    return res.status();
  }

  // ── Boards ─────────────────────────────────────────
  async createBoard(name: string, opts?: Record<string, unknown>) {
    return this.post('/api/boards', { name, boardType: 'goal', maxAgents: 5, ...opts });
  }

  async deleteBoard(id: string) {
    return this.del(`/api/boards/${id}`);
  }

  async updateBoard(id: string, data: Record<string, unknown>) {
    return this.patch(`/api/boards/${id}`, data);
  }

  // ── Tasks ──────────────────────────────────────────
  async createTask(title: string, opts?: Record<string, unknown>) {
    return this.post('/api/tasks', { title, priority: 'MEDIUM', ...opts });
  }

  async deleteTask(id: string) {
    return this.del(`/api/tasks/${id}`);
  }

  // ── Tags ───────────────────────────────────────────
  async createTag(name: string, color = '#3b82f6') {
    return this.post('/api/tags', { name, color });
  }

  async deleteTag(id: string) {
    return this.del(`/api/tags/${id}`);
  }

  async assignTags(taskId: string, tagIds: string[]) {
    return this.post('/api/tags/assign', { taskId, tagIds });
  }

  // ── Custom Fields ──────────────────────────────────
  async createCustomField(label: string, fieldKey: string, fieldType = 'TEXT') {
    return this.post('/api/custom-fields', { label, fieldKey, fieldType, uiVisibility: 'ALWAYS' });
  }

  async deleteCustomField(id: string) {
    return this.del(`/api/custom-fields/${id}`);
  }

  // ── Webhooks ───────────────────────────────────────
  async createWebhook(boardId: string, description = 'E2E test webhook') {
    return this.post(`/api/boards/${boardId}/webhooks`, { description });
  }

  async sendInboundWebhook(boardId: string, webhookId: string, secret: string, payload: unknown) {
    const ctx = await request.newContext({ baseURL: this.baseUrl });
    const res = await ctx.post(`/api/v1/webhooks/${boardId}/${webhookId}`, {
      headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': secret },
      data: payload,
    });
    const status = res.status();
    let json: any = null;
    try { json = await res.json(); } catch {}
    await ctx.dispose();
    return { status, data: json };
  }

  // ── Board Groups ───────────────────────────────────
  async createBoardGroup(name: string) {
    return this.post('/api/boards/groups', { name, description: 'E2E test group' });
  }

  async addGroupMemory(groupId: string, content: string, tags?: string[]) {
    return this.post(`/api/board-groups/${groupId}/memory`, { content, tags, source: 'e2e-test' });
  }

  // ── Soul Templates ─────────────────────────────────
  async createSoulTemplate(name: string, content: string, category = 'general') {
    return this.post('/api/soul-templates', { name, content, category, description: 'E2E test template' });
  }

  async deleteSoulTemplate(id: string) {
    return this.del(`/api/soul-templates/${id}`);
  }

  // ── Skills ─────────────────────────────────────────
  async createSkill(name: string, category = 'general', risk = 'low') {
    return this.post('/api/skills/marketplace', { name, category, risk, description: 'E2E test skill' });
  }

  // ── Invites ────────────────────────────────────────
  async createInvite(email: string, role = 'MEMBER') {
    return this.post('/api/org/invites', { invitedEmail: email, role });
  }

  async revokeInvite(id: string) {
    return this.del(`/api/org/invites/${id}`);
  }

  // ── Agents ─────────────────────────────────────────
  async listAgents() {
    return this.get('/api/agents');
  }

  async toggleA2A(agentId: string, enabled: boolean) {
    return this.patch(`/api/agents/${agentId}/a2a`, { enabled });
  }

  // ── Onboarding ─────────────────────────────────────
  async startOnboarding(boardId: string) {
    return this.post(`/api/boards/${boardId}/onboarding/start`);
  }
}
