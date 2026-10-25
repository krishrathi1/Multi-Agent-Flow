import { Router } from 'express';
import { validateWithPydantic } from '../services/pydantic.service.js';

export const pydanticRouter = Router();

/**
 * POST /api/structured-output/validate
 * Validates agent output with Pydantic and returns JSON, Table, and Markdown views.
 */
pydanticRouter.post('/validate', async (req, res) => {
  try {
    const payload = req.body && Object.keys(req.body).length > 0 ? req.body : undefined;
    const result = await validateWithPydantic(payload);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({
      pydanticValidated: false,
      error: err.message || 'Validation failed',
    });
  }
});

/**
 * GET /api/structured-output/schema
 * Returns the Pydantic JSON schema.
 */
pydanticRouter.get('/schema', async (req, res) => {
  try {
    const result = await validateWithPydantic();
    res.json({
      schema: result.jsonSchema || {},
      version: 'pydantic-v2',
      supportedFormats: ['JSON', 'Table', 'Markdown'],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
