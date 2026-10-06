import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { SEO } from '../../components/SEO';

export function DocsWebSocketEvents() {
  return (
    <div>
      <SEO
        title="WebSocket Events — Real-time AI Agent Communication"
        description="Build live dashboards and integrations with real-time WebSocket event streaming from AI agents. Stream agent status, task updates, and board events with MyceliumOps by Blostem."
        canonical="/docs/websocket-events"
        keywords="AI agent WebSocket, real-time agent events, live AI dashboard, agent event streaming, real-time AI communication, Blostem AI"
      />
      <h1 className="text-4xl font-bold text-white mb-2">WebSocket Events</h1>
      <p className="text-gray-400 text-lg mb-10">
        Real-time event streaming for building live dashboards and integrations.
      </p>

      <DocSection id="connecting" title="Connecting">
        <p className="text-gray-300 leading-relaxed mb-4">
          MyceliumOps uses Socket.IO for real-time communication. Connect by providing your JWT token
          in the auth object. After connecting, you are automatically joined to your organization's
          room and will receive all events for your organization.
        </p>
        <CodeBlock
          title="Connect to WebSocket"
          language="javascript"
          code={`import { io } from "socket.io-client";

const socket = io("https://your-myceliumops", {
  auth: { token: "your_jwt_token" }
});

socket.on("connect", () => {
  console.log("Connected to MyceliumOps WebSocket");
});

socket.on("connect_error", (err) => {
  console.error("Connection failed:", err.message);
});`}
        />
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          The JWT token is validated on connection. If the token is expired or invalid, the connection
          will be rejected with a <code className="bg-surface-900 px-1.5 py-0.5 rounded">connect_error</code> event.
        </div>
      </DocSection>

      <DocSection id="agent-events" title="Agent Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          Agent events are emitted when agents are created, updated, or change status.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:created</td>
              <td className="py-2">A new agent has been registered</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:updated</td>
              <td className="py-2">Agent properties have been changed</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:status</td>
              <td className="py-2">Agent status changed (ONLINE, IDLE, OFFLINE, ERROR)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:heartbeat</td>
              <td className="py-2">A heartbeat was received from the agent</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:config</td>
              <td className="py-2">Agent configuration was updated</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">agent:deleted</td>
              <td className="py-2">An agent was permanently removed</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Agent Event Payloads"
          language="typescript"
          code={`// agent:created / agent:updated
{
  id: string;
  displayName: string;
  name: string;
  status: "ONLINE" | "IDLE" | "OFFLINE" | "ERROR";
  enabled: boolean;
  // ... all agent fields
}

// agent:status
{
  agentId: string;
  status: "ONLINE" | "IDLE" | "OFFLINE" | "ERROR";
  lastHeartbeat: string; // ISO timestamp
}

// agent:heartbeat
{
  agentId: string;
  timestamp: string;
  message?: string;
}

// agent:deleted
{
  agentId: string;
}`}
        />
      </DocSection>

      <DocSection id="activity-events" title="Activity Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          Activity events are emitted when new activities are logged for any agent in your organization.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">activity:new</td>
              <td className="py-2">A new activity was logged</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Activity Event Payload"
          language="typescript"
          code={`// activity:new
{
  id: string;
  agentId: string;
  type: "HEARTBEAT" | "TASK_START" | "TASK_COMPLETE" | "ERROR" |
        "MESSAGE" | "DELEGATION" | "ALERT" | "SYSTEM";
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}`}
        />
      </DocSection>

      <DocSection id="task-events" title="Task Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          Task events are emitted when tasks on the Kanban board are created, updated, or deleted.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">task:update</td>
              <td className="py-2">A task was created or updated</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">task:delete</td>
              <td className="py-2">A task was removed</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Task Event Payloads"
          language="typescript"
          code={`// task:update
{
  id: string;
  title: string;
  description?: string;
  status: "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  assignedAgentId?: string;
  // ... all task fields
}

// task:delete
{
  taskId: string;
}`}
        />
      </DocSection>

      <DocSection id="alert-events" title="Alert Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          Alert events keep you informed about changes to alert rules and when alerts fire.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">alert:rule:created</td>
              <td className="py-2">A new alert rule was created</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">alert:rule:updated</td>
              <td className="py-2">An alert rule was modified</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">alert:new</td>
              <td className="py-2">A new alert event was triggered</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">alert:event:acknowledged</td>
              <td className="py-2">An alert event was acknowledged</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Alert Event Payloads"
          language="typescript"
          code={`// alert:new
{
  id: string;
  ruleId: string;
  ruleName: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  agentId?: string;
  createdAt: string;
}

// alert:event:acknowledged
{
  eventId: string;
  acknowledgedBy: string;
  acknowledgedAt: string;
}`}
        />
      </DocSection>

      <DocSection id="command-events" title="Command Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          Command events are emitted when new commands are sent to agents.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Event</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm text-nexus-400">command:sent</td>
              <td className="py-2">A new command was issued to an agent</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Command Event Payload"
          language="typescript"
          code={`// command:sent
{
  id: string;
  agentId: string;
  command: string;
  createdAt: string;
}`}
        />
      </DocSection>

      <DocSection id="example-live-dashboard" title="Example: Live Dashboard">
        <p className="text-gray-300 leading-relaxed mb-4">
          Here is a complete example showing how to build a simple live dashboard using MyceliumOps
          WebSocket events. This pattern mirrors what the MyceliumOps frontend itself uses.
        </p>
        <CodeBlock
          title="Live Dashboard Integration"
          language="javascript"
          code={`import { io } from "socket.io-client";

const socket = io("https://your-myceliumops", {
  auth: { token: "your_jwt_token" }
});

// Track agent status changes
socket.on("agent:status", (data) => {
  updateAgentStatus(data.agentId, data.status);
});

// Live activity feed
socket.on("activity:new", (activity) => {
  addToFeed(activity);
});

// Real-time alert notifications
socket.on("alert:new", (alert) => {
  showNotification(alert.message, alert.severity);
});

// Task board updates
socket.on("task:update", (task) => {
  updateKanbanCard(task);
});

socket.on("task:delete", (data) => {
  removeKanbanCard(data.taskId);
});

// Agent lifecycle
socket.on("agent:created", (agent) => {
  addAgentCard(agent);
});

socket.on("agent:deleted", (data) => {
  removeAgentCard(data.agentId);
});

// Cleanup on disconnect
socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
  showReconnectingBanner();
});`}
        />
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          Socket.IO automatically handles reconnection. When the connection drops, the client will
          attempt to reconnect with exponential backoff. All missed events during the disconnect
          period should be recovered by re-fetching data from the REST API on reconnect.
        </div>
      </DocSection>
    </div>
  );
}
