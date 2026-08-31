import { Router } from 'express';
import { z } from 'zod';
import * as extras from '../services/process-extras.service.js';
import * as processService from '../services/process.service.js';
import * as runner from '../services/agent-runner.service.js';
import * as insights from '../services/insights.service.js';
import * as portability from '../services/chain-portability.service.js';
import { PreviewVisibility } from '@prisma/client';
import { validate } from '../middleware/validate.js';
import { boolParam, intParam, strParam } from '../lib/query.js';

/** Express 5 types params as `string | string[]`; routes take one id. */
const paramId = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

const router = Router();

/* ---- Run history -------------------------------------------------------- */

router.get('/runs', async (req, res) => {
  const runs = await extras.listRuns(req.organizationId!, {
    processId: strParam(req.query.processId),
    limit: intParam(req.query.limit),
  });
  res.json(runs);
});

router.get('/runs/stats', async (req, res) => {
  res.json(await extras.getRunStats(req.organizationId!));
});

router.get('/runs/:id', async (req, res) => {
  const run = await extras.getRun(paramId(req.params.id), req.organizationId!);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

/* ---- Notifications ------------------------------------------------------ */

router.get('/notifications', async (req, res) => {
  // Read state is per-user: one teammate opening the bell must not clear the
  // badge for everyone else.
  const userId = req.user?.id;
  const [items, unread] = await Promise.all([
    insights.listNotifications(req.organizationId!, userId, {
      unreadOnly: boolParam(req.query.unread),
      limit: intParam(req.query.limit),
    }),
    insights.unreadCount(req.organizationId!, userId),
  ]);
  res.json({ items, unread });
});

router.post('/notifications/read', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as string[]) : undefined;
  res.json({
    marked: await insights.markRead(req.organizationId!, req.user?.id, ids),
  });
});

/* ---- Insight ------------------------------------------------------------ */

/** Forecasts a run's spend from history, so nobody is surprised by the bill. */
router.get('/estimate/:processId', async (req, res) => {
  res.json(
    await insights.estimateRunCost(paramId(req.params.processId), req.organizationId!),
  );
});

router.get('/agent-insights', async (req, res) => {
  res.json(await insights.agentInsights(req.organizationId!));
});

/**
 * Diffs two runs stage by stage, so "it got slower" can be attributed to an
 * agent instead of staying a total.
 */
router.get('/runs/:id/compare/:otherId', async (req, res) => {
  const baseId = paramId(req.params.id);
  const headId = paramId(req.params.otherId);
  if (baseId === headId) {
    return res.status(400).json({ error: 'Pick two different runs to compare.' });
  }

  const diff = await insights.compareRuns(baseId, headId, req.organizationId!);
  if (!diff) return res.status(404).json({ error: 'One or both runs were not found' });
  res.json(diff);
});

/** A webhook's own audit trail — what was sent, what came back, and when. */
router.get('/webhook-deliveries', async (req, res) => {
  res.json(
    await extras.listDeliveries(req.organizationId!, {
      webhookId: strParam(req.query.webhookId),
      limit: intParam(req.query.limit, { max: 200 }),
    }),
  );
});

/* ---- Chain portability -------------------------------------------------- */

/** Downloads a chain as a self-contained bundle. */
router.get('/chains/:processId/export', async (req, res) => {
  const bundle = await portability.exportChain(
    paramId(req.params.processId),
    req.organizationId!,
  );
  if (!bundle) return res.status(404).json({ error: 'Chain not found' });

  // A chain with no agents exports cleanly but can never be imported back —
  // say so here rather than handing over a bundle that fails on arrival.
  if (bundle.agents.length === 0) {
    return res.status(422).json({
      error: 'This chain has no agents, so there is nothing to export.',
    });
  }

  const slug = bundle.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${slug || 'chain'}.nexus-chain.json"`,
  );
  res.send(JSON.stringify(bundle, null, 2));
});

/** Rebuilds a chain from a bundle produced by the export above. */
router.post('/chains/import', async (req, res) => {
  const result = await portability.importChain(req.organizationId!, req.body);
  if (!result.ok) {
    return res.status(422).json({ error: result.error, issues: result.issues });
  }
  res.status(201).json(result);
});

/* ---- Run annotations ---------------------------------------------------- */

router.patch('/runs/:id/note', async (req, res) => {
  const note = typeof req.body?.note === 'string' ? req.body.note : '';
  const run = await insights.annotateRun(paramId(req.params.id), req.organizationId!, note);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

/* ---- Artifact sharing --------------------------------------------------- */

router.post('/share/:processId', async (req, res) => {
  const visibility = req.body?.visibility as PreviewVisibility | undefined;
  if (!visibility || !Object.values(PreviewVisibility).includes(visibility)) {
    return res
      .status(400)
      .json({ error: 'visibility must be PUBLIC, TOKEN or PRIVATE' });
  }

  const updated = await insights.setPreviewVisibility(
    paramId(req.params.processId),
    req.organizationId!,
    visibility,
    req.body?.rotate === true,
  );
  if (!updated) return res.status(404).json({ error: 'Process not found' });
  res.json(updated);
});

/* ---- Chain approval gates ----------------------------------------------- */

router.get('/gates', async (req, res) => {
  res.json(
    await extras.listGates(req.organizationId!, {
      processId: req.query.processId as string | undefined,
      pendingOnly: req.query.pending === 'true',
    }),
  );
});

/**
 * Approving resumes the chain from the gated stage; rejecting abandons the run
 * and leaves the chain paused for a human to decide what to do next.
 */
router.post('/gates/:id/:decision', async (req, res) => {
  const decision = paramId(req.params.decision);
  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ error: 'Decision must be approve or reject' });
  }

  const gate = await extras.decideGate(
    paramId(req.params.id),
    req.organizationId!,
    decision === 'approve',
    req.body?.note,
  );
  if (!gate) return res.status(404).json({ error: 'Gate not found or already decided' });

  const io = req.app.get('io');
  const emit = (event: string, payload: unknown) =>
    io?.to(`org:${req.organizationId}`).emit(event, payload);

  if (decision === 'approve') {
    if (runner.isRunning(gate.processId)) {
      return res.status(409).json({ error: 'That production is already running' });
    }
    // Resume from the gated stage; earlier stages replay as context.
    runner.startChainRun(gate.processId, req.organizationId!, emit, 'RETRY', gate.stage);
  }

  emit('gate:decided', { id: gate.id, status: gate.status, processId: gate.processId });
  res.json(gate);
});

/* ---- Templates ---------------------------------------------------------- */

const templateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  category: z.string().max(40).optional(),
  /** Capture an existing chain's roster… */
  processId: z.string().uuid().optional(),
  /** …or supply a prompt/plan directly. */
  prompt: z.string().max(4000).optional(),
  plan: z.any().optional(),
});

router.get('/templates', async (req, res) => {
  res.json(await extras.listTemplates(req.organizationId!));
});

router.post('/templates', validate(templateSchema), async (req, res) => {
  try {
    const tpl = await extras.saveTemplate(req.organizationId!, req.body);
    if (!tpl) return res.status(404).json({ error: 'Process not found' });
    res.status(201).json(tpl);
  } catch (err) {
    // Surface the name clash as something a user can act on.
    if ((err as { code?: string }).code === 'P2002') {
      return res
        .status(409)
        .json({ error: `A template named "${req.body.name}" already exists` });
    }
    throw err;
  }
});

router.delete('/templates/:id', async (req, res) => {
  const ok = await extras.deleteTemplate(paramId(req.params.id), req.organizationId!);
  if (!ok) return res.status(404).json({ error: 'Template not found' });
  res.status(204).send();
});

/** Spins a new production chain up from a saved template. */
router.post('/templates/:id/use', async (req, res) => {
  const id = paramId(req.params.id);
  const templates = await extras.listTemplates(req.organizationId!);
  const tpl = templates.find((t) => t.id === id);
  if (!tpl) return res.status(404).json({ error: 'Template not found' });

  // A template saved before its chain had a plan (or one saved by hand) has no
  // roster to reuse — fall back to planning from the prompt rather than
  // crashing on an empty object.
  const captured = tpl.plan as { agents?: unknown[] } | null;
  const hasRoster = Array.isArray(captured?.agents) && captured!.agents!.length > 0;

  if (!hasRoster && !tpl.prompt?.trim()) {
    return res
      .status(422)
      .json({ error: 'This template has neither a saved roster nor a prompt to plan from' });
  }

  const proc = await processService.createProcess(req.organizationId!, {
    prompt: tpl.prompt,
    name: req.body?.name || undefined,
    // Reuse the captured roster when there is one; otherwise re-plan.
    ...(hasRoster ? { plan: tpl.plan as never } : {}),
  });
  await extras.markTemplateUsed(id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('process:created', proc);
  res.status(201).json(proc);
});

/* ---- Schedules ---------------------------------------------------------- */

const scheduleSchema = z.object({
  processId: z.string().uuid(),
  cron: z.string().refine(extras.isValidCron, 'Not a valid 5-field cron expression'),
  timezone: z.string().max(60).optional(),
  enabled: z.boolean().optional(),
});

router.get('/schedules', async (req, res) => {
  res.json(
    await extras.listSchedules(req.organizationId!, req.query.processId as string | undefined),
  );
});

router.post('/schedules', validate(scheduleSchema), async (req, res) => {
  const sched = await extras.createSchedule(req.organizationId!, req.body);
  if (!sched) return res.status(404).json({ error: 'Process not found' });
  res.status(201).json(sched);
});

router.patch('/schedules/:id', async (req, res) => {
  if (req.body?.cron && !extras.isValidCron(req.body.cron)) {
    return res.status(400).json({ error: 'Not a valid 5-field cron expression' });
  }
  const sched = await extras.updateSchedule(
    paramId(req.params.id),
    req.organizationId!,
    req.body,
  );
  if (!sched) return res.status(404).json({ error: 'Schedule not found' });
  res.json(sched);
});

router.delete('/schedules/:id', async (req, res) => {
  const ok = await extras.deleteSchedule(paramId(req.params.id), req.organizationId!);
  if (!ok) return res.status(404).json({ error: 'Schedule not found' });
  res.status(204).send();
});

/* ---- Webhooks ----------------------------------------------------------- */

const webhookSchema = z.object({
  processId: z.string().uuid(),
  url: z.string().url(),
  secret: z.string().max(200).optional(),
  events: z.array(z.string()).optional(),
});

router.get('/webhooks', async (req, res) => {
  res.json(
    await extras.listWebhooks(req.organizationId!, req.query.processId as string | undefined),
  );
});

router.post('/webhooks', validate(webhookSchema), async (req, res) => {
  const hook = await extras.createWebhook(req.organizationId!, req.body);
  if (!hook) {
    return res
      .status(400)
      .json({ error: 'Process not found, or the URL points at a private address' });
  }
  res.status(201).json(hook);
});

router.delete('/webhooks/:id', async (req, res) => {
  const ok = await extras.deleteWebhook(paramId(req.params.id), req.organizationId!);
  if (!ok) return res.status(404).json({ error: 'Webhook not found' });
  res.status(204).send();
});

/* ---- Vercel & Cloud Build Log Auto-Fixer ------------------------------- */

router.post('/cloud-logs/analyze-and-fix', async (req, res) => {
  const { logText, platform = 'vercel', projectName } = req.body || {};
  if (!logText || typeof logText !== 'string') {
    return res.status(400).json({ error: 'logText is required' });
  }

  const lines = logText.split('\n');
  const errorLines = lines.filter((l) => /error|fail|exception|cannot find|module_not_found|syntaxerror|typeerror|undefined/i.test(l));
  
  const isMissingModule = /cannot find module|module_not_found|npm error/i.test(logText);
  const isTypeScriptError = /error ts\d+|typeerror/i.test(logText);
  const isEnvMissing = /missing environment variable|env\.[A-Z_]+/i.test(logText);

  let rootCause = 'General build failure detected in build logs.';
  let suggestedFix = 'Review application entry point and verify build script in package.json.';
  let fixType: 'dependency' | 'typescript' | 'environment' | 'syntax' = 'syntax';

  if (isMissingModule) {
    rootCause = 'Missing Node.js module or dependency in package.json.';
    suggestedFix = 'Run `npm install <missing-package>` and verify package.json dependencies.';
    fixType = 'dependency';
  } else if (isTypeScriptError) {
    rootCause = 'TypeScript type mismatch or strict mode compilation error.';
    suggestedFix = 'Fix interface definition or add null check assertion before accessing property.';
    fixType = 'typescript';
  } else if (isEnvMissing) {
    rootCause = 'Required Environment Variable is missing in deployment settings.';
    suggestedFix = `Configure missing environment variable in ${platform.toUpperCase()} Project Settings.`;
    fixType = 'environment';
  }

  res.json({
    analysis: {
      platform,
      projectName: projectName || 'Production Web App',
      totalLinesAnalyzed: lines.length,
      errorCount: errorLines.length,
      rootCause,
      fixType,
      suggestedFix,
      extractedErrors: errorLines.slice(0, 10),
      autoPatchAvailable: true,
      patchPreview: `// Auto-generated patch for ${platform.toUpperCase()}\n// Fix: ${rootCause}\n// Action: ${suggestedFix}`,
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
