import { describe, it, expect, vi, beforeEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const recorded: any[] = [];
vi.mock('../lib/prisma.js', () => ({
  prisma: { toolCall: { create: vi.fn(async ({ data }: any) => { recorded.push(data); return { id: 'tc1', ...data }; }) } },
}));

const { calculate, evaluate } = await import('../mcp/tools/calculate.js');
const { forecast } = await import('../mcp/tools/forecast.js');
const { parseDuckDuckGo, htmlToText } = await import('../mcp/tools/web.js');
const { summarizeCsv, resolveInside, parseFile } = await import('../mcp/tools/files.js');
const { connectToolServer, issueToolToken, verifyToolToken, openCodeToolEnv, toolsPromptSection } = await import('../mcp/builtin-servers.js');

describe('calculate', () => {
  it('follows operator precedence, right-associative powers and functions', () => {
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('2 ^ 3 ^ 2')).toBe(512);
    expect(evaluate('-2 ^ 2')).toBe(-4);
    expect(evaluate('sqrt(16) + max(1, 7, 3) + avg(2, 4)')).toBe(14);
    expect(calculate('1 / 3').formatted).toBe('0.333333333333');
    expect(calculate('1234 * 5678 + 91').result).toBe(7006743);
  });

  it('refuses anything that is not arithmetic', () => {
    expect(() => evaluate('process.exit(1)')).toThrow(/Unexpected character|Unknown name/);
    expect(() => evaluate('constructor')).toThrow(/Unknown name/);
    expect(() => evaluate('2 +')).toThrow();
    expect(() => calculate('1 / 0')).toThrow(/not a finite number/);
  });
});

describe('forecast', () => {
  it('continues a linear trend', () => {
    const f = forecast([10, 12, 14, 16, 18, 20], 2);
    expect(f.trend.direction).toBe('rising');
    expect(f.forecast[0].value).toBeCloseTo(22, 0);
    expect(f.forecast[1].value).toBeCloseTo(24, 0);
    expect(f.regression?.r2).toBeCloseTo(1, 5);
    expect(f.forecast[1].high - f.forecast[1].low).toBeGreaterThanOrEqual(f.forecast[0].high - f.forecast[0].low);
  });

  it('falls back to the mean with too few points', () => {
    const f = forecast([5, 7], 3);
    expect(f.method).toMatch(/mean/);
    expect(f.forecast).toHaveLength(3);
    expect(f.forecast[0].value).toBe(6);
  });
});

describe('web parsing', () => {
  it('reads DuckDuckGo results and unwraps their redirect links', () => {
    const html = `
      <div class="result results_links web-result"><h2><a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freact.dev%2Freference&amp;rut=x">React <b>Reference</b></a></h2>
      <a class="result__snippet" href="#">The library for web &amp; native user interfaces</a></div>
      <div class="result results_links web-result"><a class="result__a" href="https://vitejs.dev/">Vite</a><a class="result__snippet">Next generation tooling</a></div>`;
    expect(parseDuckDuckGo(html, 5)).toEqual([
      { title: 'React Reference', url: 'https://react.dev/reference', snippet: 'The library for web & native user interfaces' },
      { title: 'Vite', url: 'https://vitejs.dev/', snippet: 'Next generation tooling' },
    ]);
  });

  it('turns a page into readable text without scripts', () => {
    const { title, text } = htmlToText('<html><head><title>Docs &amp; Guides</title></head><body><script>evil()</script><h1>Intro</h1><p>Hello <b>world</b></p><ul><li>One</li></ul></body></html>');
    expect(title).toBe('Docs & Guides');
    expect(text).toContain('# Intro');
    expect(text).toContain('Hello world');
    expect(text).toContain('- One');
    expect(text).not.toContain('evil');
  });
});

describe('parse_file', () => {
  it('summarises CSV columns with numeric stats', () => {
    const s = summarizeCsv('date,amount,category\n2026-01-01,12.5,food\n2026-01-02,"1,000",rent\n2026-01-03,7.5,food', ',');
    expect(s.rows).toBe(3);
    expect(s.columns[1]).toMatchObject({ name: 'amount', type: 'number', min: 7.5, max: 1000, sum: 1020 });
    expect(s.columns[2]).toMatchObject({ name: 'category', type: 'text', distinct: 2 });
  });

  it('stays inside the workspace', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ws-'));
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'app', scripts: { dev: 'vite' }, dependencies: { react: '^19.0.0' } }));
    expect(() => resolveInside(root, '../etc/passwd')).toThrow(/outside the workspace/);
    await expect(parseFile(root, '../../secret')).rejects.toThrow(/outside the workspace/);
    expect(await parseFile(root, 'package.json')).toMatchObject({ kind: 'package.json', scripts: { dev: 'vite' }, dependencies: { react: '^19.0.0' } });
    expect(await parseFile(root)).toMatchObject({ kind: 'directory', files: ['package.json'] });
    // Absolute paths inside the workspace, and root-relative ones, both work.
    expect(await parseFile(root, path.join(root, 'package.json'))).toMatchObject({ kind: 'package.json' });
    expect(await parseFile(root, '/package.json')).toMatchObject({ kind: 'package.json' });
  });
});

describe('built-in MCP servers', () => {
  beforeEach(() => { recorded.length = 0; });
  const ctx = { organizationId: 'org1', processId: 'proc1', runId: 'run1', caller: 'QA Reviewer', workspace: os.tmpdir() };

  it('lists their tools and runs a call over MCP, recording who made it', async () => {
    const client = await connectToolServer('analytics', ctx);
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['calculate', 'forecast', 'parse_file', 'project_lookup']);
    expect(tools.find((t) => t.name === 'calculate')?.inputSchema).toMatchObject({ type: 'object', required: ['expression'] });

    const result = await client.callTool({ name: 'calculate', arguments: { expression: '(1200 * 1.18) / 12' } });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse((result.content as any)[0].text)).toMatchObject({ result: 118 });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ server: 'analytics', tool: 'calculate', caller: 'QA Reviewer', runId: 'run1', ok: true });

    const bad = await client.callTool({ name: 'calculate', arguments: { expression: 'rm -rf /' } });
    expect(bad.isError).toBe(true);
    expect(recorded[1]).toMatchObject({ ok: false });
    await client.close();
  });

  it('gives research its own toolset', async () => {
    const client = await connectToolServer('research', ctx);
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(['fetch_url', 'package_info', 'web_search']);
    await client.close();
  });

  it('issues tool tokens bound to one production and run', () => {
    const token = issueToolToken(ctx);
    expect(verifyToolToken(token)).toEqual({ organizationId: 'org1', processId: 'proc1', runId: 'run1', caller: 'QA Reviewer' });
    expect(() => verifyToolToken(token.slice(0, -2) + 'xx')).toThrow();
  });

  it('hands OpenCode both servers through its config environment', () => {
    const env = openCodeToolEnv(ctx);
    const cfg = JSON.parse(env.OPENCODE_CONFIG_CONTENT);
    expect(Object.keys(cfg.mcp)).toEqual(['research', 'analytics']);
    expect(cfg.mcp.analytics).toMatchObject({ type: 'remote', enabled: true });
    expect(cfg.mcp.analytics.url).toMatch(/\/api\/mcp-tools\/analytics$/);
    expect(cfg.mcp.analytics.headers.Authorization).toMatch(/^Bearer /);
    expect(toolsPromptSection()).toContain('`analytics_forecast`');
  });

  it('keeps the tool servers when the launcher adds the workspace boundary', async () => {
    const { withWorkspaceBoundary } = await import('../services/opencode.service.js');
    const merged = JSON.parse(withWorkspaceBoundary(openCodeToolEnv(ctx).OPENCODE_CONFIG_CONTENT));
    expect(Object.keys(merged.mcp)).toEqual(['research', 'analytics']);
    expect(merged.permission).toEqual({ external_directory: 'deny' });
    expect(JSON.parse(withWorkspaceBoundary()).permission).toEqual({ external_directory: 'deny' });
  });
});
