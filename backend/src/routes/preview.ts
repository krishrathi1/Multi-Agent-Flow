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

/** Token may arrive as ?t= or an X-Share-Token header. */
const shareToken = (req: { query: Record<string, unknown>; get: (h: string) => string | undefined }) =>
  (typeof req.query.t === 'string' ? req.query.t : undefined) ?? req.get('x-share-token');

router.get('/:processId', async (req, res) => {
  if (!(await canViewPreview(req.params.processId, shareToken(req)))) {
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
  // Redirect so relative asset URLs inside the page resolve correctly, and
  // carry the token forward or the very next request would be refused.
  const t = shareToken(req);
  res.redirect(
    `/preview/${req.params.processId}/${entry}${t ? `?t=${encodeURIComponent(t)}` : ''}`,
  );
});

router.get('/:processId/*splat', async (req, res) => {
  if (!(await canViewPreview(req.params.processId, shareToken(req)))) {
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

  // Generated content is untrusted: never let it run as same-origin script
  // against the API, and don't allow it to frame-bust.
  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  if (type.startsWith('text/html')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' data: https:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https: data:; frame-ancestors 'self'; sandbox allow-scripts allow-forms allow-same-origin;"
    );
  }
  res.send(body);
});

export default router;
