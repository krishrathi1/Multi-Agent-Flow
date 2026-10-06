import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { SEO } from '../../components/SEO';

export function DocsOrganizations() {
  return (
    <div>
      <SEO
        title="Organizations & Teams — Enterprise AI Agent Management"
        description="Manage teams with role-based access control for enterprise AI agent operations. Set up organizations, assign roles, and control access to your agent infrastructure with MyceliumOps by Blostem."
        canonical="/docs/organizations"
        keywords="enterprise AI agent management, team management, role-based access control, AI agent RBAC, multi-tenant AI platform, Blostem AI"
      />
      <h1 className="text-4xl font-bold text-white mb-2">Organizations & Teams</h1>
      <p className="text-gray-400 text-lg mb-10">
        Manage your team, assign roles, and control access to your agent infrastructure.
      </p>

      <DocSection id="overview" title="Overview">
        <p className="text-gray-300 leading-relaxed mb-4">
          MyceliumOps uses a multi-tenant architecture where each organization is a completely isolated
          workspace. An organization contains its own agents, activities, tasks, metrics, alert rules,
          API keys, and team members.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          When you sign up, you create both a user account and an organization. You become the
          Owner of that organization and can invite others to join.
        </p>
      </DocSection>

      <DocSection id="roles" title="Roles">
        <p className="text-gray-300 leading-relaxed mb-4">
          MyceliumOps supports four roles with different levels of access:
        </p>
        <div className="space-y-3 mb-4">
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-nexus-500/15 text-nexus-400 border border-nexus-500/30">
                OWNER
              </span>
              <span className="text-white font-semibold text-sm">Full Access</span>
            </div>
            <p className="text-gray-400 text-sm">
              Complete control over the organization. Can manage all settings, members, agents,
              API keys, and billing. Can transfer ownership or delete the organization. Only one
              owner per organization.
            </p>
          </div>

          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                ADMIN
              </span>
              <span className="text-white font-semibold text-sm">Manage Members & Infrastructure</span>
            </div>
            <p className="text-gray-400 text-sm">
              Can invite and remove members, generate and revoke API keys, create and manage agents,
              and configure alert rules. Cannot change organization settings or manage the Owner role.
            </p>
          </div>

          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                MEMBER
              </span>
              <span className="text-white font-semibold text-sm">Create & Edit</span>
            </div>
            <p className="text-gray-400 text-sm">
              Can create and edit agents, manage tasks, send commands, and view all data. Cannot
              manage team members or API keys.
            </p>
          </div>

          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-500/15 text-gray-400 border border-gray-500/30">
                VIEWER
              </span>
              <span className="text-white font-semibold text-sm">Read-Only</span>
            </div>
            <p className="text-gray-400 text-sm">
              View-only access to dashboards, agents, activities, and metrics. Cannot create, edit,
              or delete anything. Ideal for stakeholders who need visibility without modification rights.
            </p>
          </div>
        </div>
      </DocSection>

      <DocSection id="inviting-members" title="Inviting Members">
        <p className="text-gray-300 leading-relaxed mb-4">
          To invite a new team member to your organization:
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>Navigate to <strong className="text-white">Settings</strong> from the sidebar.</li>
          <li>Click the <strong className="text-white">Members</strong> tab.</li>
          <li>Click <strong className="text-white">Invite Member</strong>.</li>
          <li>Enter the person's <strong className="text-white">email address</strong>.</li>
          <li>Select a <strong className="text-white">role</strong> (Admin, Member, or Viewer).</li>
          <li>Click <strong className="text-white">Send Invite</strong>.</li>
        </ol>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          Only users with the <strong className="text-white">Owner</strong> or{' '}
          <strong className="text-white">Admin</strong> role can invite new members.
        </div>

        <CodeBlock
          title="Invite Member via API"
          language="bash"
          code={`curl -X POST https://your-nexus/api/org/members \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "colleague@example.com",
    "role": "MEMBER"
  }'`}
        />
      </DocSection>

      <DocSection id="managing-roles" title="Managing Roles">
        <p className="text-gray-300 leading-relaxed mb-4">
          Only the organization Owner can change member roles. To update a member's role:
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>Navigate to <strong className="text-white">Settings &gt; Members</strong>.</li>
          <li>Find the member in the list.</li>
          <li>Click the role dropdown next to their name.</li>
          <li>Select the new role.</li>
        </ol>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          <strong className="text-amber-400">Note:</strong> The Owner can promote any member to Admin
          or demote Admins to Member/Viewer. Transferring ownership is a separate action that requires
          confirmation.
        </div>

        <CodeBlock
          title="Update Member Role via API"
          language="bash"
          code={`curl -X PATCH https://your-nexus/api/org/members/:memberId \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "role": "ADMIN"
  }'`}
        />
      </DocSection>

      <DocSection id="api-keys" title="API Keys">
        <p className="text-gray-300 leading-relaxed mb-4">
          API keys are used to authenticate remote agents. They are scoped to your organization
          and can be managed from the Settings page.
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>Navigate to <strong className="text-white">Settings &gt; API Keys</strong>.</li>
          <li>Click <strong className="text-white">Generate Key</strong>.</li>
          <li>Enter a descriptive name for the key.</li>
          <li>Copy the generated key immediately.</li>
        </ol>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          <strong className="text-amber-400">Important:</strong> API keys are hashed using a one-way
          hash before storage. The plain-text key is only displayed once at creation time. If you
          lose a key, you must generate a new one and revoke the old one.
        </div>
        <p className="text-gray-300 leading-relaxed mb-4">
          All API keys have the prefix <code className="text-sm bg-surface-900 px-1.5 py-0.5 rounded">nxk_</code> followed
          by a random string. Use them in the <code className="text-sm bg-surface-900 px-1.5 py-0.5 rounded">X-API-Key</code> header
          for remote agent API calls.
        </p>
      </DocSection>

      <DocSection id="data-isolation" title="Data Isolation">
        <p className="text-gray-300 leading-relaxed mb-4">
          All data in MyceliumOps is scoped to the organization level. This means:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
          <li>Members of one organization <strong className="text-white">cannot see</strong> another organization's agents, activities, tasks, or metrics.</li>
          <li>API keys are organization-scoped and can only access data within that organization.</li>
          <li>JWT tokens include the user's organization ID, ensuring all queries are automatically filtered.</li>
          <li>WebSocket connections are joined to organization-specific rooms, so real-time events are never leaked across organizations.</li>
        </ul>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          Data isolation is enforced at the database query level, not just the application level.
          Every query includes an organization ID filter, making cross-organization data access
          architecturally impossible.
        </div>
      </DocSection>
    </div>
  );
}
