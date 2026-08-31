import { useState, useEffect } from 'react';
import { Mail, Plus, Send, Trash2, UserPlus, Users } from 'lucide-react';
import { api } from '../lib/api';
import { PageHeader, SectionHeading } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/States';
import { CustomSelect } from '../components/ui/CustomSelect';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import type { OrgInvite } from '../types';

export function Invitations() {
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.invites.list().then(data => {
      setInvites(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function handleInvite(e?: React.FormEvent) {
    e?.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const invite = await api.invites.create({ invitedEmail: email.trim(), role });
      setInvites(prev => [invite, ...prev]);
      setEmail('');
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function handleRevoke(id: string) {
    await api.invites.revoke(id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'REVOKED' as const } : i));
  }

  const statusTones: Record<string, 'warning' | 'success' | 'neutral' | 'danger'> = {
    PENDING: 'warning',
    ACCEPTED: 'success',
    EXPIRED: 'neutral',
    REVOKED: 'danger',
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlus}
        title="Workspace Invitations"
        description="Invite team members to collaborate and manage autonomous agent workflows"
      />

      {/* Invite Form */}
      <Card className="p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-ink mb-1">
          Invite New Member
        </h3>
        <p className="text-xs text-ink-muted mb-4">
          Invited members will receive an email to join your workspace with the selected role.
        </p>

        <form onSubmit={handleInvite} className="flex flex-wrap items-center gap-3">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="colleague@company.com"
            type="email"
            required
            className="flex-1 min-w-[240px] rounded-xl border border-line bg-inset px-3.5 py-2 text-xs text-ink placeholder:text-ink-muted shadow-2xs focus:outline-none focus:ring-1 focus:ring-brand-500"
          />

          <div className="w-56">
            <CustomSelect
              value={role}
              onChange={val => setRole(val)}
              options={[
                { value: 'MEMBER', label: 'Member (Standard Access)' },
                { value: 'ADMIN', label: 'Admin (Full Management)' },
                { value: 'VIEWER', label: 'Viewer (Read Only)' },
              ]}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            icon={Send}
            loading={sending}
            disabled={!email.trim() || sending}
          >
            Send Invite
          </Button>
        </form>
      </Card>

      {/* Invitations List */}
      <div className="space-y-3">
        <SectionHeading
          title="Pending & Past Invitations"
          description={`${invites.length} invitation${invites.length === 1 ? '' : 's'} recorded`}
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <HourglassLoader size={40} label="Loading workspace invitations..." />
          </div>
        ) : invites.length === 0 ? (
          <Card padding="lg" className="text-center">
            <EmptyState
              icon={Users}
              title="No invitations sent yet"
              description="Invite team members to collaborate on autonomous agent pipelines and workflows."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {invites.map(invite => (
              <Card
                key={invite.id}
                padding="sm"
                className="flex items-center justify-between border border-line-subtle bg-surface shadow-2xs rounded-xl"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-xs font-bold text-brand-600 dark:text-brand-400 border border-brand-500/20">
                    {invite.invitedEmail.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-ink">{invite.invitedEmail}</p>
                    <p className="truncate text-[11px] text-ink-muted mt-0.5">
                      Role: <span className="font-semibold text-ink">{invite.role.toLowerCase()}</span> &middot; Sent {new Date(invite.createdAt).toLocaleDateString()}
                      {invite.expiresAt && ` &middot; Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <Badge tone={statusTones[invite.status] || 'neutral'}>
                    {invite.status.toLowerCase()}
                  </Badge>
                  {invite.status === 'PENDING' && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRevoke(invite.id)}
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
