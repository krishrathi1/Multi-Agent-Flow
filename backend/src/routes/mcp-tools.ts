import { Router } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { createToolServer, verifyToolToken, toolsEnabled, SERVERS, type ServerName } from '../mcp/builtin-servers.js';
import { workspaceFor } from '../services/agent-runner.service.js';

/**
 * Streamable HTTP endpoint for the built-in MCP tool servers:
 *   POST /api/mcp-tools/research
 *   POST /api/mcp-tools/analytics
 *
 * Authenticated by a tool token (Bearer) issued for one production and run,
 * not by a login session — agent processes call it. Stateless: each request
 * gets its own server and transport.
 */
const router = Router();

const rpcError = (code: number, message: string) => ({ jsonrpc: '2.0', error: { code, message }, id: null });

router.post('/:server', async (req, res) => {
  if (!toolsEnabled()) return res.status(503).json(rpcError(-32000, 'MCP tools are disabled on this server'));
  const server = req.params.server as ServerName;
  if (!SERVERS.includes(server)) return res.status(404).json(rpcError(-32601, `No tool server "${req.params.server}"`));

  const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? '')?.[1];
  let claims;
  try {
    if (!bearer) throw new Error('missing token');
    claims = verifyToolToken(bearer);
  } catch {
    return res.status(401).json(rpcError(-32001, 'A valid tool token is required'));
  }
  // A token for a production that has since been deleted stops working.
  const process = await prisma.process.findFirst({ where: { id: claims.processId, organizationId: claims.organizationId }, select: { id: true } });
  if (!process) return res.status(404).json(rpcError(-32002, 'Production not found'));

  const mcp = createToolServer(server, { ...claims, workspace: workspaceFor(claims.processId) });
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  res.on('close', () => {
    transport.close().catch(() => {});
    mcp.close().catch(() => {});
  });
  try {
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    logger.warn({ err, server }, 'MCP tool request failed');
    if (!res.headersSent) res.status(500).json(rpcError(-32603, 'Internal error'));
  }
});

// Stateless server: no SSE stream to resume and no session to end.
router.get('/:server', (_req, res) => res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Method not allowed')));
router.delete('/:server', (_req, res) => res.status(405).set('Allow', 'POST').json(rpcError(-32000, 'Method not allowed')));

export default router;
