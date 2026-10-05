import { Router } from 'express';
import * as skillService from '../services/skill.service.js';

const router = Router();

router.get('/marketplace', async (req, res) => {
  const gatewayId = req.query.gatewayId as string | undefined;
  const skills = await skillService.listSkills(req.organizationId!, gatewayId);
  res.json(skills);
});

router.post('/marketplace', async (req, res) => {
  const skill = await skillService.createSkill(req.organizationId!, req.body);
  res.status(201).json(skill);
});

router.post('/marketplace/:id/install', async (req, res) => {
  const { gatewayId } = req.body;
  const result = await skillService.installSkill(req.params.id, gatewayId, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:installed', { skillId: req.params.id, gatewayId });
  res.json(result);
});

router.post('/marketplace/:id/uninstall', async (req, res) => {
  const { gatewayId } = req.body;
  await skillService.uninstallSkill(req.params.id, gatewayId, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:uninstalled', { skillId: req.params.id, gatewayId });
  res.status(204).end();
});

router.delete('/marketplace/:id', async (req, res) => {
  try {
    await skillService.deleteSkill(req.params.id, req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:deleted', { skillId: req.params.id });
    res.status(204).end();
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.get('/packs', async (req, res) => {
  const packs = await skillService.listPacks(req.organizationId!);
  res.json(packs);
});

router.post('/packs', async (req, res) => {
  const pack = await skillService.createPack(req.organizationId!, req.body);
  res.status(201).json(pack);
});

router.post('/packs/:id/sync', async (req, res) => {
  const result = await skillService.syncPack(req.params.id, req.organizationId!);
  res.json(result);
});

router.delete('/packs/:id', async (req, res) => {
  try {
    await skillService.deletePack(req.params.id, req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:pack:deleted', { packId: req.params.id });
    res.status(204).end();
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

export default router;
