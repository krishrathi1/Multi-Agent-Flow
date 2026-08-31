import { useState } from 'react';
import { Edit3, Save } from 'lucide-react';
import { api } from '../../lib/api';
import type { ApprovalMode, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';

interface EditProcessModalProps {
  process: Process;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

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

        <Select
          label="Stage Approval Mode"
          value={approvalMode}
          onChange={(e) => setApprovalMode(e.target.value as ApprovalMode)}
          options={[
            { value: 'NONE', label: 'No gate — Run fully autonomous' },
            { value: 'FINAL_STAGE', label: 'Approve before the final stage' },
            { value: 'EVERY_STAGE', label: 'Approve before every stage' },
          ]}
        />
      </form>
    </Modal>
  );
}
