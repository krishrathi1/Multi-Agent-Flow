import { Router } from 'express';
import {
  getRecentMonitoringEvents,
  getMasAgentHeatMap,
  onTaskStart,
  onIntermediateOutput,
  onExecutionFlow,
  onError,
  onTaskComplete,
} from '../services/monitoring-callbacks.js';

export const monitoringRouter = Router();

/**
 * GET /api/monitoring/heatmap
 * Returns the MAS Agent Heat Map matrix across hours and agents.
 */
monitoringRouter.get('/heatmap', async (req, res) => {
  try {
    const orgId = req.organizationId!;
    const heatMap = await getMasAgentHeatMap(orgId);
    res.json(heatMap);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to generate heat map' });
  }
});

/**
 * GET /api/monitoring/callbacks/recent
 * Returns recent callback monitoring logs (task start, intermediate output, flow, error).
 */
monitoringRouter.get('/callbacks/recent', (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
  const events = getRecentMonitoringEvents(isNaN(limit) ? 50 : limit);
  res.json({
    totalEvents: events.length,
    events,
  });
});

/**
 * POST /api/monitoring/simulate
 * Simulates a multi-agent execution flow with callbacks for testing.
 */
monitoringRouter.post('/simulate', (req, res) => {
  const taskId = `task-${Date.now()}`;
  
  // 1. Task Start
  const ev1 = onTaskStart('agent-arch-1', 'Architect Agent', taskId, { prompt: 'Design Multi-Agent Blackboard Topology' }, 1);
  
  // 2. Intermediate Output
  const ev2 = onIntermediateOutput('agent-arch-1', 'Architect Agent', taskId, 'Schema Draft', { tables: ['BlackboardState', 'Metrics'] }, 1);
  
  // 3. Execution Flow
  const ev3 = onExecutionFlow(
    { id: 'agent-arch-1', name: 'Architect Agent' },
    { id: 'agent-dev-2', name: 'Core Engineer' },
    'DELEGATE_IMPLEMENTATION',
    { taskId, schemaVersion: 'v2' },
  );

  // 4. Task Complete
  const ev4 = onTaskComplete('agent-dev-2', 'Core Engineer', taskId, { status: 'DELIVERED' }, { durationMs: 240, tokens: 950, costUsd: 0.002 });

  res.json({
    message: 'Simulation events dispatched successfully via monitoring callbacks',
    eventsDispatched: [ev1, ev2, ev3, ev4],
  });
});
