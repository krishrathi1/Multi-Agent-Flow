import { config } from '../config.js';
import { ask as askOpenCode } from './opencode.service.js';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, extname, basename, resolve } from 'path';
import { logger } from '../lib/logger.js';
import { prisma } from '../lib/prisma.js';
import { decryptField } from '../lib/crypto.js';
import { runClaudeCli, isClaudeCliEnabled } from '../lib/claude-cli.js';

// ─── Types ──────────────────────────────────────────────

export interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'enum' | 'const' | 'variable' | 'export';
  file: string;
  line: number;
  exported: boolean;
  signature?: string;
}

export interface FileInfo {
  path: string;
  relativePath: string;
  language: string;
  lineCount: number;
  sizeBytes: number;
  imports: string[];
  exports: string[];
  symbols: CodeSymbol[];
}

export interface DependencyEdge {
  source: string;   // importing file
  target: string;   // imported file/module
  importNames: string[];
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  matchStart: number;
  matchEnd: number;
  context: { before: string[]; after: string[] };
}

export interface CodebaseStats {
  totalFiles: number;
  totalLines: number;
  totalBytes: number;
  languages: Record<string, number>;
  directories: Record<string, number>;
  avgFileSize: number;
  largestFiles: { path: string; lines: number; bytes: number }[];
}

export interface SymbolReference {
  file: string;
  line: number;
  content: string;
  kind: 'import' | 'usage';
}

export interface WorkspaceRepo {
  id: string;
  name: string;
  rawName: string;
  description: string;
  source: 'myceliumops';
  fileCount: number;
  lastModified: string;
  framework?: string;
  processStatus?: string;
}

// ─── Configuration ──────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.prisma', '.yml', '.yaml', '.sql', '.sh',
]);

const IGNORE_DIRS_BASE = new Set([
  'node_modules', '.git', 'build', '.next', 'coverage', '.turbo',
]);

const LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (React)',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (React)',
  '.json': 'JSON',
  '.css': 'CSS',
  '.html': 'HTML',
  '.md': 'Markdown',
  '.prisma': 'Prisma',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.sql': 'SQL',
  '.sh': 'Shell',
};

// ─── Workspace Resolution ───────────────────────────────

/**
 * Returns the root directory where MyceliumOps workspaces live.
 */
export function getNexusWorkspacesRoot(): string {
  if (process.env.AGENT_WORKSPACE_ROOT) {
    return resolve(process.env.AGENT_WORKSPACE_ROOT);
  }
  const cwd = process.cwd();
  const cand1 = join(cwd, '.nexus-workspaces');
  if (existsSync(cand1)) return cand1;
  const cand2 = join(cwd, '..', '.nexus-workspaces');
  if (existsSync(cand2)) return cand2;
  if (typeof import.meta !== 'undefined' && import.meta.dirname) {
    const cand3 = join(import.meta.dirname, '..', '..', '..', '.nexus-workspaces');
    if (existsSync(cand3)) return cand3;
  }
  return cand1;
}

function formatTitleCase(str: string): string {
  return str
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

/**
 * Discovers and lists all repositories created by MyceliumOps.
 * Combines filesystem discovery in .nexus-workspaces with Prisma process data.
 */
export async function listWorkspaces(organizationId?: string): Promise<WorkspaceRepo[]> {
  const root = getNexusWorkspacesRoot();
  if (!existsSync(root)) return [];

  const repos: WorkspaceRepo[] = [];
  try {
    const entries = await readdir(root, { withFileTypes: true });

    // Lookup processes from Prisma for the organization
    const dbProcesses: Map<string, { name: string; summary: string | null; status: string }> = new Map();
    try {
      const procs = await prisma.process.findMany({
        where: organizationId ? { organizationId } : undefined,
        select: { id: true, name: true, summary: true, status: true },
      });
      for (const p of procs) {
        dbProcesses.set(p.id, { name: p.name, summary: p.summary, status: p.status });
      }
    } catch {
      // Prisma query fallback if table or DB not accessible
    }

    if (organizationId && dbProcesses.size === 0) {
      return [];
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

      // Only include workspaces that belong to real processes in this organization
      if (organizationId && !dbProcesses.has(entry.name)) {
        continue;
      }

      const wsDir = join(root, entry.name);
      let rawName = entry.name;
      let displayName = formatTitleCase(entry.name);
      let description = '';
      let framework = 'TypeScript / Web';

      // Check package.json
      const pkgPath = join(wsDir, 'package.json');
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'));
          if (pkg.name) {
            rawName = pkg.name;
            displayName = formatTitleCase(pkg.name);
          }
          if (pkg.description) {
            description = pkg.description;
          }

          // Framework heuristics
          const deps = { ...pkg.dependencies, ...pkg.devDependencies };
          if (deps['react'] && deps['vite']) framework = 'React + Vite';
          else if (deps['next']) framework = 'Next.js';
          else if (deps['react']) framework = 'React';
          else if (deps['vue']) framework = 'Vue.js';
          else if (deps['express']) framework = 'Node.js + Express';
        } catch { /* skip */ }
      }

      // Check README.md for title or description if needed
      const readmePath = join(wsDir, 'README.md');
      if (existsSync(readmePath) && !description) {
        try {
          const readme = await readFile(readmePath, 'utf-8');
          const lines = readme.split('\n').map(l => l.trim()).filter(Boolean);
          for (const l of lines) {
            if (l.startsWith('# ') && !displayName) {
              displayName = l.replace(/^#\s+/, '').trim();
            } else if (!l.startsWith('#') && !l.startsWith('>') && l.length > 15) {
              description = l.slice(0, 160);
              break;
            }
          }
        } catch { /* skip */ }
      }

      // Enrich with Prisma process info if available
      const dbProc = dbProcesses.get(entry.name);
      if (dbProc) {
        if (dbProc.name) displayName = dbProc.name;
        if (dbProc.summary && !description) description = dbProc.summary;
      }

      // Quick count of source files in workspace
      let fileCount = 0;
      let mtime = new Date(0);
      try {
        const s = await stat(wsDir);
        mtime = s.mtime;
        const wsFiles = await scanDirectory(wsDir, wsDir, true);
        fileCount = wsFiles.length;
      } catch { /* skip */ }

      repos.push({
        id: entry.name,
        name: displayName,
        rawName,
        description: description || 'Repository autonomously generated by MyceliumOps agents.',
        source: 'myceliumops',
        fileCount,
        lastModified: mtime.toISOString(),
        framework,
        processStatus: dbProc?.status,
      });
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to list MyceliumOps workspaces');
  }

  // Sort by lastModified descending (newest first)
  return repos.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());
}

/**
 * Resolves the target workspace root directory.
 * Guaranteed to only return directories inside .nexus-workspaces belonging to the organization.
 */
export async function resolveWorkspace(organizationId: string, workspaceId?: string): Promise<{ id: string; root: string; name: string } | null> {
  if (!organizationId) return null;
  const workspacesRoot = getNexusWorkspacesRoot();
  if (!existsSync(workspacesRoot)) return null;

  const orgWorkspaces = await listWorkspaces(organizationId);
  if (orgWorkspaces.length === 0) return null;

  if (workspaceId) {
    const safeId = workspaceId.replace(/[^a-zA-Z0-9-_]/g, '');
    const found = orgWorkspaces.find(w => w.id === safeId);
    if (found) {
      return { id: found.id, root: join(workspacesRoot, found.id), name: found.name };
    }
    // Return null if workspaceId is not owned by this organization
    return null;
  }

  // Default to first / latest workspace belonging to this organization
  const first = orgWorkspaces[0];
  return { id: first.id, root: join(workspacesRoot, first.id), name: first.name };
}

// ─── Cache ──────────────────────────────────────────────

interface WorkspaceCache {
  files: FileInfo[];
  symbols: CodeSymbol[];
  edges: DependencyEdge[];
  stats: CodebaseStats;
  lastIndexTime: number;
}

const workspaceCaches = new Map<string, WorkspaceCache>();
const CACHE_TTL_MS = 60_000; // re-index every 60s at most

// ─── File Scanner ───────────────────────────────────────

/**
 * Recursively walks a workspace directory and collects all source files,
 * skipping ignored directories and unsupported file types.
 */
async function scanDirectory(dir: string, root: string, hasSourceTree: boolean): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS_BASE.has(entry.name)) continue;
      if (entry.name === 'dist' && hasSourceTree) continue;
      if (entry.name.endsWith('.map')) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await scanDirectory(fullPath, root, hasSourceTree);
        files.push(...sub);
      } else if (SUPPORTED_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory may be inaccessible — skip silently.
  }
  return files;
}

// ─── Symbol Extraction ──────────────────────────────────

/**
 * Extracts code symbols (functions, classes, interfaces, types, etc.)
 * from TypeScript/JavaScript source text.
 */
function extractSymbols(content: string, filePath: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    const isExported = line.trimStart().startsWith('export');

    // function declarations
    const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*[(<]/);
    if (funcMatch) {
      symbols.push({
        name: funcMatch[1],
        kind: 'function',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // arrow function const (including typed React components, e.g. const Dashboard: React.FC = ...)
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)(?:\s*:[^=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>/)
      || line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)(?:\s*:[^=]+)?\s*=\s*(?:async\s*)?\(/);
    if (arrowMatch) {
      symbols.push({
        name: arrowMatch[1],
        kind: 'function',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // class declarations
    const classMatch = line.match(/(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      symbols.push({
        name: classMatch[1],
        kind: 'class',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // interface declarations
    const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
    if (ifaceMatch) {
      symbols.push({
        name: ifaceMatch[1],
        kind: 'interface',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // type aliases
    const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*[=<]/);
    if (typeMatch) {
      symbols.push({
        name: typeMatch[1],
        kind: 'type',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // enum declarations
    const enumMatch = line.match(/(?:export\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      symbols.push({
        name: enumMatch[1],
        kind: 'enum',
        file: filePath,
        line: lineNum,
        exported: isExported,
        signature: line.trim().slice(0, 120),
      });
      continue;
    }

    // const/variable declarations (exported, non-function)
    const constMatch = line.match(/export\s+(?:const|let|var)\s+(\w+)\s*[=:]/);
    if (constMatch && !arrowMatch) {
      symbols.push({
        name: constMatch[1],
        kind: 'const',
        file: filePath,
        line: lineNum,
        exported: true,
        signature: line.trim().slice(0, 120),
      });
    }
  }

  return symbols;
}

/**
 * Extracts import statements from source code.
 */
function extractImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:(?:[\w*{}\s,]+)\s+from\s+)?['"](.*?)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

/**
 * Extracts export names from source code.
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  const exportRegex = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/g;
  let match;
  while ((match = exportRegex.exec(content)) !== null) {
    exports.push(match[1]);
  }
  return exports;
}

// ─── Indexing ───────────────────────────────────────────

/**
 * Indexes a specific MyceliumOps workspace. Thread-safe via TTL guard per workspace.
 */
export async function indexCodebase(organizationId: string, workspaceId?: string): Promise<{ ws: { id: string; root: string; name: string }; cache: WorkspaceCache } | null> {
  const ws = await resolveWorkspace(organizationId, workspaceId);
  if (!ws) return null;

  const cacheKey = `${organizationId}:${ws.id}`;
  const now = Date.now();
  const existing = workspaceCaches.get(cacheKey);
  if (existing && now - existing.lastIndexTime < CACHE_TTL_MS && existing.files.length > 0) {
    return { ws, cache: existing };
  }

  const root = ws.root;
  const hasSourceTree = existsSync(join(root, 'src'));
  logger.info({ workspaceId: ws.id, root, repoName: ws.name }, 'Indexing MyceliumOps workspace for code intelligence');

  const filePaths = await scanDirectory(root, root, hasSourceTree);
  const files: FileInfo[] = [];
  const symbols: CodeSymbol[] = [];
  const edges: DependencyEdge[] = [];

  for (const fp of filePaths) {
    try {
      const content = await readFile(fp, 'utf-8');
      const relPath = relative(root, fp).replace(/\\/g, '/');
      const ext = extname(fp).toLowerCase();
      const lines = content.split('\n');

      const isJsTs = ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
      const fileImports = isJsTs ? extractImports(content) : [];
      const fileExports = isJsTs ? extractExports(content) : [];
      const fileSymbols = isJsTs ? extractSymbols(content, relPath) : [];

      const s = await stat(fp);

      files.push({
        path: fp,
        relativePath: relPath,
        language: LANGUAGE_MAP[ext] || ext,
        lineCount: lines.length,
        sizeBytes: s.size,
        imports: fileImports,
        exports: fileExports,
        symbols: fileSymbols,
      });

      symbols.push(...fileSymbols);

      // Build dependency edges
      for (const imp of fileImports) {
        edges.push({
          source: relPath,
          target: imp,
          importNames: [],
        });
      }
    } catch {
      // File read error — skip.
    }
  }

  // Build stats
  const languages: Record<string, number> = {};
  const directories: Record<string, number> = {};
  let totalLines = 0;
  let totalBytes = 0;

  for (const f of files) {
    totalLines += f.lineCount;
    totalBytes += f.sizeBytes;
    languages[f.language] = (languages[f.language] || 0) + 1;
    const parts = f.relativePath.split('/');
    const dir = parts.length > 2 && parts[0] === 'src' ? `src/${parts[1]}` : (parts[0] || 'root');
    directories[dir] = (directories[dir] || 0) + 1;
  }

  const sortedBySize = [...files].sort((a, b) => b.lineCount - a.lineCount);
  const stats: CodebaseStats = {
    totalFiles: files.length,
    totalLines,
    totalBytes,
    languages,
    directories,
    avgFileSize: files.length > 0 ? Math.round(totalBytes / files.length) : 0,
    largestFiles: sortedBySize.slice(0, 10).map(f => ({
      path: f.relativePath,
      lines: f.lineCount,
      bytes: f.sizeBytes,
    })),
  };

  const newCache: WorkspaceCache = {
    files,
    symbols,
    edges,
    stats,
    lastIndexTime: now,
  };

  workspaceCaches.set(cacheKey, newCache);

  logger.info(
    { workspaceId: ws.id, files: files.length, symbols: symbols.length, edges: edges.length },
    'MyceliumOps workspace indexing complete',
  );

  return { ws, cache: newCache };
}

// ─── Public API ─────────────────────────────────────────

function isDangerousRegex(pattern: string): boolean {
  // Bound pattern length
  if (pattern.length > 250) return true;
  // Reject nested repetition operators: (a+)+, (a*)*, etc.
  if (/(\+|\*|\{[0-9]+,[0-9]*\})\s*(\+|\*|\{[0-9]+,[0-9]*\})/.test(pattern)) return true;
  if (/\([^)]*(\+|\*)[^)]*\)\s*(\+|\*|\{[0-9]+,[0-9]*\})/.test(pattern)) return true;
  // Reject ambiguous alternation inside repetition: (a|aa)+, (a|a)+
  if (/\([^)]*\|[^)]*\)\s*(\+|\*|\{[0-9]+,[0-9]*\})/.test(pattern)) return true;
  // Reject overlapping wildcards
  if (/(\.\*|\.\+)\s*(\.\*|\.\+)/.test(pattern)) return true;
  return false;
}

/**
 * Performs code search across the selected workspace files with ReDoS guards and timeouts.
 */
export async function searchCode(
  organizationId: string,
  query: string,
  options: { fileFilter?: string; language?: string; maxResults?: number; isRegex?: boolean; workspaceId?: string } = {},
): Promise<SearchResult[]> {
  const indexed = await indexCodebase(organizationId, options.workspaceId);
  if (!indexed) return [];

  const { files } = indexed.cache;
  const { fileFilter, language, maxResults = 50, isRegex = false } = options;
  const results: SearchResult[] = [];

  if (isRegex && isDangerousRegex(query)) {
    logger.warn({ query }, 'Rejected dangerous regex pattern to prevent ReDoS');
    return [];
  }

  let regex: RegExp;
  try {
    regex = isRegex ? new RegExp(query, 'gi') : new RegExp(escapeRegex(query), 'gi');
  } catch {
    return [];
  }

  const deadline = Date.now() + 3000; // 3-second hard timeout for search traversal

  for (const file of files) {
    if (Date.now() > deadline) break;
    if (language && file.language !== language) continue;
    if (fileFilter && !file.relativePath.includes(fileFilter)) continue;

    try {
      const content = await readFile(file.path, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        if (i % 50 === 0 && Date.now() > deadline) break;
        const line = lines[i];
        // Clamp single line length to prevent engine lockup on minified or adversarial lines
        const targetLine = line.length > 2000 ? line.slice(0, 2000) : line;
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(targetLine)) !== null) {
          results.push({
            file: file.relativePath,
            line: i + 1,
            column: match.index,
            content: line.trimEnd(),
            matchStart: match.index,
            matchEnd: match.index + match[0].length,
            context: {
              before: lines.slice(Math.max(0, i - 2), i).map(l => l.trimEnd()),
              after: lines.slice(i + 1, Math.min(lines.length, i + 3)).map(l => l.trimEnd()),
            },
          });

          if (results.length >= maxResults) return results;
          if (match[0].length === 0) break;
        }
      }
    } catch {
      // Skip unreadable files.
    }
  }

  return results;
}

/**
 * Lists all extracted symbols for the selected MyceliumOps repository.
 */
export async function getSymbols(
  organizationId: string,
  options: { kind?: string; query?: string; fileFilter?: string; limit?: number; workspaceId?: string } = {},
): Promise<CodeSymbol[]> {
  const indexed = await indexCodebase(organizationId, options.workspaceId);
  if (!indexed) return [];

  let result = [...indexed.cache.symbols];

  if (options.kind) {
    result = result.filter(s => s.kind === options.kind);
  }
  if (options.query) {
    const q = options.query.toLowerCase();
    result = result.filter(s => s.name.toLowerCase().includes(q));
  }
  if (options.fileFilter) {
    result = result.filter(s => s.file.includes(options.fileFilter!));
  }

  return result.slice(0, options.limit || 200);
}

/**
 * Reads a file's content from the selected MyceliumOps repository.
 */
export async function getFileContent(
  organizationId: string,
  filePath: string,
  workspaceId?: string,
): Promise<{ relativePath: string; language: string; content: string; lineCount: number; symbols: CodeSymbol[] } | null> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) return null;

  const file = indexed.cache.files.find(f => f.relativePath === filePath);
  if (!file) return null;

  try {
    const content = await readFile(file.path, 'utf-8');
    return {
      relativePath: file.relativePath,
      language: file.language,
      content,
      lineCount: file.lineCount,
      symbols: file.symbols,
    };
  } catch {
    return null;
  }
}

/**
 * Finds all references to a symbol in the selected MyceliumOps repository.
 */
export async function findReferences(organizationId: string, symbolName: string, workspaceId?: string): Promise<SymbolReference[]> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) return [];

  const refs: SymbolReference[] = [];

  for (const file of indexed.cache.files) {
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(file.path).toLowerCase())) continue;

    try {
      const content = await readFile(file.path, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.includes('import') && line.includes(symbolName)) {
          refs.push({
            file: file.relativePath,
            line: i + 1,
            content: line.trimEnd(),
            kind: 'import',
          });
          continue;
        }

        const regex = new RegExp(`\\b${escapeRegex(symbolName)}\\b`);
        if (regex.test(line) && !line.trimStart().startsWith('//') && !line.trimStart().startsWith('*')) {
          refs.push({
            file: file.relativePath,
            line: i + 1,
            content: line.trimEnd(),
            kind: 'usage',
          });
        }
      }
    } catch {
      // Skip.
    }
  }

  return refs.slice(0, 100);
}

/**
 * Returns the dependency graph for the selected MyceliumOps repository.
 */
export async function getDependencyGraph(organizationId: string, workspaceId?: string): Promise<{
  nodes: { id: string; group: string; lineCount: number; symbolCount: number }[];
  edges: DependencyEdge[];
}> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) return { nodes: [], edges: [] };

  const { files, edges } = indexed.cache;

  const nodes = files
    .filter(f => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(f.path).toLowerCase()))
    .map(f => {
      const parts = f.relativePath.split('/');
      const group = parts.length > 2 && parts[0] === 'src' ? `src/${parts[1]}` : (parts[0] || 'root');
      return {
        id: f.relativePath,
        group,
        lineCount: f.lineCount,
        symbolCount: f.symbols.length,
      };
    });

  const nodeIds = new Set(nodes.map(n => n.id));
  const resolvedEdges = edges.filter(e => nodeIds.has(e.source));

  return { nodes, edges: resolvedEdges };
}

/**
 * Returns aggregate statistics for the selected MyceliumOps repository.
 */
export async function getStats(organizationId: string, workspaceId?: string): Promise<CodebaseStats> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) {
    return {
      totalFiles: 0,
      totalLines: 0,
      totalBytes: 0,
      languages: {},
      directories: {},
      avgFileSize: 0,
      largestFiles: [],
    };
  }
  return indexed.cache.stats;
}

/**
 * Lists all files in the selected MyceliumOps repository with metadata.
 */
export async function listFiles(organizationId: string, workspaceId?: string): Promise<Omit<FileInfo, 'path'>[]> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) return [];
  return indexed.cache.files.map(({ path: _p, ...rest }) => rest);
}

/**
 * Answers questions grounded in the selected MyceliumOps repository.
 */
export async function askCodebase(
  organizationId: string,
  question: string,
  preferredModel?: string,
  workspaceId?: string,
): Promise<{
  question: string;
  answer: string;
  citations: { file: string; line?: number; reason: string }[];
  relatedSymbols: CodeSymbol[];
}> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) {
    return {
      question,
      answer: 'No MyceliumOps repository found to analyze for this organization. Please run a production chain in Mission Control to generate code.',
      citations: [],
      relatedSymbols: [],
    };
  }

  const repoName = indexed.ws.name;
  const { files, topFiles } = await rankFilesForQuestion(indexed.cache.files, question, 5, 3);
  return answerFromRanked(organizationId, question, repoName, files.length, topFiles, preferredModel);
}

type RankedFile = { file: FileInfo; score: number; matchedReasons: string[]; snippet?: string; snippetStart?: number };

/**
 * Files most relevant to a natural-language question, with the excerpt that
 * best matches it. Shared by Code Intelligence "Ask" and Mother Chat, which
 * otherwise only knew file names and couldn't answer code questions.
 *
 * Word matching can't link "drift" to `endAt - Date.now()`, so when the top
 * file is small enough it is returned whole and the model finds the logic.
 */
export async function retrieveCodeContext(
  organizationId: string,
  question: string,
  workspaceId: string,
  opts: { maxFiles?: number; contextLines?: number; wholeTopFileChars?: number } = {},
): Promise<Array<{ file: string; startLine: number; snippet: string }>> {
  const indexed = await indexCodebase(organizationId, workspaceId);
  if (!indexed) return [];
  const { topFiles } = await rankFilesForQuestion(indexed.cache.files, question, opts.maxFiles ?? 3, opts.contextLines ?? 15);
  const out = topFiles
    .filter((t) => t.snippet)
    .map((t) => ({ file: t.file.relativePath, startLine: t.snippetStart ?? 1, snippet: t.snippet! }));
  const limit = opts.wholeTopFileChars ?? 0;
  if (limit > 0 && topFiles[0]) {
    try {
      const whole = await readFile(topFiles[0].file.path, 'utf-8');
      if (whole.length <= limit) out[0] = { file: topFiles[0].file.relativePath, startLine: 1, snippet: whole };
    } catch { /* keep the excerpt */ }
  }
  return out;
}

async function rankFilesForQuestion(files: FileInfo[], question: string, maxFiles: number, contextLines: number) {
  const q = question.toLowerCase();
  const keywords = q
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 2 && !['how', 'what', 'where', 'when', 'which', 'who', 'why', 'does', 'did', 'the', 'and', 'for', 'are', 'with', 'from', 'this', 'that', 'nexus', 'work', 'works', 'working', 'implemented', 'explain', 'tell', 'show', 'into', 'have', 'been'].includes(k))
    // Light stemming so "drifting" finds "drift" and "timers" finds "timer".
    .map(k => (k.length > 5 ? k.replace(/(ing|ed|es|s)$/, '') : k));

  const scoredFiles: RankedFile[] = [];
  for (const f of files) {
    let score = 0;
    const reasons: string[] = [];
    const lowerPath = f.relativePath.toLowerCase();
    const base = lowerPath.split('/').pop() || '';

    for (const kw of keywords) {
      if (base.includes(kw)) {
        score += 15;
        reasons.push(`Filename matches "${kw}"`);
      } else if (lowerPath.includes(kw)) {
        score += 8;
        reasons.push(`Path matches "${kw}"`);
      }
      for (const sym of f.symbols) {
        const lowerSym = sym.name.toLowerCase();
        if (lowerSym === kw) {
          score += 12;
          reasons.push(`Symbol "${sym.name}" exactly matches "${kw}"`);
        } else if (lowerSym.includes(kw)) {
          score += 5;
          reasons.push(`Symbol "${sym.name}" matches "${kw}"`);
        }
      }
      for (const imp of f.imports) {
        if (imp.toLowerCase().includes(kw)) {
          score += 2;
        }
      }
    }

    if (score > 0) {
      scoredFiles.push({ file: f, score, matchedReasons: reasons.slice(0, 3) });
    }
  }

  scoredFiles.sort((a, b) => b.score - a.score);
  const topFiles = scoredFiles.slice(0, maxFiles);

  // Extract snippet excerpts for top files
  for (const tf of topFiles) {
    try {
      const content = await readFile(tf.file.path, 'utf-8');
      const lines = content.split('\n');
      // The window with the most keyword hits, not the first hit: the first
      // mention is usually an import line, so a question about a component's
      // logic used to get its import block instead of the logic.
      // Each keyword is weighted by how rare it is in this file, so a word
      // that names the file (and fills its class names) can't drown out the
      // one that points at the logic.
      const isImport = (line: string) => /^\s*(import\s|export\s+\*|.*\brequire\()/.test(line);
      const lineCount: Record<string, number> = {};
      for (const kw of keywords) lineCount[kw] = lines.filter((l) => !isImport(l) && l.toLowerCase().includes(kw)).length;
      const hits = lines.map((line) => {
        if (isImport(line)) return 0;
        const l = line.toLowerCase();
        return keywords.reduce((n, kw) => n + (l.includes(kw) ? 1 / lineCount[kw] : 0), 0);
      });
      const span = Math.max(4, contextLines + 3);
      let best = -1;
      let bestStart = Math.max(0, (tf.file.symbols[0]?.line || 1) - 2);
      let sum = 0;
      for (let i = 0; i < lines.length; i++) {
        sum += hits[i];
        if (i >= span) sum -= hits[i - span];
        if (i >= span - 1 || i === lines.length - 1) {
          const s = Math.max(0, i - span + 1);
          if (sum > best) { best = sum; bestStart = s; }
        }
      }
      const start = best > 0 ? bestStart : Math.max(0, (tf.file.symbols[0]?.line || 1) - 2);
      const end = Math.min(lines.length, start + span);
      tf.snippet = lines.slice(start, end).join('\n');
      tf.snippetStart = start + 1;
    } catch {
      // Ignore read error
    }
  }
  return { files, topFiles };
}

async function answerFromRanked(
  organizationId: string,
  question: string,
  repoName: string,
  filesScanned: number,
  topFiles: RankedFile[],
  preferredModel?: string,
): Promise<{ question: string; answer: string; citations: { file: string; line?: number; reason: string }[]; relatedSymbols: CodeSymbol[] }> {
  const files = { length: filesScanned };

  const relatedSymbols: CodeSymbol[] = [];
  for (const item of topFiles) {
    relatedSymbols.push(...item.file.symbols.slice(0, 4));
  }

  const citations = topFiles.map(tf => ({
    file: tf.file.relativePath,
    line: tf.file.symbols[0]?.line || 1,
    reason: tf.matchedReasons.join('; '),
  }));

  if (topFiles.length === 0) {
    return {
      question,
      answer: `I analyzed the MyceliumOps repository "${repoName}" for "${question}", but couldn't locate direct matches in the indexed files (${files.length} files scanned). Try searching for components, exports, or functions present in this codebase.`,
      citations: [],
      relatedSymbols: [],
    };
  }

  let aiAnswer: string | null = null;
  let unavailableReason: string | null = null;
  const contextBlock = topFiles.map(tf => (
    `File: ${tf.file.relativePath} (${tf.file.language}, ${tf.file.lineCount} lines)\n` +
    `Symbols: ${tf.file.symbols.slice(0, 6).map(s => `${s.kind} ${s.name}`).join(', ')}\n` +
    (tf.snippet ? `Snippet:\n${tf.snippet}\n` : '')
  )).join('\n---\n');

  const prompt = `You are the MyceliumOps AI Code Intelligence Assistant. A developer asked the following question about the MyceliumOps-engineered repository "${repoName}":\n\n` +
    `Question: "${question}"\n\n` +
    `Here is the indexed repository context with relevant files and code excerpts:\n\n` +
    `${contextBlock}\n\n` +
    `Provide a clear, detailed, and technically accurate explanation in GitHub-flavored Markdown. ` +
    `Explain how the architecture works, reference specific files and symbols, and provide code guidance where applicable. Keep the tone professional, helpful, and concise.`;

  // 1. Explicit OpenCode model selection
  if (preferredModel && (preferredModel.startsWith('opencode/') || preferredModel.startsWith('nvidia/'))) {
    try {
      const op = await askOpenCode(prompt, preferredModel);
      if (op.result && op.result.trim().length > 20) aiAnswer = op.result.trim();
    } catch (err) { unavailableReason = (err as Error).message; }
  }

  // 2. Try Gemini API (Default Cloud Intelligence)
  if (!aiAnswer) {
    let geminiKey = process.env.GEMINI_API_KEY || process.env.PLATFORM_GOOGLE_API_KEY || process.env.GOOGLE_API_KEY;
    if (organizationId) {
      try {
        const provs = await prisma.llmProvider.findMany({
          where: { organizationId, isActive: true },
        });
        const gProv = provs.find((p) => p.provider.toLowerCase() === 'google' || p.provider.toLowerCase() === 'gemini');
        if (gProv?.apiKey) {
          try { geminiKey = decryptField(gProv.apiKey); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    if (geminiKey) {
      const cleanPreferred = preferredModel ? preferredModel.replace(/^(google|gemini)\//i, '') : null;
      const candidateModels = [
        cleanPreferred,
        'gemini-flash-lite-latest',
        'gemini-flash-latest',
        'gemini-3.5-flash-lite',
        ...config.geminiModels.map(m => m.replace(/^(google|gemini)\//i, '')),
      ].filter(Boolean) as string[];

      // Deduplicate
      const uniqueCandidates = Array.from(new Set(candidateModels));

      for (const m of uniqueCandidates) {
        try {
          const res = await fetch(
            `${config.geminiApiBaseUrl}/v1beta/models/${m}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
              }),
              signal: AbortSignal.timeout(15000),
            },
          );
          if (res.ok) {
            const data = (await res.json()) as any;
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && typeof text === 'string' && text.trim().length > 0) {
              aiAnswer = text.trim();
              break;
            }
          }
        } catch { /* try next */ }
      }
    }
  }

  // 3. Try Claude CLI if enabled
  if (!aiAnswer && isClaudeCliEnabled()) {
    try {
      const cliRes = await runClaudeCli(prompt, { timeoutMs: 15000 });
      if (cliRes?.text && cliRes.text.trim().length > 20) {
        aiAnswer = cliRes.text.trim();
      }
    } catch { /* fallthrough */ }
  }

  // 4. Try Local PC Ollama
  if (!aiAnswer) {
    const endpoints = config.localLlmEndpoints;
    for (const ep of endpoints) {
      try {
        const ping = await fetch(`${ep}/api/tags`, { signal: AbortSignal.timeout(1500) });
        if (!ping.ok) continue;

        const res = await fetch(`${ep}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: preferredModel?.replace(/^local\//, '') || config.localLlmModel,
            prompt,
            stream: false,
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const data = (await res.json()) as any;
          if (data?.response && typeof data.response === 'string') {
            aiAnswer = data.response.trim();
            break;
          }
        }
      } catch { /* try next */ }
    }
  }

  // 4. "Auto" with no Gemini key or local model used to stop here, so orgs on
  // the platform's OpenCode models only ever got the retrieval fallback.
  if (!aiAnswer && !preferredModel && config.opencodeModel) {
    try {
      const op = await askOpenCode(prompt, config.opencodeModel);
      if (op.result && op.result.trim().length > 20) aiAnswer = op.result.trim();
    } catch (err) { unavailableReason = (err as Error).message; }
  }

  // Grounded truthful retrieval synthesis (no invented summaries)
  const finalAnswer = aiAnswer || (
    `### 🔍 Direct Retrieval Matches for: "${question}"\n\n` +
    `No AI model answered${unavailableReason ? ` (${unavailableReason})` : ''}, so here are the matching code passages from the **${repoName}** workspace instead:\n\n` +
    topFiles.map((tf, idx) => {
      const lineStart = tf.file.symbols[0]?.line || 1;
      const lineEnd = lineStart + (tf.snippet ? tf.snippet.split('\n').length : 1) - 1;
      return `#### ${idx + 1}. \`${tf.file.relativePath}\` (Lines ${lineStart}–${lineEnd})\n` +
        (tf.snippet ? `\`\`\`${tf.file.language.toLowerCase().includes('type') ? 'typescript' : 'javascript'}\n${tf.snippet}\n\`\`\`\n` : '');
    }).join('\n')
  );

  return {
    question,
    answer: finalAnswer,
    citations,
    relatedSymbols: relatedSymbols.slice(0, 8),
  };
}

/**
 * Forces a re-index of a workspace on the next request.
 */
export function invalidateCache(organizationId?: string, workspaceId?: string): void {
  if (organizationId && workspaceId) {
    workspaceCaches.delete(`${organizationId}:${workspaceId}`);
  } else if (organizationId) {
    const prefix = `${organizationId}:`;
    for (const key of workspaceCaches.keys()) {
      if (key.startsWith(prefix)) {
        workspaceCaches.delete(key);
      }
    }
  } else {
    workspaceCaches.clear();
  }
}

// ─── Helpers ────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
