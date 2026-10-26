import { Router } from 'express';
import * as skillService from '../services/skill.service.js';
import { sendError } from '../lib/http-error.js';

const router = Router();

router.get('/marketplace', async (req, res) => {
  const gatewayId = req.query.gatewayId as string | undefined;
  const skills = await skillService.listSkills(req.organizationId!, gatewayId);
  res.json(skills);
});

router.post('/marketplace', async (req, res) => {
  try {
    const skill = await skillService.createSkill(req.organizationId!, req.body);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:created', skill);
    res.status(201).json(skill);
  } catch (err: any) {
    sendError(res, err, 400);
  }
});

router.get('/marketplace/:id/files', async (req, res) => {
  try {
    const subPath = (req.query.path as string) || '';
    const result = await skillService.getSkillFiles(req.params.id, req.organizationId!, subPath);
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 404);
  }
});

router.get('/marketplace/:id/file', async (req, res) => {
  try {
    const filePath = (req.query.path as string) || '';
    if (!filePath) return res.status(400).json({ error: 'File path is required' });
    const result = await skillService.getSkillFileContent(req.params.id, req.organizationId!, filePath);
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 404);
  }
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
    sendError(res, err, 404);
  }
});

router.get('/packs', async (req, res) => {
  const packs = await skillService.listPacks(req.organizationId!);
  res.json(packs);
});

router.post('/packs', async (req, res) => {
  try {
    const pack = await skillService.createPack(req.organizationId!, req.body);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:pack:created', pack);
    res.status(201).json(pack);
  } catch (err: any) {
    sendError(res, err, 400);
  }
});

router.post('/packs/:id/sync', async (req, res) => {
  try {
    const result = await skillService.syncPack(req.params.id, req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:pack:synced', { packId: req.params.id });
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 400);
  }
});

router.get('/packs/:id/files', async (req, res) => {
  try {
    const subPath = (req.query.path as string) || '';
    const result = await skillService.getPackFiles(req.params.id, req.organizationId!, subPath);
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 404);
  }
});

router.get('/packs/:id/file', async (req, res) => {
  try {
    const filePath = (req.query.path as string) || '';
    if (!filePath) return res.status(400).json({ error: 'File path is required' });
    const result = await skillService.getPackFileContent(req.params.id, req.organizationId!, filePath);
    res.json(result);
  } catch (err: any) {
    sendError(res, err, 404);
  }
});

router.delete('/packs/:id', async (req, res) => {
  try {
    await skillService.deletePack(req.params.id, req.organizationId!);
    req.app.get('io')?.to(`org:${req.organizationId}`).emit('skill:pack:deleted', { packId: req.params.id });
    res.status(204).end();
  } catch (err: any) {
    sendError(res, err, 404);
  }
});

export default router;
