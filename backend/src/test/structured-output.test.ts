import { describe, it, expect, vi, beforeAll } from 'vitest';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const updates: any[] = [];
const run = {
  id: 'run-1111-2222',
  processId: 'proc-1',
  state: 'COMPLETED',
  durationMs: 184_000,
  totalTokens: 5400,
  totalCostUsd: 0.0123,
  messagingMode: 'BLACKBOARD',
  process: { id: 'proc-1', name: 'Expense Splitter', prompt: 'Split shared expenses fairly.', messagingMode: 'BLACKBOARD', agents: [{ displayName: 'QA Reviewer', processRole: 'Quality' }] },
  steps: [] as any[],
  _count: { toolCalls: 7, blackboard: 5 },
};
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    processRun: { findUnique: vi.fn(async () => run), update: vi.fn(async (args: any) => { updates.push(args); return {}; }) },
    blackboardEntry: { findMany: vi.fn(async () => [{ kind: 'issue', topic: 'Clear all', content: 'Needs a confirm dialog', status: 'open' }]) },
  },
}));

const { collectStageOutput, buildFinalOutput, callPydantic, lastParagraph, outputFile } = await import('../services/structured-output.service.js');

const dev = { displayName: 'Frontend Developer', processRole: 'UI', processStage: 1 };
const qa = { displayName: 'QA Reviewer', processRole: 'Quality', processStage: 2 };

let python = true;
beforeAll(async () => {
  try { await callPydantic(['schema', 'StageOutput']); } catch { python = false; }
});

async function workspaceWith(agent: typeof dev, content?: string) {
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'so-'));
  if (content !== undefined) {
    await fs.mkdir(path.join(ws, '.agent-output'), { recursive: true });
    await fs.writeFile(path.join(ws, outputFile(agent)), content);
  }
  return ws;
}

describe('stage output', () => {
  it('validates what the agent wrote, with who and which stage taken from the run', async () => {
    if (!python) return;
    const ws = await workspaceWith(dev, JSON.stringify({
      agent: 'Someone Else', stage: 9, status: 'done', summary: 'Built the expense splitter with paise math.',
      deliverables: ['src/App.jsx', { path: 'src/expenses.js', description: 'Split and settle logic' }],
      issues: [{ severity: 'high', description: 'No undo for deletes' }],
    }));
    const r = await collectStageOutput({ workspace: ws, agent: dev, ok: true, summary: '', files: [], toolsUsed: ['research_package_info'] });
    expect(r.agentErrors).toBeNull();
    expect(r.output).toMatchObject({
      agent: 'Frontend Developer', stage: 1, status: 'completed', source: 'agent',
      deliverables: [{ path: 'src/App.jsx' }, { path: 'src/expenses.js', description: 'Split and settle logic' }],
      issues: [{ severity: 'major', description: 'No undo for deletes', resolved: false }],
      tools_used: ['research_package_info'],
    });
  });

  it('falls back to a derived output, keeping the validation errors, when the file is invalid', async () => {
    if (!python) return;
    const ws = await workspaceWith(qa, JSON.stringify({ status: 'vibing', summary: 'ok' }));
    const r = await collectStageOutput({ workspace: ws, agent: qa, ok: true, summary: 'Reviewed.\n\nAll 7 tests pass and the build succeeds; approved.', files: ['qa-report.md'], toolsUsed: [] });
    expect(r.agentErrors?.map((e) => e.loc).sort()).toEqual(['status', 'summary']);
    expect(r.output).toMatchObject({ source: 'derived', status: 'completed', summary: 'All 7 tests pass and the build succeeds; approved.', deliverables: [{ path: 'qa-report.md' }] });
  });

  it('derives an output when the agent wrote none', async () => {
    if (!python) return;
    const r = await collectStageOutput({ workspace: await workspaceWith(dev), agent: dev, ok: true, summary: 'Done building.', files: [], toolsUsed: [] });
    expect(r.agentErrors?.[0].type).toBe('missing');
    expect(r.output?.source).toBe('derived');
  });

  it('takes the last paragraph of a transcript as the summary', () => {
    expect(lastParagraph('Reading files...\n\nI will now build.\n\nBuilt RupeeSplit; tests pass.')).toBe('Built RupeeSplit; tests pass.');
  });
});

describe('final output', () => {
  it('assembles, validates and renders a run as Markdown tables and JSON', async () => {
    if (!python) return;
    run.steps = [
      { agentName: 'Frontend Developer', stage: 1, state: 'COMPLETED', summary: 'x', files: [], output: {
        agent: 'Frontend Developer', role: 'UI', stage: 1, status: 'completed', summary: 'Built the app with paise-exact math.',
        deliverables: [{ path: 'src/App.jsx', description: 'Root UI' }], decisions: ['Integer paise'], issues: [], tests: null,
        tools_used: ['research_package_info'], next_steps: [], verdict: null, source: 'agent',
      } },
      // A step from before structured output: derived from its record.
      { agentName: 'QA Reviewer', stage: 2, state: 'COMPLETED', summary: 'Checked it.\n\nEverything matches the brief.', files: ['qa-report.md'], output: null },
    ];
    updates.length = 0;
    const out = await buildFinalOutput(run.id);
    expect(out.errors).toBeNull();
    expect(out.validatedBy).toBe('pydantic:FinalOutput@1.0');
    expect(out.data).toMatchObject({
      production: 'Expense Splitter', status: 'completed', messaging_mode: 'BLACKBOARD',
      metrics: { duration_seconds: 184, tokens: 5400, agent_steps: 2, tool_calls: 7, blackboard_entries: 5 },
      deliverables: [{ path: 'src/App.jsx' }, { path: 'qa-report.md' }],
      open_issues: [{ severity: 'major', description: 'Clear all: Needs a confirm dialog' }],
    });
    expect(out.data!.stages.map((s: any) => s.source)).toEqual(['agent', 'derived']);
    expect(out.markdown).toContain('| 1 | Frontend Developer | ✅ completed | 1 | 0 | — | agent |');
    expect(out.markdown).toContain('| `src/App.jsx` | Root UI |');
    expect(updates[0].data.output.data.run_id).toBe(run.id);
  });

  it('reports a completed run with a self-reported failed stage as partial', async () => {
    if (!python) return;
    run.steps = [{ agentName: 'QA Reviewer', stage: 2, state: 'COMPLETED', summary: '', files: [], output: {
      agent: 'QA Reviewer', stage: 2, status: 'failed', summary: 'The build does not start; see issues.', deliverables: [], decisions: [],
      issues: [{ severity: 'critical', description: 'npm run build fails', resolved: false }], tools_used: [], next_steps: [], verdict: 'changes_requested', source: 'agent',
    } }];
    const out = await buildFinalOutput(run.id);
    expect(out.errors).toBeNull();
    expect(out.data).toMatchObject({ status: 'partial', qa_verdict: 'changes_requested' });
    expect(out.data!.open_issues.map((i: any) => i.description)).toContain('QA Reviewer: npm run build fails');
  });
});
