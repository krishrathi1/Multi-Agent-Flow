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

    const { commit, branch, repo } = req.body || {};
    const repoName = typeof repo === 'string' ? repo.trim() : '';

    if (!repoName) {
      return res.status(400).json({ error: 'Repository name ("repo") is required in webhook payload' });
    }

    // Idempotency check via X-GitHub-Delivery or commit SHA
    const deliveryId = (req.headers['x-github-delivery'] as string) || (typeof commit === 'string' ? commit : null);
    if (deliveryId) {
      const existing = processedDeliveries.get(deliveryId);
      if (existing && Date.now() - existing < 300_000) {
        return res.status(200).json({ status: 'duplicate_delivery', message: 'Delivery already processed', deliveryId });
      }
      processedDeliveries.set(deliveryId, Date.now());
    }

    logger.info({ commit, branch, repo: repoName }, 'Received authenticated Git push trigger');

    // Exact process matching: require explicit processId, or exact match on Process name
    const requestedProcessId = (req.query.processId as string) || req.body?.processId;
    const requestedOrgId = (req.headers['x-organization-id'] as string) || (req.query.orgId as string);

    let proc = null;
    if (requestedProcessId) {
      proc = await prisma.process.findFirst({
        where: {
          id: requestedProcessId,
          ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
        },
      });
    } else {
      proc = await prisma.process.findFirst({
        where: {
          name: { equals: repoName, mode: 'insensitive' },
          ...(requestedOrgId ? { organizationId: requestedOrgId } : {}),
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

    // Check if already running
    if (runner.isRunning(proc.id)) {
      return res.status(409).json({ status: 'already_running', processId: proc.id });
    }

    const emit = (event: string, payload: unknown) => {
      req.app.get('io')?.to(`org:${proc.organizationId}`).emit(event, payload);
    };

    // Trigger run immediately in background
    const runStatus = runner.startChainRun(proc.id, proc.organizationId, emit);
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
