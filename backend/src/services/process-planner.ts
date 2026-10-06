import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { runClaudeCli, isClaudeCliEnabled } from '../lib/claude-cli.js';

/**
 * Turns a plain-language goal into a staged agent roster.
 *
 * Two strategies, same output shape:
 *   1. The Anthropic API, when PLATFORM_ANTHROPIC_API_KEY is configured.
 *   2. The locally installed Claude Code CLI, which is already authenticated
 *      on the host — so a real model plans the chain with no API key.
 *   3. A deterministic heuristic, so the feature still works offline/in CI
 *      instead of erroring.
 */

export interface PlannedAgent {
  /** kebab-case, unique within the process. */
  name: string;
  displayName: string;
  /** What this agent is for, one line. */
  role: string;
  description: string;
  /** 1-based pipeline position. Agents in the same stage run in parallel. */
  stage: number;
  soulMd: string;
  heartbeatInterval: number;
  avatar: string | null;
}

export interface ProcessPlan {
  name: string;
  summary: string;
  agents: PlannedAgent[];
  stages: Array<{ stage: number; label: string }>;
  plannedBy: string;
}

const MAX_AGENTS = 8;
const MIN_AGENTS = 2;

/* ---- Heuristic planner --------------------------------------------------
   Keyword buckets map a goal onto specialist roles. Deliberately simple and
   inspectable — it is a fallback, not a pretender to an LLM.
   ---------------------------------------------------------------------- */

interface RoleTemplate {
  key: string;
  displayName: string;
  role: string;
  description: string;
  stage: number;
  responsibilities: string[];
  match: RegExp;
  avatar: string;
}

const ROLE_LIBRARY: RoleTemplate[] = [
  {
    key: 'researcher',
    displayName: 'Researcher',
    role: 'Research & discovery',
    description: 'Gathers source material, prior art, and constraints for the goal.',
    stage: 1,
    responsibilities: ['Collect and cite sources', 'Summarise findings', 'Flag unknowns and risks'],
    match: /research|investigat|analy|discover|explore|study|market|competitor/i,
    avatar: '🔎',
  },
  {
    key: 'planner',
    displayName: 'Planner',
    role: 'Planning & decomposition',
    description: 'Breaks the goal into ordered, assignable tasks.',
    stage: 1,
    responsibilities: ['Decompose the goal', 'Sequence work', 'Define done criteria'],
    match: /plan|roadmap|strategy|organi|schedul|coordinat|manage/i,
    avatar: '🗺️',
  },
  {
    key: 'writer',
    displayName: 'Writer',
    role: 'Content production',
    description: 'Produces written deliverables from research and plans.',
    stage: 2,
    responsibilities: ['Draft content', 'Match tone and format', 'Revise on feedback'],
    match: /writ|content|blog|article|copy|documentation|docs|report|summar/i,
    avatar: '✍️',
  },
  {
    key: 'engineer',
    displayName: 'Engineer',
    role: 'Implementation',
    description: 'Writes and changes code to implement the goal.',
    stage: 2,
    responsibilities: ['Implement features', 'Keep changes small', 'Write tests alongside'],
    match: /code|build|implement|develop|engineer|api|backend|frontend|app|script|software|feature|bug|fix/i,
    avatar: '🔧',
  },
  {
    key: 'designer',
    displayName: 'Designer',
    role: 'Design & UX',
    description: 'Owns interface structure, visual design, and usability.',
    stage: 2,
    responsibilities: ['Produce layouts', 'Keep a consistent system', 'Check accessibility'],
    match: /design|ui|ux|interface|layout|brand|visual|mockup|figma/i,
    avatar: '🎨',
  },
  {
    key: 'data',
    displayName: 'Data Analyst',
    role: 'Data & metrics',
    description: 'Pulls, cleans, and interprets data relevant to the goal.',
    stage: 2,
    responsibilities: ['Query sources', 'Validate data quality', 'Report metrics'],
    match: /data|metric|analytic|dashboard|report|sql|etl|pipeline|statistic/i,
    avatar: '📊',
  },
  {
    key: 'qa',
    displayName: 'QA Reviewer',
    role: 'Quality assurance',
    description: 'Verifies output against the goal and reports defects.',
    stage: 3,
    responsibilities: ['Test against criteria', 'File precise defects', 'Re-verify fixes'],
    match: /test|qa|quality|review|verif|validat|audit|check/i,
    avatar: '🔍',
  },
  {
    key: 'ops',
    displayName: 'Operations',
    role: 'Deployment & monitoring',
    description: 'Ships the result and watches it in production.',
    stage: 4,
    responsibilities: ['Deploy safely', 'Monitor health', 'Roll back on regressions'],
    match: /deploy|ops|infra|monitor|server|release|ship|production|uptime|devops/i,
    avatar: '🖥️',
  },
  {
    key: 'web-builder',
    displayName: 'Full-Stack Web Builder',
    role: 'End-to-end web & app generation',
    description: 'Generates responsive UIs, backend API routes, database schemas, and live preview sites.',
    stage: 2,
    responsibilities: ['Build full-stack web application', 'Create responsive React/Tailwind UI', 'Set up REST/GraphQL endpoints', 'Generate database schemas & seeds'],
    match: /website|web app|fullstack|site|landing page|frontend app|react app|nextjs|application|component/i,
    avatar: '🌐',
  },
  {
    key: 'mcp-connector',
    displayName: 'MCP Protocol Specialist',
    role: 'Model Context Protocol tool execution',
    description: 'Connects and executes tools from external MCP servers (PostgreSQL, Filesystem, Memory, API).',
    stage: 2,
    responsibilities: ['Configure SSE/HTTP MCP server transports', 'Execute remote MCP tool calls', 'Validate input/output schemas', 'Provide context to agent team'],
    match: /mcp|context protocol|mcp tool|mcp server|database tool|tool server|sse transport/i,
    avatar: '🔌',
  },
  {
    key: 'cloud-log-fixer',
    displayName: 'Vercel & Cloud Log Resolver',
    role: 'Build & deployment log auto-fixing',
    description: 'Parses Vercel/Netlify/Docker build logs, isolates exceptions, and auto-generates bug fixes.',
    stage: 3,
    responsibilities: ['Fetch and analyze Vercel/Cloud error logs', 'Isolate stack trace & missing modules', 'Auto-generate patch diffs', 'Re-trigger build verification'],
    match: /vercel|cloud log|deployment log|build error|fix vercel|autofix deployment|log review|stacktrace/i,
    avatar: '⚡',
  },
  {
    key: 'security-auditor',
    displayName: 'Security & Vulnerability Auditor',
    role: 'Security scanning & OWASP audit',
    description: 'Scans code for secret leaks, OWASP Top 10 vulnerabilities, and dependency risks.',
    stage: 3,
    responsibilities: ['Scan for hardcoded secrets & keys', 'Check OWASP Top 10 compliance', 'Audit third-party dependencies', 'Produce security remediation patch'],
    match: /security|vulnerability|audit|secret leak|owasp|pen test|sanitization/i,
    avatar: '🛡️',
  },
  {
    key: 'support',
    displayName: 'Support',
    role: 'Customer response',
    description: 'Handles inbound questions arising from the work.',
    stage: 4,
    responsibilities: ['Answer inbound requests', 'Escalate real issues', 'Track themes'],
    match: /support|customer|ticket|helpdesk|inbox|email|respond|service/i,
    avatar: '💬',
  },
];

const STAGE_LABELS: Record<number, string> = {
  1: 'Discovery',
  2: 'Production',
  3: 'Review',
  4: 'Delivery',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'process';
}

function titleFromPrompt(prompt: string): string {
  const firstLine = prompt.trim().split('\n')[0].trim();
  const clipped = firstLine.length > 60 ? `${firstLine.slice(0, 57).trimEnd()}…` : firstLine;
  return clipped.charAt(0).toUpperCase() + clipped.slice(1);
}

function buildSoul(t: RoleTemplate, goal: string): string {
  return [
    `# ${t.displayName}`,
    '',
    `You are the **${t.role}** agent in a production chain.`,
    '',
    '## Goal',
    goal.trim(),
    '',
    '## Your responsibilities',
    ...t.responsibilities.map((r) => `- ${r}`),
    '',
    '## Working agreement',
    '- Report progress via activity events as you work.',
    '- Hand off to the next stage with a short, concrete summary.',
    '- Ask for human approval before anything destructive or irreversible.',
  ].join('\n');
}

function parseCurlPrompt(prompt: string): { isCurl: boolean; method: string; url: string; title: string } {
  const p = prompt.trim();
  if (!p.toLowerCase().startsWith('curl')) {
    return { isCurl: false, method: 'GET', url: '', title: '' };
  }

  const methodMatch = p.match(/-X\s+([A-Z]+)/i) || p.match(/--request\s+([A-Z]+)/i);
  const method = methodMatch ? methodMatch[1].toUpperCase() : p.includes('-d ') || p.includes('--data') ? 'POST' : 'GET';
  
  const urlMatch = p.match(/(https?:\/\/[^\s"']+)/i);
  const url = urlMatch ? urlMatch[1] : 'Target API Endpoint';
  
  let cleanName = 'API Integration';
  try {
    const parsed = new URL(url);
    cleanName = `${method} ${parsed.pathname.split('/').filter(Boolean).slice(-2).join('/') || parsed.hostname}`;
  } catch {
    cleanName = `${method} API Pipeline`;
  }

  return { isCurl: true, method, url, title: cleanName };
}

/**
 * Picks roles by keyword, or builds dedicated cURL API pipeline if input is a curl command.
 */
export function planHeuristically(prompt: string, requested?: number): ProcessPlan {
  const goal = prompt.trim();
  const curlInfo = parseCurlPrompt(goal);

  if (curlInfo.isCurl) {
    const agents: PlannedAgent[] = [
      {
        name: `${slugify(curlInfo.title)}-architect`,
        displayName: 'API Architect',
        role: 'API Contract & Architecture',
        description: `Analyzes ${curlInfo.method} ${curlInfo.url} request schema, headers, and contracts.`,
        stage: 1,
        soulMd: `# API Architect\n\nYou are responsible for breaking down the following cURL request:\n\`\`\`bash\n${goal}\n\`\`\`\n\nDefine the request/response schema, TypeScript interfaces, and validation boundaries.`,
        heartbeatInterval: 30,
        avatar: '📐',
      },
      {
        name: `${slugify(curlInfo.title)}-backend`,
        displayName: 'Backend Integrator',
        role: 'Endpoint & Business Logic',
        description: `Implements the ${curlInfo.method} handler, authentication headers, and database mappings.`,
        stage: 2,
        soulMd: `# Backend Integrator\n\nImplement the production integration for:\n\`\`\`bash\n${goal}\n\`\`\`\n\nWrite robust, typed handlers with error boundaries.`,
        heartbeatInterval: 30,
        avatar: '⚡',
      },
      {
        name: `${slugify(curlInfo.title)}-security`,
        displayName: 'Security & Schema Engineer',
        role: 'Validation & Auth Guard',
        description: 'Implements rate limiting, token rotation, and Zod input validation.',
        stage: 2,
        soulMd: `# Security & Schema Engineer\n\nSecure the ${curlInfo.method} ${curlInfo.url} integration with strict payload validation and sanitization.`,
        heartbeatInterval: 30,
        avatar: '🛡️',
      },
      {
        name: `${slugify(curlInfo.title)}-qa`,
        displayName: 'Integration QA Tester',
        role: 'Automated E2E Testing',
        description: 'Generates automated test suites and mocks to verify endpoint responses.',
        stage: 3,
        soulMd: `# Integration QA Tester\n\nVerify that the ${curlInfo.method} ${curlInfo.url} integration correctly handles 200 OK, 400 Bad Request, and 500 server errors.`,
        heartbeatInterval: 30,
        avatar: '🧪',
      },
    ];

    const targetCount = Math.min(MAX_AGENTS, Math.max(MIN_AGENTS, requested ?? 4));
    const finalAgents = agents.slice(0, targetCount);
    const stages = [
      { stage: 1, label: 'API Architecture' },
      { stage: 2, label: 'Implementation' },
      { stage: 3, label: 'Verification & QA' },
    ];

    return {
      name: `cURL: ${curlInfo.title}`,
      summary: `Automated ${finalAgents.length}-agent production pipeline for ${curlInfo.method} ${curlInfo.url}`,
      agents: finalAgents,
      stages,
      plannedBy: 'curl-analyzer',
    };
  }

  const matched = ROLE_LIBRARY.filter((t) => t.match.test(goal));

  // Nothing matched — fall back to a generic three-stage chain.
  let chosen = matched.length > 0 ? matched : ROLE_LIBRARY.filter((t) =>
    ['planner', 'engineer', 'qa'].includes(t.key),
  );

  // Always close the loop with a reviewer.
  if (!chosen.some((t) => t.key === 'qa')) {
    chosen = [...chosen, ROLE_LIBRARY.find((t) => t.key === 'qa')!];
  }
  // And open it with someone who decomposes the work.
  if (!chosen.some((t) => t.stage === 1)) {
    chosen = [ROLE_LIBRARY.find((t) => t.key === 'planner')!, ...chosen];
  }

  const target = Math.min(
    MAX_AGENTS,
    Math.max(MIN_AGENTS, requested ?? chosen.length),
  );

  // Grow toward the requested count by pulling in the next best unused roles.
  if (chosen.length < target) {
    for (const t of ROLE_LIBRARY) {
      if (chosen.length >= target) break;
      if (!chosen.some((c) => c.key === t.key)) chosen.push(t);
    }
  }
  chosen = chosen.slice(0, target).sort((a, b) => a.stage - b.stage);

  const agents: PlannedAgent[] = chosen.map((t) => ({
    name: `${slugify(titleFromPrompt(goal)).slice(0, 20)}-${t.key}`,
    displayName: t.displayName,
    role: t.role,
    description: t.description,
    stage: t.stage,
    soulMd: buildSoul(t, goal),
    heartbeatInterval: t.stage === 4 ? 5 : 30,
    avatar: t.avatar,
  }));

  const stages = [...new Set(agents.map((a) => a.stage))]
    .sort((a, b) => a - b)
    .map((stage) => ({ stage, label: STAGE_LABELS[stage] ?? `Stage ${stage}` }));

  return {
    name: titleFromPrompt(goal),
    summary: `A ${agents.length}-agent production chain covering ${stages
      .map((s) => s.label.toLowerCase())
      .join(' → ')}.`,
    agents,
    stages,
    plannedBy: 'heuristic',
  };
}

/* ---- LLM planner --------------------------------------------------------
   Uses the Anthropic Messages API when PLATFORM_ANTHROPIC_API_KEY is set.
   Any failure (no key, network, bad JSON) degrades to the heuristic planner
   rather than failing the request.
   ---------------------------------------------------------------------- */

const PLANNER_MODEL = config.defaultAgentRunModel;

const PLANNER_SYSTEM = `You design small teams of autonomous AI agents ("production chains").

Given a goal, return ONLY a JSON object — no prose, no markdown fence — shaped:
{
  "name": "short title, max 60 chars",
  "summary": "one sentence describing the chain",
  "stages": [{ "stage": 1, "label": "Discovery" }],
  "agents": [{
    "name": "kebab-case-unique-id",
    "displayName": "Human Name",
    "role": "short role label",
    "description": "one sentence on what this agent does",
    "stage": 1,
    "heartbeatInterval": 30,
    "soulMd": "# Name\\n\\nMarkdown system prompt: goal, responsibilities, handoff rules."
  }]
}

Rules:
- Between ${MIN_AGENTS} and ${MAX_AGENTS} agents. Use the FEWEST that genuinely cover the goal.
- Stages are 1-based; agents sharing a stage run in parallel.
- Always include a review/QA agent in the final or penultimate stage.
- "name" must be unique, lowercase, kebab-case, and safe as an identifier.
- "displayName" is the AGENT'S FUNCTION, e.g. "Competitor Researcher" or
  "Launch Writer". Never invent a human person's name.
- heartbeatInterval is minutes: 5 for monitoring roles, 30 otherwise.
- Output the JSON object only. No preamble, no explanation, no code fence.`;

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
  model?: string;
  error?: { message?: string };
}

/** Parses planner JSON into a validated ProcessPlan. Shared by both LLM paths. */
function parsePlanJson(raw: string, prompt: string, plannedBy: string): ProcessPlan | null {
  try {
    // Tolerate a stray ```json fence, or prose wrapped around the object.
    let text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    if (!text.startsWith('{')) {
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end <= start) return null;
      text = text.slice(start, end + 1);
    }

    const parsed = JSON.parse(text) as Partial<ProcessPlan>;
    if (!Array.isArray(parsed.agents) || parsed.agents.length === 0) return null;

    const seen = new Set<string>();
    const agents = parsed.agents.slice(0, MAX_AGENTS).map((a, i) => {
      // Names must be unique inside the plan or agent creation collides.
      let name = slugify(a.name ?? `agent-${i + 1}`);
      while (seen.has(name)) name = `${name}-${i + 1}`;
      seen.add(name);
      return {
        name,
        displayName: a.displayName ?? `Agent ${i + 1}`,
        role: a.role ?? 'Contributor',
        description: a.description ?? '',
        stage: Number(a.stage) > 0 ? Number(a.stage) : 1,
        soulMd: a.soulMd ?? `# ${a.displayName ?? 'Agent'}`,
        heartbeatInterval:
          Number(a.heartbeatInterval) > 0 ? Number(a.heartbeatInterval) : 30,
        avatar: a.avatar ?? null,
      };
    });

    const stages =
      Array.isArray(parsed.stages) && parsed.stages.length > 0
        ? parsed.stages
        : [...new Set(agents.map((a) => a.stage))]
            .sort((x, y) => x - y)
            .map((stage) => ({ stage, label: STAGE_LABELS[stage] ?? `Stage ${stage}` }));

    return {
      name: (parsed.name ?? titleFromPrompt(prompt)).slice(0, 60),
      summary: parsed.summary ?? '',
      agents,
      stages,
      plannedBy,
    };
  } catch {
    return null;
  }
}

/** Plans via the local Claude Code CLI (no API key needed). */
async function planWithCli(prompt: string, requested?: number): Promise<ProcessPlan | null> {
  if (!isClaudeCliEnabled()) return null;

  const ask = requested
    ? `${prompt}

Use exactly ${requested} agents.`
    : prompt;

  const res = await runClaudeCli(ask, { systemPrompt: PLANNER_SYSTEM });
  if (!res) return null;

  const plan = parsePlanJson(res.text, prompt, `cli:${res.model}`);
  if (!plan) {
    logger.warn('Claude CLI returned unusable plan JSON; falling back');
    return null;
  }
  logger.info(
    { model: res.model, costUsd: res.costUsd, agents: plan.agents.length },
    'Planned production chain via Claude CLI',
  );
  return plan;
}

async function planWithLlm(prompt: string, requested?: number): Promise<ProcessPlan | null> {
  const ask = requested
    ? `${prompt}\n\nUse exactly ${requested} agents.`
    : prompt;

  const geminiKey =
    process.env.PLATFORM_GOOGLE_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY;
  const anthropicKey = process.env.PLATFORM_ANTHROPIC_API_KEY;

  // 1. Try Google Gemini models
  if (geminiKey) {
    for (const model of config.geminiModels) {
      try {
        const combined = `${PLANNER_SYSTEM}\n\nUser Production Request:\n${ask}\n\nRespond ONLY with the JSON plan.`;
        const res = await fetch(
          `${config.geminiApiBaseUrl}/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: combined }] }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
            }),
            signal: AbortSignal.timeout(30000),
          },
        );

        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && typeof text === 'string') {
            const plan = parsePlanJson(text.trim(), prompt, `gemini:${model}`);
            if (plan && plan.agents.length > 0) {
              logger.info({ model, agents: plan.agents.length }, 'Planned production chain via Gemini API');
              return plan;
            }
          }
        }
      } catch (err) {
        logger.warn({ err, model }, 'Gemini planner call failed, trying next candidate');
      }
    }
  }

  // 2. Try Anthropic API if key is available
  if (anthropicKey) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: PLANNER_MODEL,
          max_tokens: 4096,
          system: PLANNER_SYSTEM,
          messages: [{ role: 'user', content: ask }],
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const body = (await res.json()) as AnthropicResponse;
        const text = body.content?.find((c) => c.type === 'text')?.text?.trim();
        if (text) {
          const plan = parsePlanJson(text, prompt, `anthropic:${body.model ?? PLANNER_MODEL}`);
          if (plan) return plan;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Anthropic planner call failed');
    }
  }

  // 3. Try Local PC Ollama
  for (const ep of config.localLlmEndpoints) {
    try {
      const res = await fetch(`${ep}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.localLlmModel,
          prompt: `${PLANNER_SYSTEM}\n\nTask:\n${ask}\n\nRespond ONLY with JSON plan:`,
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        if (data?.response) {
          const plan = parsePlanJson(data.response, prompt, `ollama:${config.localLlmModel}`);
          if (plan && plan.agents.length > 0) return plan;
        }
      }
    } catch {
      // Continue to heuristic
    }
  }

  return null;
}

/**
 * Plans a chain: hosted API first, then the local Claude CLI, then the
 * built-in heuristic. Each step degrades silently to the next, so planning
 * never fails outright.
 */
export async function planProcess(prompt: string, requested?: number): Promise<ProcessPlan> {
  const viaApi = await planWithLlm(prompt, requested);
  if (viaApi) return viaApi;

  const viaCli = await planWithCli(prompt, requested);
  if (viaCli) return viaCli;

  return planHeuristically(prompt, requested);
}
