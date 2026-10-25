import type { Agent } from '../../types';

export function SoulViewer({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6 shadow-xs">
      <h3 className="text-sm font-bold text-ink mb-4">Agent Configuration</h3>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InfoItem label="Name" value={agent.name} mono />
          <InfoItem label="Display Name" value={agent.displayName} />
          <InfoItem label="Workspace" value={agent.workspace} mono />
          <InfoItem label="Heartbeat Interval" value={agent.heartbeatInterval > 0 ? `${agent.heartbeatInterval} minutes` : 'Always on'} />
          <InfoItem label="Status" value={agent.status} />
          <InfoItem label="Current Task" value={agent.currentTask || 'None'} />
        </div>

        {agent.description && (
          <div className="pt-3 border-t border-line-subtle">
            <h4 className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mb-1">Description</h4>
            <p className="text-xs text-ink leading-relaxed">{agent.description}</p>
          </div>
        )}

        {agent.workspace && (
          <div className="pt-3 border-t border-line-subtle">
            <h4 className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mb-1">SOUL.md Location</h4>
            <code className="text-xs text-brand-600 dark:text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-lg font-mono border border-brand-500/20">
              {agent.workspace}SOUL.md
            </code>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-xl bg-inset/50 border border-line-subtle">
      <div className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mb-1">{label}</div>
      <div className={`text-xs font-semibold text-ink truncate ${mono ? 'font-mono text-[11px]' : ''}`}>{value || '—'}</div>
    </div>
  );
}

