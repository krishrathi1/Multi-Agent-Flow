import { Router } from 'express';
import {
  postToBlackboard,
  getBlackboardState,
  seedSampleBlackboard,
  clearBlackboard,
  compareMessagingArchitectures,
} from '../services/blackboard.service.js';

export const blackboardRouter = Router();

/**
 * GET /api/blackboard/compare
 * Evaluates Blackboard Architecture vs Peer-to-Peer messaging.
 */
blackboardRouter.get('/compare', (req, res) => {
  const agentCount = req.query.agentCount ? parseInt(req.query.agentCount as string, 10) : 5;
  const comparison = compareMessagingArchitectures(isNaN(agentCount) ? 5 : agentCount);
  res.json(comparison);
});

/**
 * GET /api/blackboard/:scopeId
 * Retrieves all entries in the Blackboard for a given scope (process, board, or session).
 */
blackboardRouter.get('/:scopeId', (req, res) => {
  const { scopeId } = req.params;
  let entries = getBlackboardState(scopeId);
  if (entries.length === 0 && req.query.seed === 'true') {
    entries = seedSampleBlackboard(scopeId);
  }
  res.json({
    scopeId,
    totalEntries: entries.length,
    entries,
  });
});

/**
 * POST /api/blackboard/:scopeId/entry
 * Adds an intermediate output, fact, hypothesis or artifact to the Blackboard.
 */
blackboardRouter.post('/:scopeId/entry', async (req, res) => {
  try {
    const { scopeId } = req.params;
    const { authorAgentId, authorAgentName, stage, category, key, value, tags } = req.body;

    if (!key || !category) {
      return res.status(400).json({ error: 'Key and category are required' });
    }

    const entry = await postToBlackboard(scopeId, {
      scopeId,
      authorAgentId: authorAgentId || 'anonymous-agent',
      authorAgentName: authorAgentName || 'Agent',
      stage: typeof stage === 'number' ? stage : 1,
      category: category || 'INTERMEDIATE_OUTPUT',
      key,
      value: value || {},
      tags: Array.isArray(tags) ? tags : [],
    });

    // Notify realtime listeners
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('blackboard:entry:created', { scopeId, entry });

    res.status(201).json(entry);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to post to blackboard' });
  }
});

/**
 * POST /api/blackboard/:scopeId/seed
 * Populates sample Blackboard context for demonstration and testing.
 */
blackboardRouter.post('/:scopeId/seed', (req, res) => {
  const { scopeId } = req.params;
  const entries = seedSampleBlackboard(scopeId);
  res.json({
    message: 'Blackboard seeded successfully',
    scopeId,
    entriesCount: entries.length,
    entries,
  });
});

/**
 * DELETE /api/blackboard/:scopeId
 * Clears the Blackboard state for a scope.
 */
blackboardRouter.delete('/:scopeId', (req, res) => {
  const { scopeId } = req.params;
  clearBlackboard(scopeId);
  res.json({ message: 'Blackboard cleared', scopeId });
});
