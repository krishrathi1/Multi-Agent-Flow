import { Router } from 'express';
import { z } from 'zod';
import { inspectPromptSecurity, runGuardrailsPersonaSuite } from '../services/guardrails.service.js';

export const guardrailsRouter = Router();

const checkSchema = z.object({
  prompt: z.string().min(1).max(5000),
  persona: z.string().optional().default('User Persona'),
});

guardrailsRouter.post('/inspect', async (req, res) => {
  try {
    const { prompt, persona } = checkSchema.parse(req.body);
    const result = await inspectPromptSecurity(prompt, persona);
    res.json({ ok: true, inspection: result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

guardrailsRouter.get('/persona-suite', async (_req, res) => {
  try {
    const results = await runGuardrailsPersonaSuite();
    res.json({
      ok: true,
      total_tests: results.length,
      all_passed: results.every((r) => r.passed_test),
      suite: results,
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error.message });
  }
});
