import type { Server as IOServer } from 'socket.io';
import { RunTrigger } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { claimSchedule, dueSchedules, pruneDeliveries } from './process-extras.service.js';
import { notify } from './insights.service.js';
import {
  startChainRun,
  isRunning,
  atCapacityGlobal,
  capacityLimit,
  reapStaleRuns,
} from './agent-runner.service.js';

/**
 * Minute-resolution cron tick for scheduled chain runs.
 *
 * Deliberately simple: one interval, aligned to the top of each minute, that
 * asks which schedules are due and starts them. Runs are skipped if the chain
 * is already executing, so a slow chain can't stack up overlapping runs.
 */

let timer: NodeJS.Timeout | null = null;

/** Ticks between housekeeping passes — hourly, at one tick a minute. */
const PRUNE_EVERY_TICKS = 60;
let ticks = 0;

async function tick(io?: IOServer): Promise<void> {
  try {
    // Collect runs that stopped reporting progress before deciding what may
    // start — an abandoned row otherwise counts against capacity forever.
    await reapStaleRuns().catch((err) => logger.warn({ err }, 'Stale-run reap failed'));

    // The delivery log grows once per attempt per run; trim it occasionally
    // rather than on every tick, which would be a pointless query a minute.
    if (++ticks % PRUNE_EVERY_TICKS === 0) {
      await pruneDeliveries().catch((err) => logger.warn({ err }, 'Delivery prune failed'));
    }

    const due = await dueSchedules(new Date());
    for (const schedule of due) {
      // Scheduled runs are the easiest way to blow past the ceiling, since
      // nobody is watching when they fire.
      if (await atCapacityGlobal()) {
        logger.warn(
          { limit: capacityLimit(), processId: schedule.processId },
          'Scheduled run deferred — at concurrency capacity',
        );
        continue;
      }
      if (isRunning(schedule.processId)) {
        logger.info(
          { processId: schedule.processId },
          'Scheduled run skipped — chain already running',
        );
        continue;
      }

      // Claim the firing before starting it. Two instances ticking the same
      // minute both see it as due; only the one that wins the compare-and-swap
      // may run it, so the chain is never billed twice for one cron match.
      const claimed = await claimSchedule(schedule.id, schedule.lastRunAt);
      if (!claimed) {
        logger.info(
          { scheduleId: schedule.id },
          'Scheduled run skipped — claimed by another instance',
        );
        continue;
      }

      const emit = (event: string, payload: unknown) =>
        io?.to(`org:${schedule.organizationId}`).emit(event, payload);

      startChainRun(schedule.processId, schedule.organizationId, emit, RunTrigger.SCHEDULED);

      await notify(
        schedule.organizationId,
        'SCHEDULE_FIRED',
        `Scheduled run started: ${schedule.process.name}`,
        { body: `Triggered by cron ${schedule.cron}.`, link: '/runs', processId: schedule.processId },
      );

      logger.info(
        { scheduleId: schedule.id, processId: schedule.processId, cron: schedule.cron },
        'Scheduled chain run started',
      );
    }
  } catch (err) {
    // A scheduler failure must never take the server down.
    logger.error({ err }, 'Scheduler tick failed');
  }
}

export function startScheduler(io?: IOServer): void {
  if (timer) return;
  if (process.env.DISABLE_SCHEDULER === 'true') {
    logger.info('Scheduler disabled by DISABLE_SCHEDULER');
    return;
  }

  // Align to the next minute boundary so cron fires predictably.
  const msToNextMinute = 60_000 - (Date.now() % 60_000);
  setTimeout(() => {
    void tick(io);
    timer = setInterval(() => void tick(io), 60_000);
  }, msToNextMinute);

  logger.info({ startsInMs: msToNextMinute }, 'Chain scheduler started');
}

export function stopScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
