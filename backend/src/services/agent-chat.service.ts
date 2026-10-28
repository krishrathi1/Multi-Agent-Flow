import { config } from '../config.js';
import { Prisma, ActivityType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { runClaudeCli, isClaudeCliEnabled } from '../lib/claude-cli.js';
import { decryptField } from '../lib/crypto.js';
import { safeFetch } from '../lib/url-validator.js';
import { listWorkspaceFiles, workspaceFor } from './agent-runner.service.js';
import { getVercelDeploymentLogs, autoHealWorkspace, pushWorkspaceToGitHub, deployToVercel } from './git-deploy.service.js';
import { askAiAndSpawnFixerAgent } from './process.service.js';
import { ask as askOpenCode } from './opencode.service.js';
import { outcomeOf } from './project-report.service.js';
import { retrieveCodeContext, numberLines, CODE_QUOTING_RULE } from './code-intelligence.service.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getOrganizationIntegrationToken } from './org.service.js';
import { getGroqApiKey, groqChat, getGrokApiKey, grokChat } from './llm-provider.service.js';

const HISTORY_LIMIT = 30;

/**
 * Real per-model pricing (USD per 1M tokens, as of 2025).
 * input  = prompt / input tokens price per 1M
 * output = completion / output tokens price per 1M
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Grok
  'grok-2-latest':            { input: 2.00,  output: 10.00 },
  'grok-2':                   { input: 2.00,  output: 10.00 },
  'grok-2-1212':              { input: 2.00,  output: 10.00 },
  'grok-2-vision-128k':       { input: 2.00,  output: 10.00 },
  'grok-2-vision':            { input: 2.00,  output: 10.00 },
  'grok-3':                   { input: 3.00,  output: 15.00 },
  'grok-3-mini':              { input: 0.50,  output: 2.00  },
  'grok-beta':                { input: 5.00,  output: 15.00 },
  'grok-vision-beta':         { input: 5.00,  output: 15.00 },
  'grok':                     { input: 2.00,  output: 10.00 },
  // Gemini
  'gemini-2.5-flash':         { input: 0.30,  output: 2.50  },
  'gemini-2.5-pro':           { input: 1.25,  output: 10.00 },
  'gemini-2.0-flash':         { input: 0.10,  output: 0.40  },
  'gemini-2.0-flash-lite':    { input: 0.075, output: 0.30  },
  'gemini-1.5-flash':         { input: 0.075, output: 0.30  },
  'gemini-1.5-pro':           { input: 1.25,  output: 5.00  },
  'gemini-3.6-flash':         { input: 0.30,  output: 2.50  }, // treat like 2.5-flash
  // OpenAI
  'gpt-4o':                   { input: 2.50,  output: 10.00 },
  'gpt-4o-mini':              { input: 0.15,  output: 0.60  },
  'gpt-4-turbo':              { input: 10.00, output: 30.00 },
  'gpt-3.5-turbo':            { input: 0.50,  output: 1.50  },
  // Anthropic
  'claude-3-5-sonnet':        { input: 3.00,  output: 15.00 },
  'claude-3-5-haiku':         { input: 0.80,  output: 4.00  },
  'claude-3-opus':            { input: 15.00, output: 75.00 },
  // Groq
  'openai/gpt-oss-120b':      { input: 0.15,  output: 0.60  },
  'openai/gpt-oss-20b':       { input: 0.075, output: 0.30  },
  'qwen/qwen3.8-27b':         { input: 0.80,  output: 4.00  },
  'llama-3.3-70b-versatile':  { input: 0.59,  output: 0.79  },
  'llama-3.1-8b-instant':     { input: 0.05,  output: 0.08  },
  'mixtral-8x7b-32768':       { input: 0.24,  output: 0.24  },
};

/** Calculate real USD cost from token counts and model name. */
function calcCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(MODEL_PRICING).find((k) => model.toLowerCase().includes(k));
  if (!key) return Number(((inputTokens * 0.0000003) + (outputTokens * 0.0000006)).toFixed(6));
  const { input, output } = MODEL_PRICING[key];
  return Number(((inputTokens * input + outputTokens * output) / 1_000_000).toFixed(6));
}


export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatMetadata {
  chat?: boolean;
  motherChat?: boolean;
  role?: 'user' | 'assistant';
  content?: string;
  model?: string;
}

export function isLocalChatAvailable(): boolean {
  return true; // Always available via multi-LLM router (Gemini, Local Ollama, Synthesis)
}

/**
 * Executes a conversation turn via Gemini API, Local Ollama, Claude CLI, or intelligent synthesis.
 */
export async function callChatLLM(params: {
  organizationId: string;
  systemPrompt: string;
  prompt: string;
  preferredModel?: string;
  /** Reply budget for the Grok/Groq paths; their default suits chat answers, not code edits. */
  maxTokens?: number;
  coworkData?: {
    processName?: string;
    status?: string;
    goal?: string;
    agents?: Array<{ name: string; role?: string; stage?: number; status?: string }>;
    files?: string[];
    tasks?: Array<{ title: string; status: string; agent?: string }>;
    latestSteps?: string[];
  };
}): Promise<{ text: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }> {
  /** Why the model didn't answer, shown in the fallback reply. */
  let unavailableReason: string | null = null;
  // Resolve Active LLM Providers
  const providers = await prisma.llmProvider.findMany({
    where: { organizationId: params.organizationId, isActive: true },
  });

  const preferred = (params.preferredModel || '').trim();
  const preferredLower = preferred.toLowerCase();

  const isGoogle = preferredLower.startsWith('google/') || preferredLower.startsWith('gemini/') || (preferredLower.includes('gemini') && !preferredLower.startsWith('opencode/'));
  const isGrok = preferredLower.startsWith('grok/') || preferredLower.startsWith('xai/') || preferredLower.includes('grok');
  const isGroq = preferredLower.startsWith('groq/') || preferredLower.includes('groq');
  const isNvidia = preferredLower.startsWith('nvidia/');
  const isOpenCode = preferredLower.startsWith('opencode/');
  const isOpenAI = preferredLower.startsWith('openai/') || (!preferredLower.includes('/') && (preferredLower.startsWith('gpt-') || preferredLower.startsWith('o1') || preferredLower.startsWith('o3')));
  const isAnthropic = preferredLower.startsWith('anthropic/') || (!preferredLower.includes('/') && preferredLower.startsWith('claude-'));
  const isLocal = preferredLower.startsWith('local/') || preferredLower.startsWith('ollama/');

  // 0a. xAI Grok direct execution when requested or when key is available
  if (isGrok || !preferred) {
    const grokKey = await getGrokApiKey(params.organizationId);
    if (grokKey) {
      const g = await grokChat({
        apiKey: grokKey,
        system: params.systemPrompt,
        prompt: params.prompt,
        model: isGrok ? preferred : undefined,
        maxTokens: params.maxTokens,
      });
      if (g) {
        return {
          text: g.text,
          model: g.model,
          inputTokens: g.inputTokens,
          outputTokens: g.outputTokens,
          costUsd: calcCost(g.model, g.inputTokens, g.outputTokens),
        };
      }
      unavailableReason = 'xAI Grok did not answer';
    }
  }

  // 0b. Groq execution (when requested, or as seamless fallback if Grok/other preferred has no direct key)
  if (isGroq || !preferred || /^(groq|opencode)\//i.test(preferred) || isGrok) {
    const groqKey = await getGroqApiKey(params.organizationId);
    if (groqKey) {
      const g = await groqChat({
        apiKey: groqKey,
        system: params.systemPrompt,
        prompt: params.prompt,
        model: preferredLower.startsWith('groq/') ? preferred : undefined,
        maxTokens: params.maxTokens,
      });
      if (g) return { text: g.text, model: g.model, inputTokens: g.inputTokens, outputTokens: g.outputTokens, costUsd: 0 };
      unavailableReason = 'Groq did not answer';
    }
  }

  // 1. Nvidia API Direct Execution (Sub-second response)
  if (isNvidia) {
    const nvidiaKey = process.env.NVIDIA_API_KEY;
    if (nvidiaKey) {
      try {
        const cleanModel = preferred.replace(/^nvidia\//i, '');
        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${nvidiaKey}`,
          },
          body: JSON.stringify({
            model: cleanModel,
            messages: [
              { role: 'system', content: params.systemPrompt },
              { role: 'user', content: params.prompt },
            ],
            temperature: 0.3,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data?.choices?.[0]?.message?.content;
          if (text && typeof text === 'string' && text.trim().length > 0) {
            const inputTokens = data?.usage?.prompt_tokens ?? Math.max(100, Math.ceil((params.systemPrompt + params.prompt).length / 4));
            const outputTokens = data?.usage?.completion_tokens ?? Math.max(50, Math.ceil(text.length / 4));
            return {
              text: text.trim(),
              model: `nvidia/${cleanModel}`,
              inputTokens,
              outputTokens,
              costUsd: calcCost(cleanModel, inputTokens, outputTokens),
            };
          }
        } else {
          logger.warn({ status: res.status, model: cleanModel }, 'Nvidia API returned non-OK status; falling back');
        }
      } catch (err) {
        logger.warn({ err, model: preferred }, 'Nvidia API call failed or timed out; falling back');
      }
    }
  }

  // 2. OpenCode CLI Model Selection
  if (isOpenCode) {
    try {
      // Runs in an empty sandbox (it offered to "scaffold this repo" when it
      // ran in the backend's source); 12s used to cut most answers off.
      const op = await askOpenCode(`${params.systemPrompt}\n\n${params.prompt}`, preferred, 80000);
      if (op.result && op.result.length > 0) {
        const inputTokens = Math.max(100, Math.ceil((params.systemPrompt + params.prompt).length / 4));
        const outputTokens = Math.max(50, Math.ceil(op.result.length / 4));
        return {
          text: op.result,
          model: op.model || preferred,
          inputTokens,
          outputTokens,
          costUsd: calcCost(op.model || preferred, inputTokens, outputTokens),
        };
      }
    } catch (err) {
      logger.warn({ err, model: preferred }, 'OpenCode model execution timed out or failed; falling back to ultra-fast cloud model');
      unavailableReason = (err as Error).message;
    }
  }

  // 3. Claude CLI / Anthropic
  if (isAnthropic && isClaudeCliEnabled()) {
    try {
      const cliRes = await runClaudeCli(params.prompt, {
        systemPrompt: params.systemPrompt,
        timeoutMs: 30000,
      });
      if (cliRes) return cliRes;
    } catch {
      // Fall through
    }
  }

  // 4. Google Gemini Direct REST Execution (Blazing fast, 300-500ms)
  let geminiKey: string | undefined;
  const geminiProv = providers.find((p) => p.provider.toLowerCase() === 'google' || p.provider.toLowerCase() === 'gemini');
  if (geminiProv && geminiProv.apiKey) {
    try {
      geminiKey = decryptField(geminiProv.apiKey);
    } catch { /* ignore */ }
  }
  if (!geminiKey && process.env.GEMINI_API_KEY) geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey && process.env.GOOGLE_API_KEY) geminiKey = process.env.GOOGLE_API_KEY;
  if (!geminiKey && process.env.PLATFORM_GOOGLE_API_KEY) geminiKey = process.env.PLATFORM_GOOGLE_API_KEY;

  if (geminiKey) {
    const geminiCandidates: string[] = [];
    if (isGoogle && preferred) {
      const reqClean = preferred.replace(/^google\//i, '').replace(/^gemini\//i, '');
      geminiCandidates.push(reqClean);
    }
    // Reliable fast fallbacks
    for (const m of ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-flash-latest']) {
      if (!geminiCandidates.includes(m)) geminiCandidates.push(m);
    }

    for (const cleanModel of geminiCandidates) {
      try {
        const combined = `${params.systemPrompt}\n\n${params.prompt}`;
        const res = await fetch(
          `${config.geminiApiBaseUrl}/v1beta/models/${cleanModel}:generateContent`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
            body: JSON.stringify({
              contents: [{ parts: [{ text: combined }] }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
            }),
            signal: AbortSignal.timeout(15000),
          },
        );

        if (res.ok) {
          const data = (await res.json()) as any;
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text && typeof text === 'string' && text.trim().length > 0) {
            const inputTokens: number = data?.usageMetadata?.promptTokenCount ?? Math.max(100, Math.ceil((params.systemPrompt + params.prompt).length / 4));
            const outputTokens: number = data?.usageMetadata?.candidatesTokenCount ?? Math.max(50, Math.ceil(text.length / 4));
            return {
              text: text.trim(),
              model: cleanModel,
              inputTokens,
              outputTokens,
              costUsd: calcCost(cleanModel, inputTokens, outputTokens),
            };
          }
        }
      } catch (err) {
        logger.warn({ err, model: cleanModel }, 'Gemini model failed, trying next candidate');
      }
    }
  }

  // 4b. Universal Fast Cloud Fallback (Groq) if previous candidates did not answer
  try {
    const universalGroqKey = await getGroqApiKey(params.organizationId);
    if (universalGroqKey) {
      const g = await groqChat({
        apiKey: universalGroqKey,
        system: params.systemPrompt,
        prompt: params.prompt,
      });
      if (g) return { text: g.text, model: g.model, inputTokens: g.inputTokens, outputTokens: g.outputTokens, costUsd: 0 };
    }
  } catch {
    // Continue to local/offline fallbacks
  }

  // 5. Local PC Ollama on Windows Host
  if (isLocal || !geminiKey) {
    const candidateEndpoints = config.localLlmEndpoints;
    for (const ep of candidateEndpoints) {
      try {
        const ollamaRes = await fetch(`${ep}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: preferredLower.includes('ollama') ? preferred.replace(/^ollama\//i, '') : config.localLlmModel,
            prompt: `${params.systemPrompt}\n\n${params.prompt}`,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (ollamaRes.ok) {
          const data = (await ollamaRes.json()) as any;
          const text = data?.response;
          if (text && typeof text === 'string' && text.trim().length > 0) {
            const inputTokens: number = data?.prompt_eval_count ?? Math.max(100, Math.ceil((params.systemPrompt + params.prompt).length / 4));
            const outputTokens: number = data?.eval_count ?? Math.max(50, Math.ceil(text.length / 4));
            return {
              text: text.trim(),
              model: `${config.localLlmModel} (Local Host)`,
              inputTokens,
              outputTokens,
              costUsd: 0,
            };
          }
        }
      } catch {
        // Continue to fallback
      }
    }
  }

  // 6. No model answered. Say so, and show the live facts instead of a canned
  // reply that ignored the question and claimed progress it couldn't know.
  const cw = params.coworkData;
  const filesLine = cw?.files?.length
    ? `${cw.files.length} file(s): ${cw.files.slice(0, 15).map((f) => `\`${f}\``).join(', ')}${cw.files.length > 15 ? ', …' : ''}`
    : 'none yet';
  const synthesizedAnswer = cw
    ? `I couldn't reach an AI model just now${unavailableReason ? ` (${unavailableReason})` : ''}, so I can't answer that question in detail. Here is the live status of **${cw.processName || 'this production'}** — ask again in a moment for a full answer.

**Progress**
${cw.latestSteps?.length ? cw.latestSteps.join('\n') : '- No run has started yet.'}

**Workspace files:** ${filesLine}`
    : `I couldn't reach an AI model just now${unavailableReason ? ` (${unavailableReason})` : ''}. Please try again in a moment.`;

  return {
    text: synthesizedAnswer,
    model: 'Mother-Core-Local (Fallback Engine)',
    inputTokens: 150,
    outputTokens: 300,
    costUsd: 0,
  };
}

/** Reads persisted turns for an agent, oldest first. */
export async function getLocalChatHistory(
  agentId: string,
  organizationId: string,
): Promise<{ sessionKey: string; messages: ChatTurn[] }> {
  const rows = await prisma.activity.findMany({
    where: {
      agentId,
      organizationId,
      type: ActivityType.MESSAGE,
    },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT * 2,
  });

  const messages: ChatTurn[] = rows
    .filter((r) => (r.metadata as ChatMetadata | null)?.chat === true)
    .map((r) => {
      const m = r.metadata as ChatMetadata;
      return {
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content ?? r.message,
        timestamp: r.createdAt.toISOString(),
      };
    })
    .reverse();

  return { sessionKey: `local:${agentId}`, messages };
}

/** Reads persisted turns for Mother Chat. */
export async function getMotherChatHistory(
  organizationId: string,
  processId?: string,
): Promise<{ sessionKey: string; messages: ChatTurn[] }> {
  const rows = await prisma.activity.findMany({
    where: {
      organizationId,
      type: ActivityType.MESSAGE,
      ...(processId ? { processId } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT * 2,
  });

  const messages: ChatTurn[] = rows
    .filter((r) => (r.metadata as ChatMetadata | null)?.motherChat === true)
    .map((r) => {
      const m = r.metadata as ChatMetadata;
      return {
        role: m.role === 'assistant' ? ('assistant' as const) : ('user' as const),
        content: m.content ?? r.message,
        timestamp: r.createdAt.toISOString(),
      };
    })
    .reverse();

  return { sessionKey: `mother:${processId || 'global'}`, messages };
}

function buildSystemPrompt(agent: {
  displayName: string;
  description: string;
  soulMd: string | null;
  processRole: string | null;
  agentSkills?: Array<{
    enabled: boolean;
    customName?: string | null;
    customDescription?: string | null;
    skill: { name: string; description: string; category: string };
  }>;
}): string {
  const parts = [
    agent.soulMd?.trim() || `# ${agent.displayName}\n\n${agent.description}`,
  ];

  const activeSkills = agent.agentSkills?.filter((s) => s.enabled) || [];
  if (activeSkills.length > 0) {
    parts.push(
      '',
      '## Active Skills & Domain Capabilities (from Skill Library)',
      'You are equipped with the following specialized skills, toolkits, and best practices:',
      ...activeSkills.map((s) => {
        const name = s.customName || s.skill.name;
        const desc = s.customDescription || s.skill.description;
        return `- **${name}** (${s.skill.category}): ${desc}`;
      }),
      '',
      'Apply these skills actively when answering questions, reviewing code, and generating solutions.',
    );
  }

  parts.push(
    '',
    '## Conversation rules',
    `You are "${agent.displayName}"${agent.processRole ? `, the ${agent.processRole} agent` : ''}.`,
    'Stay in that role. Answer directly and concisely in the operator\'s language.',
  );

  return parts.join('\n');
}

function inferAgentDetails(
  userPrompt: string,
  existingAgents: Array<{ displayName: string; processRole?: string | null }>,
) {
  const lower = userPrompt.toLowerCase();

  // Explicit custom name e.g. "named Sentinel" or "called Bob"
  const nameMatch = userPrompt.match(/\b(named|called)\s+([A-Z][a-zA-Z0-9_-]+)/i);
  const customName = nameMatch ? nameMatch[2].trim() : null;

  if (/\b(qa|test|tester|testing|spec|verify|inspector)\b/i.test(lower)) {
    return {
      displayName: customName || 'QA Inspector',
      processRole: 'QA & Test Automation Specialist',
      avatar: '🧪',
      description: 'Specialized quality assurance, unit testing, and test automation agent.',
    };
  }
  if (/\b(security|audit|pentest|vulnerability|owasp|warden|safety)\b/i.test(lower)) {
    return {
      displayName: customName || 'Security Warden',
      processRole: 'Security Vulnerability & Audit Specialist',
      avatar: '🛡️',
      description: 'Specialized security auditor, OWASP risk scanner, and vulnerability patcher.',
    };
  }
  if (/\b(ui|ux|frontend|design|designer|css|tailwind|styling|interface|craftsman)\b/i.test(lower)) {
    return {
      displayName: customName || 'UI Craftsman',
      processRole: 'Frontend UI/UX Specialist',
      avatar: '🎨',
      description: 'Specialized user interface designer, component architect, and styling specialist.',
    };
  }
  if (/\b(backend|api|server|database|db|sql|route|data)\b/i.test(lower)) {
    return {
      displayName: customName || 'API Architect',
      processRole: 'Backend API & Data Architect',
      avatar: '⚡',
      description: 'Specialized backend engineer, RESTful API and database schema architect.',
    };
  }
  if (/\b(devops|deploy|vercel|cloud|docker|healer|doctor|fix\s+build)\b/i.test(lower)) {
    return {
      displayName: customName || 'DevOps Doctor',
      processRole: 'DevOps & Deployment Healer',
      avatar: '🩺',
      description: 'Specialized DevOps engineer, cloud pipeline and deployment auto-healer.',
    };
  }
  if (/\b(doc|docs|documentation|readme|writer|author)\b/i.test(lower)) {
    return {
      displayName: customName || 'Docs Author',
      processRole: 'Technical Documentation Specialist',
      avatar: '📝',
      description: 'Specialized technical documentation, API guides, and README author.',
    };
  }
  if (/\b(refactor|speed|optimize|performance|cleanup)\b/i.test(lower)) {
    return {
      displayName: customName || 'Refactor Specialist',
      processRole: 'Performance & Code Refactoring Specialist',
      avatar: '🚀',
      description: 'Specialized code optimizer, performance tuner, and architecture refactorer.',
    };
  }

  // Generic agent addition e.g. "add the agent"
  const count = existingAgents.length + 1;
  return {
    displayName: customName || `Fleet Specialist ${count}`,
    processRole: 'Autonomous Fleet Specialist',
    avatar: '🤖',
    description: 'Specialized autonomous fleet agent responsible for execution deliverables.',
  };
}

function findAgentToRemove(userPrompt: string, agents: Array<any>) {
  if (!agents || agents.length === 0) return null;
  const lower = userPrompt.toLowerCase();

  // 1. Check exact or partial display name / name in prompt
  for (const a of agents) {
    if (a.displayName && lower.includes(a.displayName.toLowerCase())) {
      return a;
    }
    if (a.name && lower.includes(a.name.toLowerCase())) {
      return a;
    }
  }

  // 2. Check role / archetype keywords
  if (/\b(qa|tester|test)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('qa') || (a.processRole || '').toLowerCase().includes('test'));
    if (match) return match;
  }
  if (/\b(security|warden|audit)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('security') || (a.processRole || '').toLowerCase().includes('warden'));
    if (match) return match;
  }
  if (/\b(ui|ux|frontend|design|craftsman)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('ui') || (a.processRole || '').toLowerCase().includes('frontend') || (a.processRole || '').toLowerCase().includes('craftsman'));
    if (match) return match;
  }
  if (/\b(devops|doctor|healer)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('devops') || (a.processRole || '').toLowerCase().includes('healer') || (a.processRole || '').toLowerCase().includes('doctor'));
    if (match) return match;
  }
  if (/\b(backend|api|architect)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('api') || (a.processRole || '').toLowerCase().includes('backend'));
    if (match) return match;
  }
  if (/\b(doc|docs|writer|author)\b/i.test(lower)) {
    const match = agents.find((a) => (a.processRole || '').toLowerCase().includes('doc') || (a.processRole || '').toLowerCase().includes('author'));
    if (match) return match;
  }

  // 3. Fallback: User said "remove the agent" without naming one.
  // Pick the newest agent (highest processStage or latest createdAt)
  const sorted = [...agents].sort((a, b) => {
    const stageDiff = (b.processStage ?? 0) - (a.processStage ?? 0);
    if (stageDiff !== 0) return stageDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return sorted[0];
}

/**
 * Runs Mother Chat Turn with omniscient production context and rate-limit local fallback.
 */
export async function chatWithMother(
  organizationId: string,
  message: string,
  processId?: string,
  requestedModel?: string,
  emit?: (event: string, payload: unknown) => void,
): Promise<{ result: string; model: string; sessionKey: string }> {
  const { messages: history } = await getMotherChatHistory(organizationId, processId);

  // Intent parsing with typo tolerance (aganet, agant, ajent) and multi-lingual support
  const isRemoveAgentIntent =
    /\b(remove|delete|kill|drop|discard|dismiss|terminate|hata|hatao|nikal|nikalo)\s+(the\s+|a\s+|an\s+)?([a-z0-9_\-\s]+)?(agent|aganet|agant|ajent|agents)\b/i.test(message) ||
    /\b(agent|aganet|agant|ajent|agents)\s+(remove|delete|kill|drop|hata|hatao|nikal|nikalo|chhor|chhoro)\b/i.test(message) ||
    /\b(remove|delete|hatao|hata)\s+([a-z0-9_\-\s]+)\s+(from\s+fleet|from\s+process|ko)\b/i.test(message);

  const isAddAgentIntent =
    !isRemoveAgentIntent && (
      /\b(add|create|make|spawn|recruit|provision|bna|bnao)\s+(a\s+|an\s+|the\s+)?([a-z0-9_\-\s]+)?(agent|aganet|agant|ajent|agents)\b/i.test(message) ||
      /\b(agent|aganet|agant|ajent|agents)\s+(add|create|make|spawn|recruit|bna|bnao|lao|chahiye)\b/i.test(message) ||
      /\b(naya|new|another)\s+(agent|aganet|agant|ajent)\b/i.test(message) ||
      /\b(add|create)\s+([a-z0-9_\-]+)\s+(agent|aganet|agant|ajent)\b/i.test(message)
    );

  const isFixOrDeployIntent =
    !isAddAgentIntent && !isRemoveAgentIntent &&
    /^(please\s+)?(auto-heal|fix this|fix the build|repair workspace|heal now|deploy now)\b/i.test(message.trim());

  const isAgentStatusIntent =
    /\bwhat('s|\s+is)?\s+(the\s+|each\s+|any\s+|our\s+|my\s+)?(agent|aganet|agant|ajent|agents)\s+(doing|working\s+on|up\s+to|status)\b/i.test(message) ||
    /\bwhat\s+are\s+(the\s+|all\s+|our\s+|my\s+)?(agents|aganet|agant|ajent)\s+(doing|working\s+on|up\s+to)\b/i.test(message) ||
    /\bwhat\s+(agent|aganet|agant|ajent)\s+is\s+doing\b/i.test(message) ||
    /\b(agent|aganet|agant|ajent|agents)\s+(kya\s+kr|kya\s+kar|status|activity)\b/i.test(message) ||
    /\b(kya\s+kar\s+rahe\s+hain|kya\s+kr\s+rhe\s+hai|kya\s+kar\s+raha\s+hai|kya\s+kr\s+rha\s+h)\b/i.test(message) ||
    /\bshow\s+(agent|agents)\s+(status|activity|work)\b/i.test(message);

  let autoActionReport = '';

  // ─── ACTION 1: ADD AGENT DIRECTIVE ───────────────────────────────────────
  if (isAddAgentIntent) {
    try {
      let targetProc = processId
        ? await prisma.process.findFirst({
            where: { id: processId, organizationId },
            include: { agents: { orderBy: { processStage: 'asc' } } },
          })
        : null;

      if (!targetProc) {
        targetProc = await prisma.process.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          include: { agents: { orderBy: { processStage: 'asc' } } },
        });
      }

      const existingAgents = targetProc?.agents || [];
      const inferred = inferAgentDetails(message, existingAgents);
      const nextStage = (existingAgents[existingAgents.length - 1]?.processStage || existingAgents.length) + 1;
      const rawName = `${inferred.displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36).slice(-4)}`;

      const createdAgent = await prisma.agent.create({
        data: {
          organizationId,
          name: rawName,
          displayName: inferred.displayName,
          description: inferred.description,
          avatar: inferred.avatar,
          processId: targetProc?.id || null,
          processRole: inferred.processRole,
          processStage: nextStage,
          status: 'IDLE',
          currentTask: 'Ready for assignment',
          enabled: true,
        },
      });

      // Log activity
      await prisma.activity.create({
        data: {
          organizationId,
          agentId: createdAgent.id,
          processId: targetProc?.id || null,
          type: ActivityType.SYSTEM,
          message: `Mother Chat deployed specialist agent "${createdAgent.displayName}" (${createdAgent.avatar} Stage ${createdAgent.processStage}: ${createdAgent.processRole}) into ${targetProc ? `"${targetProc.name}"` : 'the fleet'}.`,
        },
      });

      emit?.('agent:created', createdAgent);
      emit?.('process:updated', { id: targetProc?.id });

      autoActionReport += `\n- Added specialist agent "${createdAgent.displayName}" (${createdAgent.avatar} Stage ${createdAgent.processStage}: ${createdAgent.processRole}) to ${targetProc ? `production block "${targetProc.name}"` : 'the fleet'}.`;
    } catch (err: any) {
      logger.error({ err }, 'Failed to add agent via Mother Chat');
      autoActionReport += `\n- Failed to add agent: ${err.message}`;
    }
  }

  // ─── ACTION 2: REMOVE AGENT DIRECTIVE ────────────────────────────────────
  if (isRemoveAgentIntent) {
    try {
      let targetProc = processId
        ? await prisma.process.findFirst({
            where: { id: processId, organizationId },
            include: { agents: { orderBy: { processStage: 'desc' } } },
          })
        : null;

      if (!targetProc) {
        targetProc = await prisma.process.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
          include: { agents: { orderBy: { processStage: 'desc' } } },
        });
      }

      const candidateAgents = targetProc?.agents || (await prisma.agent.findMany({ where: { organizationId } }));
      const targetAgent = findAgentToRemove(message, candidateAgents);

      if (targetAgent) {
        const agentId = targetAgent.id;

        // Clean up relations that lack Cascade deletion
        await prisma.message.deleteMany({ where: { OR: [{ senderId: agentId }, { receiverId: agentId }] } }).catch(() => {});
        await prisma.metricSnapshot.deleteMany({ where: { agentId } }).catch(() => {});
        await prisma.tokenUsage.deleteMany({ where: { agentId } }).catch(() => {});
        await prisma.command.deleteMany({ where: { agentId } }).catch(() => {});
        await prisma.approval.deleteMany({ where: { agentId } }).catch(() => {});
        await prisma.activity.deleteMany({ where: { agentId } }).catch(() => {});
        await prisma.task.updateMany({ where: { agentId }, data: { agentId: null } }).catch(() => {});

        await prisma.agent.delete({ where: { id: agentId } });

        emit?.('agent:deleted', { id: agentId });
        emit?.('process:updated', { id: targetProc?.id });

        autoActionReport += `\n- Removed agent "${targetAgent.displayName}" (${targetAgent.avatar || '🤖'} Stage ${targetAgent.processStage ?? 1}: ${targetAgent.processRole || 'Specialist'}) from ${targetProc ? `"${targetProc.name}"` : 'the fleet'}.`;
      } else {
        autoActionReport += `\n- No matching agent found in the fleet to remove.`;
      }
    } catch (err: any) {
      logger.error({ err }, 'Failed to remove agent via Mother Chat');
      autoActionReport += `\n- Failed to remove agent: ${err.message}`;
    }
  }

  // ─── ACTION 3: AUTO-HEAL OR DEPLOY DIRECTIVE ─────────────────────────────
  if (isFixOrDeployIntent) {
    try {
      let targetProcId = processId;
      if (!targetProcId) {
        const latestProc = await prisma.process.findFirst({
          where: { organizationId },
          orderBy: { createdAt: 'desc' },
        });
        targetProcId = latestProc?.id;
      }

      if (targetProcId) {
        const fixRes = await askAiAndSpawnFixerAgent({
          processId: targetProcId,
          organizationId,
          userInstruction: message,
        });

        const lines: string[] = [];
        if (fixRes.agentSpawned) {
          lines.push(`- Added specialist agent "${fixRes.agentSpawned.displayName}" (Stage ${fixRes.agentSpawned.processStage}: ${fixRes.agentSpawned.processRole}).`);
        } else if (fixRes.diagnosis) {
          lines.push(`- Diagnosis: ${fixRes.diagnosis}`);
        }
        lines.push(fixRes.fixedFiles.length > 0
          ? `- Patched ${fixRes.fixedFiles.length} workspace file(s): ${fixRes.fixedFiles.join(', ')}.`
          : '- No workspace files needed changes.');
        if (fixRes.pushResult?.repoUrl) lines.push(`- Pushed a commit to GitHub: ${fixRes.pushResult.repoUrl}`);
        if (fixRes.deployResult?.previewUrl) lines.push(`- Started a Vercel deployment: ${fixRes.deployResult.previewUrl}`);
        autoActionReport += `\n${lines.join('\n')}`;
      }
    } catch (healErr: any) {
      logger.warn({ healErr: healErr.message }, 'Mother Chat auto-heal/spawn action warning');
    }
  }

  // Find an anchor agent in the org for activity foreign key
  const anchorAgent = await prisma.agent.findFirst({
    where: { organizationId, ...(processId ? { processId } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  const fallbackAgentId = anchorAgent?.id || (await prisma.agent.findFirst({ where: { organizationId } }))?.id;

  // Gather complete production context & structured cowork telemetry
  let processContext = '';
  let preferredModel: string | undefined = requestedModel?.trim() || undefined;
  let coworkData: any = undefined;
  let activeProcessId: string | null = null;
  let agentWorkOverview = '';

  const minutes = (from: Date, to?: Date | null) =>
    Math.max(0, Math.round(((to ?? new Date()).getTime() - from.getTime()) / 60000));

  if (processId) {
    const proc = await prisma.process.findFirst({
      where: { id: processId, organizationId },
      include: {
        agents: { orderBy: { processStage: 'asc' } },
        tasks: {
          take: 10,
          orderBy: { updatedAt: 'desc' },
        },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 3,
          include: { steps: true },
        },
      },
    });

    if (proc) {
      activeProcessId = proc.id;
      if (!preferredModel && proc.plannedBy && proc.plannedBy.startsWith('llm:')) {
        preferredModel = proc.plannedBy.replace(/^llm:/, '');
      }

      const files = await listWorkspaceFiles(processId);
      const latestRun = proc.runs[0];
      const steps = [...(latestRun?.steps ?? [])].sort((a, b) => a.stage - b.stage || a.startedAt.getTime() - b.startedAt.getTime());
      const latestStepsSummary = steps.map((s) => {
        const who = `- ${s.agentName} (Stage ${s.stage})`;
        switch (s.state) {
          case 'RUNNING': return `${who}: working now, ${minutes(s.startedAt)} min so far`;
          case 'COMPLETED': return `${who}: done in ${minutes(s.startedAt, s.finishedAt)} min${s.summary ? ` — ${s.summary.slice(0, 400)}` : ''}`;
          case 'FAILED': return `${who}: failed — ${(s.error || 'no error recorded').slice(0, 300)}`;
          case 'QUEUED': return `${who}: queued`;
          default: return `${who}: ${s.state.toLowerCase().replace(/_/g, ' ')}`;
        }
      });

      const stepAgentIds = new Set(steps.map((s) => s.agentId));
      const workingNow = steps.filter((s) => s.state === 'RUNNING').map((s) => `${s.agentName} (Stage ${s.stage})`);
      const inProgress = latestRun?.state === 'RUNNING' ? latestRun.currentStage : null;
      for (const a of [...proc.agents].sort((x, y) => (x.processStage ?? 0) - (y.processStage ?? 0))) {
        if (!latestRun || stepAgentIds.has(a.id)) continue;
        if (inProgress != null && a.processStage === inProgress) {
          latestStepsSummary.push(`- ${a.displayName} (Stage ${a.processStage}): working now`);
          workingNow.push(`${a.displayName} (Stage ${a.processStage})`);
        } else {
          latestStepsSummary.push(`- ${a.displayName} (Stage ${a.processStage ?? '?'}): not started yet`);
        }
      }

      // Compile detailed live status for every agent
      const agentStatusLines = await Promise.all(
        proc.agents.map(async (a) => {
          const step = steps.find((s) => s.agentId === a.id);
          let workDetail = '';
          if (step) {
            if (step.state === 'RUNNING') {
              const mins = minutes(step.startedAt);
              workDetail = `Working now on Stage ${step.stage} (${mins} min elapsed)`;
            } else if (step.state === 'COMPLETED') {
              workDetail = `Completed Stage ${step.stage}${step.summary ? `: ${step.summary.slice(0, 180)}` : ''}`;
            } else if (step.state === 'FAILED') {
              workDetail = `Failed in Stage ${step.stage}: ${(step.error || 'error').slice(0, 160)}`;
            } else {
              workDetail = `Stage ${step.stage}: ${step.state.toLowerCase()}`;
            }
          } else if (a.currentTask) {
            workDetail = a.currentTask;
          } else {
            const lastAct = await prisma.activity.findFirst({
              where: { agentId: a.id, organizationId },
              orderBy: { createdAt: 'desc' },
            });
            workDetail = lastAct ? lastAct.message.slice(0, 160) : (a.status === 'ONLINE' ? 'Executing assigned deliverables' : 'Ready for stage assignment');
          }
          return `- ${a.avatar || '🤖'} **${a.displayName}** (Stage ${a.processStage ?? 1}: ${a.processRole || 'Specialist'}) — **${a.status}**: ${workDetail}`;
        })
      );
      agentWorkOverview = agentStatusLines.join('\n');

      coworkData = {
        processName: proc.name,
        status: proc.status,
        goal: proc.prompt,
        agents: proc.agents.map((a) => ({
          name: a.displayName,
          role: a.processRole || undefined,
          stage: a.processStage || undefined,
          status: a.status,
        })),
        files: files.map((f) => f.path),
        tasks: proc.tasks.map((t) => ({ title: t.title, status: t.status })),
        latestSteps: latestStepsSummary,
        agentWorkOverview,
      };

      // Gather live cloud deployment telemetry
      let deploymentInfo = 'Not deployed to Vercel yet.';
      try {
        const vToken = process.env.VERCEL_TOKEN || (await getOrganizationIntegrationToken(organizationId, 'vercel'));
        if (vToken) {
          const deployLogs = await getVercelDeploymentLogs({ projectName: proc.name, vercelToken: vToken });
          deploymentInfo = `Cloud State: ${deployLogs.state} | URL: ${deployLogs.previewUrl || 'None'} | AI Diagnosis: ${deployLogs.diagnosis || 'None'} | Recent Logs: ${deployLogs.logs.slice(-3).map((l) => l.text).join('; ') || 'None'}`;
        }
      } catch { /* ignore */ }

      const previousRun = proc.runs.find((r) => r.id !== latestRun?.id && (r.state === 'COMPLETED' || r.state === 'FAILED'));
      const previousSummary = previousRun
        ? `Previous Run: ${previousRun.state.toLowerCase()}, finished ${minutes(previousRun.finishedAt ?? previousRun.startedAt)} min ago\n` +
          [...previousRun.steps].sort((a, b) => a.stage - b.stage)
            .map((s) => `- ${s.agentName} (Stage ${s.stage}): ${s.state === 'FAILED' ? `failed — ${(s.error || '').slice(0, 200)}` : outcomeOf(s.summary).slice(0, 400) || 'done'}`)
            .join('\n')
        : 'Previous Run: none';

      const notes: string[] = [];
      for (const f of files.filter((x) => /-output\.md$/.test(x.path)).slice(0, 4)) {
        try {
          const text = await fs.readFile(path.join(workspaceFor(processId), f.path), 'utf-8');
          notes.push(`[${f.path}]\n${text.slice(0, 900).trim()}${text.length > 900 ? '\n…' : ''}`);
        } catch { /* unreadable */ }
      }

      let codeExcerpts = '';
      try {
        // Sized for Groq's free tier (8,000 tokens a minute): a 16 KB file left
        // no budget for a second question, which then fell to a smaller model.
        const hits = await retrieveCodeContext(organizationId, message, processId, { maxFiles: 3, contextLines: 25, wholeTopFileChars: 9000 });
        codeExcerpts = hits.map((h) => `[${h.file} from line ${h.startLine}]\n${numberLines(h.snippet, h.startLine)}`).join('\n\n');
        if (codeExcerpts) codeExcerpts += `\n\n${CODE_QUOTING_RULE}`;
      } catch { /* code index unavailable */ }

      processContext = `
Production Block: "${proc.name}"
Status: ${proc.status}
Goal / Prompt: ${proc.prompt.length > 2500 ? `${proc.prompt.slice(0, 2500)}\n…(brief truncated)` : proc.prompt}
Agents in Block: ${proc.agents.map((a) => `${a.displayName} (${a.processRole || 'Agent'}, Stage ${a.processStage}, Status: ${a.status})`).join(', ')}
Workspace Files Created (${files.length}): ${files.map((f) => f.path).join(', ') || 'None yet'}
Cloud Deployment Telemetry: ${deploymentInfo}
Latest Run State: ${latestRun?.state || 'Not run yet'}${latestRun ? `, started ${minutes(latestRun.startedAt)} min ago` : ''}
Currently Working: ${workingNow.join(', ') || (latestRun?.state === 'RUNNING' ? 'between stages' : 'nobody')}
Stage-by-Stage Progress:
${latestStepsSummary.join('\n') || 'None'}
${previousSummary}
Agent Notes (excerpts):
${notes.join('\n\n') || 'None yet'}
Relevant Code (excerpts matched to this question):
${codeExcerpts || 'None matched'}
`;
    }
  } else {
    const processes = await prisma.process.findMany({
      where: { organizationId },
      include: { agents: { orderBy: { processStage: 'asc' } } },
    });
    const allAgents = await prisma.agent.findMany({
      where: { organizationId },
      select: { id: true, displayName: true, processRole: true, processStage: true, status: true, avatar: true, currentTask: true },
      orderBy: { createdAt: 'asc' },
    });

    const agentStatusLines = await Promise.all(
      allAgents.map(async (a) => {
        let work = a.currentTask;
        if (!work) {
          const act = await prisma.activity.findFirst({
            where: { agentId: a.id, organizationId },
            orderBy: { createdAt: 'desc' },
          });
          work = act ? act.message.slice(0, 160) : 'Active and standing by';
        }
        return `- ${a.avatar || '🤖'} **${a.displayName}** (Stage ${a.processStage ?? 1}: ${a.processRole || 'Specialist'}) — **${a.status}**: ${work}`;
      })
    );
    agentWorkOverview = agentStatusLines.join('\n');

    coworkData = {
      processName: 'Fleet Command',
      status: 'ACTIVE',
      goal: 'Autonomous Agent Fleet Orchestration',
      agents: allAgents.map((a) => ({
        name: a.displayName,
        role: a.processRole || undefined,
        stage: a.processStage || undefined,
        status: a.status,
      })),
      files: [],
      agentWorkOverview,
    };

    processContext = `
Active Production Blocks (${processes.length}):
${processes.map((p) => `- "${p.name}" (${p.agents.length} agents, Status: ${p.status})`).join('\n')}
Total Fleet Agents (${allAgents.length}):
${allAgents.map((a) => `- ${a.displayName} (${a.processRole || 'Agent'}, Status: ${a.status})`).join('\n')}
`;
  }

  const effectiveMessage = message;

  // The old prompt told the model it had "ALREADY executed" fleet actions and
  // must never admit a limit, so it invented recruits, fixes and live URLs.
  const motherSystemPrompt = `
You are Mother Chat, the supreme orchestrator that oversees MyceliumOps productions (multi-agent build pipelines) and manages the fleet.
Answer the operator's question using the live production context below. It is refreshed on every message and is the only source of truth about this production.

Live production context:
${processContext}
${agentWorkOverview ? `\nDetailed Live Agent Activity Status:\n${agentWorkOverview}\n` : ''}
${autoActionReport ? `Actions MyceliumOps just executed for this message:${autoActionReport}` : 'No actions were executed for this message.'}

Rules:
- Answer the question that was asked, directly, in the first sentence. Then add only the detail that helps.
- If the operator asks what an agent or all agents are doing, report the exact status and current activity using the "Detailed Live Agent Activity Status" above.
- If an action was executed above (e.g. adding or removing an agent), confirm it clearly to the operator in the response.
- Use only facts from the context. Name agents, stages and files exactly as they appear there.
- If the context doesn't contain the answer, say so plainly.
- Keep it concise, helpful, and well-structured with Markdown lists when describing agents.
- Reply in the language the operator writes in (English, Hindi, or Hinglish).
`;

  const cleanContent = (txt: string) =>
    txt
      .replace(/^🤖 \*\*Fleet Action.*?\n\n/s, '')
      .replace(/^\*\*Actions taken:\*\*.*?\n\n/s, '')
      .replace(/^⚡ \*\*.*?\n\n/s, '')
      .replace(/^(Mother Chat|Operator|Assistant):\s*/gi, '')
      .trim();

  const transcript = history
    .slice(-6)
    .filter((t) => !t.content.includes('as an AI model') && !t.content.includes('cannot create or update'))
    .map((t) => `${t.role === 'user' ? 'Operator' : 'Mother Chat'}: ${cleanContent(t.content)}`)
    .join('\n\n');

  const prompt = transcript ? `History:\n${transcript}\n\nOperator: ${effectiveMessage}` : effectiveMessage;

  const res = await callChatLLM({
    organizationId,
    systemPrompt: motherSystemPrompt,
    prompt,
    preferredModel,
    coworkData,
  });

  // Clean output of any prefix artifacts
  let cleanText = res.text
    .replace(/^(Mother Chat|Operator|Assistant):\s*/gi, '')
    .replace(/^(Mother Chat|Operator|Assistant):\s*/gi, '')
    .trim();

  if (autoActionReport) {
    cleanText = `**Actions taken:**\n${autoActionReport.trim()}\n\n` + cleanText;
  }
  if (isAgentStatusIntent && agentWorkOverview && (!cleanText.toLowerCase().includes('stage') || cleanText.includes("couldn't reach an AI model"))) {
    cleanText = `${cleanText}\n\n**Live Agent Fleet Activity:**\n${agentWorkOverview}`;
  }
  res.text = cleanText;

  const now = new Date();
  const meta = (role: 'user' | 'assistant', content: string): Prisma.InputJsonValue => ({
    motherChat: true,
    role,
    content,
    model: res.model,
  });

  if (fallbackAgentId) {
    await prisma.$transaction([
      prisma.activity.create({
        data: {
          organizationId,
          agentId: fallbackAgentId,
          processId: activeProcessId,
          type: ActivityType.MESSAGE,
          message: `Operator → Mother Chat: ${message.slice(0, 160)}`,
          metadata: meta('user', message),
          createdAt: now,
        },
      }),
      prisma.activity.create({
        data: {
          organizationId,
          agentId: fallbackAgentId,
          processId: activeProcessId,
          type: ActivityType.MESSAGE,
          message: `Mother Chat replied: ${res.text.slice(0, 160)}`,
          metadata: meta('assistant', res.text),
          createdAt: new Date(now.getTime() + 1),
        },
      }),
    ]);
  }

  return { result: res.text, model: res.model, sessionKey: `mother:${processId || 'global'}` };
}

/**
 * Runs one chat turn locally for an individual agent.
 */
export async function chatLocally(
  agentId: string,
  organizationId: string,
  message: string,
  requestedModel?: string,
): Promise<{ result: string; model: string; sessionKey: string } | null> {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
    include: {
      agentSkills: {
        include: { skill: true },
      },
    },
  });
  if (!agent) return null;

  const effectiveMessage = message;

  const { messages: history } = await getLocalChatHistory(agentId, organizationId);

  const transcript = history
    .slice(-10)
    .map((t) => `${t.role === 'user' ? 'User' : agent.displayName}: ${t.content}`)
    .join('\n\n');

  const prompt = transcript ? `History:\n${transcript}\n\nUser: ${effectiveMessage}` : effectiveMessage;

  const res = await callChatLLM({
    organizationId,
    systemPrompt: buildSystemPrompt(agent),
    prompt,
    preferredModel: requestedModel?.trim() || undefined,
  });

  const now = new Date();
  const meta = (role: 'user' | 'assistant', content: string): Prisma.InputJsonValue => ({
    chat: true,
    role,
    content,
    model: res.model,
  });

  await prisma.$transaction([
    prisma.activity.create({
      data: {
        organizationId,
        agentId,
        processId: agent.processId,
        type: ActivityType.MESSAGE,
        message: `Human → ${agent.displayName}: ${message.slice(0, 160)}`,
        metadata: meta('user', message),
        createdAt: now,
      },
    }),
    prisma.activity.create({
      data: {
        organizationId,
        agentId,
        processId: agent.processId,
        type: ActivityType.MESSAGE,
        message: `${agent.displayName} replied: ${res.text.slice(0, 160)}`,
        metadata: meta('assistant', res.text),
        createdAt: new Date(now.getTime() + 1),
      },
    }),
  ]);

  return { result: res.text, model: res.model, sessionKey: `local:${agentId}` };
}
