import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { FinalOutputView, Process } from '../types';

const view: FinalOutputView = {
  runId: '80b870bc-1111-2222-3333-444455556666',
  state: 'COMPLETED',
  startedAt: '2026-10-29T18:00:00.000Z',
  generatedAt: '2026-10-29T18:04:00.000Z',
  validatedBy: 'pydantic:FinalOutput@1.0',
  errors: null,
  markdown: '# Tip Calculator — final output\n\n| Field | Value |\n|---|---|\n| Status | ✅ completed |',
  data: {
    schema_version: '1.0',
    production: 'Tip Calculator',
    goal: 'A tip calculator in rupees.',
    run_id: '80b870bc-1111-2222-3333-444455556666',
    status: 'completed',
    messaging_mode: 'BLACKBOARD',
    generated_at: '2026-10-29T18:04:00Z',
    stages: [
      { agent: 'Frontend Developer', role: 'UI', stage: 1, status: 'completed', summary: 'Built index.html with live rupee totals.', deliverables: [{ path: 'index.html', description: 'The calculator' }], decisions: ['Round the tip to whole paise'], issues: [], tests: { ran: true, passed: true, command: 'node smoke.mjs', details: null }, tools_used: [], next_steps: [], verdict: null, source: 'agent' },
      { agent: 'QA Reviewer', role: 'Quality', stage: 2, status: 'completed', summary: 'Reviewed in jsdom; 3 minor issues.', deliverables: [], decisions: [], issues: [{ severity: 'minor', description: 'Decimal people count is truncated', resolved: false }], tests: null, tools_used: [], next_steps: [], verdict: 'approved', source: 'derived' },
    ],
    deliverables: [{ path: 'index.html', description: 'The calculator' }],
    open_issues: [{ severity: 'major', description: 'Clear all: needs a confirm dialog', resolved: false }],
    qa_verdict: 'approved',
    metrics: { duration_seconds: 184, tokens: 5400, cost_usd: 0.0123, agent_steps: 2, tool_calls: 7, blackboard_entries: 5 },
    preview_url: null,
  },
};

const output = vi.fn(async () => view);
vi.mock('../lib/api', () => ({ api: { processes: { output: (...a: unknown[]) => output(...(a as [])) } } }));
vi.mock('../lib/socket', () => ({ getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));
vi.mock('../components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const { FinalOutputModal } = await import('../components/process/FinalOutputModal');

describe('FinalOutputModal', () => {
  it('shows the validated output as tables, Markdown and JSON', async () => {
    render(<FinalOutputModal process={{ id: 'p1', name: 'Tip Calculator' } as Process} open onClose={() => {}} />);

    expect(await screen.findByText(/Validated · Pydantic FinalOutput v1.0/)).toBeInTheDocument();
    const stages = screen.getByText('Stages').closest('section')!;
    const rows = within(stages).getAllByRole('row');
    expect(rows).toHaveLength(3); // header + 2 stages
    expect(within(rows[1]).getByText('Frontend Developer')).toBeInTheDocument();
    expect(within(rows[1]).getByText('agent JSON')).toBeInTheDocument();
    expect(within(rows[2]).getByText('derived')).toBeInTheDocument();
    expect(screen.getByText(/Round the tip to whole paise/)).toBeInTheDocument();
    expect(screen.getByText('Clear all: needs a confirm dialog')).toBeInTheDocument();
    expect(screen.getByText('5,400 / $0.0123')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /JSON/ }));
    expect(screen.getByText(/"qa_verdict": "approved"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Markdown/ }));
    expect(screen.getByText(/# Tip Calculator — final output/)).toBeInTheDocument();
  });

  it('lists the field errors when the output failed validation', async () => {
    output.mockResolvedValueOnce({ ...view, data: null, markdown: null, errors: [{ loc: 'stages.0.status', msg: "Input should be 'completed'", type: 'enum' }] });
    render(<FinalOutputModal process={{ id: 'p1', name: 'Tip Calculator' } as Process} open onClose={() => {}} />);
    expect(await screen.findByText('Failed validation')).toBeInTheDocument();
    expect(screen.getByText('stages.0.status')).toBeInTheDocument();
  });
});
