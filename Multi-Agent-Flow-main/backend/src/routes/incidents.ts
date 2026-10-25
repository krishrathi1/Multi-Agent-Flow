import { Router, Request, Response } from 'express';
import * as incidentService from '../services/incident-agent.service.js';

interface AuthRequest extends Request {
  organizationId?: string;
  app: any;
}

const router = Router();


// GET /api/incidents — list recent investigations
router.get('/', async (req: AuthRequest, res: any) => {
  const items = incidentService.getRecentInvestigations();
  res.json(items);
});

// DELETE /api/incidents — clear recent investigations
router.delete('/', async (req: AuthRequest, res: any) => {
  incidentService.clearInvestigations();
  res.json({ success: true });
});

// POST? /api/incidents/investigate — run incident investigation agent
router.post('/investigate', async (req: AuthRequest, res: any) => {
  try {
    const { alertTitle, symptom, scenario } = req.body;
    const io = req.app.get('io');
    const result = await incidentService.investigateIncident(
      req.organizationId!,
      { alertTitle, symptom, scenario },
      io,
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Investigation failed' });
  }
});

// POST ?api/incidents/simulate — simulate production incident and run RCA agent
router.post('/simulate', async (req: AuthRequest, res: any) => {
  try {
    const scenario = req.body.scenario || 'LATENCY_SPIKE';
    const io = req.app.get('io');
    const result = await incidentService.investigateIncident(
      req.organizationId!,
      { scenario },
      io,
    );
    res.status(201).json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Simulation failed' });
  }
});

export default router;
