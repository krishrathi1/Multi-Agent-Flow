import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PatternsView, Process } from '../types';

const info = (label: string) => ({ label, workers: `${label} workers`, summary: `${label} summary`, strengths: 'fast', weaknesses: 'costly' });
const view: PatternsView = {
  pattern: 'HYBRID',
  info: { HYBRID: info('Hybrid (staged)'), SEQUENTIAL: info('Sequential'), PARALLEL: info('Parallel (fan-out / join)'), HIERARCHICAL: info('Hierarchical (supervisor / workers)') },
  preview: {
    HYBRID: [{ stage: 1, kind: 'stage', agents: ['Frontend Developer'] }, { stage: 2, kind: 'stage', agents: ['QA Reviewer'] }],
    SEQUENTIAL: [{ stage: 1, kind: 'step', agents: ['Frontend Developer'] }, { stage: 2, kind: 'step', agents: ['QA Reviewer'] }],
    PARALLEL: [{ stage: 1, kind: 'workers', agents: ['Frontend Developer'] }, { stage: 2, kind: 'join', agents: ['QA Reviewer'] }],
    HIERARCHICAL: [{ stage: 0, kind: 'supervisor', agents: ['Supervisor'] }, { stage: 1, kind: 'assigned', agents: ['Frontend Developer', 'QA Reviewer'] }],
  },
  recommendation: { pattern: 'SEQUENTIAL', basis: 'structure', reasons: ['Only 2 agents: a pipeline is simplest.'] },
  runs: [{
    id: 'r1', state: 'COMPLETED', startedAt: '2026-10-30T10:00:00Z', durationMs: 420_000, totalTokens: 9000, totalCostUsd: 0.01,
    orchestrationPattern: 'HIERARCHICAL', messagingMode: 'BLACKBOARD', qaVerdict: 'approved', outputStatus: 'completed', _count: { steps: 3 },
    orchestration: {
      pattern: 'HIERARCHICAL', waves: [{ stage: 1, kind: 'assigned', agents: ['Frontend Developer'] }, { stage: 2, kind: 'assigned', agents: ['QA Reviewer'] }],
      maxParallel: 1, agentSteps: 3, supervisorCalls: 2, supervisorModel: 'groq/openai/gpt-oss-120b', supervisorFallback: null,
      plan: { rationale: 'Build first, then review.', assignments: [{ id: 't1', agent: 'Frontend Developer', task: 'Build the trip budget UI.', depends_on: [] }] },
      review: { done: false, assessment: 'Totals miss shared costs.', follow_ups: [{ id: 'f1', agent: 'Frontend Developer', task: 'Include shared costs.', depends_on: [] }] },
    },
  }],
};

const update = vi.fn(async () => ({}));
vi.mock('../lib/api', () => ({ api: { processes: { patterns: vi.fn(async () => view), update: (...a: unknown[]) => update(...(a as [])) } } }));
vi.mock('../lib/socket', () => ({ getSocket: () => ({ on: vi.fn(), off: vi.fn() }) }));
vi.mock('../components/ui/Toast', () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));

const { PatternsModal } = await import('../components/process/PatternsModal');

describe('PatternsModal', () => {
  it('shows each pattern with its topology, compares runs and shows the supervisor\'s decisions', async () => {
    render(<PatternsModal process={{ id: 'p1', name: 'Trip Budget' } as Process} open onClose={() => {}} />);
    expect(await screen.findByText(/Recommended: Sequential/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hybrid \(staged\).*In use/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByText('Supervisor').length).toBeGreaterThan(0);
    expect(screen.getByText('Workers (parallel)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Hierarchical/ }));
    expect(update).toHaveBeenCalledWith('p1', { orchestrationPattern: 'HIERARCHICAL' });

    fireEvent.click(screen.getByRole('tab', { name: /Compare runs/ }));
    expect(screen.getByText('7m 0s')).toBeInTheDocument();
    expect(screen.getByText('approved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /Last run/ }));
    expect(screen.getByText("Supervisor's plan")).toBeInTheDocument();
    expect(screen.getByText('Build the trip budget UI.')).toBeInTheDocument();
    expect(screen.getByText(/Totals miss shared costs/)).toBeInTheDocument();
  });
});
