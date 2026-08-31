import { Router } from 'express';
import { intParam } from '../lib/query.js';
import * as metricsService from '../services/metrics.service.js';

const router = Router();

// This router is mounted at both /api/tokens and /api/metrics.
// We use req.baseUrl to determine which resource is being requested.

// GET /dashboard — time-series analytics with KPIs
router.get('/dashboard', async (req, res) => {
  const range = req.query.range as string | undefined;
  const boardId = req.query.boardId as string | undefined;
  const groupId = req.query.groupId as string | undefined;
  const dashboard = await metricsService.getDashboardMetrics(req.organizationId!, { range, boardId, groupId });
  res.json(dashboard);
});

// GET / — list (tokens or metrics depending on mount point)
router.get('/', async (req, res) => {
  if (req.baseUrl.endsWith('/tokens')) {
    const agentId = req.query.agentId as string | undefined;
    const hours = intParam(req.query.hours, { max: 24 * 365 });
    const usage = await metricsService.getTokenUsage(req.organizationId!, { agentId, hours });
    res.json(usage);
  } else {
    const agentId = req.query.agentId as string | undefined;
    const limit = intParam(req.query.limit);
    const metrics = await metricsService.getMetrics(req.organizationId!, { agentId, limit });
    res.json(metrics);
  }
});

// GET /summary — summary (tokens or metrics depending on mount point)
router.get('/summary', async (req, res) => {
  if (req.baseUrl.endsWith('/tokens')) {
    const summary = await metricsService.getTokenSummary(req.organizationId!);
    res.json(summary);
  } else {
    const summary = await metricsService.getMetricsSummary(req.organizationId!);
    res.json(summary);
  }
});

export default router;
