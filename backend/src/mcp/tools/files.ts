import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * File parser tool: turns a file in the production's workspace into a
 * structured summary — CSV/TSV columns with numeric stats, JSON shape
 * (package.json scripts and dependencies), Markdown outline, or a code file's
 * imports and exports. A directory (or no path) lists the files instead.
 */

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '.blackboard', '.agent-notes', 'coverage']);
const MAX_BYTES = 1_000_000;

/** Resolves `rel` inside `root`, refusing anything that climbs out of it. */
export function resolveInside(root: string, rel: string): string {
  // Agents often pass absolute paths inside their working directory (the
  // workspace); any other leading slash means "from the workspace root".
  const absolute = path.resolve(rel);
  const full = path.isAbsolute(rel) && !path.relative(root, absolute).startsWith('..')
    ? absolute
    : path.resolve(root, rel.replace(/^[/\\]+/, ''));
  const relative = path.relative(root, full);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`"${rel}" is outside the workspace`);
  return full;
}

async function listFiles(root: string, dir: string, out: string[], limit: number): Promise<void> {
  let entries: import('node:fs').Dirent[];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (out.length >= limit) return;
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await listFiles(root, full, out, limit);
    else out.push(path.relative(root, full).split(path.sep).join('/'));
  }
}

export function splitCsvLine(line: string, sep: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { cells.push(cell); cell = ''; }
    else cell += c;
  }
  cells.push(cell);
  return cells.map((v) => v.trim());
}

export function summarizeCsv(text: string, sep: string) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return { rows: 0, columns: [] };
  const header = splitCsvLine(lines[0], sep);
  const rows = lines.slice(1).map((l) => splitCsvLine(l, sep));
  const columns = header.map((name, ci) => {
    const values = rows.map((r) => r[ci] ?? '').filter((v) => v !== '');
    const nums = values.map((v) => Number(v.replace(/[$,%\s]/g, ''))).filter((n) => Number.isFinite(n));
    if (values.length && nums.length / values.length >= 0.8) {
      const sum = nums.reduce((s, n) => s + n, 0);
      return {
        name, type: 'number', count: nums.length,
        min: Math.min(...nums), max: Math.max(...nums),
        mean: Number((sum / nums.length).toPrecision(6)), sum: Number(sum.toPrecision(10)),
      };
    }
    const distinct = new Set(values);
    return { name, type: 'text', count: values.length, distinct: distinct.size, examples: [...distinct].slice(0, 5) };
  });
  return { rows: rows.length, columns, sample: rows.slice(0, 5) };
}

function describeJson(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return { type: 'array', length: value.length, item: value.length ? describeJson(value[0], depth + 1) : undefined };
  }
  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (depth >= 2) return { type: 'object', keys: keys.slice(0, 20) };
    return { type: 'object', keys: Object.fromEntries(keys.slice(0, 30).map((k) => [k, describeJson((value as any)[k], depth + 1)])) };
  }
  return typeof value;
}

function summarizeCode(text: string) {
  const imports = [...text.matchAll(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  const requires = [...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]);
  const exports = [...text.matchAll(/^\s*export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]);
  const functions = [...text.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g)].map((m) => m[1] || m[2]);
  return {
    lines: text.split('\n').length,
    imports: [...new Set([...imports, ...requires])],
    exports: [...new Set(exports)],
    functions: [...new Set(functions)].slice(0, 40),
    todos: (text.match(/\b(TODO|FIXME)\b/g) ?? []).length,
  };
}

export async function parseFile(workspace: string, rel = ''): Promise<Record<string, unknown>> {
  const full = resolveInside(workspace, rel || '.');
  const stat = await fs.stat(full).catch(() => null);
  if (!stat) throw new Error(`No file "${rel}" in the workspace`);
  // A symlink inside the workspace must not lead outside it.
  resolveInside(await fs.realpath(workspace), path.relative(await fs.realpath(workspace), await fs.realpath(full)));
  if (stat.isDirectory()) {
    const files: string[] = [];
    await listFiles(workspace, full, files, 300);
    return { path: rel || '.', kind: 'directory', count: files.length, files };
  }
  if (stat.size > MAX_BYTES) throw new Error(`"${rel}" is too large to parse (${stat.size} bytes)`);
  const text = await fs.readFile(full, 'utf8');
  const ext = path.extname(full).toLowerCase();
  const base = { path: rel, bytes: stat.size };

  if (ext === '.csv' || ext === '.tsv') return { ...base, kind: 'table', ...summarizeCsv(text, ext === '.tsv' ? '\t' : ',') };
  if (ext === '.json') {
    let data: any;
    try { data = JSON.parse(text); } catch (err) { return { ...base, kind: 'json', valid: false, error: (err as Error).message }; }
    if (path.basename(full) === 'package.json') {
      return {
        ...base, kind: 'package.json', valid: true, name: data.name, version: data.version, type: data.type,
        scripts: data.scripts ?? {}, dependencies: data.dependencies ?? {}, devDependencies: data.devDependencies ?? {},
      };
    }
    return { ...base, kind: 'json', valid: true, shape: describeJson(data) };
  }
  if (ext === '.md' || ext === '.markdown') {
    const outline = [...text.matchAll(/^(#{1,6})\s+(.+)$/gm)].map((m) => `${'  '.repeat(m[1].length - 1)}${m[2].trim()}`);
    const checklist = (text.match(/^\s*[-*] \[[ x]\]/gim) ?? []).length;
    return { ...base, kind: 'markdown', words: text.split(/\s+/).filter(Boolean).length, outline, checklistItems: checklist };
  }
  if (/\.(m?[jt]sx?|cjs|vue|svelte|py|go|rs|java|rb|php|css|scss|html)$/.test(ext)) {
    return { ...base, kind: 'code', language: ext.slice(1), ...summarizeCode(text) };
  }
  return { ...base, kind: 'text', lines: text.split('\n').length, preview: text.slice(0, 1500) };
}
