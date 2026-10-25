import { Router } from 'express';
import { intParam } from '../lib/query.js';
import * as alertService from '../services/alert.service.js';

const router = Router();

// GET /rules — list alert rules
router.get('/rules', async (req, res) => {
  const rules = await alertService.getAlertRules(req.organizationId!);
  res.json(rules);
});

// POST /rules — create rule
router.post('/rules', async (req, res) => {
  const rule = await alertService.createAlertRule(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('alert:rule:created', rule);
  res.status(201).json(rule);
});

// PATCH /rules/:id — update rule
router.patch('/rules/:id', async (req, res) => {
  const rule = await alertService.updateAlertRule(req.params.id, req.organizationId!, req.body);
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
