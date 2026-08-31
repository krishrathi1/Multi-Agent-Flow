import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAgentStore } from '../stores/agent-store';
import { HeartbeatChart } from '../components/agent/HeartbeatChart';
import { AgentActivity } from '../components/agent/AgentActivity';
import { SoulViewer } from '../components/agent/SoulViewer';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { statusColors, statusTextColors, timeAgo, cn } from '../lib/utils';
import { api } from '../lib/api';
import type { WorkspaceFile } from '../types';

export function AgentProfile() {
  const { id } = useParams<{ id: string }>();
  const { selectedAgent, fetchAgent } = useAgentStore();

  useEffect(() => {
    if (id) fetchAgent(id);
  }, [id, fetchAgent]);

  if (!selectedAgent) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <HourglassLoader size={48} label="Loading agent telemetry..." />
      </div>
    );
  }

  const agent = selectedAgent;

  return (
    <div className="py-6 space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <Link to="/dashboard" className="hover:text-ink transition-colors font-medium">Dashboard</Link>
        <span>/</span>
        <Link to="/controls" className="hover:text-ink transition-colors font-medium">Fleet Controls</Link>
        <span>/</span>
        <span className="text-ink font-bold">{agent.displayName}</span>
      </div>

      {/* Agent header */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl w-14 h-14 rounded-2xl bg-inset border border-line-subtle flex items-center justify-center shadow-2xs shrink-0">
              {agent.avatar || '🤖'}
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-ink">{agent.displayName}</h2>
              <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
                <span className="text-xs text-ink-muted font-mono bg-inset px-2 py-0.5 rounded-md border border-line-subtle">{agent.name}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-inset border border-line-subtle">
                  <div className={cn('w-2 h-2 rounded-full', statusColors[agent.status], agent.status === 'ONLINE' && 'animate-pulse-dot')} />
                  <span className={cn('text-xs font-semibold', statusTextColors[agent.status])}>{agent.status}</span>
                </div>
                {agent.agentToAgent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    A2A
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 self-stretch sm:self-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-line-subtle">
            <div className="text-left sm:text-right">
              <div className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Last Heartbeat</div>
              <div className="text-xs font-bold text-ink mt-0.5">{timeAgo(agent.lastHeartbeat)}</div>
              {agent.heartbeatInterval > 0 && (
                <div className="text-[10px] text-ink-faint mt-0.5">Every {agent.heartbeatInterval}m</div>
              )}
            </div>
            <Link
              to={`/agents/${agent.id}/edit`}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-500 transition-colors shadow-xs"
            >
              Edit Agent
            </Link>
          </div>
        </div>

        {agent.description && (
          <p className="text-xs text-ink-muted leading-relaxed mt-4 pt-4 border-t border-line-subtle">{agent.description}</p>
        )}

        {/* Assigned Skills */}
        {agent.agentSkills && agent.agentSkills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Equipped Skills</span>
              <Link to={`/agents/${agent.id}/edit`} className="text-[11px] text-brand-500 font-semibold hover:underline">Manage</Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.agentSkills.map((as) => (
                <span key={as.id} className="px-2.5 py-1 text-xs rounded-xl bg-inset border border-line text-ink font-medium shadow-2xs">
                  {as.customName || as.skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Integrations */}
        {agent.integrations && agent.integrations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-line-subtle">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-ink-muted uppercase font-bold tracking-wider">Platform Integrations</span>
              <Link to={`/agents/${agent.id}/edit`} className="text-[11px] text-brand-500 font-semibold hover:underline">Configure</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-inset border border-line shadow-2xs"
                >
                  <span className="text-sm">
                    {integration.channel === 'TELEGRAM' ? '✈️' : integration.channel === 'SLACK' ? '💬' : '💭'}
                  </span>
                  <span className="text-xs text-ink font-semibold">
                    {integration.channel === 'GOOGLE_CHAT' ? 'Google Chat' : integration.channel.charAt(0) + integration.channel.slice(1).toLowerCase()}
                  </span>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    integration.enabled ? 'bg-emerald-500' : 'bg-line-strong'
                  )} />
                  <span className={cn(
                    'text-[10px] font-bold uppercase',
                    integration.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-faint'
                  )}>
                    {integration.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-line-subtle">
          <div className="text-center p-3 rounded-xl bg-inset/50 border border-line-subtle">
            <div className="text-xl font-bold text-ink">{agent._count?.activities || 0}</div>
            <div className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mt-0.5">Total Events</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-inset/50 border border-line-subtle">
            <div className="text-xl font-bold text-ink">{agent._count?.tasks || 0}</div>
            <div className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mt-0.5">Tasks</div>
          </div>
          <div className="text-center p-3 rounded-xl bg-inset/50 border border-line-subtle">
            <div className="text-xl font-bold text-ink">{agent.heartbeatInterval || '∞'}</div>
            <div className="text-[10px] text-ink-muted uppercase font-bold tracking-wider mt-0.5">Heartbeat (min)</div>
          </div>
        </div>
      </div>

      {/* Charts + Activity + Config + Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <HeartbeatChart activities={agent.activities || []} />
          <SoulViewer agent={agent} />
        </div>
        <div className="space-y-6">
          <AgentActivity activities={agent.activities || []} />
          {agent.gatewayAgentId && <WorkspaceFiles agentId={agent.id} />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Workspace Files Component
// ---------------------------------------------------------------------------

function WorkspaceFiles({ agentId }: { agentId: string }) {
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<WorkspaceFile | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);

  const fetchFiles = useCallback(async () => {
    try {
      const data = await api.files.list(agentId);
      setFiles(data);
    } catch {
      // Gateway may not be connected
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSelectFile = async (file: WorkspaceFile) => {
    if (file.missing) return;
    setLoadingFile(true);
    try {
      const data = await api.files.get(agentId, file.name);
      setSelectedFile(data);
      setEditContent(data.content || '');
    } catch {
      // ignore
    } finally {
      setLoadingFile(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setSaving(true);
    try {
      await api.files.update(agentId, selectedFile.name, editContent);
      setSelectedFile({ ...selectedFile, content: editContent });
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-ink">Workspace Files</h3>
        {selectedFile && (
          <button
            onClick={() => { setSelectedFile(null); setEditContent(''); }}
            className="text-xs text-brand-500 font-semibold hover:underline cursor-pointer"
          >
            Back to list
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-8">
          <HourglassLoader size={36} label="Loading workspace files..." />
        </div>
      ) : selectedFile ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-ink-muted font-bold">{selectedFile.name}</span>
            <button
              onClick={handleSave}
              disabled={saving || editContent === (selectedFile.content || '')}
              className={cn(
                'px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer',
                saving || editContent === (selectedFile.content || '')
                  ? 'bg-inset text-ink-faint cursor-not-allowed border border-line'
                  : 'bg-brand-600 text-white hover:bg-brand-500'
              )}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={16}
            className="w-full p-3.5 rounded-xl bg-inset border border-line text-xs text-ink font-mono resize-y focus:outline-none focus:border-brand-500 leading-relaxed shadow-inner"
          />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-ink-faint py-4 text-center">No workspace files found</p>
      ) : (
        <div className="space-y-1.5">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => handleSelectFile(file)}
              disabled={file.missing || loadingFile}
              className={cn(
                'w-full px-3.5 py-2.5 rounded-xl text-left flex items-center justify-between transition-all border cursor-pointer',
                file.missing
                  ? 'bg-inset/40 border-line text-ink-faint cursor-not-allowed'
                  : 'bg-inset/50 border-line text-ink hover:bg-hover hover:border-line-strong'
              )}
            >
              <span className="text-xs font-mono truncate">{file.name}</span>
              {file.size !== undefined && (
                <span className="text-[10px] text-ink-faint font-mono ml-2 shrink-0">
                  {file.size > 1024 ? `${(file.size / 1024).toFixed(1)}KB` : `${file.size}B`}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

