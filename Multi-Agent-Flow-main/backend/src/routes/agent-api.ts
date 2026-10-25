import { Router } from 'express';
import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import * as activityService from '../services/activity.service.js';
import * as approvalService from '../services/approval.service.js';

const router = Router();

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Middleware: authenticate agent via X-Agent-Token header
async function requireAgentToken(req: any, res: any, next: any) {
  const token = req.headers['x-agent-token'] as string;
  if (!token) return res.status(401).json({ error: 'X-Agent-Token header required' });

  const hash = hashToken(token);
  const agent = await prisma.agent.findUnique({
    where: { agentTokenHash: hash },
    select: { id: true, organizationId: true, name: true, displayName: true, boardId: true },
  });
  if (!agent) return res.status(401).json({ error: 'Invalid agent token' });

  req.agentId = agent.id;
  req.organizationId = agent.organizationId;
  req.agentName = agent.displayName;
  req.agentBoardId = agent.boardId;
  next();
}

router.use(requireAgentToken);

// Generate a new token for an agent (called by admin, not agent)
// This is a special admin endpoint - moved outside the agent-auth middleware
// We'll keep the token generation in a separate route below

// Agent reports its status
router.post('/status', async (req: any, res) => {
  const { status, currentTask, message } = req.body;
  await prisma.agent.update({
    where: { id: req.agentId },
    data: {
      status: status || 'ONLINE',
      currentTask: currentTask || null,
      lastHeartbeat: new Date(),
    },
  });

  if (message) {
    await activityService.createActivity(req.organizationId, {
      agentId: req.agentId,
      type: 'SYSTEM',
      message,
    });
  }

  res.json({ ok: true });
});

// Agent sends a heartbeat (rate-limited to prevent CPU waste)
const agentApiRateLimit = new Map<string, number>();
const AGENT_API_RATE_LIMIT_MS = 5 * 1000; // 5 seconds

router.post('/heartbeat', async (req: any, res) => {
  const now = Date.now();
  const lastPing = agentApiRateLimit.get(req.agentId);
  if (lastPing && now - lastPing < AGENT_API_RATE_LIMIT_MS) {
    return res.status(429).json({ error: 'Too many heartbeats', retryAfterMs: AGENT_API_RATE_LIMIT_MS - (now - lastPing) });
  }
  agentApiRateLimit.set(req.agentId, now);

  await prisma.agent.update({
    where: { id: req.agentId },
    data: { lastHeartbeat: new Date(), status: 'ONLINE' },
  });
  res.json({ ok: true });
});

// Agent logs activity
router.post('/activity', async (req: any, res) => {
  const { type, message, metadata } = req.body;
  const activity = await activityService.createActivity(req.organizationId, {
    agentId: req.agentId,
    type: type || 'INFO',
    message: message || `Activity from ${req.agentName}`,
    metadata,
  });
  res.json(activity);
});

// Agent requests approval
router.post('/approvals', async (req: any, res) => {
  const { actionType, payload, confidence, taskId } = req.body;
  if (!actionType) return res.status(400).json({ error: 'actionType is required' });
  if (!req.agentBoardId) return res.status(400).json({ error: 'Agent is not assigned to a board' });

  const approval = await approvalService.createApproval(req.organizationId, {
    boardId: req.agentBoardId,
    agentId: req.agentId,
    taskId,
    actionType,
    payload,
    confidence,
  });

  req.app.get('io')?.to(`org:${req.organizationId}`).emit('approval:created', approval);
  res.status(201).json(approval);
});

// Agent checks its pending approvals
router.get('/approvals', async (req: any, res) => {
  if (!req.agentBoardId) return res.json([]);
  const approvals = await prisma.approval.findMany({
    where: { agentId: req.agentId, status: 'PENDING', board: { organizationId: req.organizationId } },
    orderBy: { createdAt: 'desc' },
    include: {
      board: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });
  res.json(approvals);
});

export default router;

// Standalone function to generate agent token (used by admin routes)
// Caller must verify agent ownership before calling this
export async function generateAgentToken(agentId: string): Promise<string> {
  const token = `nxat_${randomBytes(32).toString('hex')}`;
  const hash = hashToken(token);
  await prisma.agent.update({
    where: { id: agentId },
    data: { agentTokenHash: hash },
  });
  return token;
}
