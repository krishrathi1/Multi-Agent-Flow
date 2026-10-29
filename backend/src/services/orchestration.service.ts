import type { OrchestrationPattern } from '@prisma/client';
import { logger } from '../lib/logger.js';
import { getGroqApiKey, groqChat } from './llm-provider.service.js';
import { callPydantic, type StageOutput } from './structured-output.service.js';

/**
 * Agentic design patterns: how a production's agents are organised into
 * waves, the groups that run together.
 *
 *   HYBRID        stages in order, the agents of a stage in parallel
 *   SEQUENTIAL    one agent at a time, in order (a pipeline; no worker nodes)
 *   PARALLEL      every builder at once (worker nodes), then the final stage joins
 *   HIERARCHICAL  a supervisor plans, assigns tasks to worker agents, reviews
 *
 * The runner executes waves the same way whatever the pattern, so budgets,
 * approval gates, messaging (blackboard or peer-to-peer) and structured
 * output all apply under every pattern.
 */

export interface PatternAgent {
  id: string;
  displayName: string;
  processRole: string | null;
  processStage: number;
  description?: string | null;
}

export type WaveKind = 'stage' | 'step' | 'workers' | 'join' | 'assigned' | 'follow-up';

export interface Wave<A extends PatternAgent = PatternAgent> {
  /** Shown as the run's stage number and used by approval gates. */
  stage: number;
  kind: WaveKind;
  agents: A[];
  /** Task for an agent in this wave, when the pattern assigns one. */
  tasks: Map<string, string>;
}

export const PATTERN_INFO: Record<OrchestrationPattern, { label: string; workers: string; summary: string; strengths: string; weaknesses: string }> = {
  HYBRID: {
    label: 'Hybrid (staged)',
    workers: 'Parallel workers inside each stage',
    summary: 'Stages run in order; the agents of one stage run at the same time.',
    strengths: 'Respects the planned stage order while using parallelism where the plan allows it.',
    weaknesses: 'Only as parallel as the plan; a slow agent holds up its whole stage.',
  },
  SEQUENTIAL: {
    label: 'Sequential',
    workers: 'No worker nodes: each agent is one step of a pipeline',
    summary: 'One agent at a time, in order; each sees everything the earlier ones produced.',
    strengths: 'Simplest and most predictable; every agent builds on complete earlier work; no edit conflicts.',
    weaknesses: 'Slowest wall-clock time; no parallelism; an early mistake flows downstream.',
  },
  PARALLEL: {
    label: 'Parallel (fan-out / join)',
    workers: 'All builders are worker nodes; the final stage is the join node',
    summary: 'Every builder starts at once on its own part; the final stage (usually QA) then merges and checks the work.',
    strengths: 'Fastest wall-clock time when the parts are independent.',
    weaknesses: 'Builders cannot use each other\'s output; overlapping files can conflict; more rework at the join.',
  },
  HIERARCHICAL: {
    label: 'Hierarchical (supervisor / workers)',
    workers: 'A supervisor node plus worker agents',
    summary: 'A supervisor splits the goal into tasks with dependencies, assigns them to worker agents, reviews the results and sends follow-up tasks.',
    strengths: 'Adapts to the goal: explicit tasks, dependency-aware scheduling, a review loop that catches gaps.',
    weaknesses: 'Extra supervisor calls (planning and review); quality depends on the supervisor\'s plan.',
  },
};

export const isReviewer = (a: Pick<PatternAgent, 'displayName' | 'processRole'>) =>
  /\b(qa|review|test|audit|verif)/i.test(`${a.processRole ?? ''} ${a.displayName}`);

const byStage = <A extends PatternAgent>(agents: A[]) =>
  [...agents].sort((a, b) => a.processStage - b.processStage || a.displayName.localeCompare(b.displayName));

/** Waves for the patterns that need no planning (all but hierarchical). */
export function staticWaves<A extends PatternAgent>(pattern: OrchestrationPattern, agents: A[]): Wave<A>[] {
  const ordered = byStage(agents);
  const stages = [...new Set(ordered.map((a) => a.processStage))];

  if (pattern === 'SEQUENTIAL') {
    return ordered.map((a, i) => ({ stage: i + 1, kind: 'step', agents: [a], tasks: new Map() }));
  }

  if (pattern === 'PARALLEL') {
    const last = stages.at(-1)!;
    const join = stages.length > 1 ? ordered.filter((a) => a.processStage === last) : [];
    const workers = ordered.filter((a) => !join.includes(a));
    const names = workers.map((w) => w.displayName);
    const tasks = new Map(workers.map((w) => [w.id, workers.length > 1
      ? `You run at the same time as ${names.filter((n) => n !== w.displayName).join(', ')}. Build only your own part (${w.processRole ?? w.displayName}); agree shared shapes through contracts rather than waiting for their code, and avoid editing files that belong to their part.`
      : `Build your part (${w.processRole ?? w.displayName}).`]));
    const waves: Wave<A>[] = [{ stage: 1, kind: 'workers', agents: workers, tasks }];
    if (join.length) {
      waves.push({
        stage: 2,
        kind: 'join',
        agents: join,
        tasks: new Map(join.map((j) => [j.id, `You are the join step: ${names.join(', ')} worked in parallel. Merge their parts into one working project — fix mismatches between them — and check the whole against the goal.`])),
      });
    }
    return waves;
  }

  // HYBRID (and the fallback for HIERARCHICAL without a supervisor).
  return stages.map((s) => ({ stage: s, kind: 'stage' as const, agents: ordered.filter((a) => a.processStage === s), tasks: new Map() }));
}

// ─── Hierarchical: the supervisor ───────────────────────────────────────

interface Assignment { id: string; agent: string; task: string; depends_on: string[] }

/** Matches a name the supervisor wrote to one of the production's agents. */
function resolveAgent<A extends PatternAgent>(name: string, agents: A[]): A | undefined {
  const n = name.trim().toLowerCase();
  return agents.find((a) => a.displayName.toLowerCase() === n)
    ?? agents.find((a) => a.displayName.toLowerCase().includes(n) || n.includes(a.displayName.toLowerCase()));
}

/** Orders assignments into waves: each wave holds the ones whose dependencies are done. */
export function wavesFromAssignments<A extends PatternAgent>(assignments: Assignment[], agents: A[], firstStage: number, kind: WaveKind): Wave<A>[] {
  const known = assignments.filter((x) => resolveAgent(x.agent, agents));
  const ids = new Set(known.map((x) => x.id));
  const pending = new Map(known.map((x) => [x.id, new Set(x.depends_on.filter((d) => ids.has(d)))]));
  const waves: Wave<A>[] = [];
  while (pending.size) {
    const ready = [...pending.entries()].filter(([, deps]) => deps.size === 0).map(([id]) => id);
    if (!ready.length) break; // a cycle; validation should have caught it
    const wave: Wave<A> = { stage: firstStage + waves.length, kind, agents: [], tasks: new Map() };
    for (const id of ready) {
      const x = known.find((k) => k.id === id)!;
      const agent = resolveAgent(x.agent, agents)!;
      if (!wave.agents.includes(agent)) wave.agents.push(agent);
      // One agent with two tasks in the same wave gets both, in one step.
      const prev = wave.tasks.get(agent.id);
      wave.tasks.set(agent.id, prev ? `${prev}\n- ${x.task}` : `- ${x.task}`);
      pending.delete(id);
    }
    for (const deps of pending.values()) for (const id of ready) deps.delete(id);
    waves.push(wave);
  }
  return waves;
}

function firstJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('the supervisor did not answer with JSON');
  return JSON.parse(body.slice(start, end + 1));
}

/**
 * Asks the supervisor model for JSON and validates it against a Pydantic
 * model, retrying once with the validation errors.
 */
async function askSupervisor<T>(organizationId: string, system: string, prompt: string, model: 'SupervisorPlan' | 'SupervisorReview'): Promise<{ data: T; model: string; attempts: number }> {
  const apiKey = await getGroqApiKey(organizationId);
  if (!apiKey) throw new Error('no Groq key is configured for the supervisor');
  let feedback = '';
  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await groqChat({ apiKey, system, prompt: prompt + feedback, maxTokens: 1800, timeoutMs: 45_000 });
    if (!res) throw new Error('the supervisor model did not answer');
    let parsed: unknown;
    try {
      parsed = firstJson(res.text);
    } catch (err) {
      feedback = `\n\nYour previous answer was not valid JSON (${(err as Error).message}). Answer with the JSON object only.`;
      continue;
    }
    const checked = await callPydantic<T>(['validate', model], parsed);
    if (checked.ok) return { data: checked.data, model: res.model, attempts: attempt };
    feedback = `\n\nYour previous answer failed validation:\n${checked.errors.map((e) => `- ${e.loc}: ${e.msg}`).join('\n')}\nFix these and answer with the JSON object only.`;
  }
  throw new Error(`the supervisor's ${model} failed validation twice`);
}

const roster = (agents: PatternAgent[]) =>
  agents.map((a) => `- ${a.displayName} — ${a.processRole ?? 'agent'}${a.description ? `: ${a.description.slice(0, 160)}` : ''}`).join('\n');

export interface SupervisorPlanResult<A extends PatternAgent> {
  waves: Wave<A>[];
  plan: { rationale: string; assignments: Assignment[] } | null;
  model: string | null;
  fallback: string | null;
}

/** The supervisor's plan for a run, as waves. Falls back to the staged plan if it can't produce a valid one. */
export async function supervisorPlan<A extends PatternAgent>(organizationId: string, goal: string, agents: A[]): Promise<SupervisorPlanResult<A>> {
  const system = 'You are the supervisor of a team of software agents. You split a goal into concrete tasks, assign each to the best-suited worker, and order them by dependency. You answer with one JSON object and nothing else.';
  const prompt = [
    `# Goal\n${goal.slice(0, 3000)}`,
    `# Workers (use these exact names)\n${roster(agents)}`,
    '# Answer with this JSON',
    '{"rationale": "why this split and order, 1-3 sentences", "assignments": [{"id": "t1", "agent": "<worker name>", "task": "<what to build or check, specific to the goal>", "depends_on": []}, {"id": "t2", "agent": "...", "task": "...", "depends_on": ["t1"]}]}',
    'Rules: every worker gets at least one task; tasks that can run at the same time must not depend on each other; reviewers/testers depend on the tasks they check; at most 8 assignments; ids are short strings.',
  ].join('\n\n');
  try {
    const { data, model } = await askSupervisor<{ rationale: string; assignments: Assignment[] }>(organizationId, system, prompt, 'SupervisorPlan');
    const waves = wavesFromAssignments(data.assignments, agents, 1, 'assigned');
    // Workers the supervisor left out still run, after their stage peers.
    const assigned = new Set(waves.flatMap((w) => w.agents.map((a) => a.id)));
    const missing = agents.filter((a) => !assigned.has(a.id));
    if (missing.length) waves.push({ stage: waves.length + 1, kind: 'assigned', agents: missing, tasks: new Map() });
    if (!waves.length) throw new Error('the plan named none of the workers');
    return { waves, plan: data, model, fallback: null };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Supervisor could not plan; using the staged plan');
    return { waves: staticWaves('HYBRID', agents), plan: null, model: null, fallback: (err as Error).message };
  }
}

export interface SupervisorReviewResult<A extends PatternAgent> {
  waves: Wave<A>[];
  review: { done: boolean; assessment: string; follow_ups: Assignment[] } | null;
  error: string | null;
}

/** The supervisor's review of the workers' structured outputs; follow-up tasks become more waves. */
export async function supervisorReview<A extends PatternAgent>(organizationId: string, goal: string, agents: A[], outputs: StageOutput[], nextStage: number): Promise<SupervisorReviewResult<A>> {
  const system = 'You are the supervisor of a team of software agents. You review their reported results against the goal and decide whether the work is done or which worker must fix what. You answer with one JSON object and nothing else.';
  const results = outputs.map((o) => ({
    agent: o.agent, status: o.status, summary: o.summary, verdict: o.verdict ?? undefined,
    issues: o.issues.filter((i) => !i.resolved).map((i) => `${i.severity}: ${i.description}`).slice(0, 8),
    tests: o.tests ?? undefined,
  }));
  const prompt = [
    `# Goal\n${goal.slice(0, 3000)}`,
    `# Workers (use these exact names)\n${roster(agents)}`,
    `# Their results (structured outputs)\n${JSON.stringify(results, null, 1).slice(0, 6000)}`,
    '# Answer with this JSON',
    '{"done": true, "assessment": "1-3 sentences", "follow_ups": []}',
    'or, if critical or major problems remain: {"done": false, "assessment": "...", "follow_ups": [{"id": "f1", "agent": "<worker>", "task": "<the exact fix>", "depends_on": []}]}',
    'Only send follow-ups for problems that break the goal (at most 3); minor polish is not a reason.',
  ].join('\n\n');
  try {
    const { data } = await askSupervisor<{ done: boolean; assessment: string; follow_ups: Assignment[] }>(organizationId, system, prompt, 'SupervisorReview');
    return { waves: data.done ? [] : wavesFromAssignments(data.follow_ups, agents, nextStage, 'follow-up'), review: data, error: null };
  } catch (err) {
    logger.warn({ err: (err as Error).message }, 'Supervisor review failed; finishing without follow-ups');
    return { waves: [], review: null, error: (err as Error).message };
  }
}

// ─── Run statistics and evaluation ─────────────────────────────────────

export interface OrchestrationStats {
  pattern: OrchestrationPattern;
  waves: Array<{ stage: number; kind: WaveKind; agents: string[] }>;
  maxParallel: number;
  agentSteps: number;
  supervisorCalls: number;
  supervisorModel: string | null;
  supervisorFallback: string | null;
  plan: SupervisorPlanResult<PatternAgent>['plan'];
  review: SupervisorReviewResult<PatternAgent>['review'];
}

export const emptyOrchestrationStats = (pattern: OrchestrationPattern): OrchestrationStats => ({
  pattern, waves: [], maxParallel: 0, agentSteps: 0, supervisorCalls: 0, supervisorModel: null, supervisorFallback: null, plan: null, review: null,
});

export interface PatternRun {
  pattern: OrchestrationPattern | null;
  state: string;
  durationMs: number | null;
  totalTokens: number;
  qaVerdict?: string | null;
}

/**
 * A pattern for this production, with reasons. Measured runs decide when
 * there are completed runs under at least two patterns; otherwise the team's
 * shape does.
 */
export function recommendPattern(agents: PatternAgent[], runs: PatternRun[]): { pattern: OrchestrationPattern; basis: 'measured' | 'structure'; reasons: string[] } {
  const done = runs.filter((r) => r.pattern && r.state === 'COMPLETED' && r.durationMs);
  const byPattern = new Map<OrchestrationPattern, PatternRun[]>();
  for (const r of done) byPattern.set(r.pattern!, [...(byPattern.get(r.pattern!) ?? []), r]);
  if (byPattern.size >= 2) {
    const scored = [...byPattern.entries()].map(([p, rs]) => {
      const all = runs.filter((r) => r.pattern === p);
      const successRate = rs.length / Math.max(1, all.length);
      const approved = rs.filter((r) => r.qaVerdict === 'approved').length / rs.length;
      const avgMin = rs.reduce((n, r) => n + r.durationMs!, 0) / rs.length / 60_000;
      return { p, successRate, approved, avgMin, score: successRate * 2 + approved - avgMin / 30 };
    }).sort((a, b) => b.score - a.score);
    const best = scored[0];
    return {
      pattern: best.p,
      basis: 'measured',
      reasons: scored.map((s) => `${PATTERN_INFO[s.p].label}: ${Math.round(s.successRate * 100)}% of runs completed, ${Math.round(s.approved * 100)}% QA-approved, ${s.avgMin.toFixed(1)} min on average`),
    };
  }

  const stages = new Set(agents.map((a) => a.processStage));
  const widest = Math.max(...[...stages].map((s) => agents.filter((a) => a.processStage === s).length));
  const builders = agents.filter((a) => !isReviewer(a)).length;
  if (agents.length <= 2) {
    return { pattern: 'SEQUENTIAL', basis: 'structure', reasons: [`Only ${agents.length} agent${agents.length === 1 ? '' : 's'}: a pipeline is simplest, and parallelism or a supervisor would add cost without speed.`] };
  }
  if (agents.length >= 5) {
    return { pattern: 'HIERARCHICAL', basis: 'structure', reasons: [`${agents.length} agents across ${stages.size} stages: a supervisor can split the goal into explicit tasks and schedule them by dependency.`] };
  }
  if (widest > 1 || builders >= 3) {
    return { pattern: 'HYBRID', basis: 'structure', reasons: [`Up to ${widest} agents share a stage: they can work in parallel while the stage order keeps dependent work in sequence.`] };
  }
  return { pattern: 'SEQUENTIAL', basis: 'structure', reasons: ['Each stage has one agent that builds on the previous one: a pipeline fits.'] };
}
