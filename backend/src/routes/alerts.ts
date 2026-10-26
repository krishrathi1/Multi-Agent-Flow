import { Router } from 'express';
import { intParam } from '../lib/query.js';
import * as alertService from '../services/alert.service.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { foreignReference } from '../middleware/resource-access.js';

const router = Router();

const ruleFields = {
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(2000).optional(),
  agentId: z.string().uuid().optional(),
  condition: z.string().trim().min(1, 'Condition is required').max(100),
  threshold: z.number().finite().optional(),
  windowMinutes: z.number().int().min(1).max(10080).optional(),
  enabled: z.boolean().optional(),
};
const createRuleSchema = z.object(ruleFields);
// Whitelisted so a PATCH can't rewrite organizationId.
const updateRuleSchema = z.object({
  ...ruleFields,
  agentId: ruleFields.agentId.nullable(),
  threshold: ruleFields.threshold.nullable(),
}).partial();

// GET /rules — list alert rules
router.get('/rules', async (req, res) => {
  const rules = await alertService.getAlertRules(req.organizationId!);
  res.json(rules);
});

// POST /rules — create rule
router.post('/rules', validate(createRuleSchema), async (req, res) => {
  if (await foreignReference(req.organizationId!, req.body)) return res.status(400).json({ error: 'Unknown agentId' });
  const rule = await alertService.createAlertRule(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:rule:created', rule);
  res.status(201).json(rule);
});

// PATCH /rules/:id — update rule
router.patch('/rules/:id', validate(updateRuleSchema), async (req, res) => {
  if (await foreignReference(req.organizationId!, req.body)) return res.status(400).json({ error: 'Unknown agentId' });
  const rule = await alertService.updateAlertRule(String(req.params.id), req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:rule:updated', rule);
  res.json(rule);
});

// GET /events — list alert events
router.get('/events', async (req, res) => {
  const acknowledged = req.query.acknowledged !== undefined
    ? req.query.acknowledged === 'true'
    : undefined;
  const limit = intParam(req.query.limit);
  const events = await alertService.getAlertEvents(req.organizationId!, { acknowledged, limit });
  res.json(events);
});

// POST /events/:id/acknowledge — acknowledge event
router.post('/events/:id/acknowledge', async (req, res) => {
  const event = await alertService.acknowledgeEvent(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:event:acknowledged', event);
  res.json(event);
});

// DELETE /events — clear all alert events
router.delete('/events', async (req, res) => {
  const result = await alertService.clearAlertEvents(req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:events:cleared');
  res.json(result);
});

// POST /events/acknowledge-all — acknowledge all alert events
router.post('/events/acknowledge-all', async (req, res) => {
  const result = await alertService.acknowledgeAllEvents(req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:events:cleared');
  res.json(result);
});

export default router;
