import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { isValidCron, cronMatches } from '../services/process-extras.service.js';
import { resolveWorkspaceFile, workspaceFor } from '../services/agent-runner.service.js';

/**
 * Regressions for edge cases that were found by probing a running server.
 * Each one here shipped broken at some point.
 */

describe('cron validation', () => {
  it('accepts the standard shapes', () => {
    for (const expr of [
      '* * * * *',
      '0 9 * * 1',
      '*/15 * * * *',
      '0-30 9-17 1-15 1-6 0-5',
      '0,15,30,45 * * * *',
    ]) {
      expect(isValidCron(expr), expr).toBe(true);
    }
  });

  it('rejects values outside each field range', () => {
    // A shape-only check accepted these, and they would never have fired.
    for (const expr of [
      '99 99 * * *',
      '60 * * * *',
      '* 24 * * *',
      '* * 32 * *',
      '* * * 13 *',
      '* * * * 7',
    ]) {
      expect(isValidCron(expr), expr).toBe(false);
    }
  });

  it('rejects malformed expressions', () => {
    for (const expr of ['', '* * * *', 'abc * * * *', '30-10 * * * *', '*/0 * * * *']) {
      expect(isValidCron(expr), expr).toBe(false);
    }
  });

  it('matches the minute it describes', () => {
    // 09:00 on a Monday.
    const monday9am = new Date(2026, 0, 5, 9, 0, 0);
    expect(cronMatches('0 9 * * 1', monday9am)).toBe(true);
    expect(cronMatches('0 10 * * 1', monday9am)).toBe(false);
  });
});

describe('workspace containment', () => {
  const processId = 'test-containment';

  it('refuses paths that climb out of the workspace', async () => {
    for (const rel of ['../package.json', '../../backend/.env', '..\..\package.json']) {
      expect(await resolveWorkspaceFile(processId, rel), rel).toBeNull();
    }
  });

  it('refuses a symlink that resolves outside the workspace', async () => {
    const ws = workspaceFor(processId);
    await fs.mkdir(ws, { recursive: true });

    const real = path.join(ws, 'real.txt');
    await fs.writeFile(real, 'inside');

    const outsideTarget = path.resolve(ws, '..', 'escape-target.txt');
    await fs.writeFile(outsideTarget, 'SECRET');
    const link = path.join(ws, 'escape.txt');
    await fs.rm(link, { force: true });

    let linkable = true;
    try {
      await fs.symlink(outsideTarget, link);
    } catch {
      linkable = false; // Windows without privilege — skip the assertion.
    }

    // A file genuinely inside resolves fine.
    expect(await resolveWorkspaceFile(processId, 'real.txt')).not.toBeNull();

    if (linkable) {
      // The escape must be blocked even though the path looks local.
      expect(await resolveWorkspaceFile(processId, 'escape.txt')).toBeNull();
    }

    await fs.rm(ws, { recursive: true, force: true });
    await fs.rm(outsideTarget, { force: true });
  });
});
