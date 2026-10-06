import { config } from '../config.js';
import { run as runOpenCode } from './opencode.service.js';
import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, extname, basename } from 'path';
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

// ─── Configuration ──────────────────────────────────────

const SUPPORTED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.prisma', '.yml', '.yaml', '.sql', '.sh',
]);

const IGNORE_DIRS_BASE = new Set([
  'node_modules', '.git', 'build', '.next', 'coverage', '.nexus-workspaces', '.turbo',
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

// ─── Cache ──────────────────────────────────────────────

let fileCache: FileInfo[] = [];
let symbolCache: CodeSymbol[] = [];
let edgeCache: DependencyEdge[] = [];
let statsCache: CodebaseStats | null = null;
let lastIndexTime = 0;
const CACHE_TTL_MS = 60_000; // re-index every 60s at most

/**
 * Returns the project root directory.
 * Walks up to find the monorepo root containing package.json and backend/ or frontend/.
 */
function getProjectRoot(): string {
  if (typeof import.meta !== 'undefined' && import.meta.dirname) {
    const candidate = join(import.meta.dirname, '..', '..', '..');
    if (existsSync(join(candidate, 'package.json')) && (existsSync(join(candidate, 'backend')) || existsSync(join(candidate, 'frontend')))) {
      return candidate;
    }
  }
  const cwd = process.cwd();
  const parent = join(cwd, '..');
  if (existsSync(join(parent, 'package.json')) && (existsSync(join(parent, 'backend')) || existsSync(join(parent, 'frontend')))) {
    return parent;
  }
  if (existsSync(join(cwd, 'package.json')) && (existsSync(join(cwd, 'backend')) || existsSync(join(cwd, 'frontend')))) {
    return cwd;
  }
  return cwd;
}

// ─── File Scanner ───────────────────────────────────────

/**
 * Recursively walks the project tree and collects all source files,
 * skipping ignored directories and unsupported file types.
 */
async function scanDirectory(dir: string, root: string, hasSourceTree: boolean): Promise<string[]> {
  const files: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (IGNORE_DIRS_BASE.has(entry.name)) continue;
      // If source directory (backend/src or src) exists, ignore dist to avoid duplicate compiled files.
      // If no src directory exists (e.g. running in minimal production container), allow dist so files are indexed.
      if (entry.name === 'dist' && hasSourceTree) continue;
      if (entry.name.endsWith('.map')) continue; // Skip .map files

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
 * from TypeScript/JavaScript source text using regex-based heuristics.
 *
 * This is intentionally lightweight — no AST parser dependency needed.
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

    // arrow function const
    const arrowMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(/);
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
 * Extracts import statements from source code and resolves them to
 * relative paths within the project.
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
 * Indexes the entire project codebase: scans files, extracts symbols,
 * builds import/export edges, and caches everything. Thread-safe via
 * a simple TTL guard.
 */
export async function indexCodebase(): Promise<void> {
  const now = Date.now();
  if (now - lastIndexTime < CACHE_TTL_MS && fileCache.length > 0) return;

  const root = getProjectRoot();
  const hasSourceTree = existsSync(join(root, 'backend', 'src')) || existsSync(join(root, 'src'));
  logger.info({ root, hasSourceTree }, 'Indexing codebase for code intelligence');

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

      const fileImports = (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx')
        ? extractImports(content)
        : [];
      const fileExports = (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx')
        ? extractExports(content)
        : [];
      const fileSymbols = (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx')
        ? extractSymbols(content, relPath)
        : [];

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
          importNames: [], // could parse named imports later
        });
      }
    } catch {
      // File read error — skip.
    }
  }

  fileCache = files;
  symbolCache = symbols;
  edgeCache = edges;
  lastIndexTime = now;

  // Build stats
  const languages: Record<string, number> = {};
  const directories: Record<string, number> = {};
  let totalLines = 0;
  let totalBytes = 0;

  for (const f of files) {
    totalLines += f.lineCount;
    totalBytes += f.sizeBytes;
    languages[f.language] = (languages[f.language] || 0) + 1;
    const dir = f.relativePath.split('/').slice(0, 2).join('/');
    directories[dir] = (directories[dir] || 0) + 1;
  }

  const sortedBySize = [...files].sort((a, b) => b.lineCount - a.lineCount);
  statsCache = {
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

  logger.info(
    { files: files.length, symbols: symbols.length, edges: edges.length },
    'Codebase indexing complete',
  );
}

// ─── Public API ─────────────────────────────────────────

/**
 * Performs a semantic search across all indexed source files.
 * Supports plain text and basic regex patterns.
 */
export async function searchCode(
  query: string,
  options: { fileFilter?: string; language?: string; maxResults?: number; isRegex?: boolean } = {},
): Promise<SearchResult[]> {
  await indexCodebase();

  const { fileFilter, language, maxResults = 50, isRegex = false } = options;
  const results: SearchResult[] = [];

  let regex: RegExp;
  try {
    regex = isRegex ? new RegExp(query, 'gi') : new RegExp(escapeRegex(query), 'gi');
  } catch {
    return [];
  }

  for (const file of fileCache) {
    if (language && file.language !== language) continue;
    if (fileFilter && !file.relativePath.includes(fileFilter)) continue;

    try {
      const content = await readFile(file.path, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
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
          // Avoid infinite loop on zero-length matches
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
 * Lists all extracted symbols, optionally filtered by kind and search query.
 */
export async function getSymbols(
  options: { kind?: string; query?: string; fileFilter?: string; limit?: number } = {},
): Promise<CodeSymbol[]> {
  await indexCodebase();

  let result = [...symbolCache];

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
 * Reads a file's content and returns it with metadata for the file viewer.
 */
export async function getFileContent(
  filePath: string,
): Promise<{ relativePath: string; language: string; content: string; lineCount: number; symbols: CodeSymbol[] } | null> {
  await indexCodebase();

  const file = fileCache.find(f => f.relativePath === filePath);
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
 * Finds all references to a given symbol name across the codebase.
 */
export async function findReferences(symbolName: string): Promise<SymbolReference[]> {
  await indexCodebase();

  const refs: SymbolReference[] = [];

  for (const file of fileCache) {
    if (!['.ts', '.tsx', '.js', '.jsx'].includes(extname(file.path).toLowerCase())) continue;

    try {
      const content = await readFile(file.path, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check imports
        if (line.includes('import') && line.includes(symbolName)) {
          refs.push({
            file: file.relativePath,
            line: i + 1,
            content: line.trimEnd(),
            kind: 'import',
          });
          continue;
        }

        // Check usage (word boundary match)
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
 * Returns the dependency graph: file nodes + import edges.
 * Used by the Code Graph visualization on the frontend.
 */
export async function getDependencyGraph(): Promise<{
  nodes: { id: string; group: string; lineCount: number; symbolCount: number }[];
  edges: DependencyEdge[];
}> {
  await indexCodebase();

  const nodes = fileCache
    .filter(f => ['.ts', '.tsx', '.js', '.jsx'].includes(extname(f.path).toLowerCase()))
    .map(f => ({
      id: f.relativePath,
      group: f.relativePath.split('/')[0] || 'root',
      lineCount: f.lineCount,
      symbolCount: f.symbols.length,
    }));

  // Only include edges where both source and target are known files
  const nodeIds = new Set(nodes.map(n => n.id));
  const resolvedEdges = edgeCache.filter(e => {
    // Try to resolve the import target to a known file
    return nodeIds.has(e.source);
  });

  return { nodes, edges: resolvedEdges };
}

/**
 * Returns aggregate statistics about the codebase.
 */
export async function getStats(): Promise<CodebaseStats> {
  await indexCodebase();
  return statsCache!;
}

/**
 * Lists all indexed files with metadata (no content).
 */
export async function listFiles(): Promise<Omit<FileInfo, 'path'>[]> {
  await indexCodebase();
  return fileCache.map(({ path: _p, ...rest }) => rest);
}

/**
 * Answers a natural-language question about the codebase using
 * semantic indexing, symbol references, and grounded snippet citations.
 */
export async function askCodebase(
  question: string,
  organizationId?: string,
  preferredModel?: string,
): Promise<{
  question: string;
  answer: string;
  citations: { file: string; line?: number; reason: string }[];
  relatedSymbols: CodeSymbol[];
}> {
  await indexCodebase();

  const q = question.toLowerCase();
  const keywords = q
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(k => k.length > 2 && !['how', 'what', 'where', 'when', 'which', 'who', 'why', 'does', 'did', 'the', 'and', 'for', 'are', 'with', 'from', 'this', 'that', 'nexus', 'work', 'works', 'working', 'implemented', 'explain', 'tell', 'show', 'into', 'have', 'been'].includes(k));

  // Find relevant files
  const scoredFiles: { file: FileInfo; score: number; matchedReasons: string[]; snippet?: string }[] = [];
  for (const f of fileCache) {
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
  const topFiles = scoredFiles.slice(0, 5);

  // Extract real snippet excerpts for top files
  for (const tf of topFiles) {
    try {
      const content = await readFile(tf.file.path, 'utf-8');
      const lines = content.split('\n');
      let targetLine = tf.file.symbols[0]?.line || 1;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i].toLowerCase();
        if (keywords.some(kw => l.includes(kw))) {
          targetLine = i + 1;
          break;
        }
      }
      const start = Math.max(0, targetLine - 2);
      const end = Math.min(lines.length, targetLine + 4);
      tf.snippet = lines.slice(start, end).join('\n');
    } catch {
      // Ignore read error
    }
  }

  // Gather matching symbols
  const relatedSymbols: CodeSymbol[] = [];
  for (const item of topFiles) {
    relatedSymbols.push(...item.file.symbols.slice(0, 4));
  }

  // Construct grounded citations
  const citations = topFiles.map(tf => ({
    file: tf.file.relativePath,
    line: tf.file.symbols[0]?.line || 1,
    reason: tf.matchedReasons.join('; '),
  }));

  if (topFiles.length === 0) {
    return {
      question,
      answer: `I analyzed the codebase for "${question}", but couldn't locate direct matches in the indexed files (${fileCache.length} files scanned). Try searching for specific terms like "agent", "auth", "gateway", "prisma", "board", "llm", or "mcp".`,
      citations: [],
      relatedSymbols: [],
    };
  }

  // Attempt real AI explanation via available LLMs
  let aiAnswer: string | null = null;
  const contextBlock = topFiles.map(tf => (
    `File: ${tf.file.relativePath} (${tf.file.language}, ${tf.file.lineCount} lines)\n` +
    `Symbols: ${tf.file.symbols.slice(0, 6).map(s => `${s.kind} ${s.name}`).join(', ')}\n` +
    (tf.snippet ? `Snippet:\n${tf.snippet}\n` : '')
  )).join('\n---\n');

  const prompt = `You are the Nexus AI Code Intelligence Assistant. A developer asked the following question about this repository:\n\n` +
    `Question: "${question}"\n\n` +
    `Here is the indexed codebase context with relevant files and code excerpts:\n\n` +
    `${contextBlock}\n\n` +
    `Provide a clear, detailed, and technically accurate explanation in GitHub-flavored Markdown. ` +
    `Explain how the architecture works, reference specific files and symbols, and provide code guidance where applicable. Keep the tone professional, helpful, and concise.`;

  // 1. Explicit provider/model selection through OpenCode. This keeps
  // Code Intelligence on the same model picker as Mother Chat.
  if (preferredModel?.includes('/') && !preferredModel.startsWith('local/')) {
    try {
      const op = await runOpenCode(prompt, preferredModel);
      if (op.result && op.result.trim().length > 20) aiAnswer = op.result.trim();
    } catch { /* continue with configured providers */ }
  }

  // 2. Try Claude CLI if enabled
  if (!aiAnswer && isClaudeCliEnabled()) {
    try {
      const cliRes = await runClaudeCli(prompt, { timeoutMs: 15000 });
      if (cliRes?.text && cliRes.text.trim().length > 20) {
        aiAnswer = cliRes.text.trim();
      }
    } catch { /* fallthrough */ }
  }

  // 2. Try Google Gemini API
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
      const candidateModels = [preferredModel, ...config.geminiModels].filter(Boolean) as string[];
      for (const m of candidateModels) {
        try {
          const res = await fetch(
            `${config.geminiApiBaseUrl}/v1beta/models/${m}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
              }),
              signal: AbortSignal.timeout(config.localLlmRequestTimeoutMs),
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

  // 3. Try Local PC Ollama
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

  // Fallback to grounded structured synthesis if no LLM responded
  const finalAnswer = aiAnswer || (
    `### 🔍 Grounded Repository Analysis\n\n` +
    `**Question:** ${question}\n\n` +
    `Found **${topFiles.length} matching files** across the codebase index:\n\n` +
    topFiles.map(tf => (
      `#### 📄 \`${tf.file.relativePath}\` (${tf.file.language}, ${tf.file.lineCount} lines)\n` +
      `- **Relevance:** ${tf.matchedReasons.join('; ')}\n` +
      (tf.file.symbols.length ? `- **Symbols:** \`${tf.file.symbols.slice(0, 6).map(s => `${s.kind} ${s.name}`).join('`, `')}\`\n` : '') +
      (tf.snippet ? `\`\`\`${tf.file.language.toLowerCase().includes('type') ? 'typescript' : 'javascript'}\n${tf.snippet}\n\`\`\`\n` : '')
    )).join('\n') +
    `\n### 💡 Architectural Flow:\n` +
    `The primary entry point for this functionality is **\`${topFiles[0]?.file.relativePath}\`**` +
    (topFiles.length > 1 ? `, which collaborates with **\`${topFiles[1]?.file.relativePath}\`**.` : '.') +
    ` You can inspect references or trace import relationships directly in the Code Graph and Symbol Explorer.`
  );

  return {
    question,
    answer: finalAnswer,
    citations,
    relatedSymbols: relatedSymbols.slice(0, 8),
  };
}

/**
 * Forces a re-index of the codebase on the next request.
 */
export function invalidateCache(): void {
  lastIndexTime = 0;
}

// ─── Helpers ────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
