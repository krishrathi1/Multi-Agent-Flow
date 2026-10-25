import { Router } from 'express';
import {
  getRegisteredA2AAgents,
  sendA2AMessage,
  delegateA2ATask,
  getA2AMessageHistory,
} from '../services/a2a.service.js';

export const a2aRouter = Router();

/**
 * GET /api/a2a/v1/agents
 * Discovers all registered agents participating in the A2A network (ADK, CrewAI).
 */
a2aRouter.get('/v1/agents', (req, res) => {
  const agents = getRegisteredA2AAgents();
  res.json({
    protocolVersion: '1.0-a2a',
    totalAgents: agents.length,
    agents,
  });
});

/**
 * POST /api/a2a/v1/messages/send
 * Dispatches an A2A message between agents across framework boundaries.
 */
a2aRouter.post('/v1/messages/send', async (req, res) => {
  try {
    const { sender, recipient, intent, payload } = req.body;
    if (!sender || !recipient || !intent || !payload) {
      return res.status(400).json({
        error: 'Missing required A2A message fields: sender, recipient, intent, payload',
      });
    }

    const envelope = await sendA2AMessage({
      sender,
      recipient,
      intent,
      payload,
    });

    // Realtime notification
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('a2a:message:dispatched', envelope);

    res.status(201).json(envelope);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to dispatch A2A message' });
  }
});

/**
 * POST /api/a2a/v1/tasks/delegate
 * Cross-framework task delegation (ADK <-> CrewAI).
 */
a2aRouter.post('/v1/tasks/delegate', async (req, res) => {
  try {
    const { fromAgentId, toAgentId, taskDescription, contextData } = req.body;
    if (!taskDescription) {
      return res.status(400).json({ error: 'taskDescription is required' });
    }

    const result = await delegateA2ATask(
      fromAgentId || 'agent-adk-architect',
      toAgentId || 'agent-crewai-worker',
      taskDescription,
      contextData,
    );

    req.app.get('io')?.to(`org:${req.organizationId}`).emit('a2a:task:completed', result);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to delegate A2A task' });
  }
});

/**
 * GET /api/a2a/v1/messages/history
 * Returns the audit trail of all A2A messages.
 */
a2aRouter.get('/v1/messages/history', (req, res) => {
  const history = getA2AMessageHistory();
  res.json({
    protocolVersion: '1.0-a2a',
    totalMessages: history.length,
    messages: history,
  });
});
