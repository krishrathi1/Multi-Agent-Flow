import { Router } from 'express';
import { promptRegistry, getPromptById, renderPrompt } from '../prompts/index.js';

const router = Router();

/**
 * GET /api/prompts
 * List all available prompt templates.
 */
router.get('/', (_req, res) => {
  // Return templates without full systemPrompt for the list view
  const templates = promptRegistry.map(({ systemPrompt: _sp, fewShotExamples: _ex, ...rest }) => rest);
  res.json({ count: templates.length, templates });
});

/**
 * GET /api/prompts/:id
 * Get a specific prompt template with full details.
 */
router.get('/:id', (req, res) => {
  const template = getPromptById(req.params.id);
  if (!template) return res.status(404).json({ error: 'Prompt template not found' });
  res.json(template);
});

/**
 * POST /api/prompts/render
 * Render a prompt template by substituting variables.
 * Body: { templateId: string, variables: Record<string, string> }
 */
router.post('/render', (req, res) => {
  const { templateId, variables } = req.body as { templateId: string; variables: Record<string, string> };
  if (!templateId) return res.status(400).json({ error: 'templateId is required' });

  const template = getPromptById(templateId);
  if (!template) return res.status(404).json({ error: 'Prompt template not found' });

  // Check required variables
  const missing = template.variables.filter(v => v.required && !variables?.[v.name]);
  if (missing.length > 0) {
    return res.status(400).json({
      error: 'Missing required variables',
      missing: missing.map(v => v.name),
    });
  }

  const rendered = renderPrompt(template, variables || {});

  res.json({
    templateId,
    rendered,
    model: template.models[0],
    temperature: template.temperature,
    maxTokens: template.maxTokens,
  });
});

/**
 * POST /api/prompts/test
 * Test a prompt against a connected LLM (placeholder — returns rendered prompt).
 * In a real implementation this would call the LLM provider.
 *
 * Body: { templateId: string, variables: Record<string, string>, model?: string }
 */
router.post('/test', async (req, res) => {
  const { templateId, variables, model } = req.body as {
    templateId: string;
    variables: Record<string, string>;
    model?: string;
  };

  const template = getPromptById(templateId);
  if (!template) return res.status(404).json({ error: 'Prompt template not found' });

  const rendered = renderPrompt(template, variables || {});

  const apiKey = process.env.GEMINI_API_KEY || process.env.PLATFORM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
  let generatedOutput: string | null = null;

  if (apiKey) {
    try {
      const targetModel = model || template.models[0] || 'gemini-2.0-flash';
      const cleanModel = targetModel.replace(/^google\//, '').replace(/^gemini\//, '');
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: rendered }] }],
            generationConfig: {
              temperature: template.temperature ?? 0.3,
              maxOutputTokens: template.maxTokens ?? 2048,
            },
          }),
          signal: AbortSignal.timeout(25000),
        },
      );
      if (geminiRes.ok) {
        const data = (await geminiRes.json()) as any;
        generatedOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
      }
    } catch {
      // ignore, fall back to rendered prompt note
    }
  }

  res.json({
    templateId,
    model: model || template.models[0],
    renderedPrompt: rendered,
    output: generatedOutput,
    fewShotExamples: template.fewShotExamples,
    note: generatedOutput
      ? 'Executed successfully via configured LLM provider.'
      : 'Rendered prompt ready. Connect an active LLM provider or gateway for live generation.',
  });
});

export default router;
