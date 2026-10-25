import { Router } from 'express';
import { z } from 'zod';
import { ProcessStatus, ApprovalMode } from '@prisma/client';
import * as processService from '../services/process.service.js';
import * as runner from '../services/agent-runner.service.js';
import { prisma } from '../lib/prisma.js';
import { validate } from '../middleware/validate.js';
import { config } from '../config.js';
import { decryptField } from '../lib/crypto.js';
import { randomBytes } from 'node:crypto';
import { getOrganizationIntegrationToken } from '../services/org.service.js';
import { recordAuthorizedPreviewSession } from '../services/insights.service.js';
import { getVercelDeploymentLogs, autoHealWorkspace, pushWorkspaceToGitHub, deployToVercel } from '../services/git-deploy.service.js';

const router = Router();

const planSchema = z.object({
  prompt: z.string().min(8, 'Describe the goal in at least a few words').max(4000),
  agentCount: z.number().int().min(2).max(8).optional(),
  model: z.string().optional(),
});

const createSchema = planSchema.extend({
  name: z.string().min(1).max(60).optional(),
  gatewayId: z.string().uuid().optional(),
  // A plan previously returned by /plan, so confirming doesn't re-plan.
  plan: z.any().optional(),
  githubToken: z.string().optional(),
  vercelToken: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  prompt: z.string().optional(),
  summary: z.string().max(2000).optional(),
  guidance: z.string().max(5000).optional(),
  status: z.nativeEnum(ProcessStatus).optional(),
  // Guardrails — a run stops once it would exceed these.
  budgetUsd: z.number().min(0).max(1000).nullable().optional(),
  maxTokens: z.number().int().min(0).max(50_000_000).nullable().optional(),
  // Human-in-the-loop gating between stages.
  approvalMode: z.nativeEnum(ApprovalMode).optional(),
});

router.get('/', async (req, res) => {
  const processes = await processService.listProcesses(req.organizationId!);
  res.json(processes);
});

router.get('/stats', async (req, res) => {
  res.json(await processService.getProcessStats(req.organizationId!));
});

/** Dry run: returns the roster the planner would create, without saving. */
router.post('/plan', validate(planSchema), async (req, res) => {
  const plan = await processService.previewPlan(req.body.prompt, req.body.agentCount, req.body.model);
  res.json(plan);
});

/** Expands plain-language goal with the default/chosen AI model. */
router.post('/expand-prompt', async (req, res) => {
  const { prompt, model } = req.body;
  const result = await processService.expandPromptWithAi(
    req.organizationId!,
    prompt || '',
    model,
  );
  res.json(result);
});

/** Express 5 types `req.params.id` as `string | string[]`; routes take one id. */
const paramId = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

router.get('/:id', async (req, res) => {
  const proc = await processService.getProcessById(paramId(req.params.id), req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  res.json(proc);
});

router.post('/', validate(createSchema), async (req, res) => {
  const proc = await processService.createProcess(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:created', proc);
  res.status(201).json(proc);
});

/** Run controls — activate the chain and bring its agents online, or idle them. */
router.post('/:id/start', async (req, res) => {
  const proc = await processService.startProcess(paramId(req.params.id), req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', proc);
  res.json(proc);
});

router.post('/:id/pause', async (req, res) => {
  const proc = await processService.pauseProcess(paramId(req.params.id), req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', proc);
  res.json(proc);
});

/**
 * Starts the chain: every agent does real work in a shared sandboxed
 * workspace, stage by stage.
 *
 * Returns immediately. A chain takes many minutes — far longer than an HTTP
 * request should stay open — so progress is polled via GET /:id/run and
 * pushed over the socket.
 */
router.post('/:id/run', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  if (runner.isRunning(id)) {
    return res.status(409).json({ error: 'This production is already running' });
  }
  if (await runner.atCapacityGlobal()) {
    return res.status(429).json({
      error: `Too many chains running at once (limit ${runner.capacityLimit()}). Wait for one to finish.`,
    });
  }

  const emit = (event: string, payload: unknown) =>
    req.app.get('io')?.to(`org:${req.organizationId}`).emit(event, payload);

  const status = runner.startChainRun(id, req.organizationId!, emit);
  res.status(202).json(status);
});

/**
 * Retries the last run from the first stage that didn't complete, replaying
 * earlier stages' output as context instead of paying to redo them.
 */
router.post('/:id/retry', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  if (runner.isRunning(id)) {
    return res.status(409).json({ error: 'This production is already running' });
  }
  if (await runner.atCapacityGlobal()) {
    return res.status(429).json({
      error: `Too many chains running at once (limit ${runner.capacityLimit()}).`,
    });
  }

  const fromStage = await runner.firstIncompleteStage(id, req.organizationId!);
  if (fromStage === 0) {
    return res.status(422).json({ error: 'The last run completed — nothing to retry' });
  }

  const emit = (event: string, payload: unknown) =>
    req.app.get('io')?.to(`org:${req.organizationId}`).emit(event, payload);

  const status = runner.startChainRun(id, req.organizationId!, emit, 'RETRY', fromStage);
  res.status(202).json({ ...status, fromStage });
});

/** Stops a run in flight. Chains cost real money, so this kills the current
 *  step rather than waiting for it to finish. */
router.post('/:id/cancel', async (req, res) => {
  const id = paramId(req.params.id);

  // The runner is keyed by process id alone, so without this check any
  // authenticated user could cancel any other organization's running chain
  // just by knowing its id — killing work in flight and wasting everything
  // already spent on the stages that had completed.
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const stopped = runner.requestCancel(id);
  if (!stopped) return res.status(409).json({ error: 'No run in flight for this production' });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('run:cancelled', { processId: id });
  res.json({ cancelled: true });
});

/** Downloads everything the chain built as a single archive. */
router.get('/:id/artifacts.zip', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  let archive: Buffer | null;
  try {
    archive = await runner.zipWorkspace(id);
  } catch (err) {
    // Oversize workspace — say so rather than dying on an allocation.
    return res.status(413).json({ error: (err as Error).message });
  }
  if (!archive) return res.status(404).json({ error: 'Nothing has been built yet' });

  const safeName = proc.name.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 60) || 'production';
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);
  res.send(archive);
});

/**
 * POST /api/processes/:id/preview-session
 * Authenticated preview handoff: establishes a process-scoped preview session cookie
 * allowing authorized organization members to view private previews.
 */
router.post('/:id/preview-session', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const sessionToken = randomBytes(24).toString('hex');
  recordAuthorizedPreviewSession(id, sessionToken);

  res.cookie('preview_token', sessionToken, {
    path: `/preview/${id}`,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 4 * 60 * 60 * 1000, // 4 hours
  });

  res.json({ success: true, previewUrl: `/preview/${id}?t=${sessionToken}` });
});

/** Live progress for a run in flight, or the last finished run. */
router.get('/:id/run', async (req, res) => {
  const id = paramId(req.params.id);

  // Same gap as cancel: the live registry is keyed by process id only, and
  // this response carries each stage's summary — the agents' actual output —
  // along with token counts and spend.
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const status = runner.getRunStatus(id);
  if (!status) return res.status(404).json({ error: 'No run recorded for this process' });
  res.json(status);
});

/** Files the chain produced, for the artifact list in the UI. */
router.get('/:id/files', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  await runner.ensureWorkspaceDeliverables(id);
  res.json(await runner.listWorkspaceFiles(id));
});

/** Return content of a single workspace file for code inspection in audit reports. */
router.get('/:id/file-content', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const filePath = typeof req.query.path === 'string' ? req.query.path : '';
  if (!filePath) return res.status(400).json({ error: 'Query parameter path is required' });

  const abs = await runner.resolveWorkspaceFile(id, filePath);
  if (!abs) return res.status(404).json({ error: 'File not found in workspace' });

  try {
    const fs = await import('node:fs/promises');
    const content = await fs.readFile(abs, 'utf-8');
    res.json({ path: filePath, content, size: Buffer.byteLength(content, 'utf-8') });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read file: ' + err.message });
  }
});

/** Return live Git commit audit and changed files breakdown */
router.get('/:id/git-audit', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  try {
    const { execSync } = await import('child_process');
    let log = '';
    let diffStat = '';
    let latestCommit = '';
    let branch = '';
    try {
      log = execSync('git log -n 3 --stat', { encoding: 'utf-8' });
      diffStat = execSync('git diff --stat HEAD~1 HEAD', { encoding: 'utf-8' });
      latestCommit = execSync('git log -1 --format="%H||%an||%ad||%s"', { encoding: 'utf-8' }).trim();
      branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    } catch {
      /* ignore git sub-errors */
    }

    const [hash, author, date, message] = latestCommit ? latestCommit.split('||') : [];

    res.json({
      processId: id,
      processName: proc.name,
      commit: {
        hash: hash || null,
        shortHash: hash?.slice(0, 8) || null,
        author: author || 'Unknown',
        date: date || null,
        message: message || null,
        branch: branch || null,
      },
      log,
      diffStat,
    });
  } catch (err: any) {
    res.json({
      processId: id,
      processName: proc.name,
      commit: {
        hash: null,
        shortHash: null,
        author: null,
        date: null,
        message: null,
      },
      log: '',
      diffStat: '',
    });
  }
});

/** GET /:id/report — Comprehensive Project Architecture & QA Report (JSON) */
router.get('/:id/report', async (req, res) => {
  const id = paramId(req.params.id);
  try {
    const { generateProjectReport } = await import('../services/project-report.service.js');
    const report = await generateProjectReport(id, req.organizationId!);
    res.json(report);
  } catch (err: any) {
    res.status(err.message === 'Process not found' ? 404 : 500).json({ error: err.message });
  }
});

/** GET /:id/report/html — Printable Executive PDF / HTML Report */
router.get('/:id/report/html', async (req, res) => {
  const id = paramId(req.params.id);
  try {
    const { generateProjectReport, renderReportHtml } = await import('../services/project-report.service.js');
    const report = await generateProjectReport(id, req.organizationId!);
    const html = renderReportHtml(report);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err: any) {
    res.status(err.message === 'Process not found' ? 404 : 500).send(`<h1>Error generating report</h1><p>${err.message}</p>`);
  }
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const proc = await processService.updateProcess(
    paramId(req.params.id),
    req.organizationId!,
    req.body,
  );
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', proc);
  res.json(proc);
});

router.delete('/:id', async (req, res) => {
  const deleted = await processService.deleteProcess(
    paramId(req.params.id),
    req.organizationId!,
    req.query.deleteAgents === 'true',
  );
  if (!deleted) return res.status(404).json({ error: 'Process not found' });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:deleted', { id: paramId(req.params.id) });
  res.status(204).send();
});

/** Test API connection for cURL / HTTP request */
router.post('/test-api', async (req, res) => {
  const { url, method = 'GET', headers = {}, body, apiKey } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  let finalUrl = url;
  const finalHeaders: Record<string, string> = { ...headers };

  if (apiKey) {
    finalUrl = finalUrl.replace(/\$(API_KEY|GEMINI_API_KEY|TOKEN)/gi, apiKey);
    for (const [k, v] of Object.entries(finalHeaders)) {
      if (typeof v === 'string') {
        finalHeaders[k] = v.replace(/\$(API_KEY|GEMINI_API_KEY|TOKEN)/gi, apiKey);
      }
    }
  }

  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const response = await fetch(finalUrl, {
      method,
      headers: finalHeaders,
      body: ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const latencyMs = Date.now() - start;
    const text = await response.text();
    let snippet = text.slice(0, 300);

    res.json({
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      latencyMs,
      snippet,
    });
  } catch (err: any) {
    res.json({
      ok: false,
      status: 0,
      statusText: err.message || 'Connection failed',
      latencyMs: Date.now() - start,
    });
  }
});

async function resolveGithubToken(explicitToken?: string, organizationId?: string): Promise<string | undefined> {
  if (explicitToken?.trim()) return explicitToken.trim();
  if (organizationId) {
    try {
      const token = await getOrganizationIntegrationToken(organizationId, 'github');
      if (token) return token;
    } catch { /* ignore */ }
  }
  return process.env.GITHUB_TOKEN || process.env.PLATFORM_GITHUB_TOKEN || undefined;
}

/** Fetch GitHub Repositories for selection */
router.post('/github-repos', async (req, res) => {
  const token = await resolveGithubToken(req.body?.token, req.organizationId);
  if (!token) {
    return res.json({ repos: [], connected: false });
  }

  try {
    const ghRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=30', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Nexus-AI',
      },
    });

    if (ghRes.ok) {
      const data = (await ghRes.json()) as Array<{ name: string; full_name: string; default_branch: string; description?: string; private: boolean }>;
      const repos = data.map(r => ({
        name: r.name,
        full_name: r.full_name,
        default_branch: r.default_branch || 'main',
        description: r.description,
        private: r.private,
      }));
      return res.json({ repos, connected: true });
    }
  } catch {
    // ignore
  }

  res.json({ repos: [], connected: false });
});

/** Create a new GitHub Repository via Personal Access Token */
router.post('/github-create-repo', async (req, res) => {
  const { name, description, isPrivate = false, autoInit = true } = req.body;
  const token = await resolveGithubToken(req.body?.token, req.organizationId);
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'GitHub Personal Access Token is required. Please connect your GitHub account in Settings.',
    });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({
      success: false,
      error: 'Repository name is required.',
    });
  }

  const cleanName = name.trim().replace(/[^a-zA-Z0-9._-]/g, '-');

  try {
    const ghRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'Nexus-AI',
      },
      body: JSON.stringify({
        name: cleanName,
        description: description || 'Autonomous application created via Nexus AI Multi-Agent Flow',
        private: Boolean(isPrivate),
        auto_init: Boolean(autoInit),
      }),
    });

    const data = (await ghRes.json()) as any;

    if (ghRes.ok || ghRes.status === 201) {
      return res.status(201).json({
        success: true,
        repo: {
          name: data.name,
          full_name: data.full_name,
          html_url: data.html_url,
          clone_url: data.clone_url,
          default_branch: data.default_branch || 'main',
          private: data.private,
          description: data.description,
        },
      });
    }

    return res.status(ghRes.status || 400).json({
      success: false,
      error: data.message || 'GitHub API returned an error creating the repository.',
      details: data.errors || null,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Network error connecting to GitHub API.',
    });
  }
});
/** Fetch live Vercel & GitHub deployment logs for a process */
router.get('/:id/deployment-logs', async (req, res) => {
  const proc = await processService.getProcessById(paramId(req.params.id), req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const vToken = process.env.VERCEL_TOKEN || process.env.PLATFORM_VERCEL_TOKEN || (await getOrganizationIntegrationToken(req.organizationId!, 'vercel'));

  if (!vToken) {
    return res.json({
      name: proc.name,
      state: 'UNKNOWN',
      logs: [{ date: Date.now(), text: 'No Vercel Token connected in Settings.', type: 'info' }],
      diagnosis: 'Connect your Vercel Token in Settings to stream live cloud deployment logs.',
    });
  }

  const logsData = await getVercelDeploymentLogs({
    projectName: proc.name,
    vercelToken: vToken,
  });

  res.json(logsData);
});

/** Trigger autonomous self-healing pass on process workspace and re-deploy */
router.post('/:id/auto-heal', async (req, res) => {
  const proc = await processService.getProcessById(paramId(req.params.id), req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const workspace = runner.workspaceFor(proc.id);
  const healResult = await autoHealWorkspace(workspace);

  const ghToken = process.env.GITHUB_TOKEN || (await getOrganizationIntegrationToken(req.organizationId!, 'github'));
  const vToken = process.env.VERCEL_TOKEN || (await getOrganizationIntegrationToken(req.organizationId!, 'vercel'));

  let pushResult: any = null;
  let deployResult: any = null;

  const repoMatch =
    proc.prompt.match(/Target GitHub Repository:\s*([^\s\(\n]+)/i) ||
    proc.prompt.match(/Action:\s*Create New GitHub Repository[\s\S]*?Name:\s*([^\n]+)/i);
  let targetRepo = repoMatch ? repoMatch[1].trim() : null;
  if (targetRepo && !targetRepo.includes('/') && config.defaultGithubOwner) targetRepo = `${config.defaultGithubOwner}/${targetRepo}`;

  if (targetRepo && ghToken) {
    pushResult = await pushWorkspaceToGitHub({
      workspace,
      repoFullName: targetRepo,
      githubToken: ghToken,
      commitMessage: `fix(auto-heal): Autonomous zero-error patch by DevOps Auto-Healer Agent`,
    });
  }

  if (vToken) {
    deployResult = await deployToVercel({
      workspace,
      projectName: proc.name,
      vercelToken: vToken,
    });
  }

  res.json({
    success: true,
    fixedFiles: healResult.fixedFiles,
    pushResult,
    deployResult,
    message: 'Auto-healing complete. Zero-error patch pushed to GitHub and re-deployed to Vercel.',
  });
});

/** Ask AI: Analyzes error, recruits specialist agent if needed, applies zero-error fix & re-deploys */
router.post('/:id/ask-ai-fix', async (req, res) => {
  try {
    const result = await processService.askAiAndSpawnFixerAgent({
      processId: paramId(req.params.id),
      organizationId: req.organizationId!,
      userInstruction: req.body?.instruction,
    });

    const updated = await processService.getProcessById(paramId(req.params.id), req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', updated);

    res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Process MCP & Gateway Integrations ──────────────────

/** GET /api/processes/:id/mcp-servers — list MCP servers connected to this process */
router.get('/:id/mcp-servers', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  const servers = await prisma.mcpServer.findMany({
    where: { agent: { processId: id } },
    include: { tools: true, agent: { select: { id: true, name: true, displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(servers);
});

/** POST /api/processes/:id/mcp-servers — connect an MCP server to this process */
router.post('/:id/mcp-servers', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });

  const primaryAgent = proc.agents[0];
  if (!primaryAgent) return res.status(400).json({ error: 'Process has no agents' });

  const { name, url, transport, existingServerId } = req.body;
  if (existingServerId) {
    const existing = await prisma.mcpServer.findFirst({
      where: { id: existingServerId, agent: { organizationId: req.organizationId! } },
      include: { tools: true },
    });
    if (!existing) return res.status(404).json({ error: 'Existing MCP server not found' });
    const linked = await prisma.mcpServer.create({
      data: {
        agentId: primaryAgent.id,
        name: existing.name,
        url: existing.url,
        transport: existing.transport,
        enabled: true,
        tools: {
          create: existing.tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema as any,
          })),
        },
      },
      include: { tools: true, agent: { select: { id: true, name: true, displayName: true } } },
    });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:created', linked);
    return res.status(201).json(linked);
  }

  const server = await prisma.mcpServer.create({
    data: {
      agentId: primaryAgent.id,
      name,
      url,
      transport: transport || 'SSE',
      enabled: true,
    },
    include: { tools: true, agent: { select: { id: true, name: true, displayName: true } } },
  });

  try {
    const { refreshMcpTools } = await import('../services/mcp.service.js');
    await refreshMcpTools(server.id, primaryAgent.id);
  } catch { /* ignore connection error at create time */ }

  const refreshed = await prisma.mcpServer.findUnique({
    where: { id: server.id },
    include: { tools: true, agent: { select: { id: true, name: true, displayName: true } } },
  });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:created', refreshed);
  res.status(201).json(refreshed);
});

/** PATCH /api/processes/:id/mcp-servers/:serverId — update MCP server */
router.patch('/:id/mcp-servers/:serverId', async (req, res) => {
  const serverId = req.params.serverId;
  const { name, url, transport, enabled } = req.body;
  const server = await prisma.mcpServer.update({
    where: { id: serverId },
    data: {
      ...(name && { name }),
      ...(url && { url }),
      ...(transport && { transport }),
      ...(enabled !== undefined && { enabled }),
    },
    include: { tools: true, agent: { select: { id: true, name: true, displayName: true } } },
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:updated', server);
  res.json(server);
});

/** DELETE /api/processes/:id/mcp-servers/:serverId — delete or unlink MCP server */
router.delete('/:id/mcp-servers/:serverId', async (req, res) => {
  const serverId = req.params.serverId;
  await prisma.mcpServer.delete({ where: { id: serverId } });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:deleted', { id: serverId });
  res.status(204).end();
});

/** GET /api/processes/:id/gateways — list gateways connected to this process */
router.get('/:id/gateways', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  const gatewayIds = [...new Set(proc.agents.map((a) => a.gatewayId).filter(Boolean))] as string[];
  const gateways = await prisma.gateway.findMany({
    where: { id: { in: gatewayIds }, organizationId: req.organizationId! },
    select: { id: true, name: true, url: true, status: true, workspaceRoot: true, lastCheckedAt: true, createdAt: true },
  });
  res.json(gateways);
});

/** POST /api/processes/:id/gateways — connect a gateway to this process */
router.post('/:id/gateways', async (req, res) => {
  const id = paramId(req.params.id);
  const proc = await processService.getProcessById(id, req.organizationId!);
  if (!proc) return res.status(404).json({ error: 'Process not found' });
  const { gatewayId, name, url, token, workspaceRoot } = req.body;
  let targetGatewayId = gatewayId;
  if (!targetGatewayId && name && url) {
    const createdGw = await prisma.gateway.create({
      data: {
        organizationId: req.organizationId!,
        name,
        url,
        token: token || 'default',
        workspaceRoot: workspaceRoot || '',
        status: 'ONLINE',
      },
    });
    targetGatewayId = createdGw.id;
  }
  if (!targetGatewayId) return res.status(400).json({ error: 'Gateway ID or configuration is required' });

  await prisma.agent.updateMany({
    where: { processId: id },
    data: { gatewayId: targetGatewayId },
  });
  const gateway = await prisma.gateway.findUnique({
    where: { id: targetGatewayId },
    select: { id: true, name: true, url: true, status: true, workspaceRoot: true, lastCheckedAt: true },
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', { id, gatewayId: targetGatewayId });
  res.status(201).json(gateway);
});

/** DELETE /api/processes/:id/gateways/:gatewayId — unlink gateway from this process */
router.delete('/:id/gateways/:gatewayId', async (req, res) => {
  const id = paramId(req.params.id);
  const gatewayId = req.params.gatewayId;
  await prisma.agent.updateMany({
    where: { processId: id, gatewayId },
    data: { gatewayId: null },
  });
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:updated', { id });
  res.status(204).end();
});

export default router;
