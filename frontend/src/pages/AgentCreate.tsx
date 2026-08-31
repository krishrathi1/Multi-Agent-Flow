import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, Bot, Sparkles, Plus, Trash2, Check, X, Shield, RefreshCw, Cpu, ChevronDown } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import type { Agent, Gateway, McpServer, McpTool, LlmProvider, SoulTemplate, MarketplaceSkill, AgentSkill, AgentIntegration, ChannelType } from '../types';

interface McpServerWithTools extends McpServer {
  tools?: McpTool[];
  _loadingTools?: boolean;
  _expanded?: boolean;
}

// ── Emoji Picker ─────────────────────────────────────────
const EMOJI_OPTIONS = [
  { emoji: '\u{1F916}', label: 'Robot' },
  { emoji: '\u{1F9E0}', label: 'Brain' },
  { emoji: '\u{26A1}',  label: 'Zap' },
  { emoji: '\u{1F680}', label: 'Rocket' },
  { emoji: '\u{1F50D}', label: 'Search' },
  { emoji: '\u{1F4BB}', label: 'Laptop' },
  { emoji: '\u{1F6E0}\uFE0F', label: 'Tools' },
  { emoji: '\u{2699}\uFE0F',  label: 'Gear' },
  { emoji: '\u{1F4CA}', label: 'Chart' },
  { emoji: '\u{1F3AF}', label: 'Target' },
  { emoji: '\u{1F4DD}', label: 'Memo' },
  { emoji: '\u{1F50E}', label: 'Magnify' },
  { emoji: '\u{1F9D1}\u200D\u{1F4BB}', label: 'Dev' },
  { emoji: '\u{1F4E1}', label: 'Satellite' },
  { emoji: '\u{1F9EA}', label: 'Test Tube' },
  { emoji: '\u{1F525}', label: 'Fire' },
  { emoji: '\u{1F30D}', label: 'Globe' },
  { emoji: '\u{1F512}', label: 'Lock' },
  { emoji: '\u{1F4A1}', label: 'Idea' },
  { emoji: '\u{1F4E6}', label: 'Package' },
  { emoji: '\u{1F332}', label: 'Tree' },
  { emoji: '\u{2B50}',  label: 'Star' },
  { emoji: '\u{1F40D}', label: 'Snake' },
  { emoji: '\u{1F431}', label: 'Cat' },
];

function EmojiPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-inset border text-sm transition-all cursor-pointer shadow-2xs',
          open ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-line hover:border-line-strong'
        )}
      >
        <span className="text-xl leading-none w-8 h-8 flex items-center justify-center rounded-lg bg-surface border border-line-subtle shadow-xs shrink-0">
          {value || <span className="text-ink-faint text-sm">?</span>}
        </span>
        <span className="text-ink-muted text-xs font-medium">{value ? 'Change avatar' : 'Pick an avatar'}</span>
        <ChevronDown size={14} className={cn('text-ink-muted ml-auto transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 left-0 w-full rounded-2xl bg-surface border border-line shadow-xl p-2.5">
          <div className="grid grid-cols-6 gap-1.5">
            {EMOJI_OPTIONS.map(({ emoji, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => { onChange(emoji); setOpen(false); }}
                title={label}
                className={cn(
                  'w-full aspect-square rounded-xl flex items-center justify-center text-xl hover:bg-hover transition-colors cursor-pointer',
                  value === emoji ? 'bg-brand-500/15 ring-2 ring-brand-500' : ''
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              className="w-full mt-2 px-2 py-1.5 rounded-lg text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-all text-center cursor-pointer"
            >
              Remove avatar
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const KNOWN_PROVIDERS = [
  { id: 'openai', label: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'google', label: 'Google AI', placeholder: 'AIza...' },
  { id: 'mistral', label: 'Mistral', placeholder: 'mis-...' },
  { id: 'groq', label: 'Groq', placeholder: 'gsk_...' },
  { id: 'openrouter', label: 'OpenRouter', placeholder: 'sk-or-...' },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function AgentCreate() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);

  // Form state
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [description, setDescription] = useState('');
  const [workspace, setWorkspace] = useState('');
  const [avatar, setAvatar] = useState('');
  const [heartbeatInterval, setHeartbeatInterval] = useState(30);
  const [enabled, setEnabled] = useState(true);
  const [agentToAgent, setAgentToAgent] = useState(false);
  const [soulMd, setSoulMd] = useState('');
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [gatewayId, setGatewayId] = useState('');
  const [gateways, setGateways] = useState<Gateway[]>([]);

  // LLM provider state
  const [llmProviders, setLlmProviders] = useState<LlmProvider[]>([]);
  const [llmLoading, setLlmLoading] = useState(true);
  const [llmMode, setLlmMode] = useState<'BYOK' | 'PLATFORM'>('BYOK');
  const [llmProvider, setLlmProvider] = useState('openai');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmMessage, setLlmMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showLlmSetup, setShowLlmSetup] = useState(false);

  // Advanced settings
  const [showAdvanced, setShowAdvanced] = useState(isEditMode);
  const [gatewayInfo, setGatewayInfo] = useState<{ hasDefaultConfig: boolean; gatewayCount: number } | null>(null);

  // MCP state
  const [mcpServers, setMcpServers] = useState<McpServerWithTools[]>([]);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [newMcpName, setNewMcpName] = useState('');
  const [newMcpUrl, setNewMcpUrl] = useState('');
  const [newMcpTransport, setNewMcpTransport] = useState<'SSE' | 'STREAMABLE_HTTP'>('SSE');
  const [addingMcp, setAddingMcp] = useState(false);
  const [refreshingServer, setRefreshingServer] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);

  // Soul template state
  const [soulTemplates, setSoulTemplates] = useState<SoulTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Skills state
  const [availableSkills, setAvailableSkills] = useState<MarketplaceSkill[]>([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState<Set<string>>(new Set());
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([]);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);
  const [skillCustomizations, setSkillCustomizations] = useState<Record<string, { customName: string; customDescription: string }>>({});

  // Integration state
  const [integrations, setIntegrations] = useState<Record<ChannelType, Partial<AgentIntegration>>>({
    TELEGRAM: {},
    SLACK: {},
    GOOGLE_CHAT: {},
  });
  const [expandedChannel, setExpandedChannel] = useState<ChannelType | null>(null);
  const [savingIntegration, setSavingIntegration] = useState<ChannelType | null>(null);

  // General state
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load gateways, gateway defaults, and LLM providers
  useEffect(() => {
    api.gateways.list().then(setGateways).catch(() => {});
    api.gateways.defaults().then(setGatewayInfo).catch(() => {});
    api.soulTemplates.list().then(setSoulTemplates).catch(() => {});
    api.skills.marketplace().then(setAvailableSkills).catch(() => {});
    api.llmProviders.usage()
      .then((data) => {
        setLlmProviders(data.providers);
        if (data.providers.length === 0) setShowLlmSetup(true);
      })
      .catch(() => {})
      .finally(() => setLlmLoading(false));
  }, []);

  // Load agent data in edit mode
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.agents
      .get(id)
      .then((agent: Agent) => {
        setName(agent.name);
        setDisplayName(agent.displayName);
        setDescription(agent.description || '');
        setWorkspace(agent.workspace || '');
        setAvatar(agent.avatar || '');
        setHeartbeatInterval(agent.heartbeatInterval);
        setEnabled(agent.enabled);
        setAgentToAgent(agent.agentToAgent ?? false);
        setSoulMd(agent.soulMd || '');
        setGatewayId(agent.gatewayId || '');
        setSelectedTemplateId(agent.soulTemplateId || '');
        setNameManuallyEdited(true);

        // Load agent skills
        if (agent.agentSkills) {
          setAgentSkills(agent.agentSkills);
          setSelectedSkillIds(new Set(agent.agentSkills.map((s: AgentSkill) => s.skillId)));
          const customizations: Record<string, { customName: string; customDescription: string }> = {};
          agent.agentSkills.forEach((s: AgentSkill) => {
            if (s.customName || s.customDescription) {
              customizations[s.skillId] = {
                customName: s.customName || '',
                customDescription: s.customDescription || '',
              };
            }
          });
          setSkillCustomizations(customizations);
        }

        // Load integrations
        if (agent.integrations) {
          const intMap: Record<ChannelType, Partial<AgentIntegration>> = { TELEGRAM: {}, SLACK: {}, GOOGLE_CHAT: {} };
          agent.integrations.forEach((i: AgentIntegration) => {
            intMap[i.channel] = i;
          });
          setIntegrations(intMap);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  // Load MCP servers in edit mode
  const fetchMcpServers = useCallback(async () => {
    if (!id) return;
    try {
      const servers = (await api.mcp.list(id)) as McpServer[];
      setMcpServers(servers.map((s) => ({ ...s, _loadingTools: false, _expanded: false })));
    } catch (err) {
      console.error('Failed to fetch MCP servers:', err);
    }
  }, [id]);

  useEffect(() => {
    fetchMcpServers();
  }, [fetchMcpServers]);

  // Auto-generate name from displayName
  const handleDisplayNameChange = (value: string) => {
    setDisplayName(value);
    if (!nameManuallyEdited) {
      setName(toSlug(value));
    }
  };

  const handleNameChange = (value: string) => {
    setNameManuallyEdited(true);
    setName(toSlug(value));
  };

  // Soul template selection
  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const template = soulTemplates.find(t => t.id === templateId);
      if (template) {
        setSoulMd(template.content);
      }
    }
  };

  // Save integration
  const handleSaveIntegration = async (channel: ChannelType) => {
    if (!id) return;
    setSavingIntegration(channel);
    try {
      const data = integrations[channel];
      const result = await api.agents.upsertIntegration(id, channel, data as Record<string, unknown>);
      setIntegrations(prev => ({ ...prev, [channel]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save integration');
    } finally {
      setSavingIntegration(null);
    }
  };

  const handleDeleteIntegration = async (channel: ChannelType) => {
    if (!id) return;
    try {
      await api.agents.deleteIntegration(id, channel);
      setIntegrations(prev => ({ ...prev, [channel]: {} }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove integration');
    }
  };

  const handleToggleIntegration = async (channel: ChannelType, enabled: boolean) => {
    if (!id) return;
    try {
      const result = await api.agents.toggleIntegration(id, channel, enabled);
      setIntegrations(prev => ({ ...prev, [channel]: result }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle integration');
    }
  };

  const updateIntegrationField = (channel: ChannelType, field: string, value: unknown) => {
    setIntegrations(prev => ({
      ...prev,
      [channel]: { ...prev[channel], [field]: value },
    }));
  };

  // Skill toggle
  const handleSkillToggle = (skillId: string) => {
    setSelectedSkillIds(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
        if (editingSkillId === skillId) setEditingSkillId(null);
      } else {
        next.add(skillId);
      }
      return next;
    });
  };

  // Save LLM provider
  const handleSaveLlmProvider = async () => {
    if (llmMode === 'BYOK' && !llmApiKey.trim()) {
      setLlmMessage({ type: 'error', text: 'API key is required for BYOK mode' });
      return;
    }
    setLlmSaving(true);
    setLlmMessage(null);
    try {
      await api.llmProviders.upsert({
        provider: llmProvider,
        mode: llmMode,
        ...(llmMode === 'BYOK' && { apiKey: llmApiKey.trim() }),
      });
      const data = await api.llmProviders.usage();
      setLlmProviders(data.providers);
      setLlmMessage({ type: 'success', text: `${KNOWN_PROVIDERS.find((p) => p.id === llmProvider)?.label || llmProvider} provider configured` });
      setShowLlmSetup(false);
      setLlmApiKey('');
    } catch (err: unknown) {
      setLlmMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to save provider' });
    } finally {
      setLlmSaving(false);
    }
  };

  // Form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !displayName.trim()) {
      setError('Name and Display Name are required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Only send gatewayId if user explicitly selected one (not auto-provisioned)
      const shouldSendGateway = gatewayId && !(gatewayInfo?.hasDefaultConfig && gatewayInfo.gatewayCount <= 1 && !showAdvanced);
      const data: Record<string, unknown> = {
        name: name.trim(),
        displayName: displayName.trim(),
        description: description.trim(),
        workspace: workspace.trim() || undefined,
        avatar: avatar.trim() || undefined,
        heartbeatInterval,
        enabled,
        agentToAgent,
        soulMd: soulMd.trim() || undefined,
        soulTemplateId: selectedTemplateId || null,
        gatewayId: shouldSendGateway ? gatewayId : undefined,
      };
      const skillIdsArray = Array.from(selectedSkillIds);

      if (isEditMode && id) {
        await api.agents.update(id, data);

        // Sync skills: compute diff
        const currentSkillIds = new Set(agentSkills.map(s => s.skillId));
        // Remove deselected
        for (const sid of currentSkillIds) {
          if (!selectedSkillIds.has(sid)) {
            await api.agents.removeSkill(id, sid);
          }
        }
        // Add newly selected
        const toAdd = skillIdsArray.filter(sid => !currentSkillIds.has(sid));
        if (toAdd.length > 0) {
          await api.agents.assignSkills(id, toAdd);
        }
        // Update customizations
        for (const sid of selectedSkillIds) {
          const custom = skillCustomizations[sid];
          if (custom && (custom.customName || custom.customDescription)) {
            await api.agents.updateSkill(id, sid, {
              customName: custom.customName || null,
              customDescription: custom.customDescription || null,
            });
          }
        }

        navigate(`/agents/${id}`);
      } else {
        data.skillIds = skillIdsArray;
        const created = (await api.agents.create(data)) as Agent;

        // Update customizations for newly created agent
        for (const sid of selectedSkillIds) {
          const custom = skillCustomizations[sid];
          if (custom && (custom.customName || custom.customDescription)) {
            await api.agents.updateSkill(created.id, sid, {
              customName: custom.customName || null,
              customDescription: custom.customDescription || null,
            });
          }
        }

        // Save integrations configured during creation
        for (const channel of ['TELEGRAM', 'SLACK', 'GOOGLE_CHAT'] as ChannelType[]) {
          const integ = integrations[channel];
          const hasCredentials = integ.botToken || integ.appToken || integ.serviceAccount || integ.webhookUrl;
          if (hasCredentials) {
            await api.agents.upsertIntegration(created.id, channel, integ as Record<string, unknown>);
          }
        }

        navigate(`/agents/${created.id}`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save agent');
    } finally {
      setSaving(false);
    }
  };

  // Delete agent
  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await api.agents.delete(id);
      navigate('/controls');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
      setDeleting(false);
    }
  };

  // MCP server operations
  const handleAddMcpServer = async () => {
    if (!id || !newMcpName.trim() || !newMcpUrl.trim()) return;
    setAddingMcp(true);
    try {
      await api.mcp.add(id, {
        name: newMcpName.trim(),
        url: newMcpUrl.trim(),
        transport: newMcpTransport,
      });
      setNewMcpName('');
      setNewMcpUrl('');
      setNewMcpTransport('SSE');
      setShowAddMcp(false);
      await fetchMcpServers();
    } catch (err) {
      console.error('Failed to add MCP server:', err);
    } finally {
      setAddingMcp(false);
    }
  };

  const handleRefreshTools = async (serverId: string) => {
    if (!id) return;
    setRefreshingServer(serverId);
    try {
      await api.mcp.refreshTools(id, serverId);
      const tools = (await api.mcp.tools(id, serverId)) as McpTool[];
      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, tools, _expanded: true } : s))
      );
    } catch (err) {
      console.error('Failed to refresh tools:', err);
    } finally {
      setRefreshingServer(null);
    }
  };

  const handleToggleMcpEnabled = async (serverId: string, currentEnabled: boolean) => {
    if (!id) return;
    try {
      await api.mcp.update(id, serverId, { enabled: !currentEnabled });
      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, enabled: !currentEnabled } : s))
      );
    } catch (err) {
      console.error('Failed to toggle MCP server:', err);
    }
  };

  const handleDeleteMcpServer = async (serverId: string) => {
    if (!id) return;
    setDeletingServer(serverId);
    try {
      await api.mcp.remove(id, serverId);
      setMcpServers((prev) => prev.filter((s) => s.id !== serverId));
    } catch (err) {
      console.error('Failed to delete MCP server:', err);
    } finally {
      setDeletingServer(null);
    }
  };

  const handleToggleExpand = async (serverId: string) => {
    const server = mcpServers.find((s) => s.id === serverId);
    if (!server) return;
    // If expanding and no tools loaded yet, load them
    if (!server._expanded && !server.tools && id) {
      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, _loadingTools: true } : s))
      );
      try {
        const tools = (await api.mcp.tools(id, serverId)) as McpTool[];
        setMcpServers((prev) =>
          prev.map((s) =>
            s.id === serverId ? { ...s, tools, _loadingTools: false, _expanded: true } : s
          )
        );
      } catch (err) {
        console.error('Failed to load tools:', err);
        setMcpServers((prev) =>
          prev.map((s) => (s.id === serverId ? { ...s, _loadingTools: false, _expanded: true } : s))
        );
      }
    } else {
      setMcpServers((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, _expanded: !s._expanded } : s))
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Bot}
          title={isEditMode ? 'Edit Agent' : 'Create Agent'}
          description="Loading agent configuration..."
          breadcrumbs={[
            { label: 'Fleet Controls', to: '/controls' },
            { label: isEditMode ? 'Edit Agent' : 'Create Agent' },
          ]}
        />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb & Back Button */}
      <PageHeader
        icon={Bot}
        title={isEditMode ? 'Edit Agent' : 'Create Agent'}
        description={
          isEditMode
            ? 'Modify agent configuration, personality, and MCP server connections'
            : 'Configure a new AI agent with personality, workspace, and tool connections'
        }
        breadcrumbs={[
          { label: 'Fleet Controls', to: '/controls' },
          { label: isEditMode ? 'Edit Agent' : 'Create Agent' },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <ButtonLink
              to="/controls"
              variant="secondary"
              icon={ArrowLeft}
            >
              Back
            </ButtonLink>
          </div>
        }
      />

      {/* Error banner */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shadow-2xs">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-600 dark:text-red-300 font-semibold ml-4 hover:underline cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left column: Form + SOUL.md */}
          <div className={cn('flex flex-col gap-6', isEditMode ? 'w-full lg:w-2/3' : 'w-full max-w-3xl')}>
            {/* About Your Agent — Primary Fields */}
            <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs">
              <h3 className="text-sm font-bold text-ink mb-4">About Your Agent</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Display Name */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => handleDisplayNameChange(e.target.value)}
                    placeholder="My Agent"
                    className="w-full h-10 px-3.5 py-2 rounded-xl bg-inset border border-line text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    required
                  />
                </div>

                {/* Avatar Emoji Picker */}
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                    Avatar
                  </label>
                  <EmojiPicker value={avatar} onChange={setAvatar} />
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What does this agent do?"
                    rows={3}
                    className="w-full p-3 rounded-xl bg-inset border border-line text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-y leading-relaxed"
                  />
                </div>

                {/* Agent-to-Agent Toggle */}
                <div className="col-span-2">
                  <div className="flex items-center justify-between p-3.5 rounded-xl bg-inset border border-line shadow-2xs">
                    <div>
                      <p className="text-xs font-bold text-ink">Agent-to-Agent (A2A)</p>
                      <p className="text-[11px] text-ink-muted mt-0.5">
                        Allow this agent to discover and communicate with other A2A-enabled agents
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAgentToAgent(!agentToAgent)}
                      className={cn(
                        'relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ml-4 cursor-pointer',
                        agentToAgent ? 'bg-brand-600' : 'bg-line-strong'
                      )}
                    >
                      <div
                        className={cn(
                          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transition-transform duration-200',
                          agentToAgent ? 'translate-x-5.5' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Gateway warning — only when no auto-provisioning and no gateways */}
              {gatewayInfo && !gatewayInfo.hasDefaultConfig && gatewayInfo.gatewayCount === 0 && (
                <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                  No agent connection available. Contact your admin or{' '}
                  <Link to="/gateways" className="underline font-semibold hover:text-amber-800 dark:hover:text-amber-200">configure a gateway</Link>.
                </div>
              )}
            </div>

            {/* Advanced Settings — Collapsible */}
            <div className="rounded-2xl border border-line-subtle bg-surface shadow-xs">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-xs font-bold text-ink-muted hover:text-ink transition-all cursor-pointer"
              >
                <span>Advanced Settings</span>
                <ChevronDown
                  size={15}
                  className={cn('transition-transform duration-200', showAdvanced && 'rotate-180')}
                />
              </button>
              {showAdvanced && (
                <div className="px-5 pb-5 pt-0 grid grid-cols-2 gap-4 border-t border-line-subtle">
                  {/* Internal ID (slug) */}
                  <div className="col-span-2 sm:col-span-1 pt-3">
                    <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                      Internal ID{' '}
                      <span className="text-ink-faint font-normal">(auto-generated)</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="my-agent"
                      className="w-full h-10 px-3.5 py-2 rounded-xl bg-inset border border-line text-xs text-ink placeholder:text-ink-faint font-mono shadow-2xs focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  {/* Connection Gateway — hidden when auto-provisioned with 0-1 gateways */}
                  {!(gatewayInfo?.hasDefaultConfig && gatewayInfo.gatewayCount <= 1) && (
                    <div className="col-span-2 sm:col-span-1 pt-3">
                      <label className="block text-xs font-semibold text-ink-muted mb-1.5">
                        Connection Gateway
                      </label>
                      <select
                        value={gatewayId}
                        onChange={(e) => setGatewayId(e.target.value)}
                        className="w-full h-10 px-3 py-2 rounded-xl bg-inset border border-line text-xs text-ink shadow-2xs focus:outline-none focus:border-brand-500 cursor-pointer"
                      >
                        <option value="">Auto (default)</option>
                        {gateways.map((gw) => (
                          <option key={gw.id} value={gw.id}>
                            {gw.name} {gw.status === 'ONLINE' ? '' : `(${gw.status.toLowerCase()})`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Health Check Frequency */}
                  <div className="col-span-1">
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Health Check Frequency <span className="text-gray-600 font-normal">(minutes)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={heartbeatInterval}
                      onChange={(e) => setHeartbeatInterval(parseInt(e.target.value) || 1)}
                      className="w-32 px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
                    />
                  </div>

                  {/* Enabled toggle */}
                  <div className="col-span-1 flex items-end pb-1">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <button
                        type="button"
                        onClick={() => setEnabled(!enabled)}
                        className={cn(
                          'relative w-11 h-6 rounded-full transition-colors duration-200',
                          enabled ? 'bg-emerald-500' : 'bg-gray-600'
                        )}
                      >
                        <div
                          className={cn(
                            'absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200',
                            enabled ? 'translate-x-5.5' : 'translate-x-0.5'
                          )}
                        />
                      </button>
                      <span className="text-xs font-medium text-gray-400">
                        {enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* LLM Configuration */}
            <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-white">LLM Configuration</h3>
                {llmProviders.length > 0 && !showLlmSetup && (
                  <button
                    type="button"
                    onClick={() => setShowLlmSetup(true)}
                    className="px-3 py-1 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all"
                  >
                    + Add Provider
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Choose how this agent accesses LLM services — bring your own API key or use platform credits
              </p>

              {/* Status message */}
              {llmMessage && (
                <div
                  className={cn(
                    'text-sm px-3 py-2 rounded-lg border mb-3',
                    llmMessage.type === 'success'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
                      : 'text-red-400 bg-red-500/10 border-red-500/30'
                  )}
                >
                  {llmMessage.text}
                </div>
              )}

              {llmLoading ? (
                <div className="text-gray-500 text-xs py-4 text-center">Loading LLM providers...</div>
              ) : (
                <>
                  {/* Existing providers */}
                  {llmProviders.length > 0 && (
                    <div className="space-y-2 mb-3">
                      {llmProviders.map((provider) => {
                        const info = KNOWN_PROVIDERS.find((p) => p.id === provider.provider);
                        return (
                          <div
                            key={provider.id}
                            className="rounded-lg border border-white/5 bg-surface-900 px-3 py-2.5 flex items-center gap-3"
                          >
                            <div className="w-8 h-8 rounded-lg bg-surface-850 border border-white/5 flex items-center justify-center text-xs font-bold text-white shrink-0">
                              {(info?.label || provider.provider).charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">
                                  {info?.label || provider.provider}
                                </span>
                                <span
                                  className={cn(
                                    'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase border',
                                    provider.mode === 'BYOK'
                                      ? 'text-blue-400 bg-blue-500/10 border-blue-500/30'
                                      : 'text-purple-400 bg-purple-500/10 border-purple-500/30'
                                  )}
                                >
                                  {provider.mode}
                                </span>
                                {provider.isActive && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30">
                                    Active
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No providers warning */}
                  {llmProviders.length === 0 && !showLlmSetup && (
                    <div className="text-center py-4 rounded-lg border border-amber-500/20 bg-amber-500/5 mb-3">
                      <p className="text-amber-400 text-sm font-medium">No LLM provider configured</p>
                      <p className="text-gray-500 text-xs mt-1">Set up a provider so your agent can use LLM services</p>
                      <button
                        type="button"
                        onClick={() => setShowLlmSetup(true)}
                        className="mt-3 px-4 py-1.5 rounded-lg text-xs font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors"
                      >
                        Configure Provider
                      </button>
                    </div>
                  )}

                  {/* Add/Setup form */}
                  {showLlmSetup && (
                    <div className="rounded-lg border border-white/10 bg-surface-900 p-4">
                      <div className="space-y-3">
                        {/* Mode selection cards */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-2">
                            How should your agent access LLM services?
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setLlmMode('BYOK')}
                              className={cn(
                                'p-3 rounded-lg border text-left transition-all',
                                llmMode === 'BYOK'
                                  ? 'border-blue-500/50 bg-blue-500/10'
                                  : 'border-white/10 bg-surface-850 hover:border-white/20'
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                                </svg>
                                <span className={cn('text-sm font-medium', llmMode === 'BYOK' ? 'text-blue-400' : 'text-gray-300')}>
                                  Bring Your Own Key
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500">Use your own API key from any provider</p>
                            </button>
                            <button
                              type="button"
                              onClick={() => setLlmMode('PLATFORM')}
                              className={cn(
                                'p-3 rounded-lg border text-left transition-all',
                                llmMode === 'PLATFORM'
                                  ? 'border-purple-500/50 bg-purple-500/10'
                                  : 'border-white/10 bg-surface-850 hover:border-white/20'
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                                </svg>
                                <span className={cn('text-sm font-medium', llmMode === 'PLATFORM' ? 'text-purple-400' : 'text-gray-300')}>
                                  Platform Managed
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500">Use MyceliumOps credits, billed per token</p>
                            </button>
                          </div>
                        </div>

                        {/* Provider selection */}
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1.5">Provider</label>
                          <select
                            value={llmProvider}
                            onChange={(e) => setLlmProvider(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-surface-850 border border-white/10 text-sm text-white focus:outline-none focus:border-nexus-500/50"
                          >
                            {KNOWN_PROVIDERS.map((p) => {
                              const alreadyConfigured = llmProviders.some((ep) => ep.provider === p.id);
                              return (
                                <option key={p.id} value={p.id} disabled={alreadyConfigured}>
                                  {p.label} {alreadyConfigured ? '(configured)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        {/* BYOK: API key input */}
                        {llmMode === 'BYOK' && (
                          <div>
                            <label className="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
                            <input
                              type="password"
                              value={llmApiKey}
                              onChange={(e) => setLlmApiKey(e.target.value)}
                              placeholder={KNOWN_PROVIDERS.find((p) => p.id === llmProvider)?.placeholder || 'Enter API key'}
                              className="w-full px-3 py-2 rounded-lg bg-surface-850 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
                            />
                          </div>
                        )}

                        {/* Platform info */}
                        {llmMode === 'PLATFORM' && (
                          <p className="text-xs text-gray-500 bg-surface-850 p-3 rounded-lg border border-white/5">
                            Platform-managed mode uses MyceliumOps credits. Usage is billed per token at standard rates.
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveLlmProvider}
                            disabled={llmSaving}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
                          >
                            {llmSaving ? 'Saving...' : 'Save Provider'}
                          </button>
                          {llmProviders.length > 0 && (
                            <button
                              type="button"
                              onClick={() => { setShowLlmSetup(false); setLlmMessage(null); }}
                              className="px-4 py-2 rounded-lg text-sm font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Skills Selection */}
            <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
              <h3 className="text-sm font-semibold text-white mb-1">Skills</h3>
              <p className="text-xs text-gray-500 mb-3">
                Select skills from the marketplace to equip this agent
              </p>
              {availableSkills.length === 0 ? (
                <p className="text-xs text-gray-600 py-4 text-center">
                  No skills available.{' '}
                  <Link to="/skills" className="text-nexus-400 hover:underline">Add some in the marketplace</Link>
                </p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {availableSkills.map((skill) => {
                    const isSelected = selectedSkillIds.has(skill.id);
                    const isEditing = editingSkillId === skill.id;
                    const riskColor = skill.risk === 'low' ? 'text-emerald-400 bg-emerald-500/10' :
                      skill.risk === 'medium' ? 'text-amber-400 bg-amber-500/10' :
                      'text-red-400 bg-red-500/10';
                    return (
                      <div key={skill.id} className={cn(
                        'rounded-lg border px-3 py-2.5 transition-all',
                        isSelected
                          ? 'border-nexus-500/30 bg-nexus-500/5'
                          : 'border-white/5 bg-surface-900 hover:border-white/10'
                      )}>
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleSkillToggle(skill.id)}>
                          <div className={cn(
                            'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                            isSelected ? 'bg-nexus-500 border-nexus-500' : 'border-white/20'
                          )}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-white">{skill.name}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium uppercase', riskColor)}>{skill.risk}</span>
                              <span className="text-[10px] text-gray-600">{skill.category}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate">{skill.description || 'No description'}</p>
                          </div>
                          {isSelected && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setEditingSkillId(isEditing ? null : skill.id); }}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all"
                            >
                              {isEditing ? 'Done' : 'Customize'}
                            </button>
                          )}
                        </div>
                        {isSelected && isEditing && (
                          <div className="mt-2 pt-2 border-t border-white/5 space-y-2">
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">Custom Name (override)</label>
                              <input
                                type="text"
                                value={skillCustomizations[skill.id]?.customName || ''}
                                onChange={(e) => setSkillCustomizations(prev => ({
                                  ...prev,
                                  [skill.id]: { customName: e.target.value, customDescription: prev[skill.id]?.customDescription || '' }
                                }))}
                                placeholder={skill.name}
                                className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-nexus-500/50"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">Custom Description (override)</label>
                              <textarea
                                value={skillCustomizations[skill.id]?.customDescription || ''}
                                onChange={(e) => setSkillCustomizations(prev => ({
                                  ...prev,
                                  [skill.id]: { customName: prev[skill.id]?.customName || '', customDescription: e.target.value }
                                }))}
                                rows={2}
                                placeholder={skill.description || 'Enter custom description'}
                                className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-nexus-500/50 resize-y"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {selectedSkillIds.size > 0 && (
                <p className="text-[11px] text-gray-500 mt-2">{selectedSkillIds.size} skill{selectedSkillIds.size !== 1 ? 's' : ''} selected</p>
              )}
            </div>

            {/* Platform Integrations */}
            <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
                <h3 className="text-sm font-semibold text-white mb-1">Platform Integrations</h3>
                <p className="text-xs text-gray-500 mb-3">
                  Connect this agent to Telegram, Slack, or Google Chat
                </p>
                <div className="space-y-3">
                  {/* Telegram */}
                  {(() => {
                    const channels: { key: ChannelType; label: string; color: string; borderColor: string; bgColor: string }[] = [
                      { key: 'TELEGRAM', label: 'Telegram', color: 'text-sky-400', borderColor: 'border-sky-500/30', bgColor: 'bg-sky-500/10' },
                      { key: 'SLACK', label: 'Slack', color: 'text-purple-400', borderColor: 'border-purple-500/30', bgColor: 'bg-purple-500/10' },
                      { key: 'GOOGLE_CHAT', label: 'Google Chat', color: 'text-emerald-400', borderColor: 'border-emerald-500/30', bgColor: 'bg-emerald-500/10' },
                    ];
                    return channels.map(({ key, label, color, borderColor, bgColor }) => {
                      const integration = integrations[key];
                      const isConfigured = Boolean(integration?.id);
                      const isExpanded = expandedChannel === key;
                      return (
                        <div key={key} className={cn('rounded-lg border transition-all', isConfigured ? borderColor : 'border-white/5', isConfigured ? bgColor.replace('/10', '/5') : 'bg-surface-900')}>
                          {/* Channel header */}
                          <div
                            className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                            onClick={() => setExpandedChannel(isExpanded ? null : key)}
                          >
                            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold', bgColor, color)}>
                              {label.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white">{label}</span>
                                {isConfigured && (
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                                    integration.enabled ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-500 bg-gray-500/10'
                                  )}>
                                    {integration.enabled ? 'Enabled' : 'Disabled'}
                                  </span>
                                )}
                                {isConfigured && integration.status && (
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
                                    integration.status === 'connected' ? 'text-emerald-400 bg-emerald-500/10' :
                                    integration.status === 'error' ? 'text-red-400 bg-red-500/10' :
                                    'text-gray-500 bg-gray-500/10'
                                  )}>
                                    {integration.status}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500">
                                {!isConfigured ? 'Not configured' : integration.lastError ? integration.lastError : 'Click to configure'}
                              </p>
                            </div>
                            {isConfigured && (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); isEditMode && id ? handleToggleIntegration(key, !integration.enabled) : updateIntegrationField(key, 'enabled', !integration.enabled); }}
                                className={cn(
                                  'relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0',
                                  integration.enabled ? 'bg-emerald-500' : 'bg-gray-600'
                                )}
                              >
                                <div className={cn(
                                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200',
                                  integration.enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                                )} />
                              </button>
                            )}
                            <svg className={cn('w-4 h-4 text-gray-500 transition-transform shrink-0', isExpanded && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>

                          {/* Expanded config form */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 border-t border-white/5 space-y-3">
                              {/* Telegram fields */}
                              {key === 'TELEGRAM' && (
                                <>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Bot Token <span className="text-gray-600">(from @BotFather)</span></label>
                                    <input
                                      type="password"
                                      value={integration.botToken || ''}
                                      onChange={(e) => updateIntegrationField(key, 'botToken', e.target.value)}
                                      placeholder="123456:ABC-DEF..."
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-sky-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Webhook URL <span className="text-gray-600">(optional, uses polling if empty)</span></label>
                                    <input
                                      type="text"
                                      value={integration.webhookUrl || ''}
                                      onChange={(e) => updateIntegrationField(key, 'webhookUrl', e.target.value)}
                                      placeholder="https://your-domain.com/telegram"
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-sky-500/50"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Slack fields */}
                              {key === 'SLACK' && (
                                <>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Bot Token <span className="text-gray-600">(xoxb-...)</span></label>
                                    <input
                                      type="password"
                                      value={integration.botToken || ''}
                                      onChange={(e) => updateIntegrationField(key, 'botToken', e.target.value)}
                                      placeholder="xoxb-..."
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">App Token <span className="text-gray-600">(xapp-... for Socket Mode)</span></label>
                                    <input
                                      type="password"
                                      value={integration.appToken || ''}
                                      onChange={(e) => updateIntegrationField(key, 'appToken', e.target.value)}
                                      placeholder="xapp-..."
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-purple-500/50"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Google Chat fields */}
                              {key === 'GOOGLE_CHAT' && (
                                <>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Service Account JSON</label>
                                    <textarea
                                      value={integration.serviceAccount ? JSON.stringify(integration.serviceAccount, null, 2) : ''}
                                      onChange={(e) => {
                                        try {
                                          const parsed = JSON.parse(e.target.value);
                                          updateIntegrationField(key, 'serviceAccount', parsed);
                                        } catch {
                                          // Allow typing incomplete JSON
                                          updateIntegrationField(key, 'serviceAccount', e.target.value as any);
                                        }
                                      }}
                                      rows={4}
                                      placeholder='{"type": "service_account", "project_id": "...", ...}'
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50 font-mono resize-y"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[11px] text-gray-400 mb-1">Webhook URL <span className="text-gray-600">(public HTTPS endpoint)</span></label>
                                    <input
                                      type="text"
                                      value={integration.webhookUrl || ''}
                                      onChange={(e) => updateIntegrationField(key, 'webhookUrl', e.target.value)}
                                      placeholder="https://your-domain.com/googlechat"
                                      className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-emerald-500/50"
                                    />
                                  </div>
                                </>
                              )}

                              {/* Common: DM & Group Policy */}
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">DM Policy</label>
                                  <select
                                    value={integration.dmPolicy || 'open'}
                                    onChange={(e) => updateIntegrationField(key, 'dmPolicy', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white focus:outline-none"
                                  >
                                    <option value="open">Open</option>
                                    <option value="pairing">Pairing</option>
                                    <option value="allowlist">Allowlist</option>
                                    <option value="disabled">Disabled</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] text-gray-400 mb-1">Group Policy</label>
                                  <select
                                    value={integration.groupPolicy || 'open'}
                                    onChange={(e) => updateIntegrationField(key, 'groupPolicy', e.target.value)}
                                    className="w-full px-2.5 py-1.5 rounded bg-surface-850 border border-white/10 text-xs text-white focus:outline-none"
                                  >
                                    <option value="open">Open</option>
                                    <option value="allowlist">Allowlist</option>
                                    <option value="disabled">Disabled</option>
                                  </select>
                                </div>
                              </div>

                              {/* Action buttons */}
                              {isEditMode && id ? (
                                <div className="flex items-center gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveIntegration(key)}
                                    disabled={savingIntegration === key}
                                    className={cn('px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-colors disabled:opacity-50',
                                      key === 'TELEGRAM' ? 'bg-sky-600 hover:bg-sky-500' :
                                      key === 'SLACK' ? 'bg-purple-600 hover:bg-purple-500' :
                                      'bg-emerald-600 hover:bg-emerald-500'
                                    )}
                                  >
                                    {savingIntegration === key ? 'Saving...' : isConfigured ? 'Update' : 'Connect'}
                                  </button>
                                  {isConfigured && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteIntegration(key)}
                                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[10px] text-gray-500 pt-1">
                                  Integration will be saved when you create the agent.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
            </div>

            {/* SOUL.md Editor */}
            <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
              <h3 className="text-sm font-semibold text-white mb-1">
                SOUL.md
              </h3>
              <p className="text-xs text-gray-500 mb-3">
                Agent personality and instructions
              </p>
              {/* Soul Template Picker */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Start from Template <span className="text-gray-600 font-normal">(optional)</span>
                </label>
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-white/10 text-sm text-white focus:outline-none focus:border-nexus-500/50"
                >
                  <option value="">Blank — start from scratch</option>
                  {soulTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.category})
                    </option>
                  ))}
                </select>
                {selectedTemplateId && (
                  <p className="text-[11px] text-ink-muted mt-1">
                    Template content loaded. Customize it below.
                  </p>
                )}
              </div>
              <textarea
                value={soulMd}
                onChange={(e) => setSoulMd(e.target.value)}
                rows={14}
                placeholder="# Agent Personality&#10;&#10;Define who this agent is, how it behaves, and what instructions it should follow..."
                className="w-full p-4 rounded-xl bg-inset border border-line text-xs text-ink font-mono resize-y focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 leading-relaxed shadow-inner"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                loading={saving}
                className="px-6 shadow-xs"
              >
                {saving
                  ? 'Saving...'
                  : isEditMode
                    ? 'Save Changes'
                    : 'Create Agent'}
              </Button>

              <ButtonLink
                to="/controls"
                variant="secondary"
                icon={ArrowLeft}
              >
                Cancel / Back
              </ButtonLink>

              {isEditMode && (
                <>
                  <div className="flex-1" />
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">Are you sure?</span>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={handleDelete}
                        loading={deleting}
                      >
                        Yes, Delete
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      icon={Trash2}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      Delete Agent
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right column: MCP Servers (edit mode only) */}
          {isEditMode && id && (
            <div className="w-1/3 flex flex-col gap-4">
              <div className="rounded-xl border border-white/5 bg-surface-850 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">MCP Servers</h3>
                  <button
                    type="button"
                    onClick={() => setShowAddMcp(!showAddMcp)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-all"
                  >
                    {showAddMcp ? 'Cancel' : '+ Add Server'}
                  </button>
                </div>

                {/* Add MCP server inline form */}
                {showAddMcp && (
                  <div className="mb-4 p-3 rounded-lg bg-surface-900 border border-white/10 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">Name</label>
                      <input
                        type="text"
                        value={newMcpName}
                        onChange={(e) => setNewMcpName(e.target.value)}
                        placeholder="my-mcp-server"
                        className="w-full px-3 py-2 rounded-lg bg-surface-850 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">URL</label>
                      <input
                        type="text"
                        value={newMcpUrl}
                        onChange={(e) => setNewMcpUrl(e.target.value)}
                        placeholder="http://localhost:3001/sse"
                        className="w-full px-3 py-2 rounded-lg bg-surface-850 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nexus-500/50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-1">
                        Transport
                      </label>
                      <select
                        value={newMcpTransport}
                        onChange={(e) =>
                          setNewMcpTransport(e.target.value as 'SSE' | 'STREAMABLE_HTTP')
                        }
                        className="w-full px-3 py-2 rounded-lg bg-surface-850 border border-white/10 text-sm text-white focus:outline-none focus:border-nexus-500/50"
                      >
                        <option value="SSE">SSE</option>
                        <option value="STREAMABLE_HTTP">Streamable HTTP</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMcpServer}
                      disabled={addingMcp || !newMcpName.trim() || !newMcpUrl.trim()}
                      className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-all disabled:opacity-50"
                    >
                      {addingMcp ? 'Adding...' : 'Add Server'}
                    </button>
                  </div>
                )}

                {/* MCP server list */}
                {mcpServers.length === 0 && !showAddMcp && (
                  <p className="text-xs text-gray-600 py-4 text-center">
                    No MCP servers connected
                  </p>
                )}

                <div className="space-y-3">
                  {mcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="rounded-lg border border-white/5 bg-surface-900 overflow-hidden"
                    >
                      {/* Server header */}
                      <div className="px-3 py-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-white truncate">
                              {server.name}
                            </span>
                            <span
                              className={cn(
                                'text-[10px] px-1.5 py-0.5 rounded font-medium uppercase shrink-0',
                                server.transport === 'SSE'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-purple-500/15 text-purple-400'
                              )}
                            >
                              {server.transport}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{server.url}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Enabled toggle */}
                          <button
                            type="button"
                            onClick={() => handleToggleMcpEnabled(server.id, server.enabled)}
                            className={cn(
                              'relative w-8 h-4.5 rounded-full transition-colors duration-200',
                              server.enabled ? 'bg-emerald-500' : 'bg-gray-600'
                            )}
                          >
                            <div
                              className={cn(
                                'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200',
                                server.enabled ? 'translate-x-4' : 'translate-x-0.5'
                              )}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Server actions */}
                      <div className="px-3 pb-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleRefreshTools(server.id)}
                          disabled={refreshingServer === server.id}
                          className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {refreshingServer === server.id ? (
                            <>
                              <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              Refreshing...
                            </>
                          ) : (
                            'Refresh Tools'
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(server.id)}
                          className="px-2.5 py-1 rounded text-[11px] font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200 transition-all flex items-center gap-1"
                        >
                          Tools
                          <svg
                            className={cn(
                              'w-3 h-3 transition-transform',
                              server._expanded && 'rotate-180'
                            )}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                        <div className="flex-1" />
                        <button
                          type="button"
                          onClick={() => handleDeleteMcpServer(server.id)}
                          disabled={deletingServer === server.id}
                          className="px-2.5 py-1 rounded text-[11px] font-medium bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        >
                          {deletingServer === server.id ? '...' : 'Delete'}
                        </button>
                      </div>

                      {/* Expanded tool list */}
                      {server._expanded && (
                        <div className="border-t border-white/5 px-3 py-2">
                          {server._loadingTools ? (
                            <div className="flex items-center justify-center py-3">
                              <div className="w-4 h-4 border border-gray-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                          ) : server.tools && server.tools.length > 0 ? (
                            <div className="space-y-1.5">
                              {server.tools.map((tool) => (
                                <div
                                  key={tool.id}
                                  className="px-2.5 py-2 rounded bg-surface-850 border border-white/5"
                                >
                                  <p className="text-xs font-medium text-white font-mono">
                                    {tool.name}
                                  </p>
                                  {tool.description && (
                                    <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2">
                                      {tool.description}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-600 py-2 text-center">
                              No tools discovered. Try refreshing.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
