import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import * as opencode from '../services/opencode.service.js';

const router = Router();

router.get('/status', async (_req, res) => res.json(await opencode.status()));
router.get('/models', async (_req, res) => res.json(await opencode.models()));
router.post('/install', requireRole('OWNER', 'ADMIN'), async (_req, res) => {
  try {
    res.json(await opencode.install());
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'OpenCode installation failed' });
  }
});

export default router;
