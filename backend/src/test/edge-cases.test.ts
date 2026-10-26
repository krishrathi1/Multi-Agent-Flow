import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { isValidCron, cronMatches } from '../services/process-extras.service.js';
import { resolveWorkspaceFile, workspaceFor } from '../services/agent-runner.service.js';
import { confineToPreview } from '../routes/preview.js';

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

  it('never serves git or agent tooling internals', async () => {
    const ws = workspaceFor(processId);
    await fs.mkdir(path.join(ws, '.git'), { recursive: true });
    await fs.writeFile(path.join(ws, '.git', 'config'), '[core]');
    expect(await resolveWorkspaceFile(processId, '.git/config')).toBeNull();
    await fs.rm(ws, { recursive: true, force: true });
  });
});

describe('preview confinement', () => {
  // Root-relative URLs in a built site used to resolve to the console's own
  // origin, so Watch Preview showed MyceliumOps instead of the user's project.
  const id = '11111111-2222-3333-4444-555555555555';
  const root = `/preview/${id}/`;

  it('rebases root-relative asset and link URLs into the preview', () => {
    const out = confineToPreview(
      '<html><head><link href="/style.css"></head><body><a href="/">Home</a><a href="/about.html">About</a><img src="/img/a.png"></body></html>',
      id, 'index.html', false,
    );
    expect(out).toContain(`href="${root}style.css"`);
    expect(out).toContain(`href="${root}index.html"`);
    expect(out).toContain(`href="${root}about.html"`);
    expect(out).toContain(`src="${root}img/a.png"`);
    expect(out).toContain(`<base href="${root}">`);
  });

  it('leaves external, protocol-relative and already-confined URLs alone', () => {
    const html = `<head></head><a href="https://x.dev/"></a><script src="//cdn.x/y.js"></script><a href="${root}a.html"></a><a href="page.html"></a>`;
    const out = confineToPreview(html, id, 'index.html', false);
    expect(out).toContain('href="https://x.dev/"');
    expect(out).toContain('src="//cdn.x/y.js"');
    expect(out).toContain(`href="${root}a.html"`);
    expect(out).toContain('href="page.html"');
  });

  it('sends "/" to the site entry from any page, not the current one', () => {
    const out = confineToPreview('<head></head><a href="/">Home</a>', id, 'menu.html', false, 'index.html');
    expect(out).toContain(`href="${root}index.html"`);
    expect(out).not.toContain(`href="${root}menu.html"`);
  });

  it('bases a site built in a subfolder on that folder', () => {
    const out = confineToPreview('<head></head>', id, 'frontend/index.html', false);
    expect(out).toContain(`<base href="${root}frontend/">`);
  });

  it('only rewrites the router path for bundled client-side apps', () => {
    expect(confineToPreview('<head></head>', id, 'index.html', true)).toContain('history.replaceState');
    expect(confineToPreview('<head></head>', id, 'index.html', false)).not.toContain('history.replaceState');
  });

  it('keeps a base tag the site already declares', () => {
    const out = confineToPreview('<head><base href="/x/"></head>', id, 'index.html', false);
    expect(out.match(/<base /g)).toHaveLength(1);
  });
});
