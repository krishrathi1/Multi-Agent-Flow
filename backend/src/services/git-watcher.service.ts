import { execSync } from 'child_process';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import * as runner from './agent-runner.service.js';
import { logger } from '../lib/logger.js';

let lastProcessedCommit: string | null = null;
let watcherInterval: NodeJS.Timeout | null = null;

/**
 * Initializes a background watcher that monitors local Git repository commits
 * and automatically triggers autonomous agent code reviews upon new pushes/commits.
 */
export function startGitWatcher(io: SocketIOServer) {
  if (watcherInterval) return;
  // Off unless asked for. It watches the backend's own checkout, so every
  // platform deploy moved HEAD and started a full run on whichever production
  // was updated last — in any organization, spending its credits. Real pushes
  // arrive through the git webhook route, which knows the repository.
  if (process.env.GIT_WATCHER_ENABLED !== 'true') {
    logger.info('Git Auto-Watcher disabled (set GIT_WATCHER_ENABLED=true to enable)');
    return;
  }

  // Initialize with current HEAD so server restart doesn't re-trigger existing commit
  try {
    lastProcessedCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
    logger.info({ initialCommit: lastProcessedCommit }, 'Git Auto-Watcher initialized');
  } catch {
    lastProcessedCommit = null;
  }

  watcherInterval = setInterval(async () => {
    try {
      const currentCommit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
      if (!currentCommit || currentCommit === lastProcessedCommit) {
        return;
      }

      logger.info(
        { oldCommit: lastProcessedCommit, newCommit: currentCommit },
        '🚀 New Git commit detected! Triggering autonomous agent review pipeline...',
      );
      lastProcessedCommit = currentCommit;

      // Prefer the most recently updated process; webhook payloads are handled by
      // the public route, while this local watcher has no repository identity.
      let proc = await prisma.process.findFirst({ orderBy: { updatedAt: 'desc' } });

      if (!proc) {
        proc = await prisma.process.findFirst({ orderBy: { updatedAt: 'desc' } });
      }

      if (!proc) {
        logger.warn('Git watcher: No production process found to run review');
        return;
      }

      if (runner.isRunning(proc.id)) {
        logger.info({ processId: proc.id }, 'Git watcher: Process is already running');
        return;
      }

      const emit = (event: string, payload: unknown) => {
        io.to(`org:${proc!.organizationId}`).emit(event, payload);
      };

      const runStatus = runner.startChainRun(proc.id, proc.organizationId, emit);
      logger.info(
        { processId: proc.id, runId: runStatus.runId, commit: currentCommit },
        '✅ Autonomous Agent pipeline automatically started for new Git push/commit',
      );
    } catch (err: any) {
      // Git command might fail if inside an isolated container without .git mount
      // Handled gracefully
    }
  }, 4000);
}
