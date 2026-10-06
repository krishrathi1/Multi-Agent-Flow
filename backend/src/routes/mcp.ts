import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import * as mcpService from '../services/mcp.service.js';

const router = Router({ mergeParams: true }); // mergeParams to access :agentId from parent

// Middleware: verify the agent belongs to the requesting user's org
async function verifyAgentOwnership(req: any, res: any, next: any) {
  const { agentId } = req.params;
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId: req.organizationId },
  });
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  next();
}

router.use(verifyAgentOwnership);

// GET /api/agents/:agentId/mcp-servers
router.get('/', async (req, res) => {
  const { agentId } = req.params as Record<string, string>;
  const servers = await mcpService.getMcpServers(agentId);
  res.json(servers);
});

// POST /api/agents/:agentId/mcp-servers
router.post('/', async (req, res) => {
  const { agentId } = req.params as Record<string, string>;
  const server = await mcpService.addMcpServer(agentId, req.body);
  res.status(201).json(server);
});

// PATCH /api/agents/:agentId/mcp-servers/:id
router.patch('/:id', async (req: any, res) => {
  try {
    const server = await mcpService.updateMcpServer(req.params.id, req.params.agentId, req.body);
    res.json(server);
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

// DELETE /api/agents/:agentId/mcp-servers/:id
router.delete('/:id', async (req: any, res) => {
  try {
    await mcpService.deleteMcpServer(req.params.id, req.params.agentId);
    res.status(204).end();
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

// POST /api/agents/:agentId/mcp-servers/:id/refresh-tools
router.post('/:id/refresh-tools', async (req: any, res) => {
  try {
    const tools = await mcpService.refreshMcpTools(req.params.id, req.params.agentId);
    res.json(tools);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

// GET /api/agents/:agentId/mcp-servers/:id/tools
router.get('/:id/tools', async (req: any, res) => {
  try {
    const tools = await mcpService.getMcpTools(req.params.id, req.params.agentId);
    res.json(tools);
  } catch (e: any) {
    return res.status(404).json({ error: e.message });
  }
});

export const orgMcpRouter = Router();

// GET /api/mcp
orgMcpRouter.get('/', async (req, res) => {
  const servers = await mcpService.getAllOrgMcpServers(req.organizationId!);
  res.json(servers);
});

// POST /api/mcp (Standalone / Individual MCP Server creation)
orgMcpRouter.post('/', async (req, res) => {
  const { agentId, name, url, transport } = req.body;
  try {
    let targetAgentId = agentId;
    if (!targetAgentId) {
      const defaultAgent = await prisma.agent.findFirst({
        where: { organizationId: req.organizationId! },
      });
      if (defaultAgent) {
        targetAgentId = defaultAgent.id;
      } else {
        const fallback = await prisma.agent.create({
          data: {
            organizationId: req.organizationId!,
            name: 'system-mcp-hub',
            displayName: 'Standalone MCP Hub',
            description: 'Host endpoint for standalone and workspace-wide MCP tools',
            avatar: '⚡',
          },
        });
        targetAgentId = fallback.id;
      }
    }
    const server = await mcpService.addMcpServer(targetAgentId, { name, url, transport });
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:created', server);
    res.status(201).json(server);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/mcp/:id/refresh
orgMcpRouter.post('/:id/refresh', async (req: any, res) => {
  const serverId = String(req.params.id);
  const server = await prisma.mcpServer.findFirst({
    where: { id: serverId, agent: { organizationId: req.organizationId! } },
  });
  if (!server) return res.status(404).json({ error: 'MCP server not found' });
  try {
    const tools = await mcpService.refreshMcpTools(server.id, server.agentId);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:updated', { id: server.id, tools, lastConnected: new Date().toISOString() });
    res.json(tools);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

// POST /api/mcp/:id/tools/:toolName/call (Direct Tool Execution)
orgMcpRouter.post('/:id/tools/:toolName/call', async (req: any, res) => {
  const serverId = String(req.params.id);
  const server = await prisma.mcpServer.findFirst({
    where: { id: serverId, agent: { organizationId: req.organizationId! } },
  });
  if (!server) return res.status(404).json({ error: 'MCP server not found' });

  const toolName = String(req.params.toolName);
  if (!toolName) return res.status(400).json({ error: 'Tool name is required for execution' });

  const args = req.body.arguments || req.body.args || {};
  try {
    const output = await mcpService.callMcpTool(server.id, toolName, args);
    res.json(output);
  } catch (error: any) {
    res.status(502).json({ error: error.message });
  }
});

// PATCH /api/mcp/:id (Update or toggle enabled)
orgMcpRouter.patch('/:id', async (req: any, res) => {
  const serverId = String(req.params.id);
  const server = await prisma.mcpServer.findFirst({
    where: { id: serverId, agent: { organizationId: req.organizationId! } },
  });
  if (!server) return res.status(404).json({ error: 'MCP server not found' });
  try {
    const updated = await mcpService.updateMcpServer(server.id, server.agentId, req.body);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:updated', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE /api/mcp/:id (Delete MCP Server)
orgMcpRouter.delete('/:id', async (req: any, res) => {
  const serverId = String(req.params.id);
  const server = await prisma.mcpServer.findFirst({
    where: { id: serverId, agent: { organizationId: req.organizationId! } },
  });
  if (!server) return res.status(404).json({ error: 'MCP server not found' });
  try {
    await mcpService.deleteMcpServer(server.id, server.agentId);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('mcp:deleted', { id: server.id });
    res.status(204).end();
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
