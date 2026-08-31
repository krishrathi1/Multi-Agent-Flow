import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAgentStore } from '../stores/agent-store';
import { HeartbeatChart } from '../components/agent/HeartbeatChart';
import { AgentActivity } from '../components/agent/AgentActivity';
import { SoulViewer } from '../components/agent/SoulViewer';
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
    return <div className="py-12 text-gray-500">Loading agent...</div>;
  }

  const agent = selectedAgent;

  return (
    <div className="py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-white">{agent.displayName}</span>
      </div>

      {/* Agent header */}
      <div className="rounded-xl border border-white/5 bg-surface-850 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{agent.avatar}</span>
            <div>
              <h2 className="text-2xl font-bold text-white">{agent.displayName}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-500 font-mono">{agent.name}</span>
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full', statusColors[agent.status], agent.status === 'ONLINE' && 'animate-pulse-dot')} />
                  <span className={cn('text-sm font-medium', statusTextColors[agent.status])}>{agent.status}</span>
                </div>
                {agent.agentToAgent && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase bg-nexus-600/15 text-nexus-400 border border-nexus-500/20">
                    A2A
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Last Heartbeat</div>
              <div className="text-sm text-white mt-0.5">{timeAgo(agent.lastHeartbeat)}</div>
              {agent.heartbeatInterval > 0 && (
                <div className="text-xs text-gray-600 mt-0.5">Every {agent.heartbeatInterval}m</div>
              )}
            </div>
            <Link
              to={`/agents/${agent.id}/edit`}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors"
            >
              Edit Agent
            </Link>
          </div>
        </div>

        <p className="text-sm text-gray-400 mt-4">{agent.description}</p>

        {/* Assigned Skills */}
        {agent.agentSkills && agent.agentSkills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Skills</span>
              <Link to={`/agents/${agent.id}/edit`} className="text-[10px] text-nexus-400 hover:underline">Edit</Link>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.agentSkills.map((as) => (
                <span key={as.id} className="px-2 py-0.5 text-xs rounded-full bg-surface-900 border border-white/5 text-gray-300">
                  {as.customName || as.skill.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Integrations */}
        {agent.integrations && agent.integrations.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Integrations</span>
              <Link to={`/agents/${agent.id}/edit`} className="text-[10px] text-nexus-400 hover:underline">Configure</Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.integrations.map((integration) => (
                <div
                  key={integration.id}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900 border border-white/5"
                >
                  <span className="text-sm">
                    {integration.channel === 'TELEGRAM' ? '✈️' : integration.channel === 'SLACK' ? '💬' : '💭'}
                  </span>
                  <span className="text-xs text-gray-300 font-medium">
                    {integration.channel === 'GOOGLE_CHAT' ? 'Google Chat' : integration.channel.charAt(0) + integration.channel.slice(1).toLowerCase()}
                  </span>
                  <span className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    integration.enabled ? 'bg-emerald-400' : 'bg-gray-600'
                  )} />
                  <span className={cn(
                    'text-[10px]',
                    integration.enabled ? 'text-emerald-400' : 'text-gray-600'
                  )}>
                    {integration.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/5">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{agent._count?.activities || 0}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Total Events</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{agent._count?.tasks || 0}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Tasks</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{agent.heartbeatInterval || '∞'}</div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Heartbeat (min)</div>
          </div>
        </div>
      </div>

      {/* Charts + Activity + Config + Files */}
      <div className="grid grid-cols-2 gap-6">
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
    <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white">Workspace Files</h3>
        {selectedFile && (
          <button
            onClick={() => { setSelectedFile(null); setEditContent(''); }}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Back to list
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-gray-500 py-4 text-center">Loading files...</div>
      ) : selectedFile ? (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-gray-400">{selectedFile.name}</span>
            <button
              onClick={handleSave}
              disabled={saving || editContent === (selectedFile.content || '')}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-colors',
                saving || editContent === (selectedFile.content || '')
                  ? 'bg-white/5 text-gray-600 cursor-not-allowed'
                  : 'bg-nexus-600 text-white hover:bg-nexus-500'
              )}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-xs text-gray-300 font-mono resize-y focus:outline-none focus:border-nexus-500/50 leading-relaxed"
          />
        </div>
      ) : files.length === 0 ? (
        <p className="text-xs text-gray-600 py-4 text-center">No workspace files found</p>
      ) : (
        <div className="space-y-1">
          {files.map((file) => (
            <button
              key={file.name}
              onClick={() => handleSelectFile(file)}
              disabled={file.missing || loadingFile}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-left flex items-center justify-between transition-colors',
                file.missing
                  ? 'bg-surface-900 text-gray-600 cursor-not-allowed'
                  : 'bg-surface-900 text-gray-300 hover:bg-white/5 hover:text-white'
              )}
            >
              <span className="text-xs font-mono truncate">{file.name}</span>
              {file.size !== undefined && (
                <span className="text-[10px] text-gray-600 ml-2 shrink-0">
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
