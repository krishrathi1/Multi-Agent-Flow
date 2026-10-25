import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { cleanupTestData, createTestUser } from './setup.js';
import {
  classifyStatus,
  classifyError,
  isRetryable,
  deliverWithRetry,
  listDeliveries,
  pruneDeliveries,
  type WebhookSender,
} from '../services/process-extras.service.js';

/**
 * Webhook delivery was fire-and-forget with a single `lastStatus`, so a
 * one-second network blip permanently lost a run-completed notification and
 * left nothing to diagnose it with.
 *
 * The sender refuses loopback addresses — correctly — so the retry loop is
 * driven through an injected sender rather than a local HTTP server, which
 * would otherwise require weakening the SSRF guard to test.
 */

describe('delivery classification', () => {
  it('reads the status the way an operator would', () => {
    expect(classifyStatus(200)).toBe('DELIVERED');
    expect(classifyStatus(204)).toBe('DELIVERED');
    expect(classifyStatus(301)).toBe('REDIRECTED');
    expect(classifyStatus(400)).toBe('REJECTED');
    expect(classifyStatus(404)).toBe('REJECTED');
    expect(classifyStatus(429)).toBe('REJECTED');
    expect(classifyStatus(500)).toBe('FAILED');
    expect(classifyStatus(503)).toBe('FAILED');
  });

  it('separates "we refused to send" from "sending did not work"', () => {
    // The two need completely different fixes, so they must not look alike.
    expect(classifyError('Invalid Request URL: cannot point to private/internal addresses'))
      .toBe('BLOCKED');
    expect(classifyError('Invalid Request URL: protocol must be http, https, ws, or wss'))
      .toBe('BLOCKED');
    expect(classifyError('fetch failed')).toBe('FAILED');
    expect(classifyError('The operation was aborted')).toBe('FAILED');
  });

  it('retries only what is worth retrying', () => {
    expect(isRetryable('FAILED')).toBe(true);
    // Repeating a refusal wastes both sides' time; a block will never change.
    expect(isRetryable('REJECTED')).toBe(false);
    expect(isRetryable('BLOCKED')).toBe(false);
    expect(isRetryable('DELIVERED')).toBe(false);
    expect(isRetryable('REDIRECTED')).toBe(false);
  });
});

describe('delivery retry loop', () => {
  let orgId: string;
  let webhookId: string;

  const makeHook = async () => {
    const proc = await prisma.process.create({
      data: { organizationId: orgId, name: `Hook Chain ${Date.now()}`, prompt: 'x' },
    });
    const hook = await prisma.processWebhook.create({
      data: { organizationId: orgId, processId: proc.id, url: 'https://receiver.example.com/h' },
    });
    return hook;
  };

  beforeAll(async () => {
    const t = await createTestUser('wh');
    orgId = t.organization.id;
    webhookId = (await makeHook()).id;
  });

  afterAll(async () => {
    await cleanupTestData(orgId);
  });

  /** No real waiting — the backoff schedule is supplied as zeroes. */
  const run = (hook: { id: string }, send: WebhookSender) =>
    deliverWithRetry({ id: hook.id, url: 'https://receiver.example.com/h', secret: null },
      'run.completed', '{}', send, [0, 0]);

  it('stops after one attempt when the receiver accepts', async () => {
    const hook = await makeHook();
    let calls = 0;
    await run(hook, async () => { calls++; return { status: 200 }; });

    expect(calls).toBe(1);
    const log = await listDeliveries(orgId, { webhookId: hook.id });
    expect(log).toHaveLength(1);
    expect(log[0].outcome).toBe('DELIVERED');
  });

  it('recovers a transient failure instead of losing the notification', async () => {
    // Two 503s then a 200 — exactly the blip that used to drop the event.
    const hook = await makeHook();
    let calls = 0;
    await run(hook, async () => {
      calls++;
      return { status: calls < 3 ? 503 : 200 };
    });

    expect(calls).toBe(3);
    const log = (await listDeliveries(orgId, { webhookId: hook.id }))
      .sort((a, b) => a.attempt - b.attempt);
    expect(log.map((d) => d.outcome)).toEqual(['FAILED', 'FAILED', 'DELIVERED']);
    expect(log.map((d) => d.attempt)).toEqual([1, 2, 3]);
  });

  it('gives up after the attempt limit rather than retrying forever', async () => {
    const hook = await makeHook();
    let calls = 0;
    await run(hook, async () => { calls++; return { status: 500 }; });

    expect(calls).toBe(3);
    const log = await listDeliveries(orgId, { webhookId: hook.id });
    expect(log).toHaveLength(3);
    expect(log.every((d) => d.outcome === 'FAILED')).toBe(true);
  });

  it('does not retry a receiver that refused', async () => {
    const hook = await makeHook();
    let calls = 0;
    await run(hook, async () => { calls++; return { status: 400 }; });

    expect(calls).toBe(1);
    const log = await listDeliveries(orgId, { webhookId: hook.id });
    expect(log[0].outcome).toBe('REJECTED');
  });

  it('records a thrown send as an attempt rather than swallowing it', async () => {
    const hook = await makeHook();
    await run(hook, async () => {
      throw new Error('Invalid Request URL: cannot point to private/internal addresses');
    });

    const log = await listDeliveries(orgId, { webhookId: hook.id });
    // Blocked is terminal — one attempt, and the reason is kept.
    expect(log).toHaveLength(1);
    expect(log[0].outcome).toBe('BLOCKED');
    expect(log[0].error).toMatch(/private\/internal/);
  });

  it('prunes old records but keeps recent ones', async () => {
    const hook = await makeHook();
    await run(hook, async () => ({ status: 200 }));

    const old = await prisma.webhookDelivery.create({
      data: { webhookId: hook.id, event: 'run.completed', outcome: 'DELIVERED', status: 200 },
    });
    // Backdate past the retention window.
    await prisma.webhookDelivery.update({
      where: { id: old.id },
      data: { createdAt: new Date(Date.now() - 60 * 24 * 60 * 60_000) },
    });

    await pruneDeliveries(30);

    expect(await prisma.webhookDelivery.findUnique({ where: { id: old.id } })).toBeNull();
    // The log grows once per attempt per run; without pruning it is unbounded.
    expect((await listDeliveries(orgId, { webhookId: hook.id })).length).toBeGreaterThan(0);
  });

  it('scopes the log to the caller organization', async () => {
    const outsider = await createTestUser('wh-out');
    expect(await listDeliveries(outsider.organization.id, { webhookId })).toEqual([]);
    await cleanupTestData(outsider.organization.id);
  });
});
