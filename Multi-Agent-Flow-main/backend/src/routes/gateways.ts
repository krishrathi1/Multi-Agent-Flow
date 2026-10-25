import { Router } from 'express';
import * as gatewayService from '../services/gateway.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const gateways = await gatewayService.getAllGateways(req.organizationId!);
  res.json(gateways);
});

// Check if default gateway auto-provisioning is available
router.get('/defaults', async (req, res) => {
  const hasDefaultConfig = !!(process.env.DEFAULT_GATEWAY_URL && process.env.DEFAULT_GATEWAY_TOKEN);
  const gateways = await gatewayService.getAllGateways(req.organizationId!);
  res.json({ hasDefaultConfig, gatewayCount: gateways.length });
});

router.get('/:id', async (req, res) => {
  const gateway = await gatewayService.getGatewayById(req.params.id, req.organizationId!);
  if (!gateway) return res.status(404).json({ error: 'Gateway not found' });
  // Don't expose token
  const { token, ...safe } = gateway;
  res.json({ ...safe, hasToken: !!token });
});

router.post('/', async (req, res) => {
  try {
    const gateway = await gatewayService.createGateway(req.organizationId!, req.body);
    const { token, ...safe } = gateway;
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('gateway:created', { ...safe, hasToken: !!token });
    res.status(201).json({ ...safe, hasToken: !!token });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const gateway = await gatewayService.updateGateway(req.params.id, req.organizationId!, req.body);
    const { token, ...safe } = gateway;
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('gateway:updated', { ...safe, hasToken: !!token });
    res.json({ ...safe, hasToken: !!token });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await gatewayService.deleteGateway(req.params.id, req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('gateway:deleted', { id: req.params.id });
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get('/:id/health', async (req, res) => {
  try {
    const health = await gatewayService.checkGatewayHealth(req.params.id, req.organizationId!);
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/models', async (req, res) => {
  try {
    const models = await gatewayService.getGatewayModels(req.params.id, req.organizationId!);
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get('/:id/sessions', async (req, res) => {
  try {
    const sessions = await gatewayService.getGatewaySessions(req.params.id, req.organizationId!);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
