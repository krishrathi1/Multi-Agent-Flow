import { Router } from 'express';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import fsSync from 'node:fs';
import esbuild from 'esbuild';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
import { resolveWorkspaceFile, listWorkspaceFiles, ensureWorkspaceDeliverables } from '../services/agent-runner.service.js';
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
  let files = await listWorkspaceFiles(processId);
  let html = files.filter((f) => f.path.endsWith('.html'));
  if (html.length === 0) {
    await ensureWorkspaceDeliverables(processId);
    files = await listWorkspaceFiles(processId);
    html = files.filter((f) => f.path.endsWith('.html'));
  }
  if (html.length === 0) return null;

  // Prefer a root index.html, then any index.html, then the first page.
  return (
    html.find((f) => f.path === 'index.html')?.path ??
    html.find((f) => f.path.endsWith('/index.html'))?.path ??
    html[0].path
  );
}

/**
 * Keeps a generated site inside /preview/:processId/.
 *
 * The preview shares the console's origin, so every root-relative URL in a
 * built site — `href="/"`, `src="/main.js"`, a router's `/about` — resolved
 * to MyceliumOps itself, and the Watch Preview iframe showed the platform
 * instead of the project the user asked for.
 */
export function confineToPreview(
  html: string,
  processId: string,
  relPath: string,
  bundledSpa: boolean,
  entryPath: string = relPath,
): string {
  const root = `/preview/${processId}/`;
  const dir = path.posix.dirname(relPath);
  const base = dir === '.' ? root : `${root}${dir}/`;
  // "/" means the site's entry page, not the page being served. Vercel's
  // rewrite doesn't match a bare trailing slash, so it's the file itself.
  const home = `${root}${entryPath}`;
  const ownPrefix = root.slice(1);

  const out = html.replace(
    /(\s(?:src|href|action|poster)\s*=\s*["'])\/(?!\/)([^"']*)/gi,
    (match, attr: string, rest: string) =>
      rest.startsWith(ownPrefix) ? match : attr + (rest === '' ? home : root + rest),
  );

  const runtime = `<script>(function(){
var root=${JSON.stringify(root)},home=${JSON.stringify(home)},entry=${JSON.stringify(relPath)};
function fix(u){if(typeof u!=='string'||u.charAt(0)!=='/'||u.charAt(1)==='/'||u.indexOf(root)===0)return u;return u==='/'?home:root+u.slice(1);}
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(!a)return;var h=a.getAttribute('href'),f=fix(h);if(f!==h)a.setAttribute('href',f);},true);
${bundledSpa ? `var p=location.pathname;if(p.indexOf(root)===0){var rest=p.slice(root.length);if(rest===entry)rest='';history.replaceState(history.state,'','/'+rest+location.search+location.hash);}` : ''}
})();</script>`;
  const head = (/<base\s/i.test(out) ? '' : `<base href="${base}">`) + runtime;

  return /<head[^>]*>/i.test(out)
    ? out.replace(/<head[^>]*>/i, m => m + head)
    : head + out;
}

/** Node globals some bundles expect, plus a visible message if the app throws on load. */
const PREVIEW_RUNTIME_SHIM = `<script>
window.process = window.process || { env: { NODE_ENV: 'production', PREVIEW_BASE_URL: window.location.origin } };
window.global = window;
window.addEventListener('error', function (e) {
  var host = document.getElementById('root') || document.body;
  if (!host || host.querySelector('[data-preview-error]')) return;
  var box = document.createElement('div');
  box.setAttribute('data-preview-error', '');
  box.style.cssText = 'margin:16px;padding:16px;border:1px solid #fca5a5;border-radius:8px;background:#fef2f2;color:#991b1b;font:13px/1.5 ui-monospace,monospace;white-space:pre-wrap';
  box.textContent = 'This app threw an error while loading:\\n' + (e.error ? (e.error.stack || e.error.message) : e.message);
  host.prepend(box);
});
</script>
`;

const TAILWIND_BROWSER_CDN = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';

/** Drops Tailwind build directives from CSS; the in-browser build supplies them. */
const tailwindDirectivesPlugin: esbuild.Plugin = {
  name: 'strip-tailwind-directives',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = await fs.readFile(args.path, 'utf-8');
      if (!/tailwind|@config|@plugin/.test(css)) return undefined;
      const contents = css
        .replace(/@import\s+(url\()?["']tailwindcss[^"']*["']\)?[^;]*;/g, '')
        .replace(/@tailwind\s+[\w-]+\s*;/g, '')
        .replace(/@(config|plugin)\s+["'][^"']+["']\s*;/g, '');
      return { contents, loader: args.path.endsWith('.module.css') ? 'local-css' : 'css' };
    });
  },
};

async function workspaceMentions(wsDir: string, needle: string): Promise<boolean> {
  for (const f of ['package.json', 'tailwind.config.js', 'tailwind.config.ts', 'index.html']) {
    try {
      if ((await fs.readFile(path.join(wsDir, f), 'utf-8')).toLowerCase().includes(needle)) return true;
    } catch { /* missing */ }
  }
  return false;
}

/**
 * Bundles React/TSX components on-the-fly with esbuild and creates an interactive live preview.
 * `bundled` is true when the page was rebuilt around a client-side app.
 */
export async function buildPreviewHtml(processId: string, absHtmlPath: string): Promise<{ html: string; bundled: boolean }> {
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
    return { html: rawHtml || (await fs.readFile(absHtmlPath, 'utf-8')), bundled: false };
  }

  try {
    await ensureDependencies(wsDir);
    // Resolved from this file, not process.cwd(): under pm2 the cwd is
    // backend/, so these became backend/backend/node_modules and never
    // reached the repo-root packages (react, recharts, …).
    const rootNodeModules = path.join(REPO_DIR, 'node_modules');
    const backendNodeModules = path.join(BACKEND_DIR, 'node_modules');
    const frontendNodeModules = path.join(REPO_DIR, 'frontend', 'node_modules');

    const buildRes = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      // outdir only names the outputs; with write:false nothing touches disk.
      // It lets CSS imported from the app come out as its own file.
      outdir: path.join(wsDir, '.preview-out'),
      format: 'esm',
      target: 'es2022',
      nodePaths: [rootNodeModules, backendNodeModules, frontendNodeModules],
      // Match what Vite gives generated apps, so any React/Vite project
      // previews without per-project fixes: the automatic JSX runtime (no
      // `import React` needed), import.meta.env, and the common "@/" alias.
      jsx: 'automatic',
      alias: fsSync.existsSync(path.join(wsDir, 'src')) ? { '@': path.join(wsDir, 'src') } : {},
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.PREVIEW_BASE_URL': JSON.stringify(''),
        'process.env': JSON.stringify({ NODE_ENV: 'production' }),
        'import.meta.env': JSON.stringify({ MODE: 'production', DEV: false, PROD: true, SSR: false, BASE_URL: '/' }),
      },
      loader: {
        '.tsx': 'tsx',
        '.ts': 'ts',
        '.jsx': 'jsx',
        // JSX in .js files is common in generated React code.
        '.js': 'jsx',
        '.css': 'css',
        '.module.css': 'local-css',
        '.json': 'json',
        '.woff': 'dataurl',
        '.woff2': 'dataurl',
        '.ttf': 'dataurl',
        '.mp3': 'dataurl',
        '.wav': 'dataurl',
        '.svg': 'dataurl',
        '.png': 'dataurl',
        '.jpg': 'dataurl',
        '.jpeg': 'dataurl',
        '.gif': 'dataurl',
        '.webp': 'dataurl',
      },
      plugins: [tailwindDirectivesPlugin],
    });

    const outputs = buildRes.outputFiles ?? [];
    // A literal "</script>" inside the bundle would end the inline tag early.
    const bundledJs = (outputs.find((o) => o.path.endsWith('.js'))?.text || '').replace(/<\/script/gi, '<\\/script');
    const bundledCss = outputs.find((o) => o.path.endsWith('.css'))?.text || '';
    const usesTailwind = await workspaceMentions(wsDir, 'tailwind');

    // Tailwind needs its PostCSS build, which the preview doesn't run (and
    // generated projects often never installed it): `@import "tailwindcss"`
    // failed to resolve and the whole preview errored. Its in-browser build
    // generates the utility classes instead, and reading the app's CSS as
    // text/tailwindcss keeps @apply and @theme working.
    const headExtras =
      (usesTailwind ? `<script src="${TAILWIND_BROWSER_CDN}"></script>\n` : '') +
      PREVIEW_RUNTIME_SHIM +
      (bundledCss ? `<style${usesTailwind ? ' type="text/tailwindcss"' : ''}>\n${bundledCss}\n</style>\n` : '');
    const inlineScript = `<script type="module">\n${bundledJs}\n</script>`;

    // Keep the project's own document. The old path replaced it with an empty
    // <div id="root">, which only suits React apps: anything that renders into
    // its own markup (forms, sections) crashed on a null element, and imported
    // CSS was dropped while MyceliumOps' font and Tailwind were forced on top.
    const entryTag = rawHtml.match(/<script\b[^>]*\bsrc=["'][^"']+["'][^>]*>\s*<\/script>/gi)
      ?.find((tag) => /type=["']module["']/i.test(tag) && scriptSrcEntry && tag.includes(path.relative(wsDir, scriptSrcEntry).replace(/\\/g, '/')));

    let html: string;
    if (rawHtml && entryTag) {
      html = rawHtml.replace(entryTag, () => inlineScript);
    } else if (rawHtml && /<\/body>/i.test(rawHtml)) {
      const withRoot = /id=["']root["']/i.test(rawHtml) ? rawHtml : rawHtml.replace(/<body[^>]*>/i, (m) => `${m}\n<div id="root"></div>`);
      html = withRoot.replace(/<\/body>/i, () => `${inlineScript}\n</body>`);
    } else {
      html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="UTF-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1.0" />\n<title>Preview</title>\n</head>\n<body>\n<div id="root"></div>\n${inlineScript}\n</body>\n</html>`;
    }
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, () => `${headExtras}</head>`) : headExtras + html;
    return { html, bundled: true };
  } catch (err: any) {
    // The raw HTML points at /src/main.jsx, which a browser can't run, so
    // falling back to it showed a blank page. Say what failed instead.
    const messages: string[] = (err?.errors ?? []).slice(0, 8).map((e: any) =>
      `${e.location ? `${path.relative(wsDir, e.location.file)}:${e.location.line} — ` : ''}${e.text}`);
    if (messages.length === 0) messages.push(String(err?.message ?? err));
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return {
      html: `<!doctype html><html><head><meta charset="utf-8"><title>Preview build failed</title></head>
<body style="font:14px/1.5 system-ui,sans-serif;max-width:46rem;margin:3rem auto;padding:0 1rem;color:#111827">
<h1 style="font-size:20px">This project couldn't be built for preview</h1>
<p>The app's code has errors the preview bundler couldn't resolve. Fix these (for example by re-running the production or asking Mother Chat), then reload.</p>
<pre style="white-space:pre-wrap;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;color:#991b1b">${esc(messages.join('\n'))}</pre>
</body></html>`,
      bundled: false,
    };
  }
}

/** Where the backend's own dependencies live, regardless of the process cwd. */
const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(MODULE_DIR, '..', '..');
const REPO_DIR = path.resolve(BACKEND_DIR, '..');

const installs = new Map<string, Promise<void>>();

/**
 * Installs a workspace's declared dependencies when the agents didn't. The
 * bundler only falls back to the platform's own packages, so anything else a
 * project imports (a chart or date library) failed to resolve. Install
 * scripts are disabled: the package list came from an agent.
 */
async function ensureDependencies(wsDir: string): Promise<void> {
  let pkg: any;
  try { pkg = JSON.parse(await fs.readFile(path.join(wsDir, 'package.json'), 'utf-8')); } catch { return; }
  // Agents often install only part of what they declare, so the presence of
  // node_modules alone isn't enough: check each runtime dependency.
  const missing = Object.keys(pkg.dependencies ?? {})
    .filter((name) => !fsSync.existsSync(path.join(wsDir, 'node_modules', name, 'package.json')));
  const declaresAny = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
  if (!declaresAny || (fsSync.existsSync(path.join(wsDir, 'node_modules')) && missing.length === 0)) return;
  if (!installs.has(wsDir)) {
    installs.set(wsDir, execFileAsync(process.platform === 'win32' ? 'npm.cmd' : 'npm',
      ['install', '--no-audit', '--no-fund', '--ignore-scripts', '--loglevel=error'],
      { cwd: wsDir, timeout: 180_000, windowsHide: true, shell: process.platform === 'win32' })
      .then(() => undefined)
      .catch((e) => { console.warn('Preview dependency install failed:', (e as Error).message); }));
  }
  await installs.get(wsDir);
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

  let entry: string | null | undefined;
  const getEntry = async () => (entry === undefined ? (entry = await findIndex(req.params.processId)) : entry);

  let servedPath = relPath;
  let abs = await resolveWorkspaceFile(req.params.processId, relPath);
  if (!abs) {
    // Root-relative URLs are rebased to the workspace root, but a site built
    // in a subfolder (frontend/index.html) means its own folder by "/".
    const e = await getEntry();
    const entryDir = e ? path.posix.dirname(e) : '.';
    if (e && entryDir !== '.') {
      abs = await resolveWorkspaceFile(req.params.processId, `${entryDir}/${relPath}`);
      if (abs) servedPath = `${entryDir}/${relPath}`;
    }
    // An extensionless path is a client-side route: serve the app shell.
    // Hidden paths (.git/config) are never routes.
    const hidden = relPath.split('/').some(seg => seg.startsWith('.'));
    if (!abs && e && !hidden && !path.posix.extname(relPath)) {
      abs = await resolveWorkspaceFile(req.params.processId, e);
      servedPath = e;
    }
  }
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
    const { html, bundled } = await buildPreviewHtml(req.params.processId, abs);
    return res.send(confineToPreview(html, req.params.processId, servedPath, bundled, (await getEntry()) ?? servedPath));
  }
  res.send(body);
});

export default router;
