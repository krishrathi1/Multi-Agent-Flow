import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import * as runner from '../services/agent-runner.service.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * Public trigger endpoint for Git push / commit events.
 * Can be called by:
 * 1. Local .git/hooks/post-commit or pre-push
 * 2. GitHub Webhook on push event
 * 3. Background Git Watcher service
 */
router.post('/', async (req, res) => {
  try {
    const { commit, branch, repo } = req.body || {};
    logger.info({ commit, branch, repo }, 'Received Git push / commit auto-trigger');

    // Find target production process
    let proc = await prisma.process.findFirst({
      where: {
        OR: [
          { name: { contains: 'Multi-Agent-Flow', mode: 'insensitive' } },
          { prompt: { contains: 'Multi-Agent-Flow', mode: 'insensitive' } },
          { name: { contains: 'Review', mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!proc) {
      proc = await prisma.process.findFirst({ orderBy: { updatedAt: 'desc' } });
    }

    if (!proc) {
      return res.status(404).json({ error: 'No production process found to run review' });
    }

    // Check if already running
    if (runner.isRunning(proc.id)) {
      return res.json({ status: 'already_running', processId: proc.id });
    }

    const emit = (event: string, payload: unknown) => {
      req.app.get('io')?.to(`org:${proc.organizationId}`).emit(event, payload);
    };

    // Trigger run immediately in background
    const runStatus = runner.startChainRun(proc.id, proc.organizationId, emit);
    logger.info({ processId: proc.id, runId: runStatus.runId }, 'Autonomous agent pipeline triggered automatically by git push');

    res.json({
      success: true,
      message: `Autonomous review triggered for commit ${commit || 'HEAD'} on process ${proc.name}`,
      processId: proc.id,
      runStatus,
    });
  } catch (err: any) {
    logger.error({ err }, 'Failed to auto-trigger git review');
    res.status(500).json({ error: err.message });
  }
});

export default router;
