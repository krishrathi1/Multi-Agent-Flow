import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { EndpointBlock } from './components/EndpointBlock';
import { SEO } from '../../components/SEO';

export function DocsAgentManagement() {
  return (
    <div>
      <SEO
        title="AI Agent Management — Nexus AI Agent Platform Docs"
        description="Create, configure, and manage the full lifecycle of autonomous AI agents. Learn agent provisioning, SOUL.md identity, workspace configuration, and multi-agent orchestration with Nexus by Blostem."
        canonical="/docs/agent-management"
        keywords="AI agent management, agent lifecycle, AI agent provisioning, SOUL.md, autonomous agent configuration, multi-agent orchestration, Blostem AI"
      />
      <h1 className="text-4xl font-bold text-white mb-2">Agent Management</h1>
      <p className="text-gray-400 text-lg mb-10">
        Create, configure, and manage the full lifecycle of your AI agents.
      </p>

      <DocSection id="creating-agents" title="Creating Agents">
        <p className="text-gray-300 leading-relaxed mb-4">
          Agents can be created through the Nexus UI or via the REST API.
        </p>
        <h3 className="text-lg font-semibold text-white mb-3">Via the UI</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          Navigate to <strong className="text-white">Agent Controls</strong> in the sidebar and
          click <strong className="text-white">Create Agent</strong>. Fill in the required fields
          and click Save.
        </p>
        <h3 className="text-lg font-semibold text-white mb-3">Via the API</h3>
        <CodeBlock
          title="Create Agent"
          language="bash"
          code={`curl -X POST https://your-nexus/api/agents \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "displayName": "Research Assistant",
    "description": "Handles research tasks",
    "avatar": "🔬",
    "heartbeatInterval": 30
  }'`}
        />
      </DocSection>

      <DocSection id="agent-configuration" title="Agent Configuration">
        <p className="text-gray-300 leading-relaxed mb-4">
          Each agent has the following configurable properties:
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Field</th>
              <th className="pb-2 pr-4">Type</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">displayName</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">Human-readable name shown in the UI</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">name</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">URL-safe slug, auto-generated from displayName</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">description</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">Brief description of the agent's purpose</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">workspace</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">Optional workspace or project grouping</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">avatar</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">Emoji used as the agent's visual identifier</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">heartbeatInterval</td>
              <td className="py-2 pr-4">number</td>
              <td className="py-2">Expected seconds between heartbeats (default: 30)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">enabled</td>
              <td className="py-2 pr-4">boolean</td>
              <td className="py-2">Whether the agent is active</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">soulMd</td>
              <td className="py-2 pr-4">string</td>
              <td className="py-2">Markdown defining agent personality and instructions</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection id="soul-md" title="SOUL.md">
        <p className="text-gray-300 leading-relaxed mb-4">
          The SOUL.md field is a Markdown document that defines an agent's personality, instructions,
          and capabilities. Think of it as the agent's "system prompt" or identity document.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          You can edit the SOUL.md from the agent's edit page in the UI, or update it via the API
          using the PATCH endpoint.
        </p>
        <CodeBlock
          title="Example SOUL.md"
          language="markdown"
          code={`# Research Assistant

## Role
You are a research assistant that finds and summarizes information.

## Capabilities
- Web search and content extraction
- Document summarization
- Citation formatting

## Guidelines
- Always cite your sources
- Prefer recent sources (last 2 years)
- Flag any uncertain or conflicting information`}
        />
      </DocSection>

      <DocSection id="enabling-disabling" title="Enabling / Disabling Agents">
        <p className="text-gray-300 leading-relaxed mb-4">
          Agents can be enabled or disabled from the Agent Controls page. Toggle the switch next to
          an agent's name to change its state.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          When an agent is <strong className="text-white">disabled</strong>, it stops receiving
          commands and its status is no longer actively monitored. The agent's data and history
          are preserved.
        </p>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          Disabling an agent is non-destructive. You can re-enable it at any time to resume monitoring.
        </div>
      </DocSection>

      <DocSection id="agent-status" title="Agent Status">
        <p className="text-gray-300 leading-relaxed mb-4">
          Agents have one of four statuses, determined by heartbeat activity:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span className="text-emerald-400 font-semibold text-sm">ONLINE</span>
            </div>
            <p className="text-gray-400 text-sm">Actively sending heartbeats within the expected interval.</p>
          </div>
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span className="text-amber-400 font-semibold text-sm">IDLE</span>
            </div>
            <p className="text-gray-400 text-sm">Connected but no recent activity or tasks.</p>
          </div>
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-500"></span>
              <span className="text-gray-400 font-semibold text-sm">OFFLINE</span>
            </div>
            <p className="text-gray-400 text-sm">No heartbeat received within the expected interval.</p>
          </div>
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
              <span className="text-red-400 font-semibold text-sm">ERROR</span>
            </div>
            <p className="text-gray-400 text-sm">Agent reported an error condition.</p>
          </div>
        </div>
      </DocSection>

      <DocSection id="deleting-agents" title="Deleting Agents">
        <p className="text-gray-300 leading-relaxed mb-4">
          To delete an agent, navigate to the agent's edit page and click the{' '}
          <strong className="text-white">Delete</strong> button.
        </p>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          <strong className="text-amber-400">Warning:</strong> Deleting an agent is permanent and
          cascading. It removes all associated activities, tasks, sessions, metrics, and MCP server
          configurations. This action cannot be undone.
        </div>
      </DocSection>

      <DocSection id="api-reference" title="API Reference">
        <p className="text-gray-300 leading-relaxed mb-4">
          The following endpoints are available for managing agents programmatically.
        </p>

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
  "soulMd": "# Research Agent\\n..."
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
          method="GET"
          path="/api/agents"
          description="List all agents in your organization."
          auth="JWT"
        />

        <EndpointBlock
          method="GET"
          path="/api/agents/:id"
          description="Get detailed information about a specific agent."
          auth="JWT"
        />

        <EndpointBlock
          method="PATCH"
          path="/api/agents/:id"
          description="Update an agent's configuration. All fields are optional."
          auth="JWT"
          body={`{
  "displayName": "Updated Name",
  "enabled": false,
  "heartbeatInterval": 60
}`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/agents/:id"
          description="Permanently delete an agent and all associated data."
          auth="JWT"
        />
      </DocSection>
    </div>
  );
}
