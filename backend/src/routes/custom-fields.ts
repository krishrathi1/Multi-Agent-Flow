import { Router } from 'express';
import * as customFieldService from '../services/custom-field.service.js';
import { prisma } from '../lib/prisma.js';
import { requireBoardAccess, requireTaskAccess } from '../middleware/resource-access.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';

/** Express 5 types params as `string | string[]`; these routes take one id. */
const paramId = (v: string | string[]): string => (Array.isArray(v) ? v[0] : v);

const router = Router();

const upperEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(v => (typeof v === 'string' ? v.trim().toUpperCase() : v), z.enum(values));

const fieldType = upperEnum(['TEXT', 'TEXT_LONG', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATE_TIME', 'URL', 'JSON']);
const uiVisibility = upperEnum(['ALWAYS', 'IF_SET', 'HIDDEN']);
const validationRegex = z.string().max(500).refine(src => {
  try { new RegExp(src); return true; } catch { return false; }
}, 'Not a valid regular expression');

// The service spread the body into Prisma's data, so an `organizationId` in
// the body overrode the caller's own and planted the field in another org.
const createSchema = z.object({
  fieldKey: z.string().trim().regex(/^[A-Za-z0-9_.-]{1,64}$/, 'Key may contain letters, digits, _ . - (max 64)'),
  label: z.string().trim().min(1, 'Label is required').max(200),
  fieldType: fieldType.optional(),
  uiVisibility: uiVisibility.optional(),
  validationRegex: validationRegex.optional(),
  defaultValue: z.string().max(5000).optional(),
});

const updateSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  fieldType: fieldType.optional(),
  uiVisibility: uiVisibility.optional(),
  validationRegex: validationRegex.nullable().optional(),
  defaultValue: z.string().max(5000).nullable().optional(),
});

const attachSchema = z.object({ boardIds: z.array(z.string().uuid()).min(1).max(200) });

router.get('/', async (req, res) => {
  const defs = await customFieldService.listDefinitions(req.organizationId!);
  res.json(defs);
});

router.post('/', validate(createSchema), async (req, res) => {
  const def = await customFieldService.createDefinition(req.organizationId!, req.body);
  res.status(201).json(def);
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const def = await customFieldService.updateDefinition(String(req.params.id), req.organizationId!, req.body);
  res.json(def);
});

router.delete('/:id', async (req, res) => {
  await customFieldService.deleteDefinition(req.params.id, req.organizationId!);
  res.status(204).end();
});

router.post('/:id/attach', validate(attachSchema), async (req, res) => {
  const boardIds = [...new Set<string>(req.body.boardIds)];
  try {
    const results = await customFieldService.attachToBoard(String(req.params.id), req.organizationId!, boardIds);
    res.json(results);
  } catch (e) {
    if ((e as Error).message === 'Some boards not found') return res.status(404).json({ error: 'Board not found' });
    throw e;
  }
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
