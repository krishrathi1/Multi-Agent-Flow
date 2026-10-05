import { Router } from 'express';
import * as codeIntel from '../services/code-intelligence.service.js';

const router = Router();

/**
 * GET /api/code-intelligence/search
 * Semantic code search with query, file filter, language filter.
 *
 * Query params: q (required), file, language, limit, regex
 */
router.get('/search', async (req, res) => {
  const { q, file, language, limit, regex } = req.query as Record<string, string>;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const results = await codeIntel.searchCode(q, {
    fileFilter: file,
    language,
    maxResults: limit ? parseInt(limit, 10) : 50,
    isRegex: regex === 'true',
  });

  res.json({ query: q, count: results.length, results });
});

/**
 * GET /api/code-intelligence/symbols
 * List extracted code symbols (functions, classes, interfaces, types, etc.)
 *
 * Query params: kind, q, file, limit
 */
router.get('/symbols', async (req, res) => {
  const { kind, q, file, limit } = req.query as Record<string, string>;

  const symbols = await codeIntel.getSymbols({
    kind,
    query: q,
    fileFilter: file,
    limit: limit ? parseInt(limit, 10) : 200,
  });

  res.json({ count: symbols.length, symbols });
});

/**
 * GET /api/code-intelligence/files
 * List all indexed files with metadata (no content).
 */
router.get('/files', async (_req, res) => {
  const files = await codeIntel.listFiles();
  res.json({ count: files.length, files });
});

/**
 * GET /api/code-intelligence/file/:path(*)
 * Get file content with syntax highlighting metadata.
 * The path is a catch-all to support nested paths like "backend/src/index.ts".
 */
router.get('/file/*filePath', async (req, res) => {
  const p = (req.params as Record<string, unknown>).filePath;
  const filePath = Array.isArray(p) ? p.join('/') : String(p ?? '');
  if (!filePath) return res.status(400).json({ error: 'File path is required' });

  const file = await codeIntel.getFileContent(filePath);
  if (!file) return res.status(404).json({ error: 'File not found' });

  res.json(file);
});

/**
 * GET /api/code-intelligence/references/:symbol
 * Find all references (imports + usages) of a symbol across the codebase.
 */
router.get('/references/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const refs = await codeIntel.findReferences(symbol);

  res.json({
    symbol,
    count: refs.length,
    imports: refs.filter(r => r.kind === 'import'),
    usages: refs.filter(r => r.kind === 'usage'),
  });
});

/**
 * GET /api/code-intelligence/graph
 * Get the dependency graph (file nodes + import edges) for visualization.
 */
router.get('/graph', async (_req, res) => {
  const graph = await codeIntel.getDependencyGraph();
  res.json(graph);
});

/**
 * GET /api/code-intelligence/stats
 * Get aggregate codebase statistics.
 */
router.get('/stats', async (_req, res) => {
  const stats = await codeIntel.getStats();
  res.json(stats);
});

/**
 * POST /api/code-intelligence/ask
 * Ask a question about the repository and receive grounded explanations with citations.
 */
router.post('/ask', async (req, res) => {
  const { question } = req.body as { question: string };
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  const result = await codeIntel.askCodebase(question);
  res.json(result);
});

/**
 * POST /api/code-intelligence/reindex
 * Force a re-index of the codebase.
 */
router.post('/reindex', async (_req, res) => {
  codeIntel.invalidateCache();
  await codeIntel.indexCodebase();
  const stats = await codeIntel.getStats();
  res.json({ message: 'Reindex complete', stats });
});

export default router;
