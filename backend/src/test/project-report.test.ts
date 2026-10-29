import { describe, it, expect } from 'vitest';
import { renderReportMarkdown, renderReportHtml, formatDuration, type ProjectReport } from '../services/project-report.service.js';

/** A minimal report as generateProjectReport would build it. */
function fixture(over: Partial<ProjectReport> = {}): Omit<ProjectReport, 'markdown'> {
  return {
    processId: 'p1',
    processName: 'Expense Tracker',
    generatedAt: '2026-10-27T00:00:00.000Z',
    goal: 'Build an expense tracker.\nPersist to localStorage.',
    summary: null,
    status: 'COMPLETED',
    models: ['opencode/big-pickle'],
    run: { state: 'COMPLETED', startedAt: '2026-10-26T18:58:21.000Z', finishedAt: null, durationMs: 885_000, totalTokens: 4431, totalCostUsd: 0.0051, error: null },
    runsTotal: 1,
    runsCompleted: 1,
    usage: { totalTokens: 4431, totalCostUsd: 0.0051 },
    stages: [
      { stage: 2, agent: 'UI Developer', role: 'UI', state: 'COMPLETED', durationMs: 229_000, tokens: 1433, costUsd: 0.0017, files: ['index.html'], outcome: 'Built the UI.' },
      { stage: 1, agent: 'State Engineer', role: 'Data', state: 'COMPLETED', durationMs: 283_000, tokens: 1266, costUsd: 0.0016, files: ['src/store.ts'], outcome: 'Built the store.' },
    ],
    stack: { languages: [{ name: 'TypeScript', lines: 900, files: 9, percent: 90 }], dependencies: ['vite ^6'], packageManager: 'npm', totalFiles: 2, totalLines: 1000, totalBytes: 4096 },
    howToRun: { prerequisites: ['Node.js'], steps: [{ label: 'Install dependencies', command: 'npm install' }], notes: [] },
    apiEndpoints: [],
    envVariables: [],
    dataModels: [{ name: 'Expense', file: 'src/types.ts', fields: [{ name: 'amount', type: 'number', optional: false }, { name: 'note', type: 'string | null', optional: true }] }],
    files: [{ path: 'src/store.ts', language: 'TypeScript', lines: 120, bytes: 3000, description: 'Exports ExpenseStore.' }],
    git: { local: null, github: null, targetRepo: null },
    checks: [{ name: 'Latest run', status: 'pass', detail: 'All 2 agent steps completed.' }],
    messaging: { mode: 'BLACKBOARD', board: { total: 0, byKind: {}, open: 0, resolved: 0 }, keyEntries: [], openItems: [], runs: [] },
    tools: { total: 0, failed: 0, byTool: [], recent: [] },
    patterns: {
      pattern: 'HYBRID', label: 'Hybrid (staged)', workers: 'Parallel workers inside each stage', summary: 'Stages run in order; the agents of one stage run at the same time.',
      runs: [], recommendation: { pattern: 'SEQUENTIAL', label: 'Sequential', basis: 'structure', reasons: ['Only 2 agents: a pipeline is simplest.'] },
    },
    ...over,
  };
}

describe('project report markdown', () => {
  it('reads as a document: title, glance table, run steps, stages in order', () => {
    const md = renderReportMarkdown(fixture());
    expect(md.startsWith('# Expense Tracker\n')).toBe(true);
    expect(md).toContain('## At a glance');
    expect(md).toContain('| Status | ✅ Completed in 14 min 45 s |');
    expect(md).toContain('**1. Install dependencies**\n\n```bash\nnpm install\n```');
    expect(md.indexOf('Stage 1 · State Engineer')).toBeLessThan(md.indexOf('Stage 2 · UI Developer'));
    // Union types keep their pipe without breaking the table.
    expect(md).toContain('`string \\| null`');
  });

  it('says what is missing instead of inventing it', () => {
    const md = renderReportMarkdown(fixture({ run: null, runsTotal: 0, runsCompleted: 0, stages: [], files: [] }));
    expect(md).toContain('Not run yet');
    expect(md).toContain('No commits yet');
    expect(md).toContain('**GitHub:** not pushed');
    // Sections with nothing in them are left out.
    expect(md).not.toContain('## API endpoints');
    expect(md).not.toContain('## Environment variables');
  });
});

describe('project report context sharing', () => {
  it('shows the board and compares blackboard with peer-to-peer runs', () => {
    const md = renderReportMarkdown(fixture({
      messaging: {
        mode: 'BLACKBOARD',
        board: { total: 5, byKind: { contract: 1, artifact: 3, issue: 1 }, open: 0, resolved: 1 },
        keyEntries: [{ kind: 'contract', topic: 'Expense shape', author: 'State Engineer', content: '{ id, amount | null }' }],
        openItems: [],
        runs: [
          { runId: 'aaaaaaaa1111', mode: 'BLACKBOARD', state: 'COMPLETED', durationMs: 60000, tokens: 1200, avgContextChars: 3100, entriesPosted: 5, issuesRaised: 1, issuesResolved: 1, reworkSteps: 1 },
          { runId: 'bbbbbbbb2222', mode: 'PEER_TO_PEER', state: 'COMPLETED', durationMs: 50000, tokens: 1000, avgContextChars: 900, entriesPosted: 0, issuesRaised: 0, issuesResolved: 0, reworkSteps: 0 },
        ],
      },
    }));
    expect(md).toContain('## Context sharing');
    expect(md).toContain('through a **blackboard**');
    expect(md).toContain('- **contract** · Expense shape — *State Engineer*: { id, amount \\| null }');
    expect(md).toContain('| `aaaaaaaa` | Blackboard | ✅ Completed | 1 min 0 s | 1,200 | 3,100 chars | 5 | 1 / 1 | 1 |');
    expect(md).toContain('| `bbbbbbbb` | Peer-to-peer |');
  });
});

describe('project report tool use', () => {
  it('lists each MCP tool with its calls and callers', () => {
    const md = renderReportMarkdown(fixture({
      tools: {
        total: 3, failed: 1,
        byTool: [
          { server: 'research', tool: 'package_info', calls: 2, failed: 1, avgMs: 412, callers: ['Frontend Developer', 'QA Reviewer'] },
          { server: 'analytics', tool: 'forecast', calls: 1, failed: 0, avgMs: 9, callers: ['Mother Chat'] },
        ],
        recent: [],
      },
    }));
    expect(md).toContain('## Tool use (MCP)');
    expect(md).toContain('made **3** calls to the built-in MCP tool servers (1 failed)');
    expect(md).toContain('| `package_info` | research | 2 | 1 | 412 ms | Frontend Developer, QA Reviewer |');
  });

  it('says so when no tool was called', () => {
    expect(renderReportMarkdown(fixture())).toContain('No MCP tools were called yet.');
  });
});

describe('project report agentic patterns', () => {
  it('names the pattern, compares runs by pattern and recommends one', () => {
    const md = renderReportMarkdown(fixture({
      patterns: {
        pattern: 'HIERARCHICAL', label: 'Hierarchical (supervisor / workers)', workers: 'A supervisor node plus worker agents', summary: 'A supervisor splits the goal into tasks.',
        runs: [
          { runId: 'aaaaaaaa1111', pattern: 'HIERARCHICAL', state: 'COMPLETED', durationMs: 600000, tokens: 9000, steps: 3, waves: 3, maxParallel: 1, supervisorCalls: 2, followUps: 1, qaVerdict: 'approved' },
          { runId: 'bbbbbbbb2222', pattern: 'PARALLEL', state: 'COMPLETED', durationMs: 300000, tokens: 7000, steps: 2, waves: 2, maxParallel: 1, supervisorCalls: 0, followUps: 0, qaVerdict: 'changes_requested' },
        ],
        recommendation: { pattern: 'HIERARCHICAL', label: 'Hierarchical (supervisor / workers)', basis: 'measured', reasons: ['Hierarchical: 100% completed'] },
      },
    }));
    expect(md).toContain('## Agentic design pattern');
    expect(md).toContain('runs as **Hierarchical (supervisor / workers)**');
    expect(md).toContain('| `aaaaaaaa` | Hierarchical (supervisor / workers) | ✅ Completed | 10 min 0 s | 9,000 | 3 | 3 | 1 | 2 | 1 | approved |');
    expect(md).toContain('**Recommended:** Hierarchical (supervisor / workers) (from measured runs).');
  });
});

describe('project report html', () => {
  it('escapes agent-written text', () => {
    const report = fixture({ goal: '<img src=x onerror=alert(1)>', stages: [{ stage: 1, agent: 'A', role: 'r', state: 'COMPLETED', durationMs: 1, tokens: 1, costUsd: 0, files: [], outcome: '<script>alert(1)</script>' }] });
    const html = renderReportHtml({ ...report, markdown: renderReportMarkdown(report) });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('only links http(s) URLs', () => {
    const report = fixture({ goal: '[click](javascript:alert(1))' });
    const html = renderReportHtml({ ...report, markdown: renderReportMarkdown(report) });
    expect(html).not.toContain('href="javascript:');
  });
});

describe('formatDuration', () => {
  it('uses the largest sensible units', () => {
    expect(formatDuration(42_000)).toBe('42 s');
    expect(formatDuration(885_000)).toBe('14 min 45 s');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
  });
});
