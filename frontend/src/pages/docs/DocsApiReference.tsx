import { DocSection } from './components/DocSection';
import { EndpointBlock } from './components/EndpointBlock';
import { SEO } from '../../components/SEO';

export function DocsApiReference() {
  return (
    <div>
      <SEO
        title="API Reference — MyceliumOps AI Agent Platform"
        description="Complete REST API documentation for the MyceliumOps AI agent orchestration platform. Endpoints for agents, boards, tasks, approvals, gateways, and more. Built by Blostem."
        canonical="/docs/api-reference"
        keywords="AI agent API, REST API reference, agent orchestration API, MyceliumOps API documentation, Blostem AI platform API"
      />
      <h1 className="text-4xl font-bold text-white mb-2">API Reference</h1>
      <p className="text-gray-400 text-lg mb-10">
        Complete REST API documentation for the MyceliumOps platform.
      </p>

      <div className="bg-surface-850 border border-white/5 rounded-lg p-5 mb-10">
        <h3 className="text-lg font-semibold text-white mb-3">Authentication</h3>
        <p className="text-gray-300 text-sm leading-relaxed mb-3">
          MyceliumOps uses two authentication methods:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 text-sm">
          <li>
            <strong className="text-white">JWT Bearer Token</strong> -- For all protected endpoints.
            Include in the <code className="bg-surface-900 px-1.5 py-0.5 rounded">Authorization: Bearer &lt;token&gt;</code> header.
            Obtain a token via the login endpoint.
          </li>
          <li>
            <strong className="text-white">API Key</strong> -- For remote agent endpoints only.
            Include in the <code className="bg-surface-900 px-1.5 py-0.5 rounded">X-API-Key: nxk_...</code> header.
            Generate keys from Settings &gt; API Keys.
          </li>
        </ul>
      </div>

      {/* Auth */}
      <DocSection id="auth" title="Auth">
        <p className="text-gray-300 leading-relaxed mb-4">
          Authentication endpoints for user signup, login, token refresh, and session management.
        </p>

        <EndpointBlock
          method="POST"
          path="/api/auth/signup"
          description="Create a new user account and organization."
          body={`{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "password": "securePassword123",
  "orgName": "Acme AI"
}`}
          response={`// Response body:
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "clx...",
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "organization": { "id": "...", "name": "Acme AI", "slug": "acme-ai" }
}
// Refresh token set as httpOnly cookie (not in body)`}
        />

        <EndpointBlock
          method="POST"
          path="/api/auth/login"
          description="Authenticate with email and password. Returns JWT access token. Refresh token is set as a secure httpOnly cookie."
          body={`{
  "email": "jane@example.com",
  "password": "securePassword123"
}`}
          response={`// Response body:
{
  "accessToken": "eyJhbG...",
  "user": {
    "id": "clx...",
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "organization": { "id": "...", "name": "Acme AI", "slug": "acme-ai" }
}
// Refresh token set as httpOnly cookie (not in body)`}
        />

        <EndpointBlock
          method="POST"
          path="/api/auth/refresh"
          description="Rotate refresh token and get new access token. Refresh token is read from httpOnly cookie (no request body needed)."
          body={`// No body required — refresh token is sent
// automatically via httpOnly cookie`}
          response={`{
  "accessToken": "eyJhbG..."
}
// New refresh token set as httpOnly cookie`}
        />

        <EndpointBlock
          method="POST"
          path="/api/auth/logout"
          description="Invalidate the current session and refresh token."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/auth/me"
          description="Get the currently authenticated user's profile, including role and organization."
          auth="JWT"
          response={`{
  "id": "clx...",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "OWNER",
  "orgId": "clx...",
  "orgName": "Acme AI"
}`}
        />
      </DocSection>

      {/* Agents */}
      <DocSection id="agents" title="Agents">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for creating, reading, updating, and deleting agents, as well as managing
          heartbeats and status.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/agents"
          description="List all agents in your organization. Returns an array of agent objects."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/agents/stats"
          description="Get aggregate statistics: total agents, online count, idle count, offline count, error count."
          auth="JWT"
          response={`{
  "total": 12,
  "online": 8,
  "idle": 2,
  "offline": 1,
  "error": 1
}`}
        />

        <EndpointBlock
          method="GET"
          path="/api/agents/:id"
          description="Get detailed information about a specific agent, including MCP servers and recent activity."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/agents"
          description="Create a new agent in your organization."
          auth="JWT"
          body={`{
  "displayName": "Research Assistant",
  "description": "Handles research tasks",
  "avatar": "🔬",
  "heartbeatInterval": 30,
  "soulMd": "# Agent Instructions\\n..."
}`}
          response={`{
  "id": "clx...",
  "displayName": "Research Assistant",
  "name": "research-assistant",
  "status": "OFFLINE",
  "enabled": true,
  "createdAt": "2025-01-15T10:00:00Z"
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/agents/:id"
          description="Update agent configuration. All fields are optional."
          auth="JWT"
          body={`{
  "displayName": "Updated Name",
  "description": "Updated description",
  "enabled": false,
  "heartbeatInterval": 60,
  "soulMd": "# Updated instructions"
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/agents/:id"
          description="Permanently delete an agent and all associated data (activities, tasks, sessions, metrics)."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/agents/:id/heartbeat"
          description="Send a heartbeat for an agent, updating its status and last-seen timestamp."
          auth="JWT"
          body={`{
  "status": "ONLINE",
  "message": "All systems normal"
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/agents/:id/status"
          description="Manually update an agent's status."
          auth="JWT"
          body={`{
  "status": "IDLE"
}`}
        />
      </DocSection>

      {/* Activities */}
      <DocSection id="activities" title="Activities">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for querying the activity log. Activities are immutable records of agent actions.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/activities"
          description="List activities with optional filters. Supports pagination."
          auth="JWT"
          response={`{
  "activities": [
    {
      "id": "clx...",
      "agentId": "clx...",
      "type": "TASK_COMPLETE",
      "message": "Finished batch processing",
      "metadata": {},
      "createdAt": "2025-01-15T10:00:00Z"
    }
  ],
  "total": 150
}`}
        />

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-3">Query Parameters</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr className="border-b border-white/5">
                <th className="pb-2 pr-4">Parameter</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">agentId</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">Filter by agent</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">type</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">Filter by activity type</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">limit</td>
                <td className="py-2 pr-4">number</td>
                <td className="py-2">Max results (default: 50)</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">offset</td>
                <td className="py-2 pr-4">number</td>
                <td className="py-2">Pagination offset</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">since</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">ISO timestamp to filter activities after</td>
              </tr>
            </tbody>
          </table>
        </div>

        <EndpointBlock
          method="GET"
          path="/api/activities/search"
          description="Full-text search across activity messages."
          auth="JWT"
        />

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-3">Search Parameters</h3>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-400">
              <tr className="border-b border-white/5">
                <th className="pb-2 pr-4">Parameter</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">q</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">Search query string</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">agentId</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">Optional agent filter</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">type</td>
                <td className="py-2 pr-4">string</td>
                <td className="py-2">Optional activity type filter</td>
              </tr>
              <tr className="border-b border-white/5">
                <td className="py-2 pr-4 font-mono text-sm">limit</td>
                <td className="py-2 pr-4">number</td>
                <td className="py-2">Max results (default: 20)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </DocSection>

      {/* Tasks */}
      <DocSection id="tasks" title="Tasks">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for managing tasks on the Kanban board. Tasks can be assigned to agents
          and tracked through workflow states.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/tasks"
          description="List all tasks in your organization."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/tasks"
          description="Create a new task."
          auth="JWT"
          body={`{
  "title": "Process weekly report",
  "description": "Generate the weekly analytics report",
  "status": "TODO",
  "priority": "HIGH",
  "assignedAgentId": "clx..."
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/tasks/:id"
          description="Update a task's properties. Use this to move tasks between columns."
          auth="JWT"
          body={`{
  "status": "IN_PROGRESS",
  "assignedAgentId": "clx..."
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/tasks/:id"
          description="Delete a task."
          auth="JWT"
        />
      </DocSection>

      {/* Threads */}
      <DocSection id="threads" title="Threads">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for viewing conversation threads and agent delegation chains.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/threads"
          description="List all threads in your organization."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/threads/:id"
          description="Get a specific thread with all messages and participants."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/threads/graph"
          description="Get thread data in graph format for topology visualization."
          auth="JWT"
        />
      </DocSection>

      {/* Sessions */}
      <DocSection id="sessions" title="Sessions">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for querying agent session data and timeline information.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/sessions"
          description="List all sessions, optionally filtered by agent."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/sessions/timeline"
          description="Get session data formatted for timeline visualization."
          auth="JWT"
        />
      </DocSection>

      {/* Tokens */}
      <DocSection id="tokens" title="Tokens">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for tracking token usage and costs across agents and models.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/tokens"
          description="List token usage records with optional filters by agent, model, and date range."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/tokens/summary"
          description="Get aggregate token usage summary: total input/output tokens, cost breakdown by agent and model."
          auth="JWT"
          response={`{
  "totalInputTokens": 1250000,
  "totalOutputTokens": 450000,
  "totalCost": 12.50,
  "byAgent": [...],
  "byModel": [...]
}`}
        />
      </DocSection>

      {/* Metrics */}
      <DocSection id="metrics" title="Metrics">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for querying performance metrics such as response times, success rates, and tool usage.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/metrics"
          description="List individual metric records with optional filters."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/metrics/summary"
          description="Get aggregate metrics summary: average response time, success rate, top tools."
          auth="JWT"
          response={`{
  "avgResponseTimeMs": 850,
  "successRate": 0.97,
  "totalRequests": 5430,
  "topTools": [
    { "name": "web-search", "count": 1200 },
    { "name": "code-execute", "count": 890 }
  ]
}`}
        />
      </DocSection>

      {/* Alerts */}
      <DocSection id="alerts" title="Alerts">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for managing alert rules and alert events.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/alerts/rules"
          description="List all alert rules for your organization."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/alerts/rules"
          description="Create a new alert rule."
          auth="JWT"
          body={`{
  "name": "High Error Rate",
  "description": "Alert when error rate exceeds threshold",
  "condition": "error_rate > 5%",
  "threshold": 5,
  "timeWindowMinutes": 10,
  "agentId": null
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/alerts/rules/:id"
          description="Update an existing alert rule."
          auth="JWT"
          body={`{
  "threshold": 10,
  "enabled": false
}`}
        />

        <EndpointBlock
          method="GET"
          path="/api/alerts/events"
          description="List alert events. Filter by rule ID or acknowledgement status."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/alerts/events/:id/acknowledge"
          description="Acknowledge an alert event."
          auth="JWT"
        />
      </DocSection>

      {/* Commands */}
      <DocSection id="commands" title="Commands">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for sending commands to agents and viewing command history.
        </p>

        <EndpointBlock
          method="POST"
          path="/api/commands"
          description="Send a command to an agent."
          auth="JWT"
          body={`{
  "agentId": "clx...",
  "command": "Run the weekly analytics report"
}`}
          response={`{
  "id": "clx...",
  "agentId": "clx...",
  "command": "Run the weekly analytics report",
  "createdAt": "2025-01-15T10:00:00Z"
}`}
        />

        <EndpointBlock
          method="GET"
          path="/api/commands"
          description="List commands, optionally filtered by agent."
          auth="JWT"
        />
      </DocSection>

      {/* MCP */}
      <DocSection id="mcp" title="MCP Servers & Tools">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for managing MCP server connections and discovering tools for agents.
        </p>

        <EndpointBlock
          method="GET"
          path="/api/agents/:agentId/mcp-servers"
          description="List all MCP servers configured for an agent."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/agents/:agentId/mcp-servers"
          description="Add a new MCP server to an agent."
          auth="JWT"
          body={`{
  "name": "File System Tools",
  "url": "http://localhost:3001/mcp",
  "transport": "STREAMABLE_HTTP"
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/agents/:agentId/mcp-servers/:id"
          description="Update an MCP server's configuration."
          auth="JWT"
          body={`{
  "name": "Updated Name",
  "url": "http://localhost:3002/mcp"
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/agents/:agentId/mcp-servers/:id"
          description="Remove an MCP server and its cached tools from the agent."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/agents/:agentId/mcp-servers/:id/refresh-tools"
          description="Connect to the MCP server and refresh the cached tool catalog."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/agents/:agentId/mcp-servers/:id/tools"
          description="List all cached tools discovered from this MCP server."
          auth="JWT"
          response={`[
  {
    "name": "read_file",
    "description": "Read the contents of a file",
    "inputSchema": {
      "type": "object",
      "properties": {
        "path": { "type": "string" }
      },
      "required": ["path"]
    }
  }
]`}
        />
      </DocSection>

      {/* Remote */}
      <DocSection id="remote" title="Remote Agent API">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for remote agent integration. These use API Key authentication instead of JWT.
        </p>

        <EndpointBlock
          method="POST"
          path="/api/remote/heartbeat"
          description="Send a heartbeat from a remote agent. Auto-registers the agent if it does not exist."
          auth="API Key"
          body={`{
  "agentName": "my-remote-agent",
  "status": "ONLINE",
  "message": "Agent is healthy"
}`}
          response={`{
  "success": true,
  "agentId": "clx...",
  "status": "ONLINE"
}`}
        />

        <EndpointBlock
          method="POST"
          path="/api/remote/activity"
          description="Log an activity entry for a remote agent."
          auth="API Key"
          body={`{
  "agentName": "my-remote-agent",
  "type": "TASK_COMPLETE",
  "message": "Finished processing batch",
  "metadata": { "batchSize": 1000 }
}`}
        />

        <EndpointBlock
          method="POST"
          path="/api/remote/metrics"
          description="Report performance and cost metrics for a remote agent."
          auth="API Key"
          body={`{
  "agentName": "my-remote-agent",
  "responseTimeMs": 1250,
  "success": true,
  "toolName": "web-search",
  "inputTokens": 500,
  "outputTokens": 200,
  "model": "gpt-4o"
}`}
        />
      </DocSection>

      {/* Organization */}
      <DocSection id="organization" title="Organization">
        <p className="text-gray-300 leading-relaxed mb-4">
          Endpoints for managing your organization, team members, and API keys.
        </p>

        <h3 className="text-lg font-semibold text-white mb-3 mt-6">Organization Settings</h3>

        <EndpointBlock
          method="GET"
          path="/api/org"
          description="Get your organization's details."
          auth="JWT"
          response={`{
  "id": "clx...",
  "name": "Acme AI",
  "createdAt": "2025-01-01T00:00:00Z",
  "memberCount": 5,
  "agentCount": 12
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/org"
          description="Update organization settings. Only accessible by OWNER."
          auth="JWT"
          body={`{
  "name": "Updated Org Name"
}`}
        />

        <h3 className="text-lg font-semibold text-white mb-3 mt-6">Members</h3>

        <EndpointBlock
          method="GET"
          path="/api/org/members"
          description="List all members of your organization."
          auth="JWT"
          response={`[
  {
    "id": "clx...",
    "name": "Jane Smith",
    "email": "jane@example.com",
    "role": "OWNER",
    "joinedAt": "2025-01-01T00:00:00Z"
  }
]`}
        />

        <EndpointBlock
          method="POST"
          path="/api/org/members"
          description="Invite a new member to your organization. Requires OWNER or ADMIN role."
          auth="JWT"
          body={`{
  "email": "colleague@example.com",
  "role": "MEMBER"
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/org/members/:id"
          description="Update a member's role. Only accessible by OWNER."
          auth="JWT"
          body={`{
  "role": "ADMIN"
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/org/members/:id"
          description="Remove a member from your organization."
          auth="JWT"
        />

        <h3 className="text-lg font-semibold text-white mb-3 mt-6">API Keys</h3>

        <EndpointBlock
          method="GET"
          path="/api/org/api-keys"
          description="List all API keys for your organization (keys are masked)."
          auth="JWT"
          response={`[
  {
    "id": "clx...",
    "name": "Production Agent Key",
    "prefix": "nxk_a1b2...",
    "createdAt": "2025-01-15T10:00:00Z",
    "lastUsedAt": "2025-01-15T12:00:00Z"
  }
]`}
        />

        <EndpointBlock
          method="POST"
          path="/api/org/api-keys"
          description="Generate a new API key. The full key is only returned in this response."
          auth="JWT"
          body={`{
  "name": "Production Agent Key"
}`}
          response={`{
  "id": "clx...",
  "name": "Production Agent Key",
  "key": "nxk_a1b2c3d4e5f6g7h8i9j0..."
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/org/api-keys/:id"
          description="Revoke an API key. Any agents using this key will lose access."
          auth="JWT"
        />
      </DocSection>
    </div>
  );
}
