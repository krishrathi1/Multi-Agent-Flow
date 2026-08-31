import { useState } from 'react';
import { Check, Edit3, Lock, Save, ShieldCheck, Zap } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { ApprovalMode, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';

interface EditProcessModalProps {
  process: Process;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const APPROVAL_MODES = [
  {
    value: 'NONE' as const,
    label: 'No gate — Fully Autonomous',
    hint: 'Fastest execution. Agents transition between stages without pausing.',
    icon: Zap,
    tone: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
  },
  {
    value: 'FINAL_STAGE' as const,
    label: 'Approve before Final Stage',
    hint: 'Review outputs & deliverables before final stage execution.',
    icon: ShieldCheck,
    tone: 'text-brand-500 bg-brand-500/10 border-brand-500/30',
  },
  {
    value: 'EVERY_STAGE' as const,
    label: 'Approve before Every Stage',
    hint: 'Strict governance — requires human sign-off on each stage handoff.',
    icon: Lock,
    tone: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
  },
];

export function EditProcessModal({ process, open, onClose, onSaved }: EditProcessModalProps) {
  const toast = useToast();
  const [name, setName] = useState(process.name);
  const [prompt, setPrompt] = useState(process.prompt || '');
  const [summary, setSummary] = useState(process.summary || '');
  const [budget, setBudget] = useState(process.budgetUsd != null ? String(process.budgetUsd) : '');
  const [maxTokens, setMaxTokens] = useState(process.maxTokens != null ? String(process.maxTokens) : '');
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>(process.approvalMode || 'NONE');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Production name is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.processes.update(process.id, {
        name: name.trim(),
        prompt: prompt.trim() || undefined,
        summary: summary.trim() || undefined,
        budgetUsd: budget ? Number(budget) : null,
        maxTokens: maxTokens ? Number(maxTokens) : null,
        approvalMode,
      });

      toast.success('Production updated', `"${name.trim()}" has been saved.`);
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not save changes', (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Edit Production — ${process.name}`}
      description="Update production name, prompt goal, guardrails, and execution policies."
      size="md"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={Save}
            loading={saving}
            onClick={handleSubmit}
          >
            Save changes
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </p>
        )}

        <Input
          label="Production Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Repository Review & Quality Audit"
          required
        />

        <Textarea
          label="Target Prompt / Goal"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="What should the agents review and build?"
          rows={3}
        />

        <Textarea
          label="Description / Summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="High-level production summary"
          rows={2}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Budget Cap ($ USD)"
            type="number"
            step="0.01"
            min="0"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Unlimited"
          />

          <Input
            label="Token Limit"
            type="number"
            step="1000"
            min="0"
            value={maxTokens}
            onChange={(e) => setMaxTokens(e.target.value)}
            placeholder="Unlimited"
          />
        </div>

        {/* Custom Glassmorphic Stage Approval Selector */}
        <div>
          <label className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-brand-500" />
              <span>Stage Approval Policy</span>
            </span>
            <span className="text-[11px] font-mono text-ink-faint">
              {approvalMode === 'NONE' ? 'Autonomous' : approvalMode === 'FINAL_STAGE' ? 'Semi-Gated' : 'Strict Gate'}
            </span>
          </label>

          <div className="space-y-2">
            {APPROVAL_MODES.map((m) => {
              const Icon = m.icon;
              const isSelected = approvalMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setApprovalMode(m.value)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-brand-500/50 bg-brand-500/10 dark:bg-brand-500/15 shadow-sm ring-1 ring-brand-500/20'
                      : 'border-line-subtle bg-surface/60 hover:border-line hover:bg-hover/70'
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg border shadow-2xs transition-colors',
                      isSelected
                        ? m.tone
                        : 'bg-inset text-ink-faint border-line-subtle'
                    )}
                  >
                    <Icon size={14} strokeWidth={2} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          'text-xs transition-colors',
                          isSelected ? 'font-bold text-ink' : 'font-medium text-ink-muted'
                        )}
                      >
                        {m.label}
                      </span>
                      {isSelected && (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white shadow-2xs">
                          <Check size={10} strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p
                      className={cn(
                        'mt-0.5 text-2xs leading-relaxed',
                        isSelected ? 'text-ink-muted' : 'text-ink-faint'
                      )}
                    >
                      {m.hint}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </form>
    </Modal>
  );
}
