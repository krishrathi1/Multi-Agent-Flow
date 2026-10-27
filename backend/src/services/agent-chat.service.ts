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
import { retrieveCodeContext } from './code-intelligence.service.js';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getOrganizationIntegrationToken } from './org.service.js';

const HISTORY_LIMIT = 30;

/**
 * Real per-model pricing (USD per 1M tokens, as of 2025).
 * input  = prompt / input tokens price per 1M
 * output = completion / output tokens price per 1M
 */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
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
async function callChatLLM(params: {
  organizationId: string;
  systemPrompt: string;
  prompt: string;
  preferredModel?: string;
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
  // Resolve Active LLM Providers
  const providers = await prisma.llmProvider.findMany({
    where: { organizationId: params.organizationId, isActive: true },
  });

  const preferred = (params.preferredModel || '').trim();
  const preferredLower = preferred.toLowerCase();

  const isGoogle = preferredLower.startsWith('google/') || preferredLower.startsWith('gemini/') || (preferredLower.includes('gemini') && !preferredLower.startsWith('opencode/'));
  const isNvidia = preferredLower.startsWith('nvidia/');
  const isOpenCode = preferredLower.startsWith('opencode/');
  const isOpenAI = preferredLower.startsWith('openai/') || (!preferredLower.includes('/') && (preferredLower.startsWith('gpt-') || preferredLower.startsWith('o1') || preferredLower.startsWith('o3')));
  const isAnthropic = preferredLower.startsWith('anthropic/') || (!preferredLower.includes('/') && preferredLower.startsWith('claude-'));
  const isLocal = preferredLower.startsWith('local/') || preferredLower.startsWith('ollama/');

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
    ? `I couldn't reach an AI model just now, so I can't answer that question in detail. Here is the live status of **${cw.processName || 'this production'}** — ask again in a moment for a full answer.

**Progress**
${cw.latestSteps?.length ? cw.latestSteps.join('\n') : '- No run has started yet.'}

**Workspace files:** ${filesLine}`
    : `I couldn't reach an AI model just now. Please try again in a moment.`;

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

/**
 * Runs Mother Chat Turn with omniscient production context and rate-limit local fallback.
 */
export async function chatWithMother(
  organizationId: string,
  message: string,
  processId?: string,
  requestedModel?: string,
): Promise<{ result: string; model: string; sessionKey: string }> {
  const { messages: history } = await getMotherChatHistory(organizationId, processId);

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

  if (processId) {
    const proc = await prisma.process.findFirst({
      where: { id: processId, organizationId },
      include: {
        agents: true,
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
      // A running step has no summary yet; labelling it "Completed" made the
      // model tell operators nobody was working while stage 1 was mid-build.
      const minutes = (from: Date, to?: Date | null) =>
        Math.max(0, Math.round(((to ?? new Date()).getTime() - from.getTime()) / 60000));
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
      // A step row is only written when the agent finishes, so the agents of
      // the stage in progress have none yet; the run records which stage that is.
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

      // A re-run starts with no finished steps, so without the previous run
      // the model said the chart "isn't implemented yet" while the files from
      // the last run were sitting in the workspace.
      const previousRun = proc.runs.find((r) => r.id !== latestRun?.id && (r.state === 'COMPLETED' || r.state === 'FAILED'));
      const previousSummary = previousRun
        ? `Previous Run: ${previousRun.state.toLowerCase()}, finished ${minutes(previousRun.finishedAt ?? previousRun.startedAt)} min ago\n` +
          [...previousRun.steps].sort((a, b) => a.stage - b.stage)
            .map((s) => `- ${s.agentName} (Stage ${s.stage}): ${s.state === 'FAILED' ? `failed — ${(s.error || '').slice(0, 200)}` : outcomeOf(s.summary).slice(0, 400) || 'done'}`)
            .join('\n')
        : 'Previous Run: none';

      // Agents leave a notes file at the end of each stage; short excerpts let
      // the model answer "what did QA find?" from what was actually written.
      const notes: string[] = [];
      for (const f of files.filter((x) => /-output\.md$/.test(x.path)).slice(0, 4)) {
        try {
          const text = await fs.readFile(path.join(workspaceFor(processId), f.path), 'utf-8');
          notes.push(`[${f.path}]\n${text.slice(0, 900).trim()}${text.length > 900 ? '\n…' : ''}`);
        } catch { /* unreadable */ }
      }

      // File names alone left code questions ("how does the timer avoid
      // drift?") unanswerable; pull the most relevant excerpts for this one.
      let codeExcerpts = '';
      try {
        const hits = await retrieveCodeContext(organizationId, message, processId, { maxFiles: 3, contextLines: 25, wholeTopFileChars: 16000 });
        codeExcerpts = hits.map((h) => `[${h.file} from line ${h.startLine}]\n${h.snippet}`).join('\n\n');
      } catch { /* code index unavailable */ }

      processContext = `
Production Block: "${proc.name}"
Status: ${proc.status}
Goal / Prompt: ${proc.prompt.length > 6000 ? `${proc.prompt.slice(0, 6000)}\n…(brief truncated)` : proc.prompt}
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
      include: { agents: true },
    });
    const allAgents = await prisma.agent.findMany({
      where: { organizationId },
      select: { displayName: true, processRole: true, processStage: true, status: true },
    });

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
    };

    processContext = `
Active Production Blocks (${processes.length}):
${processes.map((p) => `- "${p.name}" (${p.agents.length} agents, Status: ${p.status})`).join('\n')}
Total Fleet Agents (${allAgents.length}):
${allAgents.map((a) => `- ${a.displayName} (${a.processRole || 'Agent'}, Status: ${a.status})`).join('\n')}
`;
  }

  const isAgentBuildIntent =
    /^(please\s+)?(make|create|build|add|spawn|bna|bnao)\s+(a\s+|an\s+)?(new\s+)?agent\b/i.test(message) ||
    /^(please\s+)?(agent\s+(bna|add|create|make))\b/i.test(message);

  const isFixOrDeployIntent =
    /^(please\s+)?(auto-heal|fix this|fix the build|repair workspace|heal now|deploy now)\b/i.test(message.trim());

  let autoHealReport = '';
  if (isAgentBuildIntent || isFixOrDeployIntent) {
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

        // Only report what actually happened — a missing push or deploy used
        // to be announced as "Pushed clean atomic commit" all the same.
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
        autoHealReport = `\n${lines.join('\n')}`;
      }
    } catch (healErr: any) {
      logger.warn({ healErr: healErr.message }, 'Mother Chat auto-heal/spawn action warning');
    }
  }

  const effectiveMessage = message;

  // The old prompt told the model it had "ALREADY executed" fleet actions and
  // must never admit a limit, so it invented recruits, fixes and live URLs.
  const motherSystemPrompt = `
You are Mother Chat, the assistant that oversees MyceliumOps productions (multi-agent build pipelines).
Answer the operator's question using the live production context below. It is refreshed on every message and is the only source of truth about this production.

Live production context:
${processContext}
${autoHealReport ? `Actions MyceliumOps just executed for this message:${autoHealReport}` : 'No actions were executed for this message.'}

Rules:
- Answer the question that was asked, directly, in the first sentence. Then add only the detail that helps.
- Use only facts from the context. Name agents, stages and files exactly as they appear there.
- If the context doesn't contain the answer (for example, a file's contents or a feature that may not be written yet), say so plainly and say what would tell us — e.g. which agent or stage will produce it.
- Never claim an agent was created, code was changed, something was pushed to GitHub, or a URL is live unless it is listed under the actions executed above.
- Don't describe files or folders outside this production; you have no access to them.
- Keep it short: a few sentences or a compact list. Use Markdown only when a list or code helps.
- Reply in the language the operator writes in.
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

  if (autoHealReport) {
    cleanText = `**Actions taken:**\n${autoHealReport.trim()}\n\n` + cleanText;
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
