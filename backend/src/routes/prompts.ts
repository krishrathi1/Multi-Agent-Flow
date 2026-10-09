import { config } from '../config.js';
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
import { prisma } from '../lib/prisma.js';
import { decryptField } from '../lib/crypto.js';
import { runClaudeCli, isClaudeCliEnabled } from '../lib/claude-cli.js';

router.post('/test', async (req: any, res) => {
  const { templateId, variables, model, allowFallback = false } = req.body as {
    templateId: string;
    variables: Record<string, string>;
    model?: string;
    allowFallback?: boolean;
  };

  const template = getPromptById(templateId);
  if (!template) return res.status(404).json({ error: 'Prompt template not found' });

  // Bound variable size to prevent memory exhaustion
  if (variables && typeof variables === 'object') {
    for (const [k, v] of Object.entries(variables)) {
      if (typeof v === 'string' && v.length > 50000) {
        return res.status(400).json({ error: `Variable "${k}" exceeds maximum allowed length of 50,000 characters.` });
      }
    }
  }

  const rendered = renderPrompt(template, variables || {});
  let generatedOutput: string | null = null;
  const requestedModel = (model || template.models[0] || config.geminiModel).trim();
  let executedModel: string = requestedModel;
  let fallbackUsed = false;
  let providerError: string | null = null;

  const isExplicitClaudeCli = requestedModel.toLowerCase().includes('claude-cli');
  const isExplicitGemini = requestedModel.toLowerCase().includes('gemini') || requestedModel.toLowerCase().includes('google');
  const isExplicitLocal = requestedModel.toLowerCase().includes('local') || requestedModel.toLowerCase().includes('ollama') || requestedModel.toLowerCase().includes('qwen');
  const isExplicitOpenAI = requestedModel.toLowerCase().startsWith('openai/') || requestedModel.toLowerCase().startsWith('gpt-') || requestedModel.toLowerCase().startsWith('o1') || requestedModel.toLowerCase().startsWith('o3');
  const isExplicitAnthropic = requestedModel.toLowerCase().startsWith('anthropic/') || (requestedModel.toLowerCase().startsWith('claude-') && !isExplicitClaudeCli);
  const isExplicitNvidia = requestedModel.toLowerCase().startsWith('nvidia/');
  const isExplicitOpencode = requestedModel.toLowerCase().startsWith('opencode/');
  const isOtherExplicitProvider = isExplicitOpenAI || isExplicitAnthropic || isExplicitNvidia || isExplicitOpencode;

  if (isOtherExplicitProvider && !allowFallback) {
    return res.status(400).json({
      error: `Model "${requestedModel}" is not supported directly in Prompt Lab without an active provider integration. Set allowFallback: true to test against default available models.`,
      requestedModel,
    });
  }

  // 1. Try Claude CLI if explicitly requested or if fallback is permitted
  if (isClaudeCliEnabled() && (isExplicitClaudeCli || (!model && allowFallback))) {
    try {
      const cliRes = await runClaudeCli(rendered, {
        timeoutMs: 60000,
      });
      if (cliRes?.text) {
        generatedOutput = cliRes.text;
        executedModel = cliRes.model || 'claude-cli';
      }
    } catch (err: any) {
      providerError = `Claude CLI error: ${err.message}`;
    }
  }

  // 2. Query configured Gemini provider
  if (!generatedOutput && (isExplicitGemini || (!isExplicitClaudeCli && !isExplicitLocal && !isOtherExplicitProvider) || allowFallback)) {
    let geminiKey = process.env.GEMINI_API_KEY || process.env.PLATFORM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    if (req.organizationId) {
      try {
        const provs = await prisma.llmProvider.findMany({
          where: { organizationId: req.organizationId, isActive: true },
        });
        const gProv = provs.find((p) => p.provider.toLowerCase() === 'google' || p.provider.toLowerCase() === 'gemini');
        if (gProv?.apiKey) {
          try { geminiKey = decryptField(gProv.apiKey); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    if (geminiKey) {
      const cleanRequested = requestedModel.replace(/^google\//i, '').replace(/^gemini\//i, '');
      const modelsToTry = allowFallback
        ? Array.from(new Set([cleanRequested, config.geminiModel, ...config.geminiModels]))
        : [cleanRequested];

      for (const m of modelsToTry) {
        try {
          const geminiRes = await fetch(
            `${config.geminiApiBaseUrl}/v1beta/models/${m}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: rendered }] }],
                generationConfig: {
                  temperature: template.temperature ?? 0.3,
                  maxOutputTokens: template.maxTokens ?? 2048,
                },
              }),
              signal: AbortSignal.timeout(30000),
            },
          );
          if (geminiRes.ok) {
            const data = (await geminiRes.json()) as any;
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && typeof text === 'string' && text.trim().length > 0) {
              generatedOutput = text.trim();
              if (m !== cleanRequested) fallbackUsed = true;
              executedModel = m;
              break;
            }
          } else {
            const errBody = await geminiRes.text();
            providerError = `Gemini API error (${geminiRes.status}): ${errBody.slice(0, 200)}`;
          }
        } catch (err: any) {
          providerError = `Gemini connection error: ${err.message}`;
        }
      }
    } else if (isExplicitGemini && !allowFallback) {
      providerError = 'No Google Gemini API key configured.';
    }
  }

  // 3. Try Local PC Ollama
  if (!generatedOutput && (isExplicitLocal || allowFallback)) {
    const localEndpoints = config.localLlmEndpoints;
    const targetLocalModel = isExplicitLocal ? requestedModel.replace(/^local\//i, '') : config.localLlmModel;
    for (const ep of localEndpoints) {
      try {
        const oRes = await fetch(`${ep}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: targetLocalModel,
            prompt: rendered,
            stream: false,
          }),
          signal: AbortSignal.timeout(config.localLlmRequestTimeoutMs),
        });
        if (oRes.ok) {
          const oData = (await oRes.json()) as any;
          if (oData?.response && typeof oData.response === 'string') {
            generatedOutput = oData.response.trim();
            if (targetLocalModel !== requestedModel) fallbackUsed = true;
            executedModel = `${targetLocalModel} (Local Host)`;
            break;
          }
        }
      } catch (err: any) {
        providerError = `Local Ollama error: ${err.message}`;
      }
    }
  }

  // 4. If execution failed, fail honestly with an accurate error report
  if (!generatedOutput) {
    return res.status(503).json({
      error: `Could not execute prompt with requested model "${requestedModel}". ${providerError || 'Please configure an API key in Settings -> LLM Providers or start a local model runner.'}`,
      templateId,
      renderedPrompt: rendered,
      testedModel: requestedModel,
      fallbackUsed,
    });
  }

  res.json({
    templateId,
    model: executedModel,
    requestedModel,
    fallbackUsed,
    renderedPrompt: rendered,
    output: generatedOutput,
    fewShotExamples: template.fewShotExamples,
    note: fallbackUsed
      ? `Executed via fallback model ${executedModel} (requested: ${requestedModel}).`
      : `Prompt executed successfully via ${executedModel}.`,
  });
});

export default router;
