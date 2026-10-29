import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { config } from '../config.js';

/**
 * Structured output, defined by the Pydantic models in backend/structured/.
 *
 * Each agent ends its step by writing a StageOutput as JSON; the runner
 * validates it through Pydantic (falling back to one derived from the
 * agent's summary and files when it is missing or invalid). At the end of a
 * run the stages are assembled into a FinalOutput, validated, and rendered
 * as Markdown tables alongside the JSON.
 */

const CLI = fileURLToPath(new URL('../../structured/cli.py', import.meta.url));
const pythonBin = () => process.env.PYTHON_BIN?.trim() || (process.platform === 'win32' ? 'python' : 'python3');

export interface FieldError { loc: string; msg: string; type: string }
type CliResult<T> = { ok: true; data: T; markdown?: string; schema?: unknown } | { ok: false; errors: FieldError[] };

/** Runs one command of the Pydantic bridge. Throws only if Python itself can't run it. */
export function callPydantic<T = unknown>(args: string[], input?: unknown, timeoutMs = 20_000): Promise<CliResult<T>> {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonBin(), ['-X', 'utf8', CLI, ...args], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Pydantic validation timed out')); }, timeoutMs);
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => { clearTimeout(timer); reject(new Error(`Could not start Python for Pydantic validation: ${err.message}`)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      try {
        resolve(JSON.parse(stdout) as CliResult<T>);
      } catch {
        reject(new Error(`Pydantic bridge failed (exit ${code}): ${(stderr || stdout).trim().slice(-400)}`));
      }
    });
    child.stdin.end(input === undefined ? '' : JSON.stringify(input));
  });
}

// ─── Stage output ───────────────────────────────────────────────────────

export const OUTPUT_DIR = '.agent-output';

export interface StageOutput {
  agent: string;
  role?: string | null;
  stage: number;
  status: 'completed' | 'partial' | 'blocked' | 'failed';
  summary: string;
  deliverables: Array<{ path: string; description: string }>;
  decisions: string[];
  issues: Array<{ severity: 'critical' | 'major' | 'minor' | 'info'; description: string; resolved: boolean }>;
  tests?: { ran: boolean; passed?: boolean | null; command?: string | null; details?: string | null } | null;
  tools_used: string[];
  next_steps: string[];
  verdict?: 'approved' | 'changes_requested' | null;
  source: 'agent' | 'derived';
}

type StepAgent = { displayName: string; processRole?: string | null; processStage: number };

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
export const outputFile = (agent: Pick<StepAgent, 'displayName'>) => `${OUTPUT_DIR}/${slug(agent.displayName)}.json`;

/** Clears the agent's file from an earlier run so a stale output is never read as this one's. */
export async function resetStageOutput(workspace: string, agent: StepAgent): Promise<void> {
  await fs.rm(path.join(workspace, outputFile(agent)), { force: true }).catch(() => {});
}

/** The prompt section asking an agent for its StageOutput. */
export function stageOutputInstructions(agent: StepAgent): string {
  const reviewer = /\b(qa|review|test|audit|verif)/i.test(`${agent.processRole ?? ''} ${agent.displayName}`);
  const example = {
    agent: agent.displayName,
    stage: agent.processStage,
    status: 'completed',
    summary: 'What you produced and its state, in 2-4 sentences.',
    deliverables: [{ path: 'src/App.jsx', description: 'Root component with the expense form and balances' }],
    decisions: ['Amounts are stored as integer paise'],
    issues: [{ severity: 'minor', description: 'No undo after deleting an expense', resolved: false }],
    tests: { ran: true, passed: true, command: 'npm test', details: '7 tests' },
    tools_used: ['research_package_info'],
    next_steps: ['Add CSV export'],
    ...(reviewer ? { verdict: 'approved' } : {}),
  };
  return [
    '# Structured output (required)',
    `As soon as your main work is done — before any optional extra checks — write your output as JSON to \`${outputFile(agent)}\`, and update it if you find more. It is validated against a schema, so use exactly these fields:`,
    '```json',
    JSON.stringify(example, null, 2),
    '```',
    '- `status`: completed | partial | blocked | failed. `severity`: critical | major | minor | info.',
    '- List every file you created or changed in `deliverables`, with paths relative to the workspace root.',
    reviewer
      ? '- As a reviewer, set `verdict` to "approved" or "changes_requested", and list each problem you found in `issues`.'
      : '- Put anything unfinished or broken in `issues`, honestly.',
  ].join('\n');
}

/**
 * The summary from the StageOutput an agent has already written, if any.
 * Lets a session that ran out of time after finishing its work count as done.
 */
export async function writtenStageSummary(workspace: string, agent: Pick<StepAgent, 'displayName'>): Promise<string | null> {
  try {
    const parsed = JSON.parse(await fs.readFile(path.join(workspace, outputFile(agent)), 'utf8'));
    return typeof parsed?.summary === 'string' && parsed.summary.trim().length >= 10 ? parsed.summary.trim() : null;
  } catch {
    return null;
  }
}

/** The last paragraph of an agent's transcript, which is where it summarises its work. */
export function lastParagraph(text: string, max = 1500): string {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length >= 10);
  const last = paragraphs.at(-1) ?? text.trim();
  return last.length > max ? `${last.slice(0, max - 1)}…` : last;
}

function derivedStage(agent: StepAgent, ok: boolean, summary: string, files: string[], toolsUsed: string[]): Record<string, unknown> {
  const text = lastParagraph(summary || '');
  return {
    agent: agent.displayName,
    role: agent.processRole ?? null,
    stage: agent.processStage,
    status: ok ? 'completed' : 'failed',
    summary: text.length >= 10 ? text : ok ? `${agent.displayName} completed its stage.` : `${agent.displayName} did not complete its stage.`,
    deliverables: files.slice(0, 60).map((p) => ({ path: p, description: '' })),
    tools_used: toolsUsed,
    source: 'derived',
  };
}

/**
 * Reads, completes and validates the StageOutput an agent wrote. When the
 * file is missing or fails validation, a derived output (from the agent's
 * summary and files) is validated instead, and the agent's errors are kept.
 */
export async function collectStageOutput(params: {
  workspace: string;
  agent: StepAgent;
  ok: boolean;
  summary: string;
  files: string[];
  toolsUsed: string[];
}): Promise<{ output: StageOutput | null; agentErrors: FieldError[] | null; error?: string }> {
  const { workspace, agent, ok, summary, files, toolsUsed } = params;
  let agentErrors: FieldError[] | null = null;
  try {
    const raw = await fs.readFile(path.join(workspace, outputFile(agent)), 'utf8').catch(() => null);
    if (raw !== null) {
      let parsed: Record<string, unknown> | null = null;
      try { parsed = JSON.parse(raw); } catch (err) {
        agentErrors = [{ loc: '(root)', msg: `not valid JSON: ${(err as Error).message}`, type: 'json_invalid' }];
      }
      if (parsed && typeof parsed === 'object') {
        // Who and which stage come from the run, not from what the agent typed.
        const candidate = {
          ...parsed,
          agent: agent.displayName,
          role: agent.processRole ?? (parsed.role as string | undefined) ?? null,
          stage: agent.processStage,
          tools_used: [...new Set([...(Array.isArray(parsed.tools_used) ? parsed.tools_used : []), ...toolsUsed])],
          source: 'agent',
        };
        const checked = await callPydantic<StageOutput>(['validate', 'StageOutput'], candidate);
        if (checked.ok) return { output: checked.data, agentErrors: null };
        agentErrors = checked.errors;
      }
    } else {
      agentErrors = [{ loc: '(file)', msg: `${outputFile(agent)} was not written`, type: 'missing' }];
    }
    const fallback = await callPydantic<StageOutput>(['validate', 'StageOutput'], derivedStage(agent, ok, summary, files, toolsUsed));
    return fallback.ok
      ? { output: fallback.data, agentErrors }
      : { output: null, agentErrors, error: fallback.errors.map((e) => `${e.loc}: ${e.msg}`).join('; ') };
  } catch (err) {
    logger.warn({ err, agent: agent.displayName }, 'Structured stage output unavailable');
    return { output: null, agentErrors, error: (err as Error).message };
  }
}

// ─── Final output ───────────────────────────────────────────────────────

export interface StoredFinalOutput {
  data: Record<string, any> | null;
  markdown: string | null;
  errors: FieldError[] | null;
  validatedBy: string;
  generatedAt: string;
}

const RUN_STATUS: Record<string, string> = {
  COMPLETED: 'completed', FAILED: 'failed', CANCELLED: 'blocked', AWAITING_APPROVAL: 'blocked', RUNNING: 'partial', QUEUED: 'partial',
};

/** Assembles a run's FinalOutput from its stages, validates and renders it with Pydantic, and stores it on the run. */
export async function buildFinalOutput(runId: string): Promise<StoredFinalOutput> {
  const run = await prisma.processRun.findUnique({
    where: { id: runId },
    include: {
      process: { select: { id: true, name: true, prompt: true, messagingMode: true, agents: { select: { displayName: true, processRole: true } } } },
      steps: { orderBy: [{ stage: 'asc' }, { startedAt: 'asc' }] },
      _count: { select: { toolCalls: true, blackboard: true } },
    },
  });
  if (!run) throw new Error('Run not found');

  const roles = new Map(run.process.agents.map((a) => [a.displayName, a.processRole]));
  const stages = run.steps.map((s) => {
    if (s.output && typeof s.output === 'object') return s.output as unknown as StageOutput;
    // Steps from before structured output, or ones that failed: derive from the record.
    const ok = s.state === 'COMPLETED';
    return derivedStage(
      { displayName: s.agentName, processRole: roles.get(s.agentName), processStage: s.stage },
      ok,
      s.summary || s.error || '',
      Array.isArray(s.files) ? (s.files as string[]) : [],
      [],
    );
  });

  const deliverables = new Map<string, { path: string; description: string }>();
  for (const st of stages as StageOutput[]) {
    for (const d of st.deliverables ?? []) {
      const prev = deliverables.get(d.path);
      if (!prev || (!prev.description && d.description)) deliverables.set(d.path, d);
    }
  }

  const board = await prisma.blackboardEntry.findMany({
    where: { processId: run.processId, status: 'open', kind: { in: ['issue', 'question'] } },
    orderBy: { createdAt: 'asc' },
    take: 30,
  });
  const openIssues = [
    ...board.map((e) => ({ severity: e.kind === 'issue' ? 'major' : 'info', description: `${e.topic}: ${e.content}`.slice(0, 600), resolved: false })),
    ...(stages as StageOutput[]).flatMap((st) => (st.issues ?? [])
      .filter((i) => !i.resolved && (i.severity === 'critical' || i.severity === 'major'))
      .map((i) => ({ ...i, description: `${st.agent}: ${i.description}`.slice(0, 600) }))),
  ];
  const verdicts = (stages as StageOutput[]).map((st) => st.verdict).filter(Boolean);
  // The run finished, but an agent reported its own stage as failed: that's partial, not completed.
  let status = RUN_STATUS[run.state] ?? 'partial';
  if (status === 'completed' && (stages as StageOutput[]).some((st) => st.status === 'failed')) status = 'partial';

  const payload = {
    production: run.process.name,
    goal: run.process.prompt.slice(0, 4000) || run.process.name,
    run_id: run.id,
    status,
    messaging_mode: run.messagingMode ?? run.process.messagingMode,
    orchestration_pattern: run.orchestrationPattern ?? null,
    generated_at: new Date().toISOString(),
    stages,
    deliverables: [...deliverables.values()].slice(0, 200),
    open_issues: openIssues,
    qa_verdict: verdicts.at(-1) ?? null,
    metrics: {
      duration_seconds: run.durationMs != null ? Math.round(run.durationMs / 100) / 10 : null,
      tokens: run.totalTokens,
      cost_usd: Number(run.totalCostUsd.toFixed(6)),
      agent_steps: run.steps.length,
      tool_calls: run._count.toolCalls,
      blackboard_entries: run._count.blackboard,
    },
    preview_url: `${config.appUrl}/preview/${run.processId}`,
  };

  let stored: StoredFinalOutput;
  try {
    const result = await callPydantic<Record<string, any>>(['final'], payload);
    stored = result.ok
      ? { data: result.data, markdown: result.markdown ?? null, errors: null, validatedBy: 'pydantic:FinalOutput@1.0', generatedAt: payload.generated_at }
      : { data: null, markdown: null, errors: result.errors, validatedBy: 'pydantic:FinalOutput@1.0', generatedAt: payload.generated_at };
  } catch (err) {
    stored = { data: null, markdown: null, errors: [{ loc: '(bridge)', msg: (err as Error).message, type: 'unavailable' }], validatedBy: 'pydantic:FinalOutput@1.0', generatedAt: payload.generated_at };
  }
  await prisma.processRun.update({ where: { id: runId }, data: { output: stored as unknown as Prisma.InputJsonValue } });
  if (stored.errors) logger.warn({ runId, errors: stored.errors }, 'Final output failed validation');
  return stored;
}
