import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { EndpointBlock } from './components/EndpointBlock';
import { SEO } from '../../components/SEO';

export function DocsRemoteAgents() {
  return (
    <div>
      <SEO
        title="Remote AI Agent Tracking — Monitor Agents Anywhere"
        description="Monitor AI agents running on external servers with heartbeats, activities, and metrics via REST API. Track distributed autonomous agents across infrastructure with MyceliumOps by Blostem."
        canonical="/docs/remote-agents"
        keywords="remote AI agent monitoring, distributed agent tracking, AI agent heartbeat, agent metrics, autonomous agent monitoring, Blostem AI"
      />
      <h1 className="text-4xl font-bold text-white mb-2">Remote Agent Tracking</h1>
      <p className="text-gray-400 text-lg mb-10">
        Monitor agents running on external servers by sending heartbeats, activities, and metrics via the REST API.
      </p>

      <DocSection id="overview" title="Overview">
        <p className="text-gray-300 leading-relaxed mb-4">
          Remote agent tracking lets you monitor AI agents that run outside of MyceliumOps -- on your
          own servers, in cloud functions, or on edge devices. Instead of managing these agents
          directly, you instrument them to report their status back to MyceliumOps.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          The process is straightforward: your agent sends HTTP requests to the MyceliumOps remote API,
          and MyceliumOps handles status tracking, activity logging, metrics aggregation, and alerting.
          Agents are automatically registered the first time they send a heartbeat.
        </p>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          All remote API endpoints use <strong className="text-white">API Key</strong> authentication
          via the <code className="bg-surface-900 px-1.5 py-0.5 rounded">X-API-Key</code> header,
          not JWT tokens.
        </div>
      </DocSection>

      <DocSection id="setting-up-api-keys" title="Setting Up API Keys">
        <p className="text-gray-300 leading-relaxed mb-4">
          Before you can send data from remote agents, you need to generate an API key.
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>Navigate to <strong className="text-white">Settings</strong> from the sidebar.</li>
          <li>Click the <strong className="text-white">API Keys</strong> tab.</li>
          <li>Click <strong className="text-white">Generate Key</strong>.</li>
          <li>Give the key a descriptive name (e.g., "Production Server Agent Key").</li>
          <li>Copy the key immediately -- it is only shown once.</li>
        </ol>
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          <strong className="text-amber-400">Important:</strong> API keys are hashed before storage
          and cannot be retrieved after creation. If you lose a key, you will need to generate a
          new one.
        </div>
        <p className="text-gray-300 leading-relaxed mb-4">
          Use the key in all remote API requests via the <code className="text-sm bg-surface-900 px-1.5 py-0.5 rounded">X-API-Key</code> header:
        </p>
        <CodeBlock
          code={`X-API-Key: nxk_your_key_here`}
          language="http"
          title="Header"
        />
      </DocSection>

      <DocSection id="sending-heartbeats" title="Sending Heartbeats">
        <p className="text-gray-300 leading-relaxed mb-4">
          Heartbeats are the core of remote agent tracking. They tell Nexus that your agent is
          alive and report its current status. If an agent doesn't exist yet, the first heartbeat
          automatically creates it.
        </p>
        <CodeBlock
          title="Send a Heartbeat"
          language="bash"
          code={`curl -X POST https://your-nexus/api/remote/heartbeat \\
  -H "X-API-Key: nxk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "my-remote-agent",
    "status": "ONLINE",
    "message": "Agent is healthy"
  }'`}
        />
        <p className="text-gray-300 leading-relaxed mb-4">
          This creates the agent if it does not exist, updates its status to ONLINE, and records
          the heartbeat timestamp. Send heartbeats at regular intervals (every 30 seconds is
          recommended) to keep the agent's status accurate.
        </p>
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Field</th>
              <th className="pb-2 pr-4">Required</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">agentName</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Unique identifier for the agent (used as slug)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">status</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">ONLINE, IDLE, OFFLINE, or ERROR (defaults to ONLINE)</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">message</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Optional status message</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection id="logging-activities" title="Logging Activities">
        <p className="text-gray-300 leading-relaxed mb-4">
          Activities are structured log entries that describe what your agent is doing. They appear
          in the MyceliumOps activity feed and can be searched and filtered.
        </p>
        <CodeBlock
          title="Log an Activity"
          language="bash"
          code={`curl -X POST https://your-myceliumops/api/remote/activity \\
  -H "X-API-Key: nxk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "my-remote-agent",
    "type": "TASK_COMPLETE",
    "message": "Finished processing batch #42",
    "metadata": {"batchSize": 1000, "duration": 45}
  }'`}
        />
        <p className="text-gray-300 leading-relaxed mb-4">
          The following activity types are supported:
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          {[
            { type: 'HEARTBEAT', color: 'text-blue-400' },
            { type: 'TASK_START', color: 'text-violet-400' },
            { type: 'TASK_COMPLETE', color: 'text-emerald-400' },
            { type: 'ERROR', color: 'text-red-400' },
            { type: 'MESSAGE', color: 'text-sky-400' },
            { type: 'DELEGATION', color: 'text-amber-400' },
            { type: 'ALERT', color: 'text-orange-400' },
            { type: 'SYSTEM', color: 'text-gray-400' },
          ].map(({ type, color }) => (
            <div key={type} className="bg-surface-850 border border-white/5 rounded px-3 py-2">
              <span className={`font-mono text-xs ${color}`}>{type}</span>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="reporting-metrics" title="Reporting Metrics">
        <p className="text-gray-300 leading-relaxed mb-4">
          Metrics track performance and cost data for individual agent operations. This data
          feeds into the MyceliumOps metrics dashboard for analysis and trend tracking.
        </p>
        <CodeBlock
          title="Report Metrics"
          language="bash"
          code={`curl -X POST https://your-myceliumops/api/remote/metrics \\
  -H "X-API-Key: nxk_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agentName": "my-remote-agent",
    "responseTimeMs": 1250,
    "success": true,
    "toolName": "web-search",
    "inputTokens": 500,
    "outputTokens": 200,
    "model": "gpt-4o"
  }'`}
        />
        <table className="w-full text-sm mb-4">
          <thead className="text-left text-gray-400">
            <tr className="border-b border-white/5">
              <th className="pb-2 pr-4">Field</th>
              <th className="pb-2 pr-4">Required</th>
              <th className="pb-2">Description</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">agentName</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Agent identifier</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">responseTimeMs</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Operation response time in milliseconds</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">success</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Whether the operation succeeded</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">toolName</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Name of the tool that was invoked</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">inputTokens</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Number of input tokens consumed</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">outputTokens</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Number of output tokens generated</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">model</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">LLM model identifier</td>
            </tr>
          </tbody>
        </table>
      </DocSection>

      <DocSection id="python-example" title="Python Example">
        <p className="text-gray-300 leading-relaxed mb-4">
          Here is a minimal Python script that sends periodic heartbeats from a remote agent.
          You can use this as a starting point for integrating MyceliumOps tracking into your own agents.
        </p>
        <CodeBlock
          title="heartbeat_agent.py"
          language="python"
          code={`import requests
import time

API_KEY = "nxk_your_key_here"
BASE_URL = "https://your-myceliumops/api/remote"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

while True:
    requests.post(f"{BASE_URL}/heartbeat", headers=HEADERS, json={
        "agentName": "python-agent",
        "message": "Running smoothly"
    })
    time.sleep(30)`}
        />
        <p className="text-gray-300 leading-relaxed mb-4">
          You can extend this pattern to also report activities and metrics whenever your agent
          performs significant operations:
        </p>
        <CodeBlock
          title="Extended example with activities and metrics"
          language="python"
          code={`import requests
import time

API_KEY = "nxk_your_key_here"
BASE_URL = "https://your-nexus/api/remote"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

def report_activity(agent_name, activity_type, message, metadata=None):
    payload = {
        "agentName": agent_name,
        "type": activity_type,
        "message": message,
    }
    if metadata:
        payload["metadata"] = metadata
    requests.post(f"{BASE_URL}/activity", headers=HEADERS, json=payload)

def report_metrics(agent_name, **kwargs):
    payload = {"agentName": agent_name, **kwargs}
    requests.post(f"{BASE_URL}/metrics", headers=HEADERS, json=payload)

# Example usage
report_activity("python-agent", "TASK_START", "Processing batch #42")

start = time.time()
# ... do work ...
duration = (time.time() - start) * 1000

report_metrics("python-agent", responseTimeMs=duration, success=True)
report_activity("python-agent", "TASK_COMPLETE", "Batch #42 complete")`}
        />
      </DocSection>

      <DocSection id="remote-api-reference" title="API Reference">
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
  "message": "Finished processing",
  "metadata": {}
}`}
        />

        <EndpointBlock
          method="POST"
          path="/api/remote/metrics"
          description="Report performance and token usage metrics for a remote agent."
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
    </div>
  );
}
