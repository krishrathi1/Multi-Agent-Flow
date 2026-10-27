import { useEffect, useState, useCallback } from 'react';
import { config } from '../config';
import {
  Building2,
  Users,
  KeyRound,
  Cpu,
  Workflow,
  Plus,
  Trash2,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Bot,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Server,
  Zap,
  Radio,
  Github,
  Globe,
  RefreshCw,
  Sliders,
  Terminal,
  Eye,
  EyeOff,
  ChevronRight,
  Search,
} from 'lucide-react';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Tabs } from '../components/ui/Tabs';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { api } from '../lib/api';
import { cn, timeAgo } from '../lib/utils';
import { useAuthStore } from '../stores/auth-store';
import type { Organization, OrgMember, OrgApiKey, LlmProvider, UsageCredit } from '../types';

type Tab = 'organization' | 'members' | 'api-keys' | 'llm-providers' | 'integrations';
type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

const roleTone: Record<OrgRole, 'brand' | 'accent' | 'success' | 'neutral'> = {
  OWNER: 'brand',
  ADMIN: 'accent',
  MEMBER: 'success',
  VIEWER: 'neutral',
};

const ALL_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'];
const INVITE_ROLES: OrgRole[] = ['ADMIN', 'MEMBER', 'VIEWER'];

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('organization');
  const { user, orgRole } = useAuthStore();

  const isAdmin = orgRole === 'OWNER' || orgRole === 'ADMIN';
  const isOwner = orgRole === 'OWNER';

  const tabs: { value: Tab; label: string; icon?: any }[] = [
    { value: 'organization', label: 'Organization' },
    { value: 'members', label: 'Team & Roles' },
    { value: 'api-keys', label: 'API Keys' },
    { value: 'llm-providers', label: 'AI Models & LLM' },
    { value: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="space-y-6 max-w-6xl w-full min-w-0 overflow-hidden">
      <PageHeader
        icon={Sliders}
        title="Workspace Settings"
        description="Manage organization configuration, team access, AI model providers, and platform integrations."
      />

      {/* Modern High-Contrast Tabs with Smooth Mobile Scrolling */}
      <div className="w-full overflow-hidden">
        <Tabs
          items={tabs}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as Tab)}
          aria-label="Settings navigation"
        />
      </div>

      {/* Tab content */}
      <div className="pt-2 w-full min-w-0">
        {activeTab === 'organization' && <OrganizationTab />}
        {activeTab === 'members' && (
          <MembersTab currentUserId={user?.id ?? ''} isAdmin={isAdmin} isOwner={isOwner} />
        )}
        {activeTab === 'api-keys' && <ApiKeysTab isAdmin={isAdmin} onNavigateToLlm={() => setActiveTab('llm-providers')} />}
        {activeTab === 'llm-providers' && <LlmProvidersTab isAdmin={isAdmin} />}
        {activeTab === 'integrations' && <IntegrationsTab isAdmin={isAdmin} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Organization Tab
// ---------------------------------------------------------------------------

function OrganizationTab() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrg = useCallback(async () => {
    try {
      const data = (await api.org.get()) as Organization;
      setOrg(data);
      setOrgName(data.name);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load organization details' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim() || orgName.trim() === org?.name) return;
    setSaving(true);
    setMessage(null);
    try {
      const updated = (await api.org.update({ name: orgName.trim() })) as Organization;
      setOrg(updated);
      setOrgName(updated.name);
      setMessage({ type: 'success', text: 'Organization name updated successfully!' });
      setTimeout(() => setMessage(null), 4000);
    } catch {
      setMessage({ type: 'error', text: 'Failed to update organization' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <HourglassLoader size={40} label="Loading organization details..." />
      </div>
    );
  }

  if (!org) {
    return (
      <Card padding="md" className="p-8 text-center text-sm text-ink-muted">
        Organization not found.
      </Card>
    );
  }

  return (
    <div className="nexus-page space-y-6">
      <SectionHeading
        title="Organization Profile"
        description="General information and workspace identification."
      />

      {message && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-2xs',
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <Card padding="md" className="border border-line bg-surface shadow-xs space-y-5">
        <form onSubmit={handleSave} className="space-y-5 max-w-xl">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-2">
              Organization Name
            </label>
            <input
              type="text"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              placeholder="Your organization name"
              required
              className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm font-medium text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 transition-all"
            />
            <p className="mt-1.5 text-xs text-ink-muted">
              Display name visible to your team members and across the platform.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Workspace Slug
              </label>
              <div className="rounded-xl border border-line-subtle bg-inset/50 px-3.5 py-2 text-xs font-mono text-ink">
                {org.slug}
              </div>
              <p className="mt-1 text-2xs text-ink-faint">Unique identifier used for routing.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Created On
              </label>
              <div className="rounded-xl border border-line-subtle bg-inset/50 px-3.5 py-2 text-xs text-ink">
                {new Date(org.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <p className="mt-1 text-2xs text-ink-faint">Workspace creation timestamp.</p>
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              variant="primary"
              loading={saving}
              disabled={!orgName.trim() || orgName.trim() === org.name}
            >
              Save Organization Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Members Tab
// ---------------------------------------------------------------------------

function MembersTab({
  currentUserId,
  isAdmin,
  isOwner,
}: {
  currentUserId: string;
  isAdmin: boolean;
  isOwner: boolean;
}) {
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrgRole>('MEMBER');
  const [inviting, setInviting] = useState(false);

  const fetchMembers = useCallback(async () => {
    try {
      const data = (await api.org.members()) as OrgMember[];
      setMembers(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load team members' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMessage(null);
    try {
      await api.org.invite(inviteEmail.trim(), inviteRole);
      setMessage({ type: 'success', text: `Invitation sent to ${inviteEmail}` });
      setInviteEmail('');
      setShowInvite(false);
      fetchMembers();
    } catch {
      setMessage({ type: 'error', text: 'Failed to send invitation' });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: OrgRole) => {
    try {
      await api.org.updateMemberRole(memberId, newRole);
      setMessage({ type: 'success', text: 'Member role updated' });
      fetchMembers();
    } catch {
      setMessage({ type: 'error', text: 'Failed to update member role' });
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm('Are you sure you want to remove this member from the organization?')) return;
    try {
      await api.org.removeMember(memberId);
      setMessage({ type: 'success', text: 'Member removed from organization' });
      fetchMembers();
    } catch {
      setMessage({ type: 'error', text: 'Failed to remove member' });
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title={`Team Members (${members.length})`}
        description="Manage your team's access levels and workspace permissions."
        actions={
          isAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => setShowInvite(!showInvite)}
            >
              Invite Member
            </Button>
          )
        }
      />

      {message && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-2xs',
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Invite Form */}
      {showInvite && (
        <Card padding="md" className="border border-brand-500/30 bg-surface shadow-md">
          <form onSubmit={handleInvite} className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
              Invite New Team Member
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-3">
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  required
                  className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                  Role Permission
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrgRole)}
                  className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm font-medium text-ink shadow-2xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {INVITE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" variant="primary" size="sm" loading={inviting}>
                Send Invitation
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Mobile Member Cards (sm:hidden) */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <HourglassLoader size={36} label="Loading team members..." />
          </div>
        ) : members.length === 0 ? (
          <Card padding="md" className="p-6 text-center text-xs text-ink-muted">
            No members found.
          </Card>
        ) : (
          members.map((member) => {
            const isSelf = member.userId === currentUserId;
            return (
              <Card
                key={member.id}
                padding="none"
                className="p-4 border border-line bg-surface rounded-2xl shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar name={member.user.name || member.user.email} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-ink truncate">
                          {member.user.name || member.user.email.split('@')[0]}
                        </span>
                        {isSelf && (
                          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 text-[10px] font-bold text-brand-600 dark:text-brand-400">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-ink-muted truncate block">{member.user.email}</span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isOwner && !isSelf ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                        className="rounded-xl border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs focus:border-brand-500 focus:outline-none"
                      >
                        {ALL_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <Badge tone={roleTone[member.role]}>{member.role}</Badge>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-line-subtle pt-2.5 text-2xs text-ink-faint">
                  <span>Joined {timeAgo(member.createdAt)}</span>
                  {isAdmin && !isSelf && member.role !== 'OWNER' && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 font-bold"
                      onClick={() => handleRemove(member.id)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop Member Table (hidden sm:block) */}
      <Card padding="none" className="hidden sm:block overflow-hidden border border-line bg-surface shadow-xs rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-inset/50 text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3.5">User</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Joined</th>
                {isAdmin && <th className="px-5 py-3.5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-ink-muted">
                    <HourglassLoader size={40} label="Loading members..." />
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-muted">
                    No members found.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const isSelf = member.userId === currentUserId;
                  return (
                    <tr key={member.id} className="hover:bg-hover/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.user.name || member.user.email} size="sm" />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink">
                                {member.user.name || member.user.email.split('@')[0]}
                              </span>
                              {isSelf && (
                                <span className="rounded bg-brand-500/10 px-1.5 py-0.2 text-2xs font-semibold text-brand-600 dark:text-brand-400">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-2xs text-ink-muted">{member.user.email}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        {isOwner && !isSelf ? (
                          <select
                            value={member.role}
                            onChange={(e) => handleRoleChange(member.id, e.target.value as OrgRole)}
                            className="rounded-lg border border-line bg-canvas px-2.5 py-1 text-xs font-semibold text-ink shadow-2xs focus:border-brand-500 focus:outline-none"
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>
                                {r}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Badge tone={roleTone[member.role]}>{member.role}</Badge>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-ink-muted tabular-nums">
                        {timeAgo(member.createdAt)}
                      </td>

                      {isAdmin && (
                        <td className="px-5 py-3.5 text-right">
                          {!isSelf && member.role !== 'OWNER' && (
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                              onClick={() => handleRemove(member.id)}
                            >
                              Remove
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 3. API Keys Tab
// ---------------------------------------------------------------------------

function ApiKeysTab({ isAdmin, onNavigateToLlm }: { isAdmin: boolean; onNavigateToLlm?: () => void }) {
  const [keys, setKeys] = useState<OrgApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchKeys = useCallback(async () => {
    try {
      const data = (await api.org.apiKeys()) as OrgApiKey[];
      setKeys(data);
    } catch {
      setMessage({ type: 'error', text: 'Failed to load API keys' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    setCreating(true);
    setMessage(null);
    try {
      const res = (await api.org.createApiKey(keyName.trim())) as { key: string; apiKey: OrgApiKey };
      setNewlyCreatedKey(res.key);
      setKeyName('');
      setShowCreate(false);
      fetchKeys();
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate API key' });
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is irreversible.')) return;
    try {
      await api.org.revokeApiKey(id);
      setMessage({ type: 'success', text: 'API key revoked successfully' });
      fetchKeys();
    } catch {
      setMessage({ type: 'error', text: 'Failed to revoke API key' });
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* ── Banner connecting to AI Model providers ── */}
      <Card padding="md" className="border border-brand-500/30 bg-brand-500/5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
            <Sparkles size={20} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-ink">Looking to connect Claude, OpenAI / Codex, or Gemini?</h4>
            <p className="text-2xs text-ink-muted">
              These keys below are Nexus API keys for external access. To connect your AI provider keys and fetch live models, use the AI Models & LLM tab.
            </p>
          </div>
        </div>
        {onNavigateToLlm && (
          <Button variant="primary" size="sm" onClick={onNavigateToLlm} icon={ChevronRight}>
            Connect AI Models & Keys
          </Button>
        )}
      </Card>

      <SectionHeading
        title={`API Access Keys (${keys.length})`}
        description="Keys used by remote agents, CLI pipelines, and external integrations to access Nexus AI API."
        actions={
          isAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={() => {
                setShowCreate(!showCreate);
                setNewlyCreatedKey(null);
              }}
            >
              Generate New Key
            </Button>
          )
        }
      />

      {message && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-2xs',
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Secret Key Alert */}
      {newlyCreatedKey && (
        <Card padding="md" className="border border-brand-500/40 bg-brand-500/5 shadow-md space-y-3">
          <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-bold text-xs">
            <KeyRound size={15} />
            <span>New Secret API Key Generated</span>
          </div>
          <p className="text-xs text-ink-muted">
            Please copy this key now and store it in a secure location. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink select-all">
              {newlyCreatedKey}
            </code>
            <Button
              variant={copied ? 'secondary' : 'primary'}
              icon={copied ? Check : Copy}
              onClick={() => handleCopy(newlyCreatedKey)}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        </Card>
      )}

      {/* Generate Form */}
      {showCreate && (
        <Card padding="md" className="border border-line bg-surface shadow-xs">
          <form onSubmit={handleCreate} className="space-y-4 max-w-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-ink">
              Create API Key
            </h4>
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Key Label / Description
              </label>
              <input
                type="text"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. GitHub Actions CI, Production Gateway"
                required
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="sm" loading={creating}>
                Generate Key
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HourglassLoader size={40} label="Loading API keys..." />
          </div>
        ) : keys.length === 0 ? (
          <Card padding="md" className="p-8 text-center text-xs text-ink-muted">
            No active API keys found. Click &quot;Generate New Key&quot; to create one.
          </Card>
        ) : (
          keys.map((k) => (
            <Card
              key={k.id}
              padding="sm"
              className="flex items-center justify-between gap-4 border border-line bg-surface p-4 shadow-2xs hover:shadow-xs transition-all"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="font-bold text-sm text-ink">{k.name}</span>
                  <code className="rounded-md border border-line-subtle bg-inset px-2 py-0.5 font-mono text-2xs text-ink-muted">
                    {k.keyPrefix}...
                  </code>
                </div>
                <div className="mt-1 flex items-center gap-4 text-2xs text-ink-muted">
                  <span>Created {timeAgo(k.createdAt)}</span>
                  <span>Last used: {k.lastUsedAt ? timeAgo(k.lastUsedAt) : 'Never'}</span>
                </div>
              </div>

              {isAdmin && (
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                  onClick={() => handleRevoke(k.id)}
                >
                  Revoke
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4. LLM Providers & AI Models Tab
// ---------------------------------------------------------------------------

interface LiveModelItem {
  id: string;
  name: string;
  description?: string;
  provider: string;
  created?: string | number;
}

interface OpenCodeModelItem {
  id: string;
  name: string;
  provider: string;
  family?: string;
  status?: string;
  context?: number;
  output?: number;
  free?: boolean;
}

function LlmProvidersTab({ isAdmin }: { isAdmin: boolean }) {
  const [openCodeStatus, setOpenCodeStatus] = useState<{ installed: boolean; version: string | null; command: string; error?: string } | null>(null);
  const [openCodeInstalling, setOpenCodeInstalling] = useState(false);
  const [openCodeLoading, setOpenCodeLoading] = useState(false);
  const [openCodeModelsList, setOpenCodeModelsList] = useState<OpenCodeModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:opencode_models');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [openCodeRawOutput, setOpenCodeRawOutput] = useState('');
  const [showOpenCodeRaw, setShowOpenCodeRaw] = useState(false);
  const [openCodeFilter, setOpenCodeFilter] = useState<'all' | 'free' | 'opencode' | 'nvidia'>('all');

  const refreshOpenCodeModels = useCallback(async () => {
    setOpenCodeLoading(true);
    try {
      const result = await api.opencode.models();
      const list = (result.models || []) as OpenCodeModelItem[];
      setOpenCodeModelsList(list);
      setOpenCodeRawOutput(result.output || '');
      localStorage.setItem('nexus:opencode_models', JSON.stringify(list));
    } catch (error: any) {
      setOpenCodeRawOutput(error?.message || 'Unable to query OpenCode.');
    } finally {
      setOpenCodeLoading(false);
    }
  }, []);

  useEffect(() => {
    api.opencode.status()
      .then((status) => {
        setOpenCodeStatus(status);
        if (status.installed) {
          refreshOpenCodeModels();
        }
      })
      .catch(() => setOpenCodeStatus({ installed: false, version: null, command: 'opencode' }));
  }, [refreshOpenCodeModels]);

  const installOpenCode = async () => {
    setOpenCodeInstalling(true);
    try {
      const result = await api.opencode.install();
      setOpenCodeStatus(result.status);
      if (result.status.installed) {
        refreshOpenCodeModels();
      }
    } catch (error: any) {
      setOpenCodeStatus((prev) => ({ ...(prev || { version: null, command: 'opencode' }), installed: false, error: error?.message || 'Installation failed' }));
    } finally {
      setOpenCodeInstalling(false);
    }
  };

  // Provider API Keys input state
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiModels, setGeminiModels] = useState<LiveModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:live_models_google');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [geminiLoading, setGeminiLoading] = useState(false);
  const [geminiError, setGeminiError] = useState<string | null>(null);

  const [claudeKey, setClaudeKey] = useState('');
  const [showClaudeKey, setShowClaudeKey] = useState(false);
  const [claudeModels, setClaudeModels] = useState<LiveModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:live_models_anthropic');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [claudeLoading, setClaudeLoading] = useState(false);
  const [claudeError, setClaudeError] = useState<string | null>(null);

  const [openaiKey, setOpenaiKey] = useState('');
  const [showOpenaiKey, setShowOpenaiKey] = useState(false);
  const [openaiModels, setOpenaiModels] = useState<LiveModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:live_models_openai');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [openaiLoading, setOpenaiLoading] = useState(false);
  const [openaiError, setOpenaiError] = useState<string | null>(null);

  // Groq: also the fallback for chat, code Q&A and agents when OpenCode's
  // free models hit their usage limit.
  const [groqKey, setGroqKey] = useState('');
  const [showGroqKey, setShowGroqKey] = useState(false);
  const [groqModels, setGroqModels] = useState<LiveModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:live_models_groq');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [groqLoading, setGroqLoading] = useState(false);
  const [groqError, setGroqError] = useState<string | null>(null);

  // Local PC State
  const [localEndpoint, setLocalEndpoint] = useState(() => localStorage.getItem('nexus:local_llm_endpoint') || config.localLlmEndpoint);
  const [localModels, setLocalModels] = useState<LiveModelItem[]>(() => {
    try {
      const saved = localStorage.getItem('nexus:live_models_local');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [localLoading, setLocalLoading] = useState(false);
  const [localConnected, setLocalConnected] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // Active / Configured providers in database
  const [configuredProviders, setConfiguredProviders] = useState<LlmProvider[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Active globally chosen model
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('nexus:active_llm_model') || localStorage.getItem('nexus:active_local_model') || '');
  const [activeProvider, setActiveProvider] = useState(() => localStorage.getItem('nexus:active_llm_provider') || 'local');

  // Filter & Search
  const [activeFilter, setActiveFilter] = useState<'all' | 'opencode' | 'google' | 'anthropic' | 'openai' | 'groq' | 'local'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Helper to check if provider is saved in DB
  const isProviderConfigured = (pName: string) => {
    return configuredProviders.some((p) => p.provider.toLowerCase() === pName.toLowerCase() && p.isActive);
  };

  // Select active default model
  const handleSelectModel = (modelId: string, provName: string) => {
    setActiveModel(modelId);
    setActiveProvider(provName);
    localStorage.setItem('nexus:active_llm_model', modelId);
    localStorage.setItem('nexus:active_llm_provider', provName);
    if (provName === 'local') {
      localStorage.setItem('nexus:active_local_model', modelId);
    }
    setToastMessage({
      type: 'success',
      text: `Default AI Model set to "${modelId}" (${provName.toUpperCase()}). All agents will prioritize this model.`,
    });
  };

  // Fetch local models
  const scanLocalPc = useCallback(async (ep: string) => {
    setLocalLoading(true);
    setLocalError(null);
    try {
      const res = await api.llmProviders.localModels(ep);
      setLocalConnected(res.reachable);
      if (res.reachable) {
        const mapped: LiveModelItem[] = (res.models || []).map((m) => ({
          id: m.name,
          name: m.name,
          description: `${m.parameterSize || 'Local Model'} • ${m.size || 'On-Device'}`,
          provider: 'local',
          created: m.modifiedAt,
        }));
        setLocalModels(mapped);
        localStorage.setItem('nexus:live_models_local', JSON.stringify(mapped));
        if (mapped.length > 0 && !activeModel) {
          handleSelectModel(mapped[0].id, 'local');
        }
      } else {
        setLocalModels([]);
        setLocalError(`Could not reach ${ep}. Ensure Ollama or LM Studio is running on your machine.`);
      }
    } catch (err: any) {
      setLocalConnected(false);
      setLocalError(err.message || `Failed to connect to ${ep}`);
    } finally {
      setLocalLoading(false);
    }
  }, [activeModel]);

  // Initial load: Fetch saved providers and their live models
  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const provs = await api.llmProviders.list();
        if (!mounted) return;
        setConfiguredProviders(provs);

        // Auto-fetch live models for configured providers
        for (const p of provs) {
          const pName = p.provider.toLowerCase();
          if (pName === 'google' || pName === 'gemini') {
            fetchLiveProviderModels('google');
          } else if (pName === 'anthropic' || pName === 'claude') {
            fetchLiveProviderModels('anthropic');
          } else if (pName === 'openai' || pName === 'codex') {
            fetchLiveProviderModels('openai');
          }
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setInitialLoading(false);
      }
    }

    loadData();
    scanLocalPc(localEndpoint);

    return () => {
      mounted = false;
    };
  }, []);

  // Fetch live models for cloud provider
  const fetchLiveProviderModels = async (provName: string, explicitKey?: string) => {
    if (provName === 'google') setGeminiLoading(true);
    if (provName === 'anthropic') setClaudeLoading(true);
    if (provName === 'openai') setOpenaiLoading(true);
    if (provName === 'groq') setGroqLoading(true);

    try {
      const res = await api.llmProviders.liveModels(provName, explicitKey);
      if (res.ok) {
        if (provName === 'google') {
          setGeminiModels(res.models);
          setGeminiError(null);
          localStorage.setItem('nexus:live_models_google', JSON.stringify(res.models));
        } else if (provName === 'anthropic') {
          setClaudeModels(res.models);
          setClaudeError(null);
          localStorage.setItem('nexus:live_models_anthropic', JSON.stringify(res.models));
        } else if (provName === 'openai') {
          setOpenaiModels(res.models);
          setOpenaiError(null);
          localStorage.setItem('nexus:live_models_openai', JSON.stringify(res.models));
        } else if (provName === 'groq') {
          setGroqModels(res.models);
          setGroqError(null);
          localStorage.setItem('nexus:live_models_groq', JSON.stringify(res.models));
        }
        return res;
      } else {
        const errMsg = res.message || `Failed to fetch live models from ${provName}`;
        if (provName === 'google') setGeminiError(errMsg);
        if (provName === 'anthropic') setClaudeError(errMsg);
        if (provName === 'openai') setOpenaiError(errMsg);
        if (provName === 'groq') setGroqError(errMsg);
        return res;
      }
    } catch (err: any) {
      const msg = err.message || `Connection to ${provName} failed`;
      if (provName === 'google') setGeminiError(msg);
      if (provName === 'anthropic') setClaudeError(msg);
      if (provName === 'openai') setOpenaiError(msg);
      if (provName === 'groq') setGroqError(msg);
      return { ok: false, models: [], message: msg };
    } finally {
      if (provName === 'google') setGeminiLoading(false);
      if (provName === 'anthropic') setClaudeLoading(false);
      if (provName === 'openai') setOpenaiLoading(false);
      if (provName === 'groq') setGroqLoading(false);
    }
  };

  // Connect and save key
  const handleConnectProvider = async (provName: string, apiKey: string) => {
    const trimmed = apiKey.trim();
    if (!trimmed) return;

    if (provName === 'google') { setGeminiLoading(true); setGeminiError(null); }
    if (provName === 'anthropic') { setClaudeLoading(true); setClaudeError(null); }
    if (provName === 'openai') { setOpenaiLoading(true); setOpenaiError(null); }
    if (provName === 'groq') { setGroqLoading(true); setGroqError(null); }

    try {
      // 1. Fetch live models to test the key and get latest available models
      const liveRes = await api.llmProviders.liveModels(provName, trimmed);
      if (!liveRes.ok) {
        throw new Error(liveRes.message || `The ${provName} API key is invalid.`);
      }

      // 2. Persist encrypted key in database
      await api.llmProviders.upsert({ provider: provName, mode: 'byok', apiKey: trimmed });

      // 3. Store models in state
      if (provName === 'google') {
        setGeminiModels(liveRes.models);
        setGeminiKey('');
        localStorage.setItem('nexus:live_models_google', JSON.stringify(liveRes.models));
      } else if (provName === 'anthropic') {
        setClaudeModels(liveRes.models);
        setClaudeKey('');
        localStorage.setItem('nexus:live_models_anthropic', JSON.stringify(liveRes.models));
      } else if (provName === 'openai') {
        setOpenaiModels(liveRes.models);
        setOpenaiKey('');
        localStorage.setItem('nexus:live_models_openai', JSON.stringify(liveRes.models));
      } else if (provName === 'groq') {
        setGroqModels(liveRes.models);
        setGroqKey('');
        localStorage.setItem('nexus:live_models_groq', JSON.stringify(liveRes.models));
      }

      // 4. Refresh configured providers
      const updated = await api.llmProviders.list();
      setConfiguredProviders(updated);

      setToastMessage({
        type: 'success',
        text: `Connected ${provName.toUpperCase()}! Fetched ${liveRes.models.length} live models directly from provider API.`,
      });

      // If no active model, auto-select flagship
      if (!activeModel && liveRes.models.length > 0) {
        handleSelectModel(liveRes.models[0].id, provName);
      }
    } catch (err: any) {
      const msg = err.message || 'Verification failed. Please check your API key.';
      if (provName === 'google') setGeminiError(msg);
      if (provName === 'anthropic') setClaudeError(msg);
      if (provName === 'openai') setOpenaiError(msg);
      if (provName === 'groq') setGroqError(msg);
      setToastMessage({ type: 'error', text: msg });
    } finally {
      if (provName === 'google') setGeminiLoading(false);
      if (provName === 'anthropic') setClaudeLoading(false);
      if (provName === 'openai') setOpenaiLoading(false);
      if (provName === 'groq') setGroqLoading(false);
    }
  };

  // Disconnect provider
  const handleDisconnectProvider = async (provName: string) => {
    const existing = configuredProviders.find((p) => p.provider.toLowerCase() === provName.toLowerCase());
    if (existing) {
      try {
        await api.llmProviders.delete(existing.id);
        const updated = await api.llmProviders.list();
        setConfiguredProviders(updated);
      } catch { /* ignore */ }
    }

    if (provName === 'google') {
      setGeminiModels([]);
      setGeminiError(null);
      localStorage.removeItem('nexus:live_models_google');
    } else if (provName === 'anthropic') {
      setClaudeModels([]);
      setClaudeError(null);
      localStorage.removeItem('nexus:live_models_anthropic');
    } else if (provName === 'openai') {
      setOpenaiModels([]);
      setOpenaiError(null);
      localStorage.removeItem('nexus:live_models_openai');
    } else if (provName === 'groq') {
      setGroqModels([]);
      setGroqError(null);
      localStorage.removeItem('nexus:live_models_groq');
    }

    if (activeProvider === provName) {
      setActiveModel('');
      setActiveProvider('');
      localStorage.removeItem('nexus:active_llm_model');
      localStorage.removeItem('nexus:active_llm_provider');
    }

    setToastMessage({
      type: 'info',
      text: `Disconnected ${provName.toUpperCase()}.`,
    });
  };

  // Filter helper for models
  const filterList = (list: LiveModelItem[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((m) => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q)));
  };

  // Filtered OpenCode models based on openCodeFilter and searchQuery
  const filteredOpenCodeModels = openCodeModelsList.filter((m) => {
    if (openCodeFilter === 'free' && !m.free) return false;
    if (openCodeFilter === 'opencode' && m.provider !== 'opencode') return false;
    if (openCodeFilter === 'nvidia' && m.provider !== 'nvidia') return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.provider.toLowerCase().includes(q) ||
      (m.family && m.family.toLowerCase().includes(q))
    );
  });

  const openCodeCard = (
    <Card padding="md" className="border border-emerald-500/20 bg-surface shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-line-subtle pb-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <Terminal size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-ink">OpenCode</h3>
              <Badge tone={openCodeStatus?.installed ? 'success' : 'neutral'} dot={openCodeStatus?.installed}>
                {openCodeStatus?.installed ? openCodeStatus.version || 'Installed' : 'Not installed'}
              </Badge>
              {openCodeModelsList.length > 0 && (
                <Badge tone="brand">
                  {openCodeModelsList.length} Models Loaded
                </Badge>
              )}
            </div>
            <p className="mt-0.5 text-2xs text-ink-muted">
              Official OpenCode CLI • Free reasoning tiers and automated multi-provider model selection.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!openCodeStatus?.installed && isAdmin && (
            <Button size="sm" variant="primary" loading={openCodeInstalling} onClick={installOpenCode}>
              Install OpenCode
            </Button>
          )}
          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={openCodeLoading}
            onClick={refreshOpenCodeModels}
          >
            Refresh models
          </Button>
        </div>
      </div>

      {/* Subheader: CLI Info & Filter pills */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">CLI:</span>
          <code className="rounded-md border border-line-subtle bg-inset px-2 py-0.5 font-mono text-2xs text-ink">
            {openCodeStatus?.command || 'opencode.exe'}
          </code>
          {openCodeModelsList.length > 0 && (
            <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400 hidden sm:inline">
              • Click any box to set as Active Default Model
            </span>
          )}
        </div>

        {openCodeModelsList.length > 0 && (
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: `All (${openCodeModelsList.length})` },
              { id: 'free', label: `Free Tier (${openCodeModelsList.filter((m) => m.free).length})` },
              { id: 'opencode', label: `OpenCode Zen (${openCodeModelsList.filter((m) => m.provider === 'opencode').length})` },
              { id: 'nvidia', label: `Nvidia (${openCodeModelsList.filter((m) => m.provider === 'nvidia').length})` },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setOpenCodeFilter(f.id as any)}
                className={cn(
                  'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer',
                  openCodeFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-canvas border border-line text-ink-muted hover:text-ink'
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Model Cards Grid (Box format) */}
      {openCodeLoading ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-line-subtle bg-canvas">
          <RefreshCw size={22} className="animate-spin text-emerald-500 mb-2" />
          <span className="text-xs font-semibold text-ink-muted">Querying OpenCode models from CLI...</span>
        </div>
      ) : openCodeModelsList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-canvas p-6 text-center text-xs text-ink-muted">
          {openCodeStatus?.error ? (
            <span className="text-rose-500">{openCodeStatus.error}</span>
          ) : (
            'No OpenCode models loaded. Click "Refresh models" above to query OpenCode CLI.'
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[460px] overflow-y-auto pr-1 no-scrollbar">
          {filteredOpenCodeModels.map((m) => {
            const isSelected = activeModel === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectModel(m.id, m.provider || 'opencode')}
                className={cn(
                  'group flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs hover:shadow-xs relative cursor-pointer',
                  isSelected
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 ring-1 ring-emerald-500/50'
                    : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:bg-hover hover:text-ink'
                )}
              >
                <div className="flex items-center justify-between w-full gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Terminal
                      size={13}
                      className={isSelected ? 'text-emerald-600 shrink-0' : 'text-ink-faint shrink-0 group-hover:text-ink'}
                    />
                    <span className="font-mono text-xs font-bold text-ink truncate" title={m.id}>
                      {m.id}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {m.free && (
                      <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400">
                        Free
                      </span>
                    )}
                    {isSelected && (
                      <span className="rounded bg-emerald-600 text-white px-1.5 py-0.2 text-[9px] uppercase font-bold">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-[12px] font-semibold text-ink line-clamp-1">{m.name}</div>

                <div className="flex flex-wrap items-center gap-1.5 mt-auto pt-1 text-[10px] text-ink-muted font-mono">
                  <span className="rounded bg-surface px-1.5 py-0.5 border border-line-subtle text-ink-faint capitalize">
                    {m.provider}
                  </span>
                  {m.context ? (
                    <span className="rounded bg-surface px-1.5 py-0.5 border border-line-subtle text-ink-faint">
                      ctx {m.context >= 1000 ? `${Math.round(m.context / 1000)}k` : m.context}
                    </span>
                  ) : null}
                  {m.output ? (
                    <span className="rounded bg-surface px-1.5 py-0.5 border border-line-subtle text-ink-faint">
                      out {m.output >= 1000 ? `${Math.round(m.output / 1000)}k` : m.output}
                    </span>
                  ) : null}
                  {m.family ? (
                    <span className="rounded bg-surface px-1.5 py-0.5 border border-line-subtle text-ink-faint">
                      {m.family}
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Raw output accordion */}
      {openCodeRawOutput && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowOpenCodeRaw(!showOpenCodeRaw)}
            className="text-2xs font-semibold text-ink-faint hover:text-ink flex items-center gap-1 cursor-pointer"
          >
            <span>{showOpenCodeRaw ? '▼ Hide' : '▶ Show'} raw CLI output</span>
          </button>
          {showOpenCodeRaw && (
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg border border-line-subtle bg-inset p-2.5 font-mono text-[10px] text-ink-muted">
              {openCodeRawOutput}
            </pre>
          )}
        </div>
      )}

      {openCodeStatus?.error && <p className="mt-1 text-xs text-rose-500">{openCodeStatus.error}</p>}
    </Card>
  );

  return (
    <div className="nexus-page space-y-6">
      {/* Header */}
      <SectionHeading
        title="AI Models & LLM Providers"
        description="Connect your API keys (Google Gemini, Anthropic Claude, OpenAI & Codex) or your Local PC to dynamically fetch live models with zero hardcoded defaults."
      />

      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={cn(
            'flex items-center justify-between gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-2xs transition-all',
            toastMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : toastMessage.type === 'info'
              ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{toastMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-2xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Active Default Engine Banner */}
      <Card padding="md" className="border border-brand-500/30 bg-brand-500/5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-xs">
              <Zap size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                  Active Default Engine
                </span>
                {activeModel && (
                  <Badge tone="brand" dot>
                    Live Active
                  </Badge>
                )}
              </div>
              <h3 className="font-mono text-sm font-bold text-ink">
                {activeModel ? activeModel : 'No default model selected — click any live model card below'}
              </h3>
            </div>
          </div>

          {activeModel && (
            <div className="flex items-center gap-2">
              <span className="rounded-lg border border-line bg-canvas px-3 py-1 font-mono text-2xs font-semibold text-ink-muted">
                Provider: <span className="text-ink font-bold uppercase">{activeProvider}</span>
              </span>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setActiveModel('');
                  setActiveProvider('');
                  localStorage.removeItem('nexus:active_llm_model');
                  localStorage.removeItem('nexus:active_llm_provider');
                }}
              >
                Clear
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'all', label: 'All Providers' },
              { id: 'opencode', label: 'OpenCode CLI' },
              { id: 'google', label: 'Google Gemini' },
              { id: 'anthropic', label: 'Anthropic Claude' },
              { id: 'openai', label: 'OpenAI & Codex' },
              { id: 'groq', label: 'Groq' },
              { id: 'local', label: 'Local PC Hardware' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0',
                activeFilter === tab.id
                  ? 'bg-brand-600 text-white shadow-xs'
                  : 'bg-surface border border-line text-ink-muted hover:border-line-strong hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter models by name or id..."
            className="w-full rounded-xl border border-line bg-canvas pl-8 pr-3 py-1.5 text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>

      {/* PROVIDER 0: OpenCode CLI */}
      {(activeFilter === 'all' || activeFilter === 'opencode') && openCodeCard}

      {/* PROVIDER 1: Google Gemini */}
      {(activeFilter === 'all' || activeFilter === 'google') && (
        <Card padding="md" className="border border-blue-500/20 bg-surface shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-600 text-white shadow-xs">
                <Sparkles size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-ink">Google Gemini</h4>
                  <Badge tone={isProviderConfigured('google') || geminiModels.length > 0 ? 'success' : 'neutral'} dot>
                    {isProviderConfigured('google') || geminiModels.length > 0
                      ? `Connected (${geminiModels.length} Live Models)`
                      : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-2xs text-ink-muted">
                  Gemini 2.5 Pro, 2.5 Flash, 2.0 Flash • Ultra-fast multi-modal reasoning and large context windows
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-2xs font-bold text-blue-600 hover:text-blue-700"
              >
                <span>Get API Key</span>
                <ExternalLink size={11} />
              </a>
              {(isProviderConfigured('google') || geminiModels.length > 0) && (
                <>
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={RefreshCw}
                    loading={geminiLoading}
                    onClick={() => fetchLiveProviderModels('google')}
                  >
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                      onClick={() => handleDisconnectProvider('google')}
                    >
                      Disconnect
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {geminiError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              <span>{geminiError}</span>
            </div>
          )}

          {/* Connect API Key Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnectProvider('google', geminiKey);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                {isProviderConfigured('google') ? 'Update Gemini API Key' : 'Connect Gemini API Key'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder={isProviderConfigured('google') ? '••••••••••••••••••••••••••••••••••••' : 'AIzaSy...'}
                    className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-blue-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  >
                    {showGeminiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={geminiLoading}
                  disabled={!geminiKey.trim()}
                >
                  Connect & Fetch Live Models
                </Button>
              </div>
            </div>
          </form>

          {/* Live Models Display */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Live Gemini Models ({geminiModels.length})
              </label>
              {geminiModels.length > 0 && (
                <span className="text-2xs font-semibold text-blue-600 dark:text-blue-400">
                  Click any model card to set as Active Default
                </span>
              )}
            </div>

            {geminiModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-5 text-center text-xs text-ink-muted">
                {geminiLoading ? 'Fetching live models from Google Gemini API...' : 'No Gemini models loaded. Connect your API key above to load live models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filterList(geminiModels).map((m) => {
                  const isSelected = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id, 'google')}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                        isSelected
                          ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/50'
                          : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Sparkles size={14} className={isSelected ? 'text-blue-600 shrink-0' : 'text-ink-faint shrink-0'} />
                          <span className="font-mono text-xs font-bold text-ink truncate">{m.id}</span>
                        </div>
                        {isSelected && (
                          <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-blue-600 shrink-0">
                            Active Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-ink-muted line-clamp-1">{m.name}</div>
                      {m.description && (
                        <p className="text-[10px] text-ink-faint line-clamp-2 leading-relaxed">{m.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* PROVIDER 2: Anthropic Claude */}
      {(activeFilter === 'all' || activeFilter === 'anthropic') && (
        <Card padding="md" className="border border-amber-500/20 bg-surface shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-600 text-white shadow-xs">
                <Cpu size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-ink">Anthropic Claude</h4>
                  <Badge tone={isProviderConfigured('anthropic') || claudeModels.length > 0 ? 'success' : 'neutral'} dot>
                    {isProviderConfigured('anthropic') || claudeModels.length > 0
                      ? `Connected (${claudeModels.length} Live Models)`
                      : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-2xs text-ink-muted">
                  Claude 3.7 Sonnet (Hybrid Reasoning), 3.5 Sonnet & Haiku • Premier coding and autonomous agent workflow model
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-2xs font-bold text-amber-600 hover:text-amber-700"
              >
                <span>Get API Key</span>
                <ExternalLink size={11} />
              </a>
              {(isProviderConfigured('anthropic') || claudeModels.length > 0) && (
                <>
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={RefreshCw}
                    loading={claudeLoading}
                    onClick={() => fetchLiveProviderModels('anthropic')}
                  >
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                      onClick={() => handleDisconnectProvider('anthropic')}
                    >
                      Disconnect
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {claudeError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              <span>{claudeError}</span>
            </div>
          )}

          {/* Connect API Key Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnectProvider('anthropic', claudeKey);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                {isProviderConfigured('anthropic') ? 'Update Anthropic Claude API Key' : 'Connect Claude API Key'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showClaudeKey ? 'text' : 'password'}
                    value={claudeKey}
                    onChange={(e) => setClaudeKey(e.target.value)}
                    placeholder={isProviderConfigured('anthropic') ? '••••••••••••••••••••••••••••••••••••' : 'sk-ant-api03-...'}
                    className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-amber-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClaudeKey(!showClaudeKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  >
                    {showClaudeKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={claudeLoading}
                  disabled={!claudeKey.trim()}
                >
                  Connect & Fetch Live Models
                </Button>
              </div>
            </div>
          </form>

          {/* Live Models Display */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Live Anthropic Models ({claudeModels.length})
              </label>
              {claudeModels.length > 0 && (
                <span className="text-2xs font-semibold text-amber-600 dark:text-amber-400">
                  Click any model card to set as Active Default
                </span>
              )}
            </div>

            {claudeModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-5 text-center text-xs text-ink-muted">
                {claudeLoading ? 'Fetching live models from Anthropic API...' : 'No Claude models loaded. Connect your API key above to load live models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filterList(claudeModels).map((m) => {
                  const isSelected = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id, 'anthropic')}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                        isSelected
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/50'
                          : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Cpu size={14} className={isSelected ? 'text-amber-600 shrink-0' : 'text-ink-faint shrink-0'} />
                          <span className="font-mono text-xs font-bold text-ink truncate">{m.id}</span>
                        </div>
                        {isSelected && (
                          <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-amber-600 shrink-0">
                            Active Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-ink-muted line-clamp-1">{m.name}</div>
                      {m.description && (
                        <p className="text-[10px] text-ink-faint line-clamp-2 leading-relaxed">{m.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* PROVIDER 3: OpenAI & Codex */}
      {(activeFilter === 'all' || activeFilter === 'openai') && (
        <Card padding="md" className="border border-emerald-500/20 bg-surface shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-xs">
                <Bot size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-ink">OpenAI & Codex</h4>
                  <Badge tone={isProviderConfigured('openai') || openaiModels.length > 0 ? 'success' : 'neutral'} dot>
                    {isProviderConfigured('openai') || openaiModels.length > 0
                      ? `Connected (${openaiModels.length} Live Models)`
                      : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-2xs text-ink-muted">
                  GPT-4o, o1, o3-mini, and Codex models • Industry-standard reasoning, vision, and programming engines
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-2xs font-bold text-emerald-600 hover:text-emerald-700"
              >
                <span>Get API Key</span>
                <ExternalLink size={11} />
              </a>
              {(isProviderConfigured('openai') || openaiModels.length > 0) && (
                <>
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={RefreshCw}
                    loading={openaiLoading}
                    onClick={() => fetchLiveProviderModels('openai')}
                  >
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                      onClick={() => handleDisconnectProvider('openai')}
                    >
                      Disconnect
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {openaiError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              <span>{openaiError}</span>
            </div>
          )}

          {/* Connect API Key Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnectProvider('openai', openaiKey);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                {isProviderConfigured('openai') ? 'Update OpenAI API Key' : 'Connect OpenAI API Key'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showOpenaiKey ? 'text' : 'password'}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder={isProviderConfigured('openai') ? '••••••••••••••••••••••••••••••••••••' : 'sk-proj-...'}
                    className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-emerald-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOpenaiKey(!showOpenaiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  >
                    {showOpenaiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={openaiLoading}
                  disabled={!openaiKey.trim()}
                >
                  Connect & Fetch Live Models
                </Button>
              </div>
            </div>
          </form>

          {/* Live Models Display */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Live OpenAI Models ({openaiModels.length})
              </label>
              {openaiModels.length > 0 && (
                <span className="text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Click any model card to set as Active Default
                </span>
              )}
            </div>

            {openaiModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-5 text-center text-xs text-ink-muted">
                {openaiLoading ? 'Fetching live models from OpenAI API...' : 'No OpenAI models loaded. Connect your API key above to load live models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filterList(openaiModels).map((m) => {
                  const isSelected = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id, 'openai')}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                        isSelected
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/50'
                          : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Bot size={14} className={isSelected ? 'text-emerald-600 shrink-0' : 'text-ink-faint shrink-0'} />
                          <span className="font-mono text-xs font-bold text-ink truncate">{m.id}</span>
                        </div>
                        {isSelected && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-emerald-600 shrink-0">
                            Active Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-ink-muted line-clamp-1">{m.name}</div>
                      {m.description && (
                        <p className="text-[10px] text-ink-faint line-clamp-2 leading-relaxed">{m.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* PROVIDER: Groq — fast hosted open models; also the fallback when OpenCode free models are exhausted */}
      {(activeFilter === 'all' || activeFilter === 'groq') && (
        <Card padding="md" className="border border-orange-500/20 bg-surface shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-orange-600 text-white shadow-xs">
                <Bot size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-ink">Groq</h4>
                  <Badge tone={isProviderConfigured('groq') || groqModels.length > 0 ? 'success' : 'neutral'} dot>
                    {isProviderConfigured('groq') || groqModels.length > 0
                      ? `Connected (${groqModels.length} Live Models)`
                      : 'Not Configured'}
                  </Badge>
                </div>
                <p className="text-2xs text-ink-muted">
                  Fast hosted open models (GPT-OSS, Qwen) • Used for Mother Chat, Code Intelligence and agents when OpenCode free models are unavailable
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-2xs font-bold text-orange-600 hover:text-orange-700"
              >
                <span>Get API Key</span>
                <ExternalLink size={11} />
              </a>
              {(isProviderConfigured('groq') || groqModels.length > 0) && (
                <>
                  <Button
                    size="xs"
                    variant="secondary"
                    icon={RefreshCw}
                    loading={groqLoading}
                    onClick={() => fetchLiveProviderModels('groq')}
                  >
                    Refresh
                  </Button>
                  {isAdmin && (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                      onClick={() => handleDisconnectProvider('groq')}
                    >
                      Disconnect
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {groqError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              <span>{groqError}</span>
            </div>
          )}

          {/* Connect API Key Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleConnectProvider('groq', groqKey);
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                {isProviderConfigured('groq') ? 'Update Groq API Key' : 'Connect Groq API Key'}
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGroqKey ? 'text' : 'password'}
                    value={groqKey}
                    onChange={(e) => setGroqKey(e.target.value)}
                    placeholder={isProviderConfigured('groq') ? '••••••••••••••••••••••••••••••••••••' : 'gsk_...'}
                    className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-orange-500 focus:outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGroqKey(!showGroqKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink"
                  >
                    {showGroqKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={groqLoading}
                  disabled={!groqKey.trim()}
                >
                  Connect & Fetch Live Models
                </Button>
              </div>
            </div>
          </form>

          {/* Live Models Display */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Live Groq Models ({groqModels.length})
              </label>
              {groqModels.length > 0 && (
                <span className="text-2xs font-semibold text-orange-600 dark:text-orange-400">
                  Click any model card to set as Active Default
                </span>
              )}
            </div>

            {groqModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-5 text-center text-xs text-ink-muted">
                {groqLoading ? 'Fetching live models from Groq...' : 'No Groq models loaded. Connect your API key above to load live models.'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filterList(groqModels).map((m) => {
                  const isSelected = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id, 'groq')}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                        isSelected
                          ? 'border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-1 ring-orange-500/50'
                          : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Bot size={14} className={isSelected ? 'text-orange-600 shrink-0' : 'text-ink-faint shrink-0'} />
                          <span className="font-mono text-xs font-bold text-ink truncate">{m.id}</span>
                        </div>
                        {isSelected && (
                          <span className="rounded bg-orange-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-orange-600 shrink-0">
                            Active Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-ink-muted line-clamp-1">{m.name}</div>
                      {m.description && (
                        <p className="text-[10px] text-ink-faint line-clamp-2 leading-relaxed">{m.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* PROVIDER 4: Local PC Hardware */}
      {(activeFilter === 'all' || activeFilter === 'local') && (
        <Card padding="md" className="border border-purple-500/20 bg-surface shadow-xs space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-subtle pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shadow-xs">
                <Server size={20} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-ink">Local PC Hardware (Ollama / LM Studio)</h4>
                  <Badge tone={localConnected ? (localModels.length > 0 ? 'success' : 'neutral') : 'neutral'} dot>
                    {localConnected
                      ? localModels.length > 0
                        ? `PC Connected (${localModels.length} Models)`
                        : 'Connected (0 Models)'
                      : 'Local Host Offline'}
                  </Badge>
                </div>
                <p className="text-2xs text-ink-muted">
                  Run private AI workflows on your own GPU/CPU with 0 API token fees
                </p>
              </div>
            </div>

            <Button
              size="xs"
              variant="secondary"
              icon={RefreshCw}
              loading={localLoading}
              onClick={() => scanLocalPc(localEndpoint)}
            >
              Scan PC
            </Button>
          </div>

          {localError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle size={15} />
              <span>{localError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              localStorage.setItem('nexus:local_llm_endpoint', localEndpoint.trim());
              scanLocalPc(localEndpoint.trim());
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
                Local Host Endpoint URL
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={localEndpoint}
                  onChange={(e) => setLocalEndpoint(e.target.value)}
                  placeholder={config.localLlmEndpoint}
                  required
                  className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-purple-500 focus:outline-none"
                />
                <Button type="submit" variant="primary" size="sm" loading={localLoading}>
                  Save & Scan
                </Button>
              </div>
              <p className="mt-1 text-2xs text-ink-muted">
                Local LLM default: <code className="font-mono text-ink">{config.localLlmEndpoint}</code>
              </p>
            </div>
          </form>

          {/* Installed Models Grid */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Models Installed on Your PC ({localModels.length})
              </label>
              {localModels.length > 0 && (
                <span className="text-2xs font-semibold text-purple-600 dark:text-purple-400">
                  Click any model to set as Active Default
                </span>
              )}
            </div>

            {localModels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-canvas p-6 text-center space-y-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-purple-500/10 text-purple-600 mx-auto">
                  <Bot size={20} />
                </div>
                <div>
                  <h5 className="font-bold text-xs text-ink">
                    {localConnected ? 'No Models Installed on Local PC' : 'Local PC Host Offline'}
                  </h5>
                  <p className="text-2xs text-ink-muted mt-1 max-w-md mx-auto">
                    {localConnected
                      ? `Connected to ${localEndpoint}, but 0 models were found. Pull a model via your terminal.`
                      : `Nexus could not reach ${localEndpoint}. Start Ollama or LM Studio, then click "Scan PC".`}
                  </p>
                </div>

                {localConnected && (
                  <div className="bg-inset rounded-lg p-3 max-w-md mx-auto text-left space-y-2 border border-line-subtle">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                      <Terminal size={12} />
                      Download via Terminal:
                    </span>
                    <div className="flex items-center justify-between gap-2 font-mono text-2xs bg-canvas px-2.5 py-1.5 rounded border border-line">
                      <code>{`ollama run ${config.localLlmModel}`}</code>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(`ollama run ${config.localLlmModel}`);
                          setToastMessage({ type: 'success', text: 'Copied command to clipboard!' });
                        }}
                        className="text-purple-600 hover:text-purple-700 font-sans font-semibold text-[11px]"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {filterList(localModels).map((m) => {
                  const isSelected = activeModel === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectModel(m.id, 'local')}
                      className={cn(
                        'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                        isSelected
                          ? 'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/50'
                          : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                      )}
                    >
                      <div className="flex items-center justify-between w-full gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Cpu size={14} className={isSelected ? 'text-purple-600 shrink-0' : 'text-ink-faint shrink-0'} />
                          <span className="font-mono text-xs font-bold text-ink truncate">{m.id}</span>
                        </div>
                        {isSelected && (
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-purple-600 shrink-0">
                            Active Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-medium text-ink-muted line-clamp-1">{m.name}</div>
                      {m.description && (
                        <p className="text-[10px] text-ink-faint line-clamp-1">{m.description}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Integrations Tab (GitHub & Vercel)
// ---------------------------------------------------------------------------

function IntegrationsTab({ isAdmin }: { isAdmin: boolean }) {
  const [githubToken, setGithubToken] = useState('');
  const [githubConnected, setGithubConnected] = useState(false);

  const [vercelToken, setVercelToken] = useState('');
  const [vercelConnected, setVercelConnected] = useState(false);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.organizations.getIntegrations()
      .then((res) => {
        setGithubConnected(res.githubConnected);
        setVercelConnected(res.vercelConnected);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSaveGithub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim()) return;
    try {
      await api.organizations.updateIntegrations({ githubToken: githubToken.trim() });
      setGithubToken('');
      setGithubConnected(true);
      setMessage({ type: 'success', text: 'GitHub account connected and encrypted securely!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect GitHub account' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDisconnectGithub = async () => {
    try {
      await api.organizations.disconnectIntegration('github');
      setGithubToken('');
      setGithubConnected(false);
      setMessage({ type: 'success', text: 'GitHub account disconnected.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to disconnect GitHub account' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveVercel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vercelToken.trim()) return;
    try {
      await api.organizations.updateIntegrations({ vercelToken: vercelToken.trim() });
      setVercelToken('');
      setVercelConnected(true);
      setMessage({ type: 'success', text: 'Vercel account connected and encrypted securely!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to connect Vercel account' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDisconnectVercel = async () => {
    try {
      await api.organizations.disconnectIntegration('vercel');
      setVercelToken('');
      setVercelConnected(false);
      setMessage({ type: 'success', text: 'Vercel account disconnected.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to disconnect Vercel account' });
    }
    setTimeout(() => setMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Developer Account Connections"
        description="Connect your GitHub and Vercel accounts. You can select specific repositories and project targets whenever you create a Production Block."
      />

      {message && (
        <div
          className={cn(
            'flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold shadow-2xs',
            message.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400',
          )}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* ── GitHub Integration ── */}
        <Card padding="md" className="border border-line bg-surface shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-900 text-white shadow-xs">
                <Github size={22} />
              </span>
              <div>
                <h4 className="font-bold text-base text-ink">GitHub Connection</h4>
                <p className="text-2xs text-ink-muted">Codebase sync & automated PR review</p>
              </div>
            </div>

            <Badge tone={githubConnected ? 'success' : 'neutral'} dot={githubConnected}>
              {githubConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Connect your GitHub account. When you create a new production block, you can select any target repository and branch for agents to work on.
          </p>

          <form onSubmit={handleSaveGithub} className="space-y-3 pt-1">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                GitHub Personal Access Token (PAT)
              </label>
              <input
                type="password"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                placeholder="ghp_..."
                required
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs font-mono text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" variant="primary" size="sm">
                {githubConnected ? 'Update GitHub Token' : 'Connect GitHub'}
              </Button>
              {githubConnected && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDisconnectGithub}>
                  Disconnect
                </Button>
              )}
            </div>
          </form>
        </Card>

        {/* ── Vercel Integration ── */}
        <Card padding="md" className="border border-line bg-surface shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-black text-white shadow-xs">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M12 1L24 22H0L12 1Z" />
                </svg>
              </span>
              <div>
                <h4 className="font-bold text-base text-ink">Vercel Connection</h4>
                <p className="text-2xs text-ink-muted">Instant preview deployments</p>
              </div>
            </div>

            <Badge tone={vercelConnected ? 'success' : 'neutral'} dot={vercelConnected}>
              {vercelConnected ? 'Connected' : 'Not Connected'}
            </Badge>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            Connect your Vercel account to automatically deploy production chain artifacts and generate live preview URLs for each completed milestone.
          </p>

          <form onSubmit={handleSaveVercel} className="space-y-3 pt-1">
            <div>
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
                Vercel API Access Token
              </label>
              <input
                type="password"
                value={vercelToken}
                onChange={(e) => setVercelToken(e.target.value)}
                placeholder="vercel_tok_..."
                required
                className="w-full rounded-xl border border-line bg-canvas px-3.5 py-2.5 text-xs font-mono text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button type="submit" variant="primary" size="sm">
                {vercelConnected ? 'Update Vercel Token' : 'Connect Vercel'}
              </Button>
              {vercelConnected && (
                <Button type="button" variant="ghost" size="sm" onClick={handleDisconnectVercel}>
                  Disconnect
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
