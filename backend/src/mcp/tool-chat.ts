import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { logger } from '../lib/logger.js';
import { connectToolServer, SERVERS, type ToolContext, type ServerName } from './builtin-servers.js';

/**
 * A chat turn that can call the built-in MCP tools: the tools are listed
 * from the MCP servers, offered to Groq as functions, and each call the model
 * makes is executed through the MCP client before it answers.
 */

/** Messages that are likely to need a tool; others take the plain chat path. */
export const TOOL_INTENT = /\b(forecast|predict|projection|trend|calculat|compute|how much|average|percent|sum of|total|estimate|search|look ?up|google|latest|version|npm|package|library|web|internet|online|https?:\/\/|url|website|page|parse|csv|json|file|workspace|runs?|history|cost|tokens|duration|database|db)\b/i;

// Groq models that support tool use well on the free tier.
const TOOL_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const TOOL_RESULT_CHARS = 4000;

export interface ToolChatResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  toolsUsed: Array<{ server: string; tool: string; ok: boolean }>;
}

type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> }
  | { role: 'tool'; tool_call_id: string; content: string };

async function groqCompletion(apiKey: string, model: string, messages: Message[], tools: unknown[]) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages, ...(tools.length ? { tools, tool_choice: 'auto' } : {}), temperature: 0.2, max_tokens: 1500 }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = (await res.json().catch(() => null)) as any;
    if (res.ok) return data;
    const retry = Number(res.headers.get('retry-after'));
    logger.warn({ model, status: res.status, error: data?.error?.message }, 'Groq tool-chat request rejected');
    if (res.status === 401) throw new Error('Groq rejected the API key');
    // The free tier's per-minute window often frees up within seconds.
    if (res.status === 429 && attempt === 0 && retry > 0 && retry <= 8) {
      await new Promise((r) => setTimeout(r, retry * 1000 + 250));
      continue;
    }
    return null;
  }
  return null;
}

export async function chatWithTools(params: {
  apiKey: string;
  system: string;
  prompt: string;
  ctx: ToolContext;
  maxRounds?: number;
}): Promise<ToolChatResult | null> {
  const clients = new Map<ServerName, Client>();
  try {
    const tools: unknown[] = [];
    for (const server of SERVERS) {
      const client = await connectToolServer(server, params.ctx);
      clients.set(server, client);
      const { tools: listed } = await client.listTools();
      for (const t of listed) {
        tools.push({ type: 'function', function: { name: `${server}_${t.name}`, description: t.description, parameters: t.inputSchema } });
      }
    }

    const messages: Message[] = [
      { role: 'system', content: `${params.system}\n\nYou can call MCP tools (web search, page reading, npm facts, calculator, forecasting, workspace file parsing, production database lookup). Call a tool whenever it gives a fact or number you would otherwise guess, then answer from its result and say which tool you used.` },
      { role: 'user', content: params.prompt },
    ];
    const toolsUsed: ToolChatResult['toolsUsed'] = [];
    let inputTokens = 0;
    let outputTokens = 0;

    for (const model of TOOL_MODELS) {
      for (let round = 0; round <= (params.maxRounds ?? 4); round++) {
        // On the last round, take tools away so the model has to answer.
        const data = await groqCompletion(params.apiKey, model, messages, round === (params.maxRounds ?? 4) ? [] : tools);
        if (!data) break;
        inputTokens += data.usage?.prompt_tokens ?? 0;
        outputTokens += data.usage?.completion_tokens ?? 0;
        const msg = data.choices?.[0]?.message;
        const calls = msg?.tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
        if (!calls?.length) {
          const text = String(msg?.content ?? '').trim();
          if (!text) break;
          return { text, model: `groq/${model}`, inputTokens, outputTokens, toolsUsed };
        }
        messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: c.function })) });
        for (const call of calls) {
          const [server, ...rest] = call.function.name.split('_');
          const tool = rest.join('_');
          const client = clients.get(server as ServerName);
          let content: string;
          let ok = false;
          if (!client) content = `Error: no tool named ${call.function.name}`;
          else {
            try {
              const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
              const result = await client.callTool({ name: tool, arguments: args });
              ok = !result.isError;
              content = ((result.content as Array<{ type: string; text?: string }>) ?? []).map((c) => c.text ?? '').join('\n');
            } catch (err) {
              content = `Error: ${(err as Error).message}`;
            }
          }
          toolsUsed.push({ server, tool, ok });
          messages.push({ role: 'tool', tool_call_id: call.id, content: content.slice(0, TOOL_RESULT_CHARS) });
        }
      }
      // A model that failed before any tool ran: try the next; after tools ran, keep their results.
      if (toolsUsed.length) break;
    }
    return null;
  } catch (err) {
    logger.warn({ err }, 'Tool-enabled chat failed');
    return null;
  } finally {
    for (const client of clients.values()) await client.close().catch(() => {});
  }
}
