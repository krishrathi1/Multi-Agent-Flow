import { Router } from 'express';
import * as customFieldService from '../services/custom-field.service.js';
import { prisma } from '../lib/prisma.js';
import { requireBoardAccess, requireTaskAccess } from '../middleware/resource-access.js';

/** Express 5 types params as `string | string[]`; these routes take one id. */
const paramId = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

const router = Router();

router.get('/', async (req, res) => {
  const defs = await customFieldService.listDefinitions(req.organizationId!);
  res.json(defs);
});

router.post('/', async (req, res) => {
  const def = await customFieldService.createDefinition(req.organizationId!, req.body);
  res.status(201).json(def);
});

router.patch('/:id', async (req, res) => {
  const def = await customFieldService.updateDefinition(req.params.id, req.organizationId!, req.body);
  res.json(def);
});

router.delete('/:id', async (req, res) => {
  await customFieldService.deleteDefinition(req.params.id, req.organizationId!);
  res.status(204).end();
});

router.post('/:id/attach', async (req, res) => {
  const { boardIds } = req.body;
  const results = await customFieldService.attachToBoard(req.params.id, req.organizationId!, boardIds);
  res.json(results);
});

router.get('/boards/:boardId', requireBoardAccess, async (req, res) => {
  const fields = await customFieldService.getBoardFields(paramId(req.params.boardId));
  res.json(fields);
});

// Task custom field values
router.post('/values', async (req, res) => {
  const { taskId, definitionId, value } = req.body;

  // The task id arrives in the body, so no param gate covers this one — and
  // the service filtered on it alone, which let any authenticated user write
  // a field value onto another organization's task.
  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: req.organizationId },
    select: { id: true },
  });
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const result = await customFieldService.setFieldValue(taskId, definitionId, value);
  res.json(result);
});

router.get('/values/:taskId', requireTaskAccess, async (req, res) => {
  const values = await customFieldService.getTaskFieldValues(paramId(req.params.taskId));
  res.json(values);
});

export default router;
