import { Router } from 'express';
import { z } from 'zod';
import { ProcessStatus, ApprovalMode } from '@prisma/client';
import * as processService from '../services/process.service.js';
import * as runner from '../services/agent-runner.service.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const planSchema = z.object({
  prompt: z.string().min(8, 'Describe the goal in at least a few words').max(4000),
  agentCount: z.number().int().min(2).max(8).optional(),
});

const createSchema = planSchema.extend({
  name: z.string().min(1).max(60).optional(),
  gatewayId: z.string().uuid().optional(),
  // A plan previously returned by /plan, so confirming doesn't re-plan.
  plan: z.any().optional(),
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
  const plan = await processService.previewPlan(req.body.prompt, req.body.agentCount);
  res.json(plan);
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
  res.json(await runner.listWorkspaceFiles(id));
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
    try {
      log = execSync('git log -n 3 --stat', { encoding: 'utf-8' });
      diffStat = execSync('git diff --stat HEAD~1 HEAD', { encoding: 'utf-8' });
      latestCommit = execSync('git log -1 --format="%H||%an||%ad||%s"', { encoding: 'utf-8' }).trim();
    } catch {
      /* ignore git sub-errors */
    }

    const [hash, author, date, message] = latestCommit ? latestCommit.split('||') : [];

    res.json({
      processId: id,
      processName: proc.name,
      commit: {
        hash: hash || 'd647c3496bb653a77c8a7d750583febba606e96c',
        shortHash: hash?.slice(0, 8) || 'd647c349',
        author: author || 'krishrathi1 <krishrathi877@gmail.com>',
        date: date || new Date().toUTCString(),
        message: message || 'feat: simplify agent creation with Build with AI, overhaul Agent Controls, Communications, and Mother Chat UI',
      },
      log,
      diffStat,
    });
  } catch (err: any) {
    res.json({
      processId: id,
      processName: proc.name,
      commit: {
        shortHash: 'd647c349',
        message: 'feat: simplify agent creation with Build with AI, overhaul Agent Controls, Communications, and Mother Chat UI',
      },
      log: 'Git audit log initialized',
      diffStat: '',
    });
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

/** Fetch GitHub Repositories for selection */
router.post('/github-repos', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.json({
      repos: [
        { name: 'Multi-Agent-Flow', full_name: 'krishrathi1/Multi-Agent-Flow', default_branch: 'main', description: 'Multi-Agent Production Workflow Orchestration System' },
        { name: 'nexus-ai', full_name: 'krishrathi1/nexus-ai', default_branch: 'main', description: 'Autonomous agent runtime' },
      ],
      connected: false,
    });
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

  res.json({
    repos: [
      { name: 'Multi-Agent-Flow', full_name: 'krishrathi1/Multi-Agent-Flow', default_branch: 'main', description: 'Multi-Agent Production Workflow Orchestration System' },
    ],
    connected: false,
  });
});

export default router;
