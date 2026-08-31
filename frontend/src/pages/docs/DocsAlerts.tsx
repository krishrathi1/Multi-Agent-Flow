import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { EndpointBlock } from './components/EndpointBlock';
import { SEO } from '../../components/SEO';

export function DocsAlerts() {
  return (
    <div>
      <SEO
        title="AI Agent Alert Configuration — Nexus by Blostem"
        description="Set up monitoring rules and alerts for your AI agents. Detect issues in real-time with configurable thresholds, severity levels, and notifications in the Nexus AI agent platform."
        canonical="https://nexus.blostem.com/docs/alerts"
        keywords="AI agent alerts, agent monitoring, real-time alerts, AI agent notifications, autonomous agent monitoring, Blostem AI"
      />
      <h1 className="text-4xl font-bold text-white mb-2">Alert Configuration</h1>
      <p className="text-gray-400 text-lg mb-10">
        Set up monitoring rules to detect issues and get notified in real time.
      </p>

      <DocSection id="overview" title="Overview">
        <p className="text-gray-300 leading-relaxed mb-4">
          Nexus alerts let you define rules that monitor your agents and trigger notifications
          when conditions are met. Alert events appear in the dashboard in real time via WebSocket,
          giving you immediate visibility into problems.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          The alerting system has two main concepts:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
          <li><strong className="text-white">Alert Rules</strong> -- Define what conditions to monitor and when to trigger</li>
          <li><strong className="text-white">Alert Events</strong> -- Individual instances when a rule fires</li>
        </ul>
      </DocSection>

      <DocSection id="creating-alert-rules" title="Creating Alert Rules">
        <p className="text-gray-300 leading-relaxed mb-4">
          To create an alert rule, navigate to the <strong className="text-white">Alerts</strong> page
          from the sidebar and click <strong className="text-white">Create Rule</strong>.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Configure the following fields:
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
              <td className="py-2 pr-4 font-mono text-sm">name</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Human-readable rule name (e.g., "High Error Rate")</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">description</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Detailed description of what this rule monitors</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">condition</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Condition string (e.g., "error_rate &gt; 5%")</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">threshold</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Numeric threshold value for the condition</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">timeWindowMinutes</td>
              <td className="py-2 pr-4">Yes</td>
              <td className="py-2">Evaluation window in minutes</td>
            </tr>
            <tr className="border-b border-white/5">
              <td className="py-2 pr-4 font-mono text-sm">agentId</td>
              <td className="py-2 pr-4">No</td>
              <td className="py-2">Optional: scope the rule to a specific agent</td>
            </tr>
          </tbody>
        </table>

        <CodeBlock
          title="Create Alert Rule via API"
          language="bash"
          code={`curl -X POST https://your-nexus/api/alerts/rules \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "High Error Rate",
    "description": "Fires when error rate exceeds 5% in 10 minutes",
    "condition": "error_rate > 5%",
    "threshold": 5,
    "timeWindowMinutes": 10
  }'`}
        />
      </DocSection>

      <DocSection id="alert-events" title="Alert Events">
        <p className="text-gray-300 leading-relaxed mb-4">
          When a rule's condition is met, Nexus creates an alert event. Each event includes:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
          <li><strong className="text-white">Rule reference</strong> -- Which rule triggered the event</li>
          <li><strong className="text-white">Severity</strong> -- INFO, WARNING, or CRITICAL</li>
          <li><strong className="text-white">Message</strong> -- Human-readable description of what happened</li>
          <li><strong className="text-white">Timestamp</strong> -- When the event occurred</li>
          <li><strong className="text-white">Agent</strong> -- Which agent triggered the alert (if agent-scoped)</li>
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-surface-850 border border-blue-500/20 rounded-lg p-4">
            <span className="text-blue-400 font-semibold text-sm">INFO</span>
            <p className="text-gray-400 text-xs mt-1">Informational alerts for awareness. No immediate action needed.</p>
          </div>
          <div className="bg-surface-850 border border-amber-500/20 rounded-lg p-4">
            <span className="text-amber-400 font-semibold text-sm">WARNING</span>
            <p className="text-gray-400 text-xs mt-1">Something requires attention but is not critical.</p>
          </div>
          <div className="bg-surface-850 border border-red-500/20 rounded-lg p-4">
            <span className="text-red-400 font-semibold text-sm">CRITICAL</span>
            <p className="text-gray-400 text-xs mt-1">Immediate attention required. Service may be impacted.</p>
          </div>
        </div>

        <p className="text-gray-300 leading-relaxed mb-4">
          Alert events are also broadcast in real time via WebSocket. See the{' '}
          <a href="/docs/websocket-events" className="text-nexus-400 hover:text-nexus-300 underline underline-offset-2">
            WebSocket Events
          </a>{' '}
          documentation for details.
        </p>
      </DocSection>

      <DocSection id="acknowledging-alerts" title="Acknowledging Alerts">
        <p className="text-gray-300 leading-relaxed mb-4">
          When you have reviewed an alert event and taken any necessary action, you can acknowledge
          it to mark it as resolved. Click the <strong className="text-white">Acknowledge</strong> button
          on the alert event in the Alerts page.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Acknowledged alerts remain in the event history for audit purposes but are visually
          distinguished from unacknowledged ones.
        </p>
        <CodeBlock
          title="Acknowledge via API"
          language="bash"
          code={`curl -X POST https://your-nexus/api/alerts/events/:eventId/acknowledge \\
  -H "Authorization: Bearer <token>"`}
        />
      </DocSection>

      <DocSection id="alerts-api-reference" title="API Reference">
        <EndpointBlock
          method="GET"
          path="/api/alerts/rules"
          description="List all alert rules for your organization."
          auth="JWT"
          response={`[
  {
    "id": "clx...",
    "name": "High Error Rate",
    "condition": "error_rate > 5%",
    "threshold": 5,
    "timeWindowMinutes": 10,
    "enabled": true,
    "createdAt": "2025-01-15T10:00:00Z"
  }
]`}
        />

        <EndpointBlock
          method="POST"
          path="/api/alerts/rules"
          description="Create a new alert rule."
          auth="JWT"
          body={`{
  "name": "High Error Rate",
  "description": "Fires when error rate exceeds threshold",
  "condition": "error_rate > 5%",
  "threshold": 5,
  "timeWindowMinutes": 10,
  "agentId": "optional-agent-id"
}`}
        />

        <EndpointBlock
          method="PATCH"
          path="/api/alerts/rules/:id"
          description="Update an existing alert rule. All fields are optional."
          auth="JWT"
          body={`{
  "name": "Updated Rule Name",
  "threshold": 10,
  "enabled": false
}`}
        />

        <EndpointBlock
          method="GET"
          path="/api/alerts/events"
          description="List alert events, optionally filtered by rule or acknowledgement status."
          auth="JWT"
        />

        <EndpointBlock
          method="POST"
          path="/api/alerts/events/:id/acknowledge"
          description="Acknowledge an alert event, marking it as reviewed and resolved."
          auth="JWT"
        />
      </DocSection>
    </div>
  );
}
