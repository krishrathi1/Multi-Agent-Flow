import { useState, useEffect } from 'react';
import { api } from '../lib/api';
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

  async function handleInvite() {
    if (!email.trim()) return;
    setSending(true);
    try {
      const invite = await api.invites.create({ invitedEmail: email, role });
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

  const statusColors: Record<string, string> = {
    PENDING: 'text-amber-400 bg-amber-500/10',
    ACCEPTED: 'text-emerald-400 bg-emerald-500/10',
    EXPIRED: 'text-gray-400 bg-gray-500/10',
    REVOKED: 'text-red-400 bg-red-500/10',
  };

  if (loading) return <div className="p-6 text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Invitations</h1>
        <p className="text-sm text-gray-500 mt-1">Invite team members to your organization</p>
      </div>

      <div className="bg-surface-850 border border-white/5 rounded-xl p-5">
        <h3 className="text-white font-medium mb-3">Send Invitation</h3>
        <div className="flex gap-3">
          <input
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email address"
            type="email"
            className="flex-1 px-4 py-2 bg-surface-800 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600"
          />
          <select value={role} onChange={e => setRole(e.target.value)} className="px-3 py-2 bg-surface-800 border border-white/10 rounded-lg text-sm text-white">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button onClick={handleInvite} disabled={!email.trim() || sending} className="px-5 py-2 bg-nexus-600 hover:bg-nexus-500 text-white text-sm font-medium rounded-lg disabled:opacity-50">
            {sending ? 'Sending...' : 'Invite'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {invites.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No invitations sent yet</div>
        ) : invites.map(invite => (
          <div key={invite.id} className="bg-surface-850 border border-white/5 rounded-xl px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-sm text-gray-400">
                {invite.invitedEmail.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm text-white">{invite.invitedEmail}</p>
                <p className="text-xs text-gray-500">
                  {invite.role.toLowerCase()} &middot; sent {new Date(invite.createdAt).toLocaleDateString()}
                  {invite.expiresAt && ` &middot; expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[invite.status]}`}>{invite.status.toLowerCase()}</span>
              {invite.status === 'PENDING' && (
                <button onClick={() => handleRevoke(invite.id)} className="px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded">Revoke</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
