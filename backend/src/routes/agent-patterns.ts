import { Router } from 'express';
import {
  executeAgenticPattern,
  evaluateAgenticPatterns,
  type AgenticPattern,
} from '../services/agent-pattern.service.js';

export const agentPatternsRouter = Router();

/**
 * GET /api/agent-patterns/evaluate
 * Returns comparative metrics evaluating Hierarchical, Parallel, and Sequential patterns.
 */
agentPatternsRouter.get('/evaluate', (req, res) => {
  const result = evaluateAgenticPatterns();
  res.json(result);
});

/**
 * POST /api/agent-patterns/run/:pattern
 * Executes a simulated or real workflow using the selected agentic design pattern.
 */
agentPatternsRouter.post('/run/:pattern', async (req, res) => {
  try {
    const rawPattern = (req.params.pattern || '').toUpperCase();
    if (!['HIERARCHICAL', 'PARALLEL', 'SEQUENTIAL'].includes(rawPattern)) {
      return res.status(400).json({
        error: 'Invalid pattern. Must be HIERARCHICAL, PARALLEL, or SEQUENTIAL.',
      });
    }

    const pattern = rawPattern as AgenticPattern;
    const prompt = req.body?.prompt || 'Deploy multi-agent microservice architecture with verified tool bridges';
    const scopeId = req.body?.scopeId || `pattern-${Date.now()}`;

    const result = await executeAgenticPattern(pattern, prompt, scopeId);

    // Emit live event to UI
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('agent:pattern:completed', result);

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to execute pattern' });
  }
});
