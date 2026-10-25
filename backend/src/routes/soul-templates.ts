import { Router } from 'express';
import * as soulTemplateService from '../services/soul-template.service.js';

const router = Router();

router.get('/', async (req, res) => {
  const category = req.query.category as string | undefined;
  const templates = await soulTemplateService.listTemplates(req.organizationId!, category);
  res.json(templates);
});

router.get('/search', async (req, res) => {
  const q = (req.query.q as string) || '';
  const templates = await soulTemplateService.searchTemplates(req.organizationId!, q);
  res.json(templates);
});

router.get('/:id', async (req, res) => {
  const template = await soulTemplateService.getTemplate(req.params.id, req.organizationId!);
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

router.post('/', async (req, res) => {
  const template = await soulTemplateService.createTemplate(req.organizationId!, req.body);
  res.status(201).json(template);
});

router.patch('/:id', async (req, res) => {
  const template = await soulTemplateService.updateTemplate(req.params.id, req.organizationId!, req.body);
  res.json(template);
});

router.delete('/:id', async (req, res) => {
  await soulTemplateService.deleteTemplate(req.params.id, req.organizationId!);
  res.status(204).end();
});

export default router;
