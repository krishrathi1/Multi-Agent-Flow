import { useState } from 'react';
import {
  Check,
  CircleDollarSign,
  Copy,
  Globe,
  KeyRound,
  Lock,
  Network,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { api } from '../../lib/api';
import type { ApprovalMode, MessagingMode, PreviewVisibility, Process } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { useToast } from '../ui/Toast';

const MODES: Array<{ value: ApprovalMode; label: string; hint: string }> = [
  { value: 'NONE', label: 'No gate — run straight through', hint: 'Fastest, fully autonomous.' },
  {
    value: 'FINAL_STAGE',
    label: 'Approve before the final stage',
    hint: 'Review the work before it ships. A good default.',
  },
  {
    value: 'EVERY_STAGE',
    label: 'Approve before every stage',
    hint: 'Maximum control — you sign off on each handoff.',
  },
];

const MESSAGING: Array<{ value: MessagingMode; label: string; hint: string }> = [
  {
    value: 'BLACKBOARD',
    label: 'Blackboard — shared state',
    hint: 'Agents read and post to one shared board; open issues send the owner back to fix them.',
  },
  {
    value: 'PEER_TO_PEER',
    label: 'Peer-to-peer — direct messages',
    hint: 'Each stage sends its summary to the next stage only. Useful as a comparison.',
  },
];

/**
 * Guardrails for a chain: where a human must sign off, how agents share
 * context, and the ceiling a run may not spend past.
 */
export function ChainSettingsModal({
  process,
  open,
  onClose,
  onSaved,
}: {
  process: Process;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<ApprovalMode>(process.approvalMode ?? 'NONE');
  const [messaging, setMessaging] = useState<MessagingMode>(process.messagingMode ?? 'BLACKBOARD');
  const [budget, setBudget] = useState(
    process.budgetUsd != null ? String(process.budgetUsd) : '',
  );
  const [maxTokens, setMaxTokens] = useState(
    process.maxTokens != null ? String(process.maxTokens) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [visibility, setVisibility] = useState<PreviewVisibility>(
    process.previewVisibility ?? 'PRIVATE',
  );
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/preview/${process.id}` +
        (visibility === 'TOKEN' && shareToken ? `?t=${shareToken}` : '')
      : '';

  const applyVisibility = async (next: PreviewVisibility, rotate = false) => {
    setVisibility(next);
    try {
      const res = await api.orchestration.setShare(process.id, next, rotate);
      setShareToken(res.shareToken);
      toast.success(
        'Sharing updated',
        next === 'PRIVATE'
          ? 'The preview is closed.'
          : next === 'TOKEN'
            ? 'Only people with the link and token can open it.'
            : 'Anyone with the link can open it.',
      );
    } catch (err) {
      toast.error('Could not update sharing', (err as Error).message);
    }
  };

  const save = async () => {
    const budgetNum = budget.trim() === '' ? null : Number(budget);
    const tokenNum = maxTokens.trim() === '' ? null : Number(maxTokens);

    if (budgetNum !== null && (Number.isNaN(budgetNum) || budgetNum < 0)) {
      setError('Budget must be a positive number, or blank for no cap.');
      return;
    }
    if (tokenNum !== null && (Number.isNaN(tokenNum) || tokenNum < 0)) {
      setError('Token cap must be a positive whole number, or blank for none.');
      return;
    }

    setBusy(true);
    setError(undefined);
    try {
      await api.processes.update(process.id, {
        approvalMode: mode,
        messagingMode: messaging,
        budgetUsd: budgetNum,
        maxTokens: tokenNum === null ? null : Math.round(tokenNum),
      });
      toast.success('Guardrails saved', `"${process.name}" updated.`);
      onSaved?.();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      toast.error('Could not save', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={SlidersHorizontal}
      title={`Guardrails — ${process.name}`}
      description="Control where a human signs off and how much a run may spend."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            Save guardrails
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <ShieldCheck size={12} strokeWidth={2} aria-hidden />
            Human approval
          </p>
          <div className="space-y-1.5">
            {MODES.map((m) => (
              <label
                key={m.value}
                className={
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ' +
                  (mode === m.value
                    ? 'border-brand-600/40 bg-brand-500/10 dark:border-brand-500/40'
                    : 'border-line bg-inset hover:border-line-strong')
                }
              >
                <input
                  type="radio"
                  name="approval-mode"
                  value={m.value}
                  checked={mode === m.value}
                  onChange={() => setMode(m.value)}
                  className="mt-0.5 accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-subtle">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <Network size={12} strokeWidth={2} aria-hidden />
            Context sharing between agents
          </p>
          <div className="space-y-1.5">
            {MESSAGING.map((m) => (
              <label
                key={m.value}
                className={
                  'flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors ' +
                  (messaging === m.value
                    ? 'border-brand-600/40 bg-brand-500/10 dark:border-brand-500/40'
                    : 'border-line bg-inset hover:border-line-strong')
                }
              >
                <input
                  type="radio"
                  name="messaging-mode"
                  value={m.value}
                  checked={messaging === m.value}
                  onChange={() => setMessaging(m.value)}
                  className="mt-0.5 accent-brand-600"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-ink-subtle">{m.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Artifact sharing: the preview route is public by id, which is
            obscurity rather than access control. This makes it a choice. */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <Globe size={12} strokeWidth={2} aria-hidden />
            Who can open the artifacts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {([
              { v: 'PRIVATE' as const, label: 'Organization members only (Private)', icon: Lock },
              { v: 'TOKEN' as const, label: 'Secret link with token', icon: KeyRound },
              { v: 'PUBLIC' as const, label: 'Anyone with link (Public)', icon: Globe },
            ]).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => applyVisibility(o.v)}
                aria-pressed={visibility === o.v}
                className={
                  'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ' +
                  (visibility === o.v
                    ? 'border-brand-600/40 bg-brand-500/12 text-brand-700 dark:border-brand-500/40 dark:text-brand-200'
                    : 'border-line bg-inset text-ink-subtle hover:border-line-strong hover:text-ink')
                }
              >
                <o.icon size={13} strokeWidth={1.75} aria-hidden />
                {o.label}
              </button>
            ))}
          </div>

          {visibility !== 'PRIVATE' && (
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-inset px-2.5 py-1.5 font-mono text-2xs text-ink-subtle">
                {shareUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                icon={copied ? Check : Copy}
                onClick={async () => {
                  await navigator.clipboard?.writeText(shareUrl).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          )}
          {visibility === 'TOKEN' && (
            <Button
              variant="ghost"
              size="xs"
              icon={KeyRound}
              className="mt-1.5"
              onClick={() => applyVisibility('TOKEN', true)}
            >
              Rotate token (revokes the old link)
            </Button>
          )}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <CircleDollarSign size={12} strokeWidth={2} aria-hidden />
            Spend ceiling
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Budget (USD)"
              type="number"
              min="0"
              step="0.5"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="No cap"
              hint="Checked between stages."
            />
            <Input
              label="Token cap"
              type="number"
              min="0"
              step="1000"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              placeholder="No cap"
              hint="Stops the run once exceeded."
            />
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-300">
              {error}
            </p>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            Caps are enforced <strong>between stages</strong>, so a single long stage can
            overshoot before the next check.
          </p>
        </div>
      </div>
    </Modal>
  );
}
