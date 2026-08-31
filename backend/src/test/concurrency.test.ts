import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { cleanupTestData, createTestUser } from './setup.js';
import {
  markRunCancelled,
  registerChildForTest,
  activeChildCount,
  wouldExceedBudget,
  reapStaleRuns,
} from '../services/agent-runner.service.js';
import { claimSchedule } from '../services/process-extras.service.js';
import * as insights from '../services/insights.service.js';
import { importChain, exportChain } from '../services/chain-portability.service.js';

/**
 * Regressions for defects found by reading the concurrency paths.
 *
 * Every case here is something that was silently wrong: cancel that only
 * half-cancelled, a cron that could fire twice, a budget discovered only after
 * it was blown, and a read receipt that spoke for the whole organization.
 */

describe('cancelling a run kills every agent', () => {
  it('kills all parallel children, not just the most recent', () => {
    // A stage runs up to MAX_STAGE_PARALLELISM agents at once. The registry
    // used to be one handle per chain, so each spawn overwrote the last and
    // cancel left the earlier agents running — and spending.
    const processId = 'cancel-all-children';
    const killed: string[] = [];

    registerChildForTest(processId, () => killed.push('a'));
    registerChildForTest(processId, () => killed.push('b'));
    registerChildForTest(processId, () => killed.push('c'));
    expect(activeChildCount(processId)).toBe(3);

    expect(markRunCancelled(processId)).toBe(3);
    expect(killed.sort()).toEqual(['a', 'b', 'c']);
  });

  it('lets one finishing agent de-register without stranding its siblings', () => {
    const processId = 'cancel-untrack-isolation';
    const killed: string[] = [];

    const untrackA = registerChildForTest(processId, () => killed.push('a'));
    registerChildForTest(processId, () => killed.push('b'));

    // Agent A finishes normally while B is still working.
    untrackA();
    expect(activeChildCount(processId)).toBe(1);

    // B must still be killable — a shared slot used to make it orphaned.
    expect(markRunCancelled(processId)).toBe(1);
    expect(killed).toEqual(['b']);
  });

  it('kills a child that spawns after cancellation was requested', () => {
    // Between the cancel sweep and a slow spawn there is a window where a new
    // child would never be killed and would run to completion, billing for
    // work nobody wanted.
    const processId = 'cancel-spawn-race';
    const killed: string[] = [];

    markRunCancelled(processId);
    registerChildForTest(processId, () => killed.push('late'));

    expect(killed).toEqual(['late']);
    expect(activeChildCount(processId)).toBe(0);
  });

  it('survives a child whose kill handle throws', () => {
    const processId = 'cancel-throwing-child';
    const killed: string[] = [];

    registerChildForTest(processId, () => {
      throw new Error('already exited');
    });
    registerChildForTest(processId, () => killed.push('sibling'));

    // One unkillable child must not strand the rest.
    expect(() => markRunCancelled(processId)).not.toThrow();
    expect(killed).toEqual(['sibling']);
  });
});

describe('budget is enforced before the spend, not after', () => {
  it('refuses a stage whose projected cost breaks the ceiling', () => {
    // $8 spent, 3 agents at ~$1 each projects to $11 against a $10 cap.
    expect(wouldExceedBudget({ budgetUsd: 10 }, 8, 1, 3)).toMatch(/exceed the budget/i);
  });

  it('allows a stage that fits', () => {
    expect(wouldExceedBudget({ budgetUsd: 10 }, 2, 1, 3)).toBeNull();
  });

  it('does not block when there is no history to project from', () => {
    // A first run has no basis to predict with — refusing it on a guess would
    // be worse than the overshoot the projection is meant to prevent.
    expect(wouldExceedBudget({ budgetUsd: 1 }, 0, 0, 5)).toBeNull();
  });

  it('does nothing when no budget is set', () => {
    expect(wouldExceedBudget({ budgetUsd: null }, 999, 5, 10)).toBeNull();
  });
});

describe('database-backed concurrency', () => {
  let orgId: string;
  let userId: string;
  let processId: string;

  beforeAll(async () => {
    const t = await createTestUser('conc');
    orgId = t.organization.id;
    userId = t.user.id;

    const proc = await prisma.process.create({
      data: { organizationId: orgId, name: 'Concurrency Chain', prompt: 'test', agentCount: 2 },
    });
    processId = proc.id;
  });

  afterAll(async () => {
    await cleanupTestData(orgId);
  });

  it('lets only one instance claim a due schedule', async () => {
    const schedule = await prisma.processSchedule.create({
      data: { organizationId: orgId, processId, cron: '0 9 * * *', lastRunAt: null },
    });

    // Two backends tick the same minute and both read lastRunAt as null.
    const [first, second] = await Promise.all([
      claimSchedule(schedule.id, null),
      claimSchedule(schedule.id, null),
    ]);

    // Exactly one may win, or the chain is billed twice for one cron match.
    expect([first, second].filter(Boolean)).toHaveLength(1);

    // A stale read (the value we saw is no longer current) must also lose.
    expect(await claimSchedule(schedule.id, null)).toBe(false);
  });

  it('does not claim a disabled schedule', async () => {
    const schedule = await prisma.processSchedule.create({
      data: {
        organizationId: orgId,
        processId,
        cron: '0 9 * * *',
        enabled: false,
        lastRunAt: null,
      },
    });
    expect(await claimSchedule(schedule.id, null)).toBe(false);
  });

  it('reaps a run that stopped heartbeating but spares a fresh one', async () => {
    const stale = await prisma.processRun.create({
      data: {
        organizationId: orgId,
        processId,
        state: 'RUNNING',
        heartbeatAt: new Date(Date.now() - 60 * 60_000),
      },
    });
    const healthy = await prisma.processRun.create({
      data: {
        organizationId: orgId,
        processId,
        state: 'RUNNING',
        heartbeatAt: new Date(),
      },
    });

    await reapStaleRuns();

    const [a, b] = await Promise.all([
      prisma.processRun.findUnique({ where: { id: stale.id } }),
      prisma.processRun.findUnique({ where: { id: healthy.id } }),
    ]);

    expect(a?.state).toBe('FAILED');
    expect(a?.error).toMatch(/abandoned/i);
    // A legitimately long stage must never be killed by the reaper.
    expect(b?.state).toBe('RUNNING');

    await prisma.processRun.deleteMany({ where: { id: { in: [stale.id, healthy.id] } } });
  });

  it('keeps notification read state per user', async () => {
    const note = await prisma.notification.create({
      data: { organizationId: orgId, kind: 'RUN_COMPLETED', title: 'Chain finished' },
    });

    const other = await createTestUser('conc-other');
    // Put the second user in the same org so they see the same notifications.
    await prisma.orgMember.create({
      data: { organizationId: orgId, userId: other.user.id, role: 'MEMBER' },
    });

    expect(await insights.unreadCount(orgId, userId)).toBeGreaterThan(0);

    // One teammate reads it.
    await insights.markRead(orgId, userId);
    expect(await insights.unreadCount(orgId, userId)).toBe(0);

    // The other must still see it — a shared readAt used to clear it for all,
    // so a chain that paused overnight became invisible to everyone but the
    // first person to glance at the bell.
    expect(await insights.unreadCount(orgId, other.user.id)).toBeGreaterThan(0);

    // Marking twice must not violate the (notification, user) unique index.
    await expect(insights.markRead(orgId, userId)).resolves.toBe(0);

    await prisma.notification.delete({ where: { id: note.id } });
    await prisma.orgMember.deleteMany({ where: { userId: other.user.id } });
    await prisma.user.delete({ where: { id: other.user.id } });
  });

  it('compares two runs and attributes the delta to a stage', async () => {
    const mk = async (cost: number, ms: number) => {
      const run = await prisma.processRun.create({
        data: {
          organizationId: orgId,
          processId,
          state: 'COMPLETED',
          totalCostUsd: cost,
          totalTokens: Math.round(cost * 1000),
          durationMs: ms,
        },
      });
      await prisma.processRunStep.create({
        data: {
          runId: run.id,
          agentId: 'a1',
          agentName: 'Writer',
          stage: 1,
          state: 'COMPLETED',
          costUsd: cost,
          durationMs: ms,
        },
      });
      return run;
    };

    const base = await mk(1, 1000);
    const head = await mk(3, 4000);

    const diff = await insights.compareRuns(base.id, head.id, orgId);
    expect(diff).not.toBeNull();
    expect(diff!.costDelta).toBeCloseTo(2, 4);
    expect(diff!.costPct).toBe(200);
    expect(diff!.durationDelta).toBe(3000);
    expect(diff!.stages[0].agentName).toBe('Writer');
    expect(diff!.stages[0].costDelta).toBeCloseTo(2, 4);

    // A run from another org must not be readable through the compare route.
    const outsider = await createTestUser('conc-outsider');
    expect(await insights.compareRuns(base.id, head.id, outsider.organization.id)).toBeNull();
    await cleanupTestData(outsider.organization.id);

    await prisma.processRun.deleteMany({ where: { id: { in: [base.id, head.id] } } });
  });

  it('round-trips a chain through export and import', async () => {
    await prisma.process.update({
      where: { id: processId },
      data: { budgetUsd: 5, approvalMode: 'FINAL_STAGE' },
    });
    await prisma.agent.create({
      data: {
        organizationId: orgId,
        name: 'writer-1',
        displayName: 'Writer',
        description: 'Writes',
        workspace: '~/x/',
        processId,
        processRole: 'Write the copy',
        processStage: 1,
      },
    });

    const bundle = await exportChain(processId, orgId);
    expect(bundle?.agents).toHaveLength(1);
    // Secrets must never ride along in a shareable bundle.
    expect(JSON.stringify(bundle)).not.toMatch(/shareToken/);

    const result = await importChain(orgId, bundle);
    expect(result.ok).toBe(true);

    const imported = await prisma.process.findUniqueOrThrow({
      where: { id: result.processId! },
    });
    // Guardrails must carry over — an imported chain arriving uncapped is the
    // dangerous default.
    expect(imported.budgetUsd).toBe(5);
    expect(imported.approvalMode).toBe('FINAL_STAGE');
    // The name is de-duplicated rather than colliding.
    expect(imported.name).not.toBe('');

    await prisma.agent.deleteMany({ where: { processId: result.processId! } });
    await prisma.activity.deleteMany({ where: { processId: result.processId! } });
    await prisma.process.delete({ where: { id: result.processId! } });
  });

  it('rejects a bundle that is not a chain', async () => {
    for (const bad of [null, {}, { nexusChainVersion: 1 }, 'nonsense', 42]) {
      const r = await importChain(orgId, bad);
      expect(r.ok, JSON.stringify(bad)).toBe(false);
    }
  });

  it('rejects a bundle from a newer exporter rather than importing it wrong', async () => {
    const r = await importChain(orgId, {
      nexusChainVersion: 99,
      name: 'Future',
      prompt: 'x',
      agents: [{ name: 'a', displayName: 'A', stage: 1 }],
    });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/newer version/i);
  });

  it('survives concurrent imports racing on the same name', async () => {
    // Names are resolved by reading before writing, so simultaneous creates
    // pick the same one and all but the winner died on a unique index. Every
    // caller should get a chain, with distinct names.
    const bundle = {
      nexusChainVersion: 1,
      name: 'Race Chain',
      prompt: 'concurrent import',
      agents: [{ name: 'racer', displayName: 'Racer', stage: 1 }],
    };

    const results = await Promise.all([
      importChain(orgId, bundle),
      importChain(orgId, bundle),
      importChain(orgId, bundle),
    ]);

    expect(results.every((r) => r.ok), JSON.stringify(results.map((r) => r.error))).toBe(true);
    const names = results.map((r) => r.name);
    expect(new Set(names).size).toBe(3);

    for (const r of results) {
      await prisma.agent.deleteMany({ where: { processId: r.processId! } });
      await prisma.activity.deleteMany({ where: { processId: r.processId! } });
      await prisma.process.delete({ where: { id: r.processId! } });
    }
  });

  it('de-duplicates agent names within one roster', async () => {
    // Names were resolved with Promise.all against the database only, so two
    // agents proposed under one name both resolved to it and the insert died
    // on the (organizationId, name) unique index — a 500, not a rejection.
    // A planner emitting a duplicate kebab name hit this too.
    const r = await importChain(orgId, {
      nexusChainVersion: 1,
      name: 'Duplicate Roster',
      prompt: 'test duplicates',
      agents: [
        { name: 'dup', displayName: 'First', stage: 1 },
        { name: 'dup', displayName: 'Second', stage: 2 },
        { name: 'dup', displayName: 'Third', stage: 3 },
      ],
    });
    expect(r.ok, r.error).toBe(true);

    const names = await prisma.agent.findMany({
      where: { processId: r.processId! },
      select: { name: true },
    });
    expect(names).toHaveLength(3);
    expect(new Set(names.map((n) => n.name)).size).toBe(3);

    await prisma.agent.deleteMany({ where: { processId: r.processId! } });
    await prisma.activity.deleteMany({ where: { processId: r.processId! } });
    await prisma.process.delete({ where: { id: r.processId! } });
  });

  it('renumbers non-contiguous stages so no stage runs empty', async () => {
    // A hand-edited bundle with stages [1, 5, 9] would otherwise leave the
    // runner iterating stages that contain no agents.
    const r = await importChain(orgId, {
      nexusChainVersion: 1,
      name: 'Sparse Stages',
      prompt: 'test sparse',
      agents: [
        { name: 'a', displayName: 'A', stage: 9 },
        { name: 'b', displayName: 'B', stage: 1 },
        { name: 'c', displayName: 'C', stage: 5 },
      ],
    });
    expect(r.ok).toBe(true);

    const agents = await prisma.agent.findMany({
      where: { processId: r.processId! },
      orderBy: { processStage: 'asc' },
      select: { displayName: true, processStage: true },
    });
    expect(agents.map((a) => a.processStage)).toEqual([1, 2, 3]);
    expect(agents.map((a) => a.displayName)).toEqual(['B', 'C', 'A']);

    await prisma.agent.deleteMany({ where: { processId: r.processId! } });
    await prisma.activity.deleteMany({ where: { processId: r.processId! } });
    await prisma.process.delete({ where: { id: r.processId! } });
  });
});
