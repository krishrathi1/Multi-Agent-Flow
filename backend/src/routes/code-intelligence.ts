import { Router } from 'express';
import * as codeIntel from '../services/code-intelligence.service.js';

const router = Router();

/**
 * GET /api/code-intelligence/workspaces
 * List all repositories/workspaces created by MyceliumOps for the authenticated organization.
 */
router.get('/workspaces', async (req, res) => {
  const orgId = req.organizationId!;
  const workspaces = await codeIntel.listWorkspaces(orgId);
  const activeWorkspaceId = workspaces.length > 0 ? workspaces[0].id : null;
  res.json({ workspaces, activeWorkspaceId });
});

/**
 * GET /api/code-intelligence/search
 * Semantic/literal code search with query, file filter, language filter scoped to organization.
 *
 * Query params: q (required), file, language, limit, regex, workspaceId
 */
router.get('/search', async (req, res) => {
  const orgId = req.organizationId!;
  const { q, file, language, limit, regex, workspaceId } = req.query as Record<string, string>;
  if (!q) return res.status(400).json({ error: 'Query parameter "q" is required' });

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const boundedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const safeQuery = q.slice(0, 500);

  const results = await codeIntel.searchCode(orgId, safeQuery, {
    fileFilter: file ? file.slice(0, 200) : undefined,
    language: language ? language.slice(0, 50) : undefined,
    maxResults: boundedLimit,
    isRegex: regex === 'true',
    workspaceId,
  });

  res.json({ query: safeQuery, count: results.length, results });
});

/**
 * GET /api/code-intelligence/symbols
 * List extracted code symbols scoped to the authenticated organization.
 *
 * Query params: kind, q, file, limit, workspaceId
 */
router.get('/symbols', async (req, res) => {
  const orgId = req.organizationId!;
  const { kind, q, file, limit, workspaceId } = req.query as Record<string, string>;

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const boundedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);

  const symbols = await codeIntel.getSymbols(orgId, {
    kind,
    query: q ? q.slice(0, 200) : undefined,
    fileFilter: file ? file.slice(0, 200) : undefined,
    limit: boundedLimit,
    workspaceId,
  });

  res.json({ count: symbols.length, symbols });
});

/**
 * GET /api/code-intelligence/files
 * List all indexed files in the MyceliumOps workspace scoped to the authenticated organization.
 */
router.get('/files', async (req, res) => {
  const orgId = req.organizationId!;
  const { workspaceId } = req.query as Record<string, string>;

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const files = await codeIntel.listFiles(orgId, workspaceId);
  res.json({ count: files.length, files });
});

/**
 * GET /api/code-intelligence/file/:path(*)
 * Get file content with syntax highlighting metadata scoped to the authenticated organization.
 */
router.get('/file/*filePath', async (req, res) => {
  const orgId = req.organizationId!;
  const p = (req.params as Record<string, unknown>).filePath;
  const filePath = Array.isArray(p) ? p.join('/') : String(p ?? '');
  if (!filePath) return res.status(400).json({ error: 'File path is required' });

  const { workspaceId } = req.query as Record<string, string>;
  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const file = await codeIntel.getFileContent(orgId, filePath, workspaceId);
  if (!file) return res.status(404).json({ error: 'File not found' });

  res.json(file);
});

/**
 * GET /api/code-intelligence/references/:symbol
 * Find all references (imports + usages) of a symbol across the workspace for the authenticated organization.
 */
router.get('/references/:symbol', async (req, res) => {
  const orgId = req.organizationId!;
  const { symbol } = req.params;
  const { workspaceId } = req.query as Record<string, string>;

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const refs = await codeIntel.findReferences(orgId, symbol, workspaceId);

  res.json({
    symbol,
    count: refs.length,
    imports: refs.filter(r => r.kind === 'import'),
    usages: refs.filter(r => r.kind === 'usage'),
  });
});

/**
 * GET /api/code-intelligence/graph
 * Get the dependency graph for visualization scoped to the authenticated organization.
 */
router.get('/graph', async (req, res) => {
  const orgId = req.organizationId!;
  const { workspaceId } = req.query as Record<string, string>;

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const graph = await codeIntel.getDependencyGraph(orgId, workspaceId);
  res.json(graph);
});

/**
 * GET /api/code-intelligence/stats
 * Get aggregate codebase statistics scoped to the authenticated organization.
 */
router.get('/stats', async (req, res) => {
  const orgId = req.organizationId!;
  const { workspaceId } = req.query as Record<string, string>;

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const stats = await codeIntel.getStats(orgId, workspaceId);
  res.json(stats);
});

/**
 * POST /api/code-intelligence/ask
 * Ask a question about the repository and receive grounded explanations scoped to the organization.
 */
router.post('/ask', async (req, res) => {
  const orgId = req.organizationId!;
  const { question, model, workspaceId } = req.body as { question: string; model?: string; workspaceId?: string };
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  const result = await codeIntel.askCodebase(orgId, question.slice(0, 1000), model, workspaceId);
  res.json(result);
});

/**
 * POST /api/code-intelligence/reindex
 * Force a re-index of the specified workspace scoped to the authenticated organization.
 */
router.post('/reindex', async (req, res) => {
  const orgId = req.organizationId!;
  const { workspaceId } = req.body as { workspaceId?: string };

  if (workspaceId) {
    const ws = await codeIntel.resolveWorkspace(orgId, workspaceId);
    if (!ws) return res.status(404).json({ error: 'Workspace not found or access denied' });
  }

  codeIntel.invalidateCache(orgId, workspaceId);
  await codeIntel.indexCodebase(orgId, workspaceId);
  const stats = await codeIntel.getStats(orgId, workspaceId);
  res.json({ message: 'Reindex complete', stats });
});

export default router;
