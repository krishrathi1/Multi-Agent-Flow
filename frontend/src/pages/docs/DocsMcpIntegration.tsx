import { DocSection } from './components/DocSection';
import { CodeBlock } from './components/CodeBlock';
import { EndpointBlock } from './components/EndpointBlock';
import { SEO } from '../../components/SEO';

export function DocsMcpIntegration() {
  return (
    <div>
      <SEO
        title="MCP Integration — Connect AI Agent Tools to Nexus"
        description="Integrate Model Context Protocol (MCP) servers with your AI agents. Connect external tools, data sources, and APIs to autonomous agents using Nexus by Blostem."
        canonical="https://nexus.blostem.com/docs/mcp-integration"
        keywords="MCP integration, Model Context Protocol, AI agent tools, AI agent data sources, tool binding, Nexus AI platform, Blostem"
      />
      <h1 className="text-4xl font-bold text-white mb-2">MCP Integration</h1>
      <p className="text-gray-400 text-lg mb-10">
        Connect your agents to external tools and data sources using Model Context Protocol.
      </p>

      <DocSection id="what-is-mcp" title="What is MCP?">
        <p className="text-gray-300 leading-relaxed mb-4">
          Model Context Protocol (MCP) is an open standard for connecting AI models to external
          tools and data sources. It provides a structured way for agents to discover and invoke
          tools hosted on external servers.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Nexus supports two MCP transport methods:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
          <li><strong className="text-white">SSE (Server-Sent Events)</strong> -- For streaming connections with real-time updates</li>
          <li><strong className="text-white">Streamable HTTP</strong> -- For standard HTTP-based MCP servers</li>
        </ul>
        <p className="text-gray-300 leading-relaxed mb-4">
          By connecting MCP servers to your agents, you give them access to capabilities like
          file systems, databases, web search, code execution, and any custom tools you build.
        </p>
      </DocSection>

      <DocSection id="adding-an-mcp-server" title="Adding an MCP Server">
        <p className="text-gray-300 leading-relaxed mb-4">
          To add an MCP server to an agent:
        </p>
        <ol className="list-decimal list-inside space-y-3 text-gray-300 mb-4">
          <li>Navigate to the agent's edit page (click the agent, then click <strong className="text-white">Edit</strong>).</li>
          <li>Scroll down to the <strong className="text-white">MCP Servers</strong> panel.</li>
          <li>Click <strong className="text-white">Add Server</strong>.</li>
          <li>Fill in the server details:
            <ul className="list-disc list-inside ml-6 mt-2 space-y-1 text-gray-400">
              <li><strong className="text-gray-300">Name</strong> -- A descriptive name (e.g., "File System Tools")</li>
              <li><strong className="text-gray-300">URL</strong> -- The MCP server endpoint (e.g., <code className="text-sm bg-surface-900 px-1.5 py-0.5 rounded">http://localhost:3001/mcp</code>)</li>
              <li><strong className="text-gray-300">Transport</strong> -- SSE or STREAMABLE_HTTP</li>
            </ul>
          </li>
          <li>Click <strong className="text-white">Save</strong>.</li>
        </ol>
        <CodeBlock
          title="Add MCP Server via API"
          language="bash"
          code={`curl -X POST https://your-nexus/api/agents/:agentId/mcp-servers \\
  -H "Authorization: Bearer <token>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "File System Tools",
    "url": "http://localhost:3001/mcp",
    "transport": "STREAMABLE_HTTP"
  }'`}
        />
      </DocSection>

      <DocSection id="discovering-tools" title="Discovering Tools">
        <p className="text-gray-300 leading-relaxed mb-4">
          Once an MCP server is added, you need to discover its available tools. Click the{' '}
          <strong className="text-white">Refresh Tools</strong> button next to the server entry.
        </p>
        <p className="text-gray-300 leading-relaxed mb-4">
          Nexus connects to the MCP server, queries its tool catalog, and caches the results.
          Each discovered tool shows:
        </p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 mb-4">
          <li><strong className="text-white">Name</strong> -- The tool's identifier (e.g., <code className="text-sm bg-surface-900 px-1.5 py-0.5 rounded">read_file</code>)</li>
          <li><strong className="text-white">Description</strong> -- What the tool does</li>
          <li><strong className="text-white">Input Schema</strong> -- The JSON schema describing the tool's parameters</li>
        </ul>
        <div className="bg-nexus-500/5 border border-nexus-500/20 rounded-lg p-4 text-sm text-gray-300 mb-4">
          Tool discovery results are cached in Nexus. If the MCP server adds or removes tools,
          click Refresh Tools again to update the cache.
        </div>
      </DocSection>

      <DocSection id="mcp-api-reference" title="API Reference">
        <EndpointBlock
          method="GET"
          path="/api/agents/:agentId/mcp-servers"
          description="List all MCP servers configured for an agent."
          auth="JWT"
          response={`[
  {
    "id": "clx...",
    "name": "File System Tools",
    "url": "http://localhost:3001/mcp",
    "transport": "STREAMABLE_HTTP",
    "toolCount": 5,
    "lastRefreshed": "2025-01-15T10:00:00Z"
  }
]`}
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
        "path": { "type": "string", "description": "File path to read" }
      },
      "required": ["path"]
    }
  }
]`}
        />

        <EndpointBlock
          method="DELETE"
          path="/api/agents/:agentId/mcp-servers/:id"
          description="Remove an MCP server and all its cached tools from the agent."
          auth="JWT"
        />
      </DocSection>

      <DocSection id="supported-transports" title="Supported Transports">
        <div className="space-y-4">
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">SSE (Server-Sent Events)</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Uses a persistent HTTP connection for real-time streaming communication between
              Nexus and the MCP server. Best suited for tools that produce incremental output
              or require long-lived connections.
            </p>
          </div>
          <div className="bg-surface-850 border border-white/5 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-2">Streamable HTTP</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              Uses standard HTTP requests for communication. Each tool invocation is a separate
              HTTP request/response cycle. This is the simpler and more commonly supported transport,
              suitable for most MCP server implementations.
            </p>
          </div>
        </div>
      </DocSection>
    </div>
  );
}
