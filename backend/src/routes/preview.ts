import { Router } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { resolveWorkspaceFile, listWorkspaceFiles } from '../services/agent-runner.service.js';
import { canViewPreview } from '../services/insights.service.js';

/**
 * Serves what a production chain built, so a generated site is viewable at a
 * real URL: /preview/:processId/
 *
 * Deliberately unauthenticated — it exists so a demo link can be opened or
 * shared. It is strictly read-only, resolves every path through the
 * workspace-scoped guard (no traversal), and serves nothing outside a chain's
 * own directory.
 */

const router = Router();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jsx': 'text/plain; charset=utf-8',
  '.ts': 'text/plain; charset=utf-8',
  '.tsx': 'text/plain; charset=utf-8',
  '.py': 'text/plain; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.yaml': 'text/plain; charset=utf-8',
  '.yml': 'text/plain; charset=utf-8',
  '.sh': 'text/plain; charset=utf-8',
  '.sql': 'text/plain; charset=utf-8',
};

/** Picks the entry document for a chain that built a site. */
async function findIndex(processId: string): Promise<string | null> {
  const files = await listWorkspaceFiles(processId);
  const html = files.filter((f) => f.path.endsWith('.html'));
  if (html.length === 0) return null;

  // Prefer a root index.html, then any index.html, then the first page.
  return (
    html.find((f) => f.path === 'index.html')?.path ??
    html.find((f) => f.path.endsWith('/index.html'))?.path ??
    html[0].path
  );
}

/** Token may arrive as ?t=, X-Share-Token header, or preview_token cookie. */
const shareToken = (req: {
  query: Record<string, unknown>;
  get: (h: string) => string | undefined;
  cookies?: Record<string, string>;
  headers?: Record<string, unknown>;
}) => {
  if (typeof req.query.t === 'string' && req.query.t) return req.query.t;
  const header = req.get('x-share-token');
  if (header) return header;
  if (req.cookies && typeof req.cookies['preview_token'] === 'string') return req.cookies['preview_token'];
  const rawCookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
  const match = rawCookie.match(/(?:^|;\s*)preview_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : undefined;
};

router.get('/:processId', async (req, res) => {
  const token = shareToken(req);
  if (!(await canViewPreview(req.params.processId, token))) {
    return res.status(403).type('text/plain').send('This preview is not shared');
  }
  const entry = await findIndex(req.params.processId);
  if (!entry) {
    return res
      .status(404)
      .type('html')
      .send(
        '<!doctype html><meta charset="utf-8"><title>Nothing built yet</title>' +
          '<body style="font:16px system-ui;padding:3rem;max-width:40rem;margin:auto">' +
          '<h1>Nothing to preview yet</h1>' +
          '<p>This production has not produced an HTML file. Run the chain first.</p>',
      );
  }
  // Set scoped cookie so relative assets (scripts, styles, images) automatically carry preview authorization
  if (token) {
    res.cookie('preview_token', token, {
      path: `/preview/${req.params.processId}`,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }
  // Redirect so relative asset URLs inside the page resolve correctly
  res.redirect(
    `/preview/${req.params.processId}/${entry}${token ? `?t=${encodeURIComponent(token)}` : ''}`,
  );
});

router.get('/:processId/*splat', async (req, res) => {
  const token = shareToken(req);
  if (!(await canViewPreview(req.params.processId, token))) {
    return res.status(403).type('text/plain').send('This preview is not shared');
  }
  const rel = (req.params as Record<string, unknown>).splat;
  const relPath = Array.isArray(rel) ? rel.join('/') : String(rel ?? '');

  const abs = await resolveWorkspaceFile(req.params.processId, relPath);
  if (!abs) return res.status(404).type('text/plain').send('Not found');

  const type = MIME[path.extname(abs).toLowerCase()] ?? 'application/octet-stream';
  const body = await fs.readFile(abs);

  if (req.query.download === 'true') {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(path.basename(abs))}"`);
  }

  // Ensure scoped cookie is set on nested asset requests if token was provided in query
  if (token) {
    res.cookie('preview_token', token, {
      path: `/preview/${req.params.processId}`,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
    });
  }

  // Generated content is untrusted: isolate origin via sandbox without allow-same-origin
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (type.startsWith('text/html')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' data: https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https: data:; frame-ancestors 'self'; sandbox allow-scripts allow-forms;"
    );
  }
  res.send(body);
});

export default router;
