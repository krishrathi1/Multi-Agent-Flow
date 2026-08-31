import type { Agent } from '../../types';

export function SoulViewer({ agent }: { agent: Agent }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
      <h3 className="text-sm font-semibold text-white mb-4">Agent Configuration</h3>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label="Name" value={agent.name} />
          <InfoItem label="Display Name" value={agent.displayName} />
          <InfoItem label="Workspace" value={agent.workspace} mono />
          <InfoItem label="Heartbeat Interval" value={agent.heartbeatInterval > 0 ? `${agent.heartbeatInterval} minutes` : 'Always on'} />
          <InfoItem label="Status" value={agent.status} />
          <InfoItem label="Current Task" value={agent.currentTask || 'None'} />
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Description</h4>
          <p className="text-sm text-gray-300">{agent.description}</p>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5">
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-2">SOUL.md Location</h4>
          <code className="text-xs text-nexus-400 bg-nexus-500/10 px-2 py-1 rounded">
            {agent.workspace}SOUL.md
          </code>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">{label}</div>
      <div className={`text-sm text-gray-300 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}
