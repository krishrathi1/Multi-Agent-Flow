import { Link } from 'react-router-dom';
import { DocSection } from './components/DocSection';
import { SEO } from '../../components/SEO';

export function DocsGettingStarted() {
  return (
    <div>
      <SEO
        title="Getting Started with MyceliumOps — AI Agent Platform Documentation"
        description="Learn how to set up MyceliumOps, the AI agent orchestration platform by Blostem. Connect gateways, deploy autonomous AI agents, and start building agentic workflows in minutes."
        canonical="https://nexus.blostem.com/docs"
        keywords="AI agent setup, getting started AI agents, MyceliumOps documentation, Blostem AI platform, agentic workflow tutorial, AI agent deployment guide"
      />
      <h1 className="text-4xl font-bold text-white mb-2">Getting Started with MyceliumOps</h1>
      <p className="text-gray-400 text-lg mb-10">
        Everything you need to set up your AI agent monitoring platform.
      </p>

      <DocSection id="what-is-nexus" title="What is MyceliumOps?">
        <p className="text-gray-300 leading-relaxed mb-4">
          MyceliumOps is an AI agent monitoring platform designed for teams managing autonomous agents.
          It provides real-time dashboards, task management, configurable alerts, cost tracking,
          and multi-agent coordination -- all from a single unified interface.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Whether you are running a single AI assistant or orchestrating dozens of specialized agents
          across multiple servers, MyceliumOps gives you full visibility into what your agents are doing,
          how they are performing, and when something needs your attention.
        </p>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          <strong className="text-nexus-400">Key capabilities:</strong> Real-time agent status monitoring,
          activity feeds, task management (Kanban boards), MCP tool integration, token usage and cost tracking,
          configurable alert rules, organization-based team collaboration, and a comprehensive REST + WebSocket API.
        </div>
      </DocSection>

      <DocSection id="creating-your-account" title="Creating Your Account">
        <p className="text-gray-300 leading-relaxed mb-4">
          To get started with MyceliumOps, you need to create an account and set up your organization.
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>
            Navigate to the{' '}
            <Link to="/signup" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              Sign Up page
            </Link>.
          </li>
          <li>
            Fill in your <strong className="text-white">name</strong>,{' '}
            <strong className="text-white">email address</strong>, and{' '}
            <strong className="text-white">password</strong>.
          </li>
          <li>
            Enter an <strong className="text-white">organization name</strong>. This creates your
            team workspace where all agents and data will live.
          </li>
          <li>
            Click <strong className="text-white">Create Account</strong>. You will be signed in
            automatically and redirected to the Dashboard.
          </li>
        </ol>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          When you create an account, you become the <strong className="text-white">Owner</strong> of
          your organization. Owners have full control over all settings, members, agents, and API keys.
        </div>
      </DocSection>

      <DocSection id="dashboard-overview" title="Dashboard Overview">
        <p className="text-gray-300 leading-relaxed mb-4">
          After logging in, you land on the Dashboard -- your central command center for monitoring
          all agent activity at a glance.
        </p>
        <h3 className="text-lg font-semibold text-white mb-3">Stats Bar</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          The top of the Dashboard shows a summary bar with counts of agents by status:
        </p>
        <ul className="space-y-2 text-gray-300 mb-6">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <strong className="text-emerald-400">Online</strong> -- Actively sending heartbeats
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <strong className="text-amber-400">Idle</strong> -- Connected but no recent activity
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-500"></span>
            <strong className="text-gray-400">Offline</strong> -- No heartbeat received
          </li>
        </ul>

        <h3 className="text-lg font-semibold text-white mb-3">Agent Cards</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          Each agent is displayed as a card showing its current status, last heartbeat time,
          active task (if any), and a quick-access link to the agent's profile page.
        </p>

        <h3 className="text-lg font-semibold text-white mb-3">Live System Health Feed</h3>
        <p className="text-gray-300 leading-relaxed mb-4">
          The activity feed on the Dashboard updates in real time via WebSocket, showing the latest
          heartbeats, task completions, errors, and other events across all your agents.
        </p>
      </DocSection>

      <DocSection id="creating-your-first-agent" title="Creating Your First Agent">
        <p className="text-gray-300 leading-relaxed mb-4">
          To start monitoring an agent, you first need to create one in Nexus.
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>
            Navigate to <strong className="text-white">Agent Controls</strong> from the sidebar.
          </li>
          <li>
            Click <strong className="text-white">Create Agent</strong>.
          </li>
          <li>
            Fill in the agent details:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-400">
              <li><strong className="text-gray-300">Display Name</strong> -- A human-readable name (e.g., "Research Assistant")</li>
              <li><strong className="text-gray-300">Name</strong> -- Auto-generated URL-safe slug based on the display name</li>
              <li><strong className="text-gray-300">Description</strong> -- What this agent does</li>
              <li><strong className="text-gray-300">Avatar</strong> -- Pick an emoji to identify the agent visually</li>
              <li><strong className="text-gray-300">SOUL.md</strong> -- A Markdown document defining the agent's personality, instructions, and capabilities</li>
              <li><strong className="text-gray-300">Heartbeat Interval</strong> -- How often (in seconds) the agent should check in</li>
            </ul>
          </li>
          <li>
            Click <strong className="text-white">Save</strong>. Your agent is now registered and
            ready to receive heartbeats and report activity.
          </li>
        </ol>
      </DocSection>

      <DocSection id="whats-next" title="What's Next">
        <p className="text-gray-300 leading-relaxed mb-4">
          Now that you have an account and your first agent, explore the rest of the platform:
        </p>
        <ul className="space-y-3 text-gray-300">
          <li>
            <Link to="/docs/agent-management" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              Agent Management
            </Link>{' '}
            -- Configure, enable/disable, and manage agent lifecycle
          </li>
          <li>
            <Link to="/docs/mcp-integration" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              MCP Integration
            </Link>{' '}
            -- Connect agents to external tools via Model Context Protocol
          </li>
          <li>
            <Link to="/docs/remote-agents" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              Remote Agent Tracking
            </Link>{' '}
            -- Track agents running on external servers via API
          </li>
          <li>
            <Link to="/docs/alerts" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              Alert Configuration
            </Link>{' '}
            -- Set up monitoring rules and get notified about issues
          </li>
          <li>
            <Link to="/docs/organizations" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              Organizations & Teams
            </Link>{' '}
            -- Invite team members and manage roles
          </li>
          <li>
            <Link to="/docs/api-reference" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              API Reference
            </Link>{' '}
            -- Full REST API documentation
          </li>
          <li>
            <Link to="/docs/websocket-events" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
              WebSocket Events
            </Link>{' '}
            -- Real-time event streaming reference
          </li>
        </ul>
      </DocSection>
    </div>
  );
}
