import { Router, Request, Response } from 'express';
import { swarmService, SwarmTopology, ConsensusProtocol } from '../services/ruflo/swarm.service.js';
import { memoryService, MemoryTier, RVFExport } from '../services/ruflo/memory.service.js';
import { goalPlannerService } from '../services/ruflo/goal-planner.service.js';
import { federationService } from '../services/ruflo/federation.service.js';
import { learningService } from '../services/ruflo/learning.service.js';
import { aiDefenceService } from '../services/ruflo/aidefence.service.js';
import { metaHarnessService } from '../services/ruflo/metaharness.service.js';
import { loopWorkersService } from '../services/ruflo/loop-workers.service.js';
import { personasService } from '../services/ruflo/personas.service.js';
import { logger } from '../lib/logger.js';

const router = Router();

function getParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
}

// ─── Swarms & Consensus ──────────────────────────────────────

router.get('/swarms', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const swarms = await swarmService.listSwarms(orgId);
    res.json({ swarms });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/swarms', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const { name, description, topology, consensusProtocol, agentIds } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const swarm = await swarmService.createSwarm({
      orgId,
      name,
      description,
      topology: (topology as SwarmTopology) || 'hybrid',
      consensusProtocol: (consensusProtocol as ConsensusProtocol) || 'majority',
      agentIds
    });
    res.status(201).json({ swarm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/swarms/:id', async (req: Request, res: Response) => {
  try {
    const swarmId = getParam(req.params.id);
    const swarm = await swarmService.getSwarm(swarmId);
    if (!swarm) return res.status(404).json({ error: 'Swarm not found' });
    res.json({ swarm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/swarms/:id/topology', async (req: Request, res: Response) => {
  try {
    const swarmId = getParam(req.params.id);
    const { topology } = req.body;
    if (!topology) return res.status(400).json({ error: 'Topology is required' });
    const swarm = await swarmService.updateTopology(swarmId, topology as SwarmTopology);
    res.json({ swarm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/swarms/:id/scale', async (req: Request, res: Response) => {
  try {
    const swarmId = getParam(req.params.id);
    const { targetCount } = req.body;
    if (typeof targetCount !== 'number') return res.status(400).json({ error: 'targetCount must be a number' });
    const swarm = await swarmService.scaleSwarm(swarmId, targetCount);
    res.json({ swarm });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/swarms/:id/consensus', async (req: Request, res: Response) => {
  try {
    const swarmId = getParam(req.params.id);
    const { topic, payload, protocol } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });
    const proposal = await swarmService.triggerConsensus({
      swarmId,
      topic,
      payload: payload || {},
      protocol: protocol as ConsensusProtocol
    });
    res.json({ proposal });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/swarms/:id/proposals', async (req: Request, res: Response) => {
  try {
    const swarmId = getParam(req.params.id);
    const proposals = await swarmService.listProposals(swarmId);
    res.json({ proposals });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AgentDB Vector Memory ──────────────────────────────────

router.post('/memory/store', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const { namespace, tier, content, tags, metadata } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const record = await memoryService.store({
      orgId,
      namespace: namespace || 'default',
      tier: tier as MemoryTier || 'working',
      content,
      tags: tags || [],
      metadata: metadata || {}
    });
    res.status(201).json({ record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/memory/search', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const { query, namespace, tier, limit, threshold } = req.body;
    if (!query) return res.status(400).json({ error: 'Query is required' });

    const results = await memoryService.search({
      query,
      orgId,
      namespace,
      tier: tier as MemoryTier,
      limit: limit ? Number(limit) : 10,
      threshold: threshold !== undefined ? Number(threshold) : 0.45
    });
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/memory/namespaces', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const namespaces = await memoryService.listNamespaces(orgId);
    res.json({ namespaces });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/memory/records', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const { namespace, tier, limit } = req.query;
    const records = await memoryService.listRecords({
      orgId,
      namespace: namespace as string,
      tier: tier as MemoryTier,
      limit: limit ? Number(limit) : 50
    });
    res.json({ records });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/memory/export-rvf', async (req: Request, res: Response) => {
  try {
    const namespace = (req.query.namespace as string) || 'global';
    const exportData = await memoryService.exportRVF(namespace);
    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/memory/import-rvf', async (req: Request, res: Response) => {
  try {
    const exportData: RVFExport = req.body;
    if (!exportData || !exportData.records) {
      return res.status(400).json({ error: 'Invalid RVF payload' });
    }
    const result = await memoryService.importRVF(exportData);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GOAP Goal Planner ──────────────────────────────────────

router.get('/goals', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const plans = await goalPlannerService.listPlans(orgId);
    res.json({ plans });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/goals/:id', async (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.id);
    const plan = await goalPlannerService.getPlan(planId);
    if (!plan) return res.status(404).json({ error: 'Goal plan not found' });
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/plan', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const { goal, context } = req.body;
    if (!goal) return res.status(400).json({ error: 'Goal description is required' });

    const plan = await goalPlannerService.createPlanFromGoal({
      orgId,
      goal,
      context
    });
    res.status(201).json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/:id/step', async (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.id);
    const { stepIndex } = req.body;
    const plan = await goalPlannerService.executeStep(planId, stepIndex !== undefined ? Number(stepIndex) : undefined);
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/:id/execute-all', async (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.id);
    const plan = await goalPlannerService.executeAll(planId);
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/goals/:id/replan', async (req: Request, res: Response) => {
  try {
    const planId = getParam(req.params.id);
    const { reason } = req.body;
    const plan = await goalPlannerService.triggerReplan(planId, reason || 'Dynamic state divergence');
    res.json({ plan });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Zero-Trust Agent Federation ────────────────────────────

router.get('/federation/peers', async (_req: Request, res: Response) => {
  try {
    const peers = await federationService.listPeers();
    const nodeInfo = federationService.getMyNodeInfo();
    res.json({ peers, nodeInfo });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/federation/peers', async (req: Request, res: Response) => {
  try {
    const { name, endpoint, publicKey, piiPolicy } = req.body;
    if (!name || !endpoint || !publicKey) {
      return res.status(400).json({ error: 'Name, endpoint, and publicKey are required' });
    }
    const peer = await federationService.registerPeer({ name, endpoint, publicKey, piiPolicy });
    res.status(201).json({ peer });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/federation/send', async (req: Request, res: Response) => {
  try {
    const { recipientNodeId, messageType, payload } = req.body;
    if (!recipientNodeId || !messageType) {
      return res.status(400).json({ error: 'recipientNodeId and messageType are required' });
    }
    const message = await federationService.sendMessage({
      recipientNodeId,
      messageType,
      payload: payload || {}
    });
    res.json({ message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/federation/audit', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await federationService.listAuditLogs(limit);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SONA Neural Learning & ReasoningBank ───────────────────

router.get('/learning/patterns', async (_req: Request, res: Response) => {
  try {
    const patterns = await learningService.listPatterns();
    const stats = learningService.getLearningStats();
    res.json({ patterns, stats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/learning/trajectories', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const trajectories = await learningService.listTrajectories(limit);
    res.json({ trajectories });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/learning/trajectories', async (req: Request, res: Response) => {
  try {
    const { agentId, agentName, taskType, prompt, steps, overallSuccess, score } = req.body;
    const trajectory = await learningService.recordTrajectory({
      agentId,
      agentName,
      taskType,
      prompt,
      steps: steps || [],
      overallSuccess: Boolean(overallSuccess),
      score
    });
    res.status(201).json({ trajectory });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AIDefence & Security Scanner ───────────────────────────

router.post('/security/scan-prompt', (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
    const result = aiDefenceService.scanPrompt(prompt);
    res.json({ result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/security/audit-report', (_req: Request, res: Response) => {
  try {
    const report = aiDefenceService.generateAuditReport();
    res.json({ report });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/security/threats', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const threats = aiDefenceService.getRecentThreats(limit);
    res.json({ threats });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── MetaHarness Fleet Readiness ────────────────────────────

router.get('/metaharness/audit', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId || 'default';
    const audit = await metaHarnessService.runFleetAudit(orgId);
    res.json({ audit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Loop Workers & Autopilot ───────────────────────────────

router.get('/workers', async (_req: Request, res: Response) => {
  try {
    const workers = await loopWorkersService.listWorkers();
    res.json({ workers });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/:id/toggle', async (req: Request, res: Response) => {
  try {
    const workerId = getParam(req.params.id);
    const { enabled } = req.body;
    const worker = await loopWorkersService.toggleWorker(workerId, Boolean(enabled));
    res.json({ worker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/workers/:id/trigger', async (req: Request, res: Response) => {
  try {
    const workerId = getParam(req.params.id);
    const worker = await loopWorkersService.triggerWorkerRun(workerId);
    res.json({ worker });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Ruflo Specialized Personas ─────────────────────────────

router.get('/personas', (req: Request, res: Response) => {
  try {
    const category = req.query.category as string | undefined;
    const personas = personasService.listPersonas(category);
    res.json({ personas });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/personas/deploy', async (req: Request, res: Response) => {
  try {
    const orgId = (req as any).user?.organizationId;
    if (!orgId) return res.status(400).json({ error: 'User organization context required' });

    const { personaId, customName } = req.body;
    if (!personaId) return res.status(400).json({ error: 'personaId is required' });

    const agent = await personasService.deployPersonaAsAgent({
      personaId,
      orgId,
      customName
    });
    res.status(201).json({ agent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
