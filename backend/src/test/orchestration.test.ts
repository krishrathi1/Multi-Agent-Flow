import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { OrchestrationPattern } from '@prisma/client';

// The supervisor's model is mocked; its answers are validated by the real Pydantic models.
const answers: string[] = [];
vi.mock('../services/llm-provider.service.js', () => ({
  getGroqApiKey: vi.fn(async () => 'gsk_test'),
  groqChat: vi.fn(async () => ({ text: answers.shift() ?? '', model: 'groq/test', inputTokens: 0, outputTokens: 0 })),
}));
vi.mock('../lib/prisma.js', () => ({ prisma: {} }));

const { staticWaves, wavesFromAssignments, supervisorPlan, supervisorReview, recommendPattern } = await import('../services/orchestration.service.js');
const { callPydantic } = await import('../services/structured-output.service.js');

const agent = (id: string, displayName: string, processStage: number, processRole: string | null = null) => ({ id, displayName, processStage, processRole });
const designer = agent('d', 'UI Designer', 1, 'Design');
const dev = agent('f', 'Frontend Developer', 2, 'Implementation');
const api = agent('b', 'Backend Developer', 2, 'API');
const qa = agent('q', 'QA Reviewer', 3, 'Quality');
const team = [qa, api, designer, dev];
const shape = (waves: Array<{ kind: string; agents: Array<{ displayName: string }> }>) => waves.map((w) => `${w.kind}:${w.agents.map((a) => a.displayName).join('+')}`);

let python = true;
beforeAll(async () => {
  try { await callPydantic(['schema', 'SupervisorPlan']); } catch { python = false; }
});
beforeEach(() => { answers.length = 0; });

describe('static patterns', () => {
  it('hybrid: stages in order, agents of a stage together', () => {
    expect(shape(staticWaves(OrchestrationPattern.HYBRID, team))).toEqual(['stage:UI Designer', 'stage:Backend Developer+Frontend Developer', 'stage:QA Reviewer']);
  });

  it('sequential: one agent per wave, a pipeline without worker nodes', () => {
    const waves = staticWaves(OrchestrationPattern.SEQUENTIAL, team);
    expect(shape(waves)).toEqual(['step:UI Designer', 'step:Backend Developer', 'step:Frontend Developer', 'step:QA Reviewer']);
    expect(waves.map((w) => w.stage)).toEqual([1, 2, 3, 4]);
  });

  it('parallel: every builder fans out as a worker, the final stage joins', () => {
    const waves = staticWaves(OrchestrationPattern.PARALLEL, team);
    expect(shape(waves)).toEqual(['workers:UI Designer+Backend Developer+Frontend Developer', 'join:QA Reviewer']);
    expect(waves[0].tasks.get('f')).toMatch(/same time as UI Designer, Backend Developer/);
    expect(waves[1].tasks.get('q')).toMatch(/join step/);
  });

  it('parallel with a single stage has no join node', () => {
    expect(shape(staticWaves(OrchestrationPattern.PARALLEL, [dev, api]))).toEqual(['workers:Backend Developer+Frontend Developer']);
  });
});

describe('hierarchical', () => {
  it('turns assignments into dependency-ordered waves and merges an agent\'s tasks', () => {
    const waves = wavesFromAssignments([
      { id: 't1', agent: 'UI Designer', task: 'Design the layout', depends_on: [] },
      { id: 't2', agent: 'backend developer', task: 'Build the API', depends_on: [] },
      { id: 't3', agent: 'Frontend Developer', task: 'Build the UI', depends_on: ['t1', 't2'] },
      { id: 't4', agent: 'Frontend Developer', task: 'Wire the API', depends_on: ['t2'] },
      { id: 't5', agent: 'QA Reviewer', task: 'Review everything', depends_on: ['t3'] },
      { id: 't6', agent: 'Nobody', task: 'Ignored: not a worker', depends_on: [] },
    ], team, 1, 'assigned');
    expect(shape(waves)).toEqual(['assigned:UI Designer+Backend Developer', 'assigned:Frontend Developer', 'assigned:QA Reviewer']);
    expect(waves[1].tasks.get('f')).toBe('- Build the UI\n- Wire the API');
  });

  it('plans with the supervisor, retrying once when its answer fails validation', async () => {
    if (!python) return;
    answers.push(
      '{"rationale": "x", "assignments": []}', // too short and empty: rejected by Pydantic
      '```json\n{"rationale": "Design and API first, then the UI, then review.", "assignments": [' +
        '{"id": "t1", "agent": "UI Designer", "task": "Design the budget screens."},' +
        '{"id": "t2", "agent": "Backend Developer", "task": "Build the expenses API."},' +
        '{"id": "t3", "agent": "Frontend Developer", "task": "Build the UI on the API.", "depends_on": ["t1", "t2"]},' +
        '{"id": "t4", "agent": "QA Reviewer", "task": "Review the app against the goal.", "depends_on": ["t3"]}]}\n```',
    );
    const planned = await supervisorPlan('org', 'Trip budget app', team);
    expect(planned.fallback).toBeNull();
    expect(planned.plan?.assignments).toHaveLength(4);
    expect(shape(planned.waves)).toEqual(['assigned:UI Designer+Backend Developer', 'assigned:Frontend Developer', 'assigned:QA Reviewer']);
  });

  it('falls back to the staged plan when the supervisor cannot produce a valid plan', async () => {
    if (!python) return;
    answers.push('not json', 'still not json');
    const planned = await supervisorPlan('org', 'Trip budget app', team);
    expect(planned.fallback).toMatch(/failed validation twice/);
    expect(shape(planned.waves)).toEqual(shape(staticWaves(OrchestrationPattern.HYBRID, team)));
  });

  it('turns the supervisor\'s review into follow-up waves', async () => {
    if (!python) return;
    answers.push('{"done": false, "assessment": "Per-person totals ignore shared expenses.", "follow_ups": [{"id": "f1", "agent": "Frontend Developer", "task": "Include shared expenses in per-person totals."}]}');
    const outputs = [{ agent: 'QA Reviewer', stage: 3, status: 'completed', summary: 'Totals are wrong for shared expenses.', deliverables: [], decisions: [], issues: [{ severity: 'major', description: 'Shared expenses missing', resolved: false }], tools_used: [], next_steps: [], verdict: 'changes_requested', source: 'agent' }] as any;
    const reviewed = await supervisorReview('org', 'Trip budget app', team, outputs, 4);
    expect(reviewed.review?.done).toBe(false);
    expect(shape(reviewed.waves)).toEqual(['follow-up:Frontend Developer']);
    expect(reviewed.waves[0].stage).toBe(4);
  });
});

describe('recommendation', () => {
  it('uses the team\'s structure until runs under two patterns exist', () => {
    expect(recommendPattern([dev, qa], []).pattern).toBe('SEQUENTIAL');
    expect(recommendPattern(team, []).pattern).toBe('HYBRID');
    expect(recommendPattern([...team, agent('x', 'Data Engineer', 2), agent('y', 'DevOps', 3)], []).pattern).toBe('HIERARCHICAL');
  });

  it('prefers the pattern that measured best', () => {
    const rec = recommendPattern(team, [
      { pattern: 'PARALLEL', state: 'COMPLETED', durationMs: 300_000, totalTokens: 1, qaVerdict: 'changes_requested' },
      { pattern: 'PARALLEL', state: 'FAILED', durationMs: 200_000, totalTokens: 1 },
      { pattern: 'SEQUENTIAL', state: 'COMPLETED', durationMs: 600_000, totalTokens: 1, qaVerdict: 'approved' },
    ]);
    expect(rec.basis).toBe('measured');
    expect(rec.pattern).toBe('SEQUENTIAL');
    expect(rec.reasons.join(' ')).toMatch(/Parallel \(fan-out \/ join\): 50% of runs completed/);
  });
});
