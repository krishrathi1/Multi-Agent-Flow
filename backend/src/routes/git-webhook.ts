import { Router } from 'express';
import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';
import * as runner from '../services/agent-runner.service.js';
import { logger } from '../lib/logger.js';

const router = Router();

// In-memory cache for webhook delivery deduplication (5-minute TTL)
const processedDeliveries = new Map<string, number>();

function verifyWebhookSignature(req: any): { valid: boolean; reason?: string } {
  const secret = process.env.GIT_WEBHOOK_SECRET;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const simpleSecret = req.headers['x-webhook-secret'] as string | undefined;

  // Webhook secret MUST be configured; fail closed if missing in any environment
  if (!secret) {
    return { valid: false, reason: 'GIT_WEBHOOK_SECRET not configured on server' };
  }

  if (signature && signature.startsWith('sha256=')) {
    if (!req.rawBody) {
      return { valid: false, reason: 'Raw request body not available for signature verification' };
    }
    const rawBuf = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(req.rawBody);
    const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBuf).digest('hex');
    try {
      const sigBuf = Buffer.from(signature);
      const expBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { valid: false, reason: 'Invalid X-Hub-Signature-256' };
      }
    } catch {
      return { valid: false, reason: 'Signature verification failure' };
    }
  } else if (simpleSecret) {
    try {
      const secBuf = Buffer.from(simpleSecret);
      const expBuf = Buffer.from(secret);
      if (secBuf.length !== expBuf.length || !crypto.timingSafeEqual(secBuf, expBuf)) {
        return { valid: false, reason: 'Invalid X-Webhook-Secret' };
      }
    } catch {
      return { valid: false, reason: 'Secret comparison failure' };
    }
  } else {
    return { valid: false, reason: 'Missing webhook signature or secret header' };
  }

  return { valid: true };
}

/**
 * Public trigger endpoint for Git push / commit events.
 * Enforces raw body HMAC signature verification, idempotency, and exact repository binding.
 */
router.post('/', async (req, res) => {
  try {
    const authCheck = verifyWebhookSignature(req);
    if (!authCheck.valid) {
      logger.warn({ reason: authCheck.reason, ip: req.ip }, 'Rejected unauthorized git webhook');
      return res.status(401).json({ error: 'Unauthorized', reason: authCheck.reason });
    }

    const body = req.body || {};

    // Standardize provider payloads: GitHub (repository.full_name, ref, after) & GitLab (project.path_with_namespace)
    const repoName = (
      body.repository?.full_name ||
      body.repository?.name ||
      body.project?.path_with_namespace ||
      body.repo ||
      ''
    ).trim();

    if (!repoName) {
      return res.status(400).json({ error: 'Repository name ("repository.full_name" or "repo") is required in webhook payload' });
    }

    const githubEvent = (req.headers['x-github-event'] || req.headers['x-gitlab-event']) as string | undefined;
    if (githubEvent === 'ping' || githubEvent === 'Ping Hook') {
      return res.status(200).json({ status: 'pong', message: 'Webhook ping received successfully' });
    }
    if (githubEvent && githubEvent !== 'push' && githubEvent !== 'Push Hook') {
      return res.status(200).json({ status: 'ignored', message: `Ignoring non-push event: ${githubEvent}` });
    }

    const rawRef = body.ref || body.branch || '';
    const parsedBranch = (typeof rawRef === 'string' ? rawRef.replace(/^refs\/heads\//, '') : '').trim();
    const rawCommit = body.after || body.head_commit?.id || body.checkout_sha || (typeof body.commit === 'string' ? body.commit : body.commit?.id) || '';
    const commit = (typeof rawCommit === 'string' ? rawCommit : String(rawCommit || '')).trim();

    // Idempotency check via X-GitHub-Delivery or commit SHA
    const deliveryId = (req.headers['x-github-delivery'] as string) || (commit || null);
    if (deliveryId) {
      const existing = processedDeliveries.get(deliveryId);
      if (existing && Date.now() - existing < 300_000) {
        return res.status(200).json({ status: 'duplicate_delivery', message: 'Delivery already processed', deliveryId });
      }
    }

    logger.info({ commit, branch: parsedBranch, repo: repoName }, 'Received authenticated Git push trigger');

    // Exact process matching: require explicit processId, or exact match on Process name / repo binding
    const requestedProcessId = (req.query.processId as string) || body.processId;
    const requestedOrgId = (req.headers['x-organization-id'] as string) || (req.query.orgId as string);

    let proc = null;
    if (requestedProcessId) {
      proc = await prisma.process.findFirst({
        where: {
          id: requestedProcessId,
          ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
        },
      });

      if (proc) {
        // Enforce exact repository binding: process must be associated with the incoming repository
        const procNameMatches = proc.name.toLowerCase() === repoName.toLowerCase();
        const procPromptMatches = proc.prompt.toLowerCase().includes(repoName.toLowerCase());
        const procSummaryMatches = proc.summary ? proc.summary.toLowerCase().includes(repoName.toLowerCase()) : false;

        if (!procNameMatches && !procPromptMatches && !procSummaryMatches) {
          logger.warn({ repo: repoName, processId: proc.id, processName: proc.name }, 'Webhook repo mismatch for process');
          return res.status(400).json({
            error: `Target repository "${repoName}" is not bound to process "${proc.name}" (${proc.id}). Request rejected.`,
          });
        }
      }
    } else {
      // Find process whose name equals repoName, or whose prompt specifies this repository
      proc = await prisma.process.findFirst({
        where: {
          ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
          OR: [
            { name: { equals: repoName, mode: 'insensitive' } },
            { prompt: { contains: repoName, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!proc) {
      logger.warn({ repo: repoName, requestedProcessId }, 'No process bound to target repository');
      return res.status(404).json({
        error: `No production process bound to repository "${repoName}". Webhook rejected without fallback.`,
      });
    }

    // Branch filter verification if process specifies a target branch
    const branchMatch = proc.prompt.match(/(?:Target Branch|Branch):\s*([^\s\n]+)/i);
    const targetBranch = branchMatch ? branchMatch[1].trim() : null;
    if (targetBranch && parsedBranch && targetBranch.toLowerCase() !== parsedBranch.toLowerCase()) {
      logger.info({ repo: repoName, parsedBranch, targetBranch }, 'Push skipped: branch does not match target branch');
      return res.status(200).json({
        status: 'skipped_branch',
        message: `Branch "${parsedBranch}" does not match configured target branch "${targetBranch}".`,
      });
    }

    // Check if already running
    if (runner.isRunning(proc.id)) {
      return res.status(409).json({ status: 'already_running', processId: proc.id });
    }

    const emit = (event: string, payload: unknown) => {
      req.app.get('io')?.to(`org:${proc.organizationId}`).emit(event, payload);
    };

    // Trigger run immediately in background
    const runStatus = runner.startChainRun(proc.id, proc.organizationId, emit);

    // Record idempotency only after successful durable scheduling
    if (deliveryId) {
      processedDeliveries.set(deliveryId, Date.now());
    }

    logger.info({ processId: proc.id, runId: runStatus.runId }, 'Autonomous pipeline triggered by authenticated git push');

    res.json({
      success: true,
      message: `Autonomous pipeline triggered for commit ${commit || 'HEAD'} on process ${proc.name}`,
      processId: proc.id,
      runStatus,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to process git webhook');
    res.status(500).json({ error: err.message });
  }
});

// Clean up stale idempotency entries periodically
setInterval(() => {
  const cutoff = Date.now() - 300_000;
  for (const [key, timestamp] of processedDeliveries) {
    if (timestamp < cutoff) processedDeliveries.delete(key);
  }
}, 60_000);

export default router;
