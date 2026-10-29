import { createHash } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';
import { calculate } from './tools/calculate.js';
import { forecast } from './tools/forecast.js';
import { webSearch, fetchUrl, packageInfo } from './tools/web.js';
import { parseFile } from './tools/files.js';
import { projectLookup, runMetricSeries, LOOKUPS, RUN_METRICS } from './tools/project-data.js';

/**
 * MyceliumOps' built-in MCP tool servers.
 *
 *   research  — web_search, fetch_url, package_info   (external web APIs)
 *   analytics — calculate, forecast, parse_file, project_lookup
 *
 * Each server is a real MCP server (official SDK). Agents reach them over
 * Streamable HTTP (routes/mcp-tools.ts) from their OpenCode session; Mother
 * Chat and the Tools window connect in-process through an MCP client. Either
 * way every call is recorded as a ToolCall against the production and run.
 */

export const SERVERS = ['research', 'analytics'] as const;
export type ServerName = (typeof SERVERS)[number];

/** Who is calling, for which production and run. Bound into every connection. */
export interface ToolContext {
  organizationId: string;
  processId: string;
  runId?: string | null;
  caller: string;
  workspace: string;
}

interface ToolDef {
  server: ServerName;
  name: string;
  title: string;
  description: string;
  input: z.ZodRawShape;
  run: (args: any, ctx: ToolContext) => Promise<unknown>;
}

export const TOOLS: ToolDef[] = [
  {
    server: 'research',
    name: 'web_search',
    title: 'Web search',
    description: 'Search the web. Returns titles, URLs and snippets. Use it to check current facts, library APIs, design references or examples before deciding.',
    input: { query: z.string().min(1).max(300).describe('What to search for'), limit: z.number().int().min(1).max(10).optional().describe('Results to return (default 5)') },
    run: ({ query, limit }) => webSearch(query, limit ?? 5),
  },
  {
    server: 'research',
    name: 'fetch_url',
    title: 'Read a web page',
    description: 'Fetch a public web page or JSON endpoint and return its readable text (title, headings, body). Private and internal addresses are refused.',
    input: { url: z.string().min(4).max(2000).describe('http(s) URL'), maxChars: z.number().int().min(500).max(20000).optional().describe('Text to return (default 6000)') },
    run: ({ url, maxChars }) => fetchUrl(url, maxChars ?? 6000),
  },
  {
    server: 'research',
    name: 'package_info',
    title: 'npm package facts',
    description: 'Look up an npm package in the public registry: latest version, peer dependencies, engines, deprecation and weekly downloads. Use it before adding or upgrading a dependency.',
    input: { name: z.string().min(1).max(214).describe('Package name, e.g. "react" or "@tanstack/react-query"') },
    run: ({ name }) => packageInfo(name),
  },
  {
    server: 'analytics',
    name: 'calculate',
    title: 'Calculator',
    description: 'Evaluate an arithmetic expression exactly: + - * / % ^, parentheses, sqrt, abs, round, floor, ceil, exp, ln, log, log2, sin, cos, tan, min, max, pow, sum, avg, pi, e. Use it instead of doing arithmetic in your head.',
    input: { expression: z.string().min(1).max(500).describe('e.g. "(1200 * 1.18) / 12" or "sum(4, 8, 15) / 3"') },
    run: ({ expression }) => Promise.resolve(calculate(expression)),
  },
  {
    server: 'analytics',
    name: 'forecast',
    title: 'Forecast',
    description: "Forecast the next values of a numeric series with Holt's exponential smoothing (plus a linear-regression trend). Pass `values`, or `metric` to forecast this production's own run history (duration_seconds, tokens or cost_usd).",
    input: {
      values: z.array(z.number()).max(500).optional().describe('The series, oldest first'),
      metric: z.enum(RUN_METRICS).optional().describe("Use this production's completed runs instead of `values`"),
      horizon: z.number().int().min(1).max(24).optional().describe('Steps ahead (default 3)'),
    },
    run: async ({ values, metric, horizon }, ctx) => {
      const series = values?.length ? values : metric ? await runMetricSeries(ctx.organizationId, ctx.processId, metric) : [];
      if (!series.length) throw new Error(metric ? `No completed runs with ${metric} to forecast yet` : 'Give `values` or a `metric`');
      return { source: values?.length ? 'values' : `run history: ${metric}`, history: series, ...forecast(series, horizon ?? 3) };
    },
  },
  {
    server: 'analytics',
    name: 'parse_file',
    title: 'Parse a workspace file',
    description: "Parse a file in this production's workspace into a structured summary: CSV/TSV columns and numeric stats, JSON shape, package.json scripts and dependencies, Markdown outline, or a code file's imports, exports and functions. Pass a directory (or nothing) to list the files.",
    input: { path: z.string().max(500).optional().describe('Path relative to the workspace root') },
    run: ({ path }, ctx) => parseFile(ctx.workspace, path ?? ''),
  },
  {
    server: 'analytics',
    name: 'project_lookup',
    title: 'Production database lookup',
    description: "Read-only lookup in the MyceliumOps database for this production: summary, runs, agents, blackboard entries or tool_calls.",
    input: {
      lookup: z.enum(LOOKUPS).describe('What to look up'),
      limit: z.number().int().min(1).max(50).optional().describe('Rows to return (default 10)'),
    },
    run: ({ lookup, limit }, ctx) => projectLookup(ctx.organizationId, ctx.processId, lookup, limit ?? 10),
  },
];

const MODEL_TEXT_LIMIT = 12_000;
const STORED_TEXT_LIMIT = 4_000;

type ToolEvent = (processId: string, organizationId: string, call: unknown) => void;
let onToolCall: ToolEvent = () => {};
/** Lets the app push each recorded call to the production's live views. */
export function setToolCallListener(listener: ToolEvent) {
  onToolCall = listener;
}

async function record(ctx: ToolContext, def: ToolDef, input: unknown, output: string, ok: boolean, durationMs: number) {
  try {
    const row = await prisma.toolCall.create({
      data: {
        organizationId: ctx.organizationId,
        processId: ctx.processId,
        runId: ctx.runId ?? null,
        server: def.server,
        tool: def.name,
        caller: ctx.caller.slice(0, 120),
        input: (input ?? {}) as Prisma.InputJsonValue,
        output: output.slice(0, STORED_TEXT_LIMIT),
        ok,
        durationMs,
      },
    });
    onToolCall(ctx.processId, ctx.organizationId, row);
  } catch (err) {
    logger.warn({ err, tool: def.name }, 'Could not record MCP tool call');
  }
}

/** A fresh MCP server exposing one built-in toolset, bound to a caller. */
export function createToolServer(server: ServerName, ctx: ToolContext): McpServer {
  const mcp = new McpServer({ name: `myceliumops-${server}`, version: '1.0.0' });
  for (const def of TOOLS.filter((t) => t.server === server)) {
    mcp.registerTool(def.name, { title: def.title, description: def.description, inputSchema: def.input }, async (args: unknown) => {
      const started = Date.now();
      try {
        const result = await def.run(args, ctx);
        const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        await record(ctx, def, args, text, true, Date.now() - started);
        return { content: [{ type: 'text' as const, text: text.slice(0, MODEL_TEXT_LIMIT) }] };
      } catch (err) {
        const message = (err as Error).message || 'Tool failed';
        await record(ctx, def, args, message, false, Date.now() - started);
        return { content: [{ type: 'text' as const, text: `Error: ${message}` }], isError: true };
      }
    });
  }
  return mcp;
}

/** An MCP client connected in-process to a built-in server — the same protocol, no network hop. */
export async function connectToolServer(server: ServerName, ctx: ToolContext): Promise<Client> {
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createToolServer(server, ctx).connect(serverSide);
  const client = new Client({ name: 'myceliumops', version: '1.0.0' });
  await client.connect(clientSide);
  return client;
}

// ─── Access for agent sessions ──────────────────────────────────────────

/** Signing key for tool tokens, derived so it never doubles as a login token. */
const tokenKey = () => createHash('sha256').update(`mcp-tools:${process.env.JWT_SECRET || 'dev-only-secret'}`).digest();

interface TokenClaims { o: string; p: string; r?: string | null; c: string }

export function issueToolToken(ctx: Omit<ToolContext, 'workspace'>, ttlSeconds = 4 * 3600): string {
  const claims: TokenClaims = { o: ctx.organizationId, p: ctx.processId, r: ctx.runId ?? null, c: ctx.caller };
  return jwt.sign(claims, tokenKey(), { expiresIn: ttlSeconds, audience: 'myceliumops-mcp-tools' });
}

export function verifyToolToken(token: string): Omit<ToolContext, 'workspace'> {
  const claims = jwt.verify(token, tokenKey(), { audience: 'myceliumops-mcp-tools' }) as TokenClaims;
  return { organizationId: claims.o, processId: claims.p, runId: claims.r ?? null, caller: claims.c };
}

export const toolsEnabled = () => process.env.MCP_TOOLS_DISABLED !== 'true';

/** Where agent processes on this host reach the tool servers. */
const toolsBaseUrl = () => (process.env.MCP_TOOLS_BASE_URL?.trim() || `http://127.0.0.1:${config.port}`).replace(/\/+$/, '');

/**
 * Environment that gives one OpenCode session the built-in tool servers:
 * OpenCode reads extra config from OPENCODE_CONFIG_CONTENT, and the bearer
 * token ties every call it makes to this production, run and agent.
 */
export function openCodeToolEnv(ctx: Omit<ToolContext, 'workspace'>): Record<string, string> {
  if (!toolsEnabled()) return {};
  const token = issueToolToken(ctx);
  const mcp = Object.fromEntries(SERVERS.map((server) => [server, {
    type: 'remote',
    url: `${toolsBaseUrl()}/api/mcp-tools/${server}`,
    headers: { Authorization: `Bearer ${token}` },
    enabled: true,
  }]));
  return { OPENCODE_CONFIG_CONTENT: JSON.stringify({ $schema: 'https://opencode.ai/config.json', mcp }) };
}

/** The tool list for an agent's prompt, so it knows what to reach for and when. */
export function toolsPromptSection(): string {
  if (!toolsEnabled()) return '';
  return [
    '# Tools (MCP)',
    'Two MCP tool servers are connected to your session. Use them when they give you facts you would otherwise guess:',
    ...TOOLS.map((t) => `- \`${t.server}_${t.name}\` — ${t.description}`),
    'At minimum, check any library version you add with `research_package_info`, and use `analytics_calculate` for arithmetic. Mention the tools you used in your summary.',
  ].join('\n');
}

export function catalog() {
  return SERVERS.map((server) => ({
    server,
    tools: TOOLS.filter((t) => t.server === server).map((t) => ({ name: t.name, title: t.title, description: t.description })),
  }));
}
