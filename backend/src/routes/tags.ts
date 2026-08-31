import { Router } from 'express';
import * as tagService from '../services/tag.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const tags = await tagService.listTags(req.organizationId!);
  res.json(tags);
});

router.post('/', async (req, res) => {
  const tag = await tagService.createTag(req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('tag:created', tag);
  res.status(201).json(tag);
});

router.patch('/:id', async (req, res) => {
  const tag = await tagService.updateTag(req.params.id, req.organizationId!, req.body);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('tag:updated', tag);
  res.json(tag);
});

router.delete('/:id', async (req, res) => {
  await tagService.deleteTag(req.params.id, req.organizationId!);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('tag:deleted', { id: req.params.id });
  res.status(204).end();
});

router.post('/assign', async (req, res) => {
  const { taskId, tagIds } = req.body;
  const assignments = await tagService.assignTags(taskId, req.organizationId!, tagIds);
  req.app.get('io')?.to(`org:${req.organizationId}`).emit('task:tagged', { taskId, tags: assignments });
  res.json(assignments);
});

export default router;
