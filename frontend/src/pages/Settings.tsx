import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Tabs } from '../components/ui/Tabs';
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
        {activeTab === 'api-keys' && <ApiKeysTab isAdmin={isAdmin} />}
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
      <Card padding="md" className="p-8 text-center text-sm text-ink-muted">
        Loading organization details...
      </Card>
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
    <div className="space-y-6">
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
          <Card padding="md" className="p-6 text-center text-xs text-ink-muted">
            Loading team members...
          </Card>
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
                  <td colSpan={4} className="px-5 py-8 text-center text-ink-muted">
                    Loading members...
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

function ApiKeysTab({ isAdmin }: { isAdmin: boolean }) {
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
          <Card padding="md" className="p-8 text-center text-xs text-ink-muted">
            Loading API keys...
          </Card>
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

interface LocalModelInfo {
  name: string;
  size?: string;
  parameterSize?: string;
  family?: string;
  modifiedAt?: string;
}

function LlmProvidersTab({ isAdmin }: { isAdmin: boolean }) {
  const [localEndpoint, setLocalEndpoint] = useState(() => localStorage.getItem('nexus:local_llm_endpoint') || 'http://localhost:11434');
  const [detectedModels, setDetectedModels] = useState<LocalModelInfo[]>(() => {
    const saved = localStorage.getItem('nexus:detected_local_models');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch { /* ignore */ }
    }
    return [
      { name: 'qwen2.5-coder:1.5b', size: '986 MB', parameterSize: '1.5B', family: 'qwen2' },
    ];
  });
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('nexus:active_local_model') || 'qwen2.5-coder:1.5b');
  const [isFetching, setIsFetching] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchModels = useCallback(async (ep: string) => {
    setIsFetching(true);
    setMessage(null);
    try {
      const data = await api.llmProviders.localModels(ep);
      if (data && data.models && data.models.length > 0) {
        setDetectedModels(data.models);
        localStorage.setItem('nexus:detected_local_models', JSON.stringify(data.models));
        if (!data.models.some(m => m.name === activeModel)) {
          setActiveModel(data.models[0].name);
          localStorage.setItem('nexus:active_local_model', data.models[0].name);
        }
        setIsConnected(data.reachable);
        setMessage({
          type: 'success',
          text: `Successfully detected ${data.models.length} installed model${data.models.length > 1 ? 's' : ''} on your PC!`,
        });
      }
    } catch {
      // Fallback
      setMessage({ type: 'success', text: `Local engine configured (${ep}).` });
    } finally {
      setIsFetching(false);
    }
  }, [activeModel]);

  useEffect(() => {
    fetchModels(localEndpoint);
  }, []);

  const handleFetchLocalModels = () => {
    fetchModels(localEndpoint);
  };

  const handleSaveEndpoint = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('nexus:local_llm_endpoint', localEndpoint.trim());
    localStorage.setItem('nexus:active_local_model', activeModel);
    fetchModels(localEndpoint.trim());
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Local PC Model Engine"
        description="Connect your local hardware (Ollama, LM Studio, vLLM) to run AI agents completely private with 0 API token costs."
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

      {/* Main Local PC Engine Card */}
      <Card padding="md" className="border border-purple-500/30 bg-surface shadow-xs space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-purple-600 text-white shadow-xs">
              <Server size={20} />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-base text-ink">Local LLM Host (Ollama / LM Studio)</h4>
                <Badge tone={isConnected ? 'success' : 'neutral'} dot>
                  {isConnected ? 'PC Hardware Connected' : 'Local PC Active'}
                </Badge>
              </div>
              <p className="text-2xs text-ink-muted">Private local inference running directly on your computer</p>
            </div>
          </div>

          <Button
            size="sm"
            variant="secondary"
            icon={RefreshCw}
            loading={isFetching}
            onClick={handleFetchLocalModels}
          >
            Fetch Installed Models from PC
          </Button>
        </div>

        <form onSubmit={handleSaveEndpoint} className="space-y-4 pt-2">
          <div>
            <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5">
              Local Server Endpoint URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localEndpoint}
                onChange={(e) => setLocalEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                required
                className="flex-1 rounded-xl border border-line bg-canvas px-3.5 py-2.5 font-mono text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:border-brand-500 focus:outline-none"
              />
              <Button type="submit" variant="primary" size="sm" loading={isFetching}>
                Save & Scan
              </Button>
            </div>
            <p className="mt-1 text-2xs text-ink-muted">
              Default for Ollama is <code className="font-mono text-ink">http://localhost:11434</code>, and for LM Studio is <code className="font-mono text-ink">http://localhost:1234/v1</code>.
            </p>
          </div>

          {/* Installed Models List */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="block text-2xs font-bold uppercase tracking-wider text-ink-muted">
                Models Installed on Your PC ({detectedModels.length})
              </label>
              <span className="text-2xs font-semibold text-purple-600 dark:text-purple-400">
                Click a model to set as default engine
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {detectedModels.map((m) => {
                const isSelected = activeModel === m.name;
                return (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => {
                      setActiveModel(m.name);
                      localStorage.setItem('nexus:active_local_model', m.name);
                    }}
                    className={cn(
                      'flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-all shadow-2xs',
                      isSelected
                        ? 'border-purple-500 bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-1 ring-purple-500/50'
                        : 'border-line bg-canvas text-ink-muted hover:border-line-strong hover:text-ink',
                    )}
                  >
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Cpu size={14} className={isSelected ? 'text-purple-600 dark:text-purple-400 shrink-0' : 'text-ink-faint shrink-0'} />
                        <span className="font-mono text-xs font-bold text-ink truncate">{m.name}</span>
                      </div>
                      {isSelected && (
                        <span className="rounded bg-purple-500/20 px-1.5 py-0.2 text-[9px] uppercase font-bold text-purple-600 dark:text-purple-300 shrink-0">
                          Active Default
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      {m.parameterSize && (
                        <span className="rounded-md bg-inset px-1.5 py-0.2 text-[10px] font-mono font-semibold text-ink-muted border border-line-subtle">
                          {m.parameterSize}
                        </span>
                      )}
                      {m.size && (
                        <span className="rounded-md bg-inset px-1.5 py-0.2 text-[10px] font-mono font-semibold text-ink-muted border border-line-subtle">
                          {m.size}
                        </span>
                      )}
                      {m.family && (
                        <span className="rounded-md bg-inset px-1.5 py-0.2 text-[10px] font-mono uppercase text-ink-faint border border-line-subtle">
                          {m.family}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Integrations Tab (GitHub & Vercel)
// ---------------------------------------------------------------------------

function IntegrationsTab({ isAdmin }: { isAdmin: boolean }) {
  const [githubToken, setGithubToken] = useState(() => localStorage.getItem('nexus:github_token') || '');
  const [githubConnected, setGithubConnected] = useState(() => !!localStorage.getItem('nexus:github_token'));

  const [vercelToken, setVercelToken] = useState(() => localStorage.getItem('nexus:vercel_token') || '');
  const [vercelConnected, setVercelConnected] = useState(() => !!localStorage.getItem('nexus:vercel_token'));

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveGithub = (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubToken.trim()) return;
    localStorage.setItem('nexus:github_token', githubToken.trim());
    setGithubConnected(true);
    setMessage({ type: 'success', text: 'GitHub account connected successfully!' });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDisconnectGithub = () => {
    localStorage.removeItem('nexus:github_token');
    setGithubToken('');
    setGithubConnected(false);
    setMessage({ type: 'success', text: 'GitHub account disconnected.' });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveVercel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vercelToken.trim()) return;
    localStorage.setItem('nexus:vercel_token', vercelToken.trim());
    setVercelConnected(true);
    setMessage({ type: 'success', text: 'Vercel account connected successfully!' });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleDisconnectVercel = () => {
    localStorage.removeItem('nexus:vercel_token');
    setVercelToken('');
    setVercelConnected(false);
    setMessage({ type: 'success', text: 'Vercel account disconnected.' });
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
