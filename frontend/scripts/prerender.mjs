/**
 * Pre-rendering script for Nexus SEO
 *
 * Renders public routes at build time using Puppeteer so that
 * Google sees fully rendered HTML instead of a blank <div id="root">.
 *
 * Usage: node scripts/prerender.mjs
 * Runs automatically after `vite build` via the build script.
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = join(__dirname, '..', 'dist');
const PORT = Number(process.env.PRERENDER_PORT || 45678);
const PRERENDER_HOST = process.env.PRERENDER_HOST || '127.0.0.1';
if (!Number.isInteger(PORT) || PORT <= 0) throw new Error('PRERENDER_PORT must be a positive integer');

// Public routes to pre-render
const ROUTES = [
  '/login',
  '/signup',
];

/**
 * Serve dist/ as a static file server with SPA fallback
 */
function startServer() {
  const fallbackHtml = readFileSync(join(DIST_DIR, 'index.html'), 'utf-8');

  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
  };

  const server = createServer((req, res) => {
    let filePath = join(DIST_DIR, req.url === '/' ? '/index.html' : req.url);

    try {
      if (existsSync(filePath) && !filePath.endsWith('/')) {
        const ext = filePath.substring(filePath.lastIndexOf('.'));
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      } else {
        // SPA fallback
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallbackHtml);
      }
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fallbackHtml);
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, () => {
      console.log(`[prerender] Static server running on http://${PRERENDER_HOST}:${PORT}`);
      resolve(server);
    });
  });
}

async function prerender() {
  console.log('[prerender] Starting pre-rendering of public routes...\n');

  if (!existsSync(DIST_DIR)) {
    console.error('[prerender] Error: dist/ directory not found. Run `vite build` first.');
    process.exit(1);
  }

  const server = await startServer();

  const launchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  };

  // Support system-installed Chromium (e.g. in Docker/Alpine)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const browser = await puppeteer.launch(launchOptions);

  let successCount = 0;

  for (const route of ROUTES) {
    try {
      const page = await browser.newPage();
      const url = `http://${PRERENDER_HOST}:${PORT}${route}`;

      await page.goto(url, {
        waitUntil: 'networkidle0',
        timeout: 15000,
      });

      // Wait a bit for React to finish rendering
      await page.waitForSelector('#root > *', { timeout: 10000 });

      const html = await page.content();

      // Determine output path
      const outputDir =
        route === '/'
          ? DIST_DIR
          : join(DIST_DIR, route);

      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const outputFile = join(outputDir, 'index.html');
      writeFileSync(outputFile, html, 'utf-8');

      const relPath = outputFile.replace(DIST_DIR, 'dist');
      console.log(`  [ok] ${route} → ${relPath}`);
      successCount++;

      await page.close();
    } catch (err) {
      console.error(`  [fail] ${route}: ${err.message}`);
    }
  }

  await browser.close();
  server.close();

  console.log(
    `\n[prerender] Done: ${successCount}/${ROUTES.length} routes pre-rendered.`
  );
}

if (process.env.VERCEL) {
  console.log('[prerender] Vercel build environment detected. Skipping Puppeteer pre-render.');
  process.exit(0);
}

prerender().catch((err) => {
  if (err.message && err.message.includes('Could not find Chrome')) {
    console.warn('[prerender] Warning: Chrome binary not found for static pre-rendering. Skipping pre-render step.');
    process.exit(0);
  }
  console.error('[prerender] Fatal error:', err);
  process.exit(1);
});
