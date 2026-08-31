import { prisma } from '../lib/prisma.js';
import { validateExternalUrl } from '../lib/url-validator.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import type { McpTransport } from '@prisma/client';
const tracer = trace.getTracer('nexus-mcp');

export async function getMcpServers(agentId: string) {
  return prisma.mcpServer.findMany({
    where: { agentId },
    include: { tools: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function addMcpServer(agentId: string, data: {
  name: string;
  url: string;
  transport?: McpTransport;
}) {
  return tracer.startActiveSpan('mcp.addServer', async (span) => {
    try {
      span.setAttribute('agent.id', agentId);
      span.setAttribute('mcp.name', data.name);
      span.setAttribute('mcp.transport', data.transport || 'SSE');
      // SSRF protection: validate the MCP server URL
      validateExternalUrl(data.url, 'MCP server URL');

      const server = await prisma.mcpServer.create({
        data: {
          agentId,
          name: data.name,
          url: data.url,
          transport: data.transport || 'SSE',
        },
        include: { tools: true },
      });
      logger.info({ mcpServerId: server.id, agentId, name: data.name }, 'MCP server added');
      return server;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function updateMcpServer(id: string, agentId: string, data: {
  name?: string;
  url?: string;
  transport?: McpTransport;
  enabled?: boolean;
}) {
  // Verify MCP server belongs to the specified agent (prevents IDOR)
  const server = await prisma.mcpServer.findFirst({
    where: { id, agentId },
  });
  if (!server) throw new Error('MCP server not found for this agent');

  // SSRF protection: validate URL if being updated
  if (data.url) validateExternalUrl(data.url, 'MCP server URL');

  return prisma.mcpServer.update({
    where: { id },
    data,
    include: { tools: true },
  });
}

export async function deleteMcpServer(id: string, agentId: string) {
  return tracer.startActiveSpan('mcp.deleteServer', async (span) => {
    try {
      span.setAttribute('mcp.id', id);
      span.setAttribute('agent.id', agentId);
      // Verify MCP server belongs to the specified agent (prevents IDOR)
      const server = await prisma.mcpServer.findFirst({
        where: { id, agentId },
      });
      if (!server) throw new Error('MCP server not found for this agent');

      const result = await prisma.mcpServer.delete({ where: { id } });
      logger.info({ mcpServerId: id, agentId }, 'MCP server deleted');
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getMcpTools(serverId: string, agentId: string) {
  // Verify MCP server belongs to the specified agent
  const server = await prisma.mcpServer.findFirst({
    where: { id: serverId, agentId },
  });
  if (!server) throw new Error('MCP server not found for this agent');

  return prisma.mcpTool.findMany({
    where: { mcpServerId: serverId },
    orderBy: { name: 'asc' },
  });
}

export async function refreshMcpTools(serverId: string, agentId: string) {
  return tracer.startActiveSpan('mcp.refreshTools', async (span) => {
    try {
      span.setAttribute('mcp.serverId', serverId);
      span.setAttribute('agent.id', agentId);
      const server = await prisma.mcpServer.findFirst({ where: { id: serverId, agentId } });
      if (!server) throw new Error('MCP server not found');

      // Try to connect to the MCP server and list tools
      // Use the MCP SDK for proper protocol handling
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js');
      const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');

      let transport;
      if (server.transport === 'SSE') {
        transport = new SSEClientTransport(new URL(server.url));
      } else {
        transport = new StreamableHTTPClientTransport(new URL(server.url));
      }

      const client = new Client({ name: 'nexus-dashboard', version: '1.0.0' });
      await client.connect(transport);

      const result = await client.listTools();

      // Upsert tools
      const tools = [];
      for (const tool of result.tools) {
        const upserted = await prisma.mcpTool.upsert({
          where: { mcpServerId_name: { mcpServerId: serverId, name: tool.name } },
          create: {
            mcpServerId: serverId,
            name: tool.name,
            description: tool.description || null,
            inputSchema: tool.inputSchema as any || null,
          },
          update: {
            description: tool.description || null,
            inputSchema: tool.inputSchema as any || null,
          },
        });
        tools.push(upserted);
      }

      // Remove tools that no longer exist on the server
      const toolNames = result.tools.map(t => t.name);
      await prisma.mcpTool.deleteMany({
        where: { mcpServerId: serverId, name: { notIn: toolNames } },
      });

      // Update lastConnected
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: { lastConnected: new Date() },
      });

      await client.close();

      logger.info({ mcpServerId: serverId, toolCount: tools.length }, 'MCP tools refreshed');
      return tools;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
