import { Router } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import esbuild from 'esbuild';
import { resolveWorkspaceFile, listWorkspaceFiles } from '../services/agent-runner.service.js';
import { canViewPreview } from '../services/insights.service.js';
import { prisma } from '../lib/prisma.js';
import { verifyAccessToken } from '../lib/jwt.js';

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

/**
 * Bundles React/TSX components on-the-fly with esbuild and creates an interactive live preview.
 */
async function buildPreviewHtml(processId: string, absHtmlPath: string): Promise<string> {
  const wsDir = path.dirname(absHtmlPath);
  let scriptSrcEntry: string | null = null;
  let rawHtml = '';
  try {
    rawHtml = await fs.readFile(absHtmlPath, 'utf-8');
    const scriptMatch =
      rawHtml.match(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/i) ||
      rawHtml.match(/<script[^>]+src=["']([^"']+)["'][^>]+type=["']module["']/i);
    if (scriptMatch && scriptMatch[1]) {
      const cleanSrc = scriptMatch[1].replace(/^\//, '');
      const candidatePath = path.join(wsDir, cleanSrc);
      if (fsSync.existsSync(candidatePath)) {
        scriptSrcEntry = candidatePath;
      }
    }
  } catch {
    // ignore
  }

  const candidates = [
    ...(scriptSrcEntry ? [scriptSrcEntry] : []),
    path.join(wsDir, 'src', 'main.tsx'),
    path.join(wsDir, 'src', 'main.jsx'),
    path.join(wsDir, 'src', 'main.js'),
    path.join(wsDir, 'src', 'index.tsx'),
    path.join(wsDir, 'src', 'index.jsx'),
    path.join(wsDir, 'src', 'index.js'),
    path.join(wsDir, 'src', 'App.tsx'),
    path.join(wsDir, 'src', 'App.jsx'),
    path.join(wsDir, 'frontend', 'src', 'main.tsx'),
    path.join(wsDir, 'frontend', 'src', 'main.jsx'),
    path.join(wsDir, 'frontend', 'src', 'App.tsx'),
    path.join(wsDir, 'frontend', 'src', 'App.jsx'),
  ];
  const entry = candidates.find((c) => {
    try {
      return fsSync.existsSync(c);
    } catch {
      return false;
    }
  });

  if (!entry) {
    return rawHtml || (await fs.readFile(absHtmlPath, 'utf-8'));
  }

  try {
    const rootNodeModules = path.resolve('node_modules');
    const backendNodeModules = path.resolve('backend/node_modules');
    const frontendNodeModules = path.resolve('frontend/node_modules');

    const buildRes = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2022',
      nodePaths: [rootNodeModules, backendNodeModules, frontendNodeModules],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.PREVIEW_BASE_URL': JSON.stringify(''),
        'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      },
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        '.js': 'js',
        '.css': 'empty',
        '.json': 'json',
      },
    });

    const bundledJs = buildRes.outputFiles?.[0]?.text || '';
    const rawHtml = await fs.readFile(absHtmlPath, 'utf-8');
    const titleMatch = rawHtml.match(/<title>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Production Live Preview';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
      window.process = { env: { NODE_ENV: 'production', PREVIEW_BASE_URL: window.location.origin } };
      window.global = window;
      window.addEventListener('error', function(e) {
        console.error('Workspace Preview Error:', e.error || e.message);
        var root = document.getElementById('root');
        if (root && root.children.length === 0) {
          root.innerHTML = '<div style="padding: 24px; color: #ef4444; font-family: monospace; background: #090d16; min-height: 100vh;">' +
            '<h2 style="font-size: 16px; font-weight: bold; margin-bottom: 8px;">Workspace Preview Error</h2>' +
            '<pre style="white-space: pre-wrap; font-size: 12px; color: #fca5a5;">' + (e.error ? (e.error.stack || e.error.message) : e.message) + '</pre>' +
          '</div>';
        }
      });
    </script>
    <style>
      body { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; margin: 0; padding: 0; }
    </style>
  </head>
  <body class="bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white min-h-screen">
    <div id="root"></div>
    <script type="module">
${bundledJs}
    </script>
  </body>
</html>`;
  } catch (err: any) {
    console.warn('Failed to bundle preview with esbuild, falling back to raw html:', err);
    return await fs.readFile(absHtmlPath, 'utf-8');
  }
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

async function resolveUserOrgIds(req: {
  headers?: Record<string, unknown>;
  get: (h: string) => string | undefined;
}): Promise<string[]> {
  try {
    const authHeader = req.get('authorization');
    const rawCookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
    const cookieTokenMatch = rawCookie.match(/(?:^|;\s*)(?:nexus_token|access_token|token)=([^;]+)/);
    const jwtToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : (cookieTokenMatch ? decodeURIComponent(cookieTokenMatch[1]) : undefined);

    if (jwtToken) {
      const payload = verifyAccessToken(jwtToken);
      if (payload?.userId) {
        const memberships = await prisma.orgMember.findMany({
          where: { userId: payload.userId },
          select: { organizationId: true },
        });
        return memberships.map((m) => m.organizationId);
      }
    }
  } catch {
    /* unauthenticated */
  }
  return [];
}

router.get('/:processId', async (req, res) => {
  const token = shareToken(req);
  const userOrgIds = await resolveUserOrgIds(req);
  if (!(await canViewPreview(req.params.processId, token, userOrgIds))) {
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
  const userOrgIds = await resolveUserOrgIds(req);
  if (!(await canViewPreview(req.params.processId, token, userOrgIds))) {
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

  res.setHeader('Content-Type', type);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  if (type.startsWith('text/html')) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' data: https: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https: data:; frame-ancestors 'self'; sandbox allow-scripts allow-forms allow-same-origin allow-modals;"
    );
    const htmlContent = await buildPreviewHtml(req.params.processId, abs);
    return res.send(htmlContent);
  }
  res.send(body);
});

export default router;
