import { Router } from 'express';
import * as codeIntel from '../services/code-intelligence.service.js';

const router = Router();

/**
 * GET /api/code-intelligence/workspaces
 * List all repositories/workspaces created by MyceliumOps.
 */
router.get('/workspaces', async (req, res) => {
  const workspaces = await codeIntel.listWorkspaces(req.organizationId);
  const activeWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
  res.json({ workspaces, activeWorkspaceId });
});

/**
 * GET /api/code-intelligence/search
 * Semantic code search with query, file filter, language filter.
 *
 * Query params: q (required), file, language, limit, regex, workspaceId
 */
router.get('/search', async (req, res) => {
  const { q, file, language, limit, regex, workspaceId } = req.query as Record<string, string>;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  const results = await codeIntel.searchCode(q, {
    fileFilter: file,
    language,
    maxResults: limit ? parseInt(limit, 10) : 50,
    isRegex: regex === 'true',
    workspaceId,
  });

  res.json({ query: q, count: results.length, results });
});

/**
 * GET /api/code-intelligence/symbols
 * List extracted code symbols (functions, classes, interfaces, types, etc.)
 *
 * Query params: kind, q, file, limit, workspaceId
 */
router.get('/symbols', async (req, res) => {
  const { kind, q, file, limit, workspaceId } = req.query as Record<string, string>;

  const symbols = await codeIntel.getSymbols({
    kind,
    query: q,
    fileFilter: file,
    limit: limit ? parseInt(limit, 10) : 200,
    workspaceId,
  });

  res.json({ count: symbols.length, symbols });
});

/**
 * GET /api/code-intelligence/files
 * List all indexed files in the MyceliumOps workspace with metadata (no content).
 */
router.get('/files', async (req, res) => {
  const { workspaceId } = req.query as Record<string, string>;
  const files = await codeIntel.listFiles(workspaceId);
  res.json({ count: files.length, files });
});

/**
 * GET /api/code-intelligence/file/:path(*)
 * Get file content with syntax highlighting metadata.
 */
router.get('/file/*filePath', async (req, res) => {
  const p = (req.params as Record<string, unknown>).filePath;
  const filePath = Array.isArray(p) ? p.join('/') : String(p ?? '');
  if (!filePath) return res.status(400).json({ error: 'File path is required' });

  const { workspaceId } = req.query as Record<string, string>;
  const file = await codeIntel.getFileContent(filePath, workspaceId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  res.json(file);
});

/**
 * GET /api/code-intelligence/references/:symbol
 * Find all references (imports + usages) of a symbol across the workspace.
 */
router.get('/references/:symbol', async (req, res) => {
  const { symbol } = req.params;
  const { workspaceId } = req.query as Record<string, string>;
  const refs = await codeIntel.findReferences(symbol, workspaceId);

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
router.get('/graph', async (req, res) => {
  const { workspaceId } = req.query as Record<string, string>;
  const graph = await codeIntel.getDependencyGraph(workspaceId);
  res.json(graph);
});

/**
 * GET /api/code-intelligence/stats
 * Get aggregate codebase statistics for the MyceliumOps repository.
 */
router.get('/stats', async (req, res) => {
  const { workspaceId } = req.query as Record<string, string>;
  const stats = await codeIntel.getStats(workspaceId);
  res.json(stats);
});

/**
 * POST /api/code-intelligence/ask
 * Ask a question about the MyceliumOps repository and receive grounded explanations with citations.
 */
router.post('/ask', async (req, res) => {
  const { question, model, workspaceId } = req.body as { question: string; model?: string; workspaceId?: string };
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  const result = await codeIntel.askCodebase(question, req.organizationId, model, workspaceId);
  res.json(result);
});

/**
 * POST /api/code-intelligence/reindex
 * Force a re-index of the specified MyceliumOps workspace.
 */
router.post('/reindex', async (req, res) => {
  const { workspaceId } = req.body as { workspaceId?: string };
  codeIntel.invalidateCache(workspaceId);
  await codeIntel.indexCodebase(workspaceId);
  const stats = await codeIntel.getStats(workspaceId);
  res.json({ message: 'Reindex complete', stats });
});

export default router;
