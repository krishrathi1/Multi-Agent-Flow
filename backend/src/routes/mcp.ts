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

export default router;
