import { describe, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Every route that addresses a record by id must scope it to the caller's
 * organization.
 *
 * Two routes did not. `POST /processes/:id/cancel` went straight to the
 * runner, which is keyed by process id alone — so any authenticated user
 * could kill any other organization's running chain by id, destroying work in
 * flight and wasting everything already spent on the completed stages. It was
 * proven: an attacker in a second org got `{"cancelled":true}` against a
 * victim's live run. `GET /processes/:id/run` had the same gap, and its
 * response carries each stage's summary — the agents' actual output.
 *
 * Both are fixed. This guards the *class* rather than the two instances,
 * because the next route added is where it will happen again.
 */

const ROUTES_DIR = path.resolve(process.cwd(), 'src/routes');

/**
 * Files whose ownership check lives in middleware rather than each handler.
 *
 * Listed explicitly so the exemption is a decision on record, not an
 * accident: anything not named here must do the check itself.
 */
const GATED_BY_MIDDLEWARE: Record<string, string> = {
  // router.use(verifyAgentOwnership) — checks agent ⇒ org before any handler.
  'mcp.ts': 'verifyAgentOwnership',
  // Authenticates by agent token, not an org session.
  'agent-api.ts': 'agent token auth',
  // Deliberately public; access is decided by canViewPreview.
  'preview.ts': 'canViewPreview',
  // Unauthenticated by design — verified by signature, not session.
  'webhook-inbound.ts': 'signature verification',
  // Operates on the caller's own user/session, which has no org id.
  'auth.ts': 'self-scoped',
};

/** Names that read as an ownership gate rather than ordinary middleware. */
const GATE_NAME = /\b\w*(?:verify|require|ensure|check|assert)[A-Z]\w*/;

/** Splits a file into individual route handlers with their bodies. */
function extractHandlers(source: string) {
  const handlers: Array<{ method: string; routePath: string; body: string; line: number }> = [];
  const re = /router\.(get|post|patch|put|delete)\(\s*(['"`])([^'"`]*)\2/g;

  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    const [, method, , routePath] = match;
    // Take everything up to the next route declaration as this handler's body.
    const rest = source.slice(match.index + match[0].length);
    const next = /router\.(get|post|patch|put|delete)\(/.exec(rest);
    handlers.push({
      method: method.toUpperCase(),
      routePath,
      body: next ? rest.slice(0, next.index) : rest,
      line: source.slice(0, match.index).split('\n').length,
    });
  }
  return handlers;
}

/**
 * Whether a handler is covered, by any of the three legitimate means:
 * a router-wide gate, a gate passed on the route itself, or the handler
 * scoping the query by organization directly.
 */
function isScoped(source: string, handler: { body: string }): boolean {
  // router.use(gate) or router.use('/:id', gate) — covers every handler after it.
  if (new RegExp(`router\\.use\\(\\s*(?:['"\`][^'"\`]*['"\`]\\s*,\\s*)?${GATE_NAME.source}`).test(source)) {
    return true;
  }

  // A gate passed as an argument before the handler: the first line of the
  // body still holds the remaining arguments of the route declaration.
  const args = handler.body.split('async')[0] ?? '';
  if (GATE_NAME.test(args)) return true;

  // Or the handler filters by organization itself.
  return /organizationId/.test(handler.body);
}

describe('multi-tenant isolation', () => {
  it('scopes every id-addressed route to the caller organization', async () => {
    const files = (await fs.readdir(ROUTES_DIR)).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(10); // the scan actually found routes

    const unscoped: string[] = [];

    for (const file of files) {
      if (file in GATED_BY_MIDDLEWARE) continue;

      const source = await fs.readFile(path.join(ROUTES_DIR, file), 'utf8');

      for (const h of extractHandlers(source)) {
        // Only routes that address a specific record can leak one.
        if (!h.routePath.includes(':')) continue;
        if (isScoped(source, h)) continue;

        unscoped.push(`${file}:${h.line}  ${h.method} ${h.routePath}`);
      }
    }

    expect(
      unscoped,
      `These routes address a record by id without scoping it to the caller's ` +
        `organization, so any authenticated user can reach another org's data:\n  ` +
        unscoped.join('\n  '),
    ).toEqual([]);
  });

  it('keeps the cancel and run-status routes scoped', async () => {
    // The two that were actually exploited — named so a future refactor that
    // drops the check fails loudly rather than silently.
    const source = await fs.readFile(path.join(ROUTES_DIR, 'processes.ts'), 'utf8');

    for (const route of ['/:id/cancel', '/:id/run']) {
      const handlers = extractHandlers(source).filter((h) => h.routePath === route);
      expect(handlers.length, `route ${route} disappeared`).toBeGreaterThan(0);
      for (const h of handlers) {
        expect(h.body, `${route} lost its organization check`).toMatch(/organizationId/);
      }
    }
  });
});
