import { safeFetch } from '../../lib/url-validator.js';

/**
 * Research tools: web search, reading a public page, and npm package facts.
 * Search uses Tavily or Brave when their key is set, otherwise DuckDuckGo's
 * HTML endpoint, with Wikipedia as the keyless fallback.
 */

export interface SearchResult { title: string; url: string; snippet: string }

const UA = 'Mozilla/5.0 (compatible; MyceliumOps-Research/1.0; +https://multi-agent-flow.vercel.app)';

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'", '#x2F': '/' };
export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z#0-9]+);/gi, (m, name) => ENTITIES[name] ?? m);
}
const stripTags = (s: string) => decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

async function tavily(query: string, limit: number, key: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: limit }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data.results ?? []).map((r: any) => ({ title: r.title, url: r.url, snippet: String(r.content ?? '').slice(0, 300) }));
}

async function brave(query: string, limit: number, key: string): Promise<SearchResult[]> {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${limit}`, {
    headers: { Accept: 'application/json', 'X-Subscription-Token': key },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data.web?.results ?? []).map((r: any) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.description ?? '') }));
}

/** Parses DuckDuckGo's no-JavaScript results page. */
export function parseDuckDuckGo(html: string, limit: number): SearchResult[] {
  const results: SearchResult[] = [];
  const blocks = html.split(/<div[^>]+class="[^"]*\bresult\b[^"]*"/).slice(1);
  for (const block of blocks) {
    const link = /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/.exec(block);
    if (!link) continue;
    let url = decodeEntities(link[1]);
    const wrapped = /[?&]uddg=([^&]+)/.exec(url);
    if (wrapped) url = decodeURIComponent(wrapped[1]);
    if (url.startsWith('//')) url = `https:${url}`;
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) continue; // ads
    const snippet = /class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(a|div|td)>/.exec(block);
    results.push({ title: stripTags(link[2]), url, snippet: snippet ? stripTags(snippet[1]) : '' });
    if (results.length >= limit) break;
  }
  return results;
}

async function duckDuckGo(query: string, limit: number): Promise<SearchResult[]> {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
    body: new URLSearchParams({ q: query }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`);
  return parseDuckDuckGo(await res.text(), limit);
}

async function wikipedia(query: string, limit: number): Promise<SearchResult[]> {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=${limit}&srsearch=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Wikipedia HTTP ${res.status}`);
  const data = (await res.json()) as any;
  return (data.query?.search ?? []).map((r: any) => ({
    title: r.title,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(String(r.title).replace(/ /g, '_'))}`,
    snippet: stripTags(r.snippet ?? ''),
  }));
}

export async function webSearch(query: string, limit = 5): Promise<{ query: string; source: string; results: SearchResult[] }> {
  const q = query.trim();
  if (!q) throw new Error('Give a search query');
  const n = Math.max(1, Math.min(10, Math.round(limit)));
  const providers: Array<[string, () => Promise<SearchResult[]>]> = [];
  if (process.env.TAVILY_API_KEY) providers.push(['tavily', () => tavily(q, n, process.env.TAVILY_API_KEY!)]);
  if (process.env.BRAVE_API_KEY) providers.push(['brave', () => brave(q, n, process.env.BRAVE_API_KEY!)]);
  providers.push(['duckduckgo', () => duckDuckGo(q, n)], ['wikipedia', () => wikipedia(q, n)]);

  const failures: string[] = [];
  for (const [source, search] of providers) {
    try {
      const results = await search();
      if (results.length) return { query: q, source, results };
      failures.push(`${source}: no results`);
    } catch (err) {
      failures.push(`${source}: ${(err as Error).message}`);
    }
  }
  if (failures.every((f) => f.endsWith('no results'))) return { query: q, source: 'none', results: [] };
  throw new Error(`Search failed (${failures.join('; ')})`);
}

/** Readable text of an HTML page: title, then body text without scripts, styles or markup. */
export function htmlToText(html: string): { title: string; text: string } {
  const title = stripTags(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '');
  const body = (/<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html)
    .replace(/<(script|style|noscript|svg|template|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => `\n${'#'.repeat(Number(n))} `);
  const text = decodeEntities(body.replace(/<[^>]+>/g, ' '))
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
  return { title, text };
}

const MAX_PAGE_BYTES = 2_000_000;

/**
 * Fetches a public page and returns its text. Private and internal addresses
 * are refused, and each redirect hop is validated again before it is followed.
 */
export async function fetchUrl(url: string, maxChars = 6000): Promise<{ url: string; status: number; contentType: string; title: string; text: string; truncated: boolean }> {
  let target = url.trim();
  if (!/^https?:\/\//i.test(target)) target = `https://${target}`;
  let res: Response | null = null;
  for (let hop = 0; hop < 4; hop++) {
    res = await safeFetch(target, { method: 'GET', headers: { 'User-Agent': UA, Accept: 'text/html,application/json,text/plain;q=0.9,*/*;q=0.5' }, timeoutMs: 12_000 });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      target = new URL(location, target).toString();
      continue;
    }
    break;
  }
  if (!res) throw new Error('No response');
  if (res.status >= 300 && res.status < 400) throw new Error(`Too many redirects (last: ${target})`);

  const contentType = res.headers.get('content-type') ?? '';
  const declared = Number(res.headers.get('content-length'));
  if (declared > MAX_PAGE_BYTES) throw new Error(`The page is too large (${declared} bytes)`);
  if (/^(image|audio|video|font)\/|application\/(pdf|zip|octet-stream)/i.test(contentType)) {
    throw new Error(`Not a text page (${contentType})`);
  }
  const raw = (await res.text()).slice(0, MAX_PAGE_BYTES);
  const limit = Math.max(500, Math.min(20_000, Math.round(maxChars)));
  let title = '';
  let text = raw;
  if (/html/i.test(contentType) || /^\s*<(!doctype|html)/i.test(raw)) ({ title, text } = htmlToText(raw));
  else if (/json/i.test(contentType)) {
    try { text = JSON.stringify(JSON.parse(raw), null, 2); } catch { /* keep raw */ }
  }
  return { url: target, status: res.status, contentType, title, text: text.slice(0, limit), truncated: text.length > limit };
}

/** Facts about an npm package from the public registry. */
export async function packageInfo(name: string): Promise<Record<string, unknown>> {
  const pkg = name.trim();
  if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(pkg)) throw new Error(`"${name}" is not a valid npm package name`);
  const res = await fetch(`https://registry.npmjs.org/${pkg.replace('/', '%2F')}`, {
    headers: { Accept: 'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8' },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new Error(`No npm package named "${pkg}"`);
  if (!res.ok) throw new Error(`npm registry HTTP ${res.status}`);
  const data = (await res.json()) as any;
  const latest = data['dist-tags']?.latest;
  const manifest = data.versions?.[latest] ?? {};
  let weeklyDownloads: number | undefined;
  try {
    const dl = await fetch(`https://api.npmjs.org/downloads/point/last-week/${pkg}`, { signal: AbortSignal.timeout(6_000) });
    if (dl.ok) weeklyDownloads = ((await dl.json()) as any).downloads;
  } catch { /* optional */ }
  return {
    name: pkg,
    latest,
    modified: data.modified,
    deprecated: manifest.deprecated || undefined,
    peerDependencies: manifest.peerDependencies,
    dependencies: manifest.dependencies ? Object.keys(manifest.dependencies).length : 0,
    engines: manifest.engines,
    weeklyDownloads,
    recentVersions: Object.keys(data.versions ?? {}).slice(-5),
  };
}
