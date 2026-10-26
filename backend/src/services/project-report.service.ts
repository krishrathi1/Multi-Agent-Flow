import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';
import { workspaceFor, listWorkspaceFiles } from './agent-runner.service.js';
import { readWorkspaceGit, type WorkspaceGitInfo } from './git-deploy.service.js';

/**
 * Production report: what a chain actually built, read from its workspace,
 * run history, token usage and git data.
 *
 * Every field is evidence. The previous version filled gaps with invented
 * content — sample endpoints and env vars, "VERIFIED" checks for Docker and
 * Zod that didn't exist, a hard-coded repository, and MyceliumOps' own git
 * history — so a report could describe a project nobody built. When
 * something is unknown the report now says so.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type CheckStatus = 'pass' | 'warn' | 'fail' | 'info';

export interface ReportCheck {
  name: string;
  status: CheckStatus;
  detail: string;
}

export interface ReportStage {
  stage: number;
  agent: string;
  role: string;
  state: string;
  durationMs: number | null;
  tokens: number | null;
  costUsd: number | null;
  files: string[];
  outcome: string;
}

export interface ReportFile {
  path: string;
  language: string;
  lines: number;
  bytes: number;
  description: string;
}

export interface ReportRunStep {
  label: string;
  command: string;
}

export interface ProjectReport {
  processId: string;
  processName: string;
  generatedAt: string;
  goal: string;
  summary: string | null;
  status: string;
  models: string[];
  run: {
    state: string;
    startedAt: string;
    finishedAt: string | null;
    durationMs: number | null;
    totalTokens: number;
    totalCostUsd: number;
    error: string | null;
  } | null;
  runsTotal: number;
  runsCompleted: number;
  usage: { totalTokens: number; totalCostUsd: number };
  stages: ReportStage[];
  stack: {
    languages: Array<{ name: string; lines: number; files: number; percent: number }>;
    dependencies: string[];
    packageManager: string | null;
    totalFiles: number;
    totalLines: number;
    totalBytes: number;
  };
  howToRun: { prerequisites: string[]; steps: ReportRunStep[]; notes: string[] };
  apiEndpoints: Array<{ method: string; path: string; file: string }>;
  envVariables: Array<{ key: string; example: string | null; source: string }>;
  dataModels: Array<{ name: string; file: string; fields: Array<{ name: string; type: string; optional: boolean }> }>;
  files: ReportFile[];
  git: {
    local: WorkspaceGitInfo | null;
    github: { repoUrl: string; commitSha: string | null; branch: string; at: string } | null;
    targetRepo: string | null;
  };
  checks: ReportCheck[];
  markdown: string;
}

// ─── Workspace reading ─────────────────────────────────────────────────────

const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.md', '.html', '.htm', '.css', '.scss',
  '.py', '.sql', '.prisma', '.yml', '.yaml', '.toml', '.txt', '.sh', '.vue', '.svelte', '.example',
]);
const MAX_READ_BYTES = 512 * 1024;

const LANGUAGE: Record<string, string> = {
  '.ts': 'TypeScript', '.tsx': 'TypeScript', '.js': 'JavaScript', '.jsx': 'JavaScript', '.mjs': 'JavaScript',
  '.cjs': 'JavaScript', '.json': 'JSON', '.md': 'Markdown', '.html': 'HTML', '.htm': 'HTML', '.css': 'CSS',
  '.scss': 'SCSS', '.py': 'Python', '.sql': 'SQL', '.prisma': 'Prisma', '.yml': 'YAML', '.yaml': 'YAML',
  '.toml': 'TOML', '.sh': 'Shell', '.vue': 'Vue', '.svelte': 'Svelte',
};

function languageOf(file: string): string {
  const base = path.basename(file).toLowerCase();
  if (base === 'dockerfile') return 'Dockerfile';
  if (base.startsWith('.env')) return 'Env';
  return LANGUAGE[path.extname(base)] ?? 'Other';
}

const isText = (file: string) => {
  const base = path.basename(file).toLowerCase();
  return TEXT_EXT.has(path.extname(base)) || base === 'dockerfile' || base.startsWith('.env');
};
const isLockfile = (file: string) => /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(file);
const isTestFile = (file: string) => /(\.|\/)(test|spec)\.[jt]sx?$/.test(file) || /(^|\/)(tests?|__tests__)\//.test(file);
const isAgentNote = (file: string) => /-output\.md$/.test(file);

/** Reads every text file once; binary and oversized files are counted, not read. */
async function readWorkspace(dir: string, files: Array<{ path: string; size: number }>) {
  const contents = new Map<string, string>();
  for (const f of files) {
    if (!isText(f.path) || f.size > MAX_READ_BYTES) continue;
    // Never read a real .env: its values are secrets, not documentation.
    if (/(^|\/)\.env(\.(?!example$)[^/]*)?$/.test(f.path)) continue;
    try {
      contents.set(f.path, await fs.readFile(path.join(dir, f.path), 'utf-8'));
    } catch { /* unreadable */ }
  }
  return contents;
}

// ─── File descriptions ─────────────────────────────────────────────────────

function firstSentence(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(.+?[.!?])(\s|$)/);
  const s = m ? m[1] : clean;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function exportsOf(content: string): string[] {
  const names = new Set<string>();
  const re = /export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) names.add(m[1]);
  return [...names];
}

/** Describes a file from its own content: leading comment, title, exports. */
function describeFile(file: string, content: string | undefined): string {
  const base = path.basename(file).toLowerCase();
  if (content === undefined) return isLockfile(file) ? 'Dependency lockfile.' : '';
  if (isLockfile(file)) return 'Dependency lockfile.';

  if (base === 'package.json') {
    try {
      const pkg = JSON.parse(content);
      const scripts = Object.keys(pkg.scripts ?? {});
      return `Package manifest${pkg.name ? ` for "${pkg.name}"` : ''}${scripts.length ? `; scripts: ${scripts.join(', ')}` : ''}.`;
    } catch { return 'Package manifest.'; }
  }
  if (base === 'tsconfig.json') return 'TypeScript compiler settings.';
  if (/^vite\.config\./.test(base)) return 'Vite build configuration.';
  if (base === 'dockerfile') return 'Container image definition.';
  if (base === '.env.example') return 'Example environment variables.';

  if (/\.html?$/.test(base)) {
    const title = content.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
    return title ? `HTML page "${title}".` : 'HTML page.';
  }
  if (/\.md$/.test(base)) {
    if (isAgentNote(file)) return 'Notes written by an agent at the end of its stage.';
    const heading = content.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim();
    return heading ? `Document: ${heading}.` : 'Markdown document.';
  }

  const parts: string[] = [];
  const lead = content.match(/^\s*(?:\/\*\*?([\s\S]*?)\*\/|((?:[ \t]*\/\/[^\n]*\n)+))/);
  if (lead) {
    const text = (lead[1] ?? lead[2] ?? '').replace(/^\s*(\*|\/\/)\s?/gm, '').trim();
    if (text && !/^eslint|^@ts-|^prettier/i.test(text)) parts.push(firstSentence(text));
  }
  if (isTestFile(file)) {
    const cases = (content.match(/\b(?:it|test)\s*\(/g) ?? []).length;
    parts.push(`Tests: ${cases} case${cases === 1 ? '' : 's'}.`);
  } else {
    const ex = exportsOf(content);
    if (ex.length) parts.push(`Exports ${ex.slice(0, 6).join(', ')}${ex.length > 6 ? ` and ${ex.length - 6} more` : ''}.`);
  }
  return parts.join(' ');
}

// ─── Project structure extraction ──────────────────────────────────────────

function findApiEndpoints(contents: Map<string, string>) {
  const found: Array<{ method: string; path: string; file: string }> = [];
  const seen = new Set<string>();
  const add = (method: string, route: string, file: string) => {
    const key = `${method} ${route}`;
    if (!seen.has(key)) { seen.add(key); found.push({ method, path: route, file }); }
  };

  for (const [file, content] of contents) {
    if (/(^|\/)(openapi|swagger|api-spec)[^/]*\.json$/i.test(file)) {
      try {
        for (const [route, ops] of Object.entries<any>(JSON.parse(content).paths ?? {})) {
          for (const m of Object.keys(ops)) if (/^(get|post|put|patch|delete)$/i.test(m)) add(m.toUpperCase(), route, file);
        }
      } catch { /* not JSON */ }
    }
  }
  const route = /\b(?:app|router|server|api)\s*\.\s*(get|post|put|patch|delete)\s*\(\s*['"`](\/[^'"`]*)['"`]/g;
  for (const [file, content] of contents) {
    if (!/\.[cm]?[jt]sx?$/.test(file) || isTestFile(file)) continue;
    let m: RegExpExecArray | null;
    while ((m = route.exec(content))) add(m[1].toUpperCase(), m[2], file);
  }
  return found.slice(0, 100);
}

function findEnvVariables(contents: Map<string, string>) {
  const vars = new Map<string, { key: string; example: string | null; source: string }>();
  for (const [file, content] of contents) {
    if (!/(^|\/)\.env\.example$/.test(file)) continue;
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m) vars.set(m[1], { key: m[1], example: m[2].replace(/^["']|["']$/g, '') || null, source: file });
    }
  }
  const use = /\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g;
  for (const [file, content] of contents) {
    if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
    let m: RegExpExecArray | null;
    while ((m = use.exec(content))) {
      if (!vars.has(m[1]) && !['NODE_ENV', 'DEV', 'PROD', 'MODE', 'BASE_URL', 'SSR'].includes(m[1])) {
        vars.set(m[1], { key: m[1], example: null, source: file });
      }
    }
  }
  return [...vars.values()].slice(0, 60);
}

function findDataModels(contents: Map<string, string>) {
  const models: ProjectReport['dataModels'] = [];
  for (const [file, content] of contents) {
    if (file.endsWith('.prisma')) {
      for (const m of content.matchAll(/model\s+(\w+)\s*\{([^}]*)\}/g)) {
        const fields = m[2].split('\n')
          .map((l) => l.trim())
          .filter((l) => l && !l.startsWith('//') && !l.startsWith('@@'))
          .map((l) => l.split(/\s+/))
          .filter((p) => p.length >= 2)
          .map(([name, type]) => ({ name, type: type.replace(/\?$/, ''), optional: type.endsWith('?') }));
        models.push({ name: m[1], file, fields });
      }
    }
  }
  // TypeScript shapes in files that look like they hold the domain types.
  for (const [file, content] of contents) {
    if (!/\.tsx?$/.test(file) || isTestFile(file) || !/(types?|models?|schema|entit|domain)/i.test(file)) continue;
    for (const m of content.matchAll(/export\s+(?:interface\s+(\w+)(?:\s+extends\s+[^{]+)?|type\s+(\w+)\s*=)\s*\{([^{}]*)\}/g)) {
      const fields = m[3].split(/[;\n]/)
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('//') && !l.startsWith('*') && !l.startsWith('/*'))
        .map((l) => l.match(/^(?:readonly\s+)?([\w$]+)(\??)\s*:\s*(.+)$/))
        .filter((x): x is RegExpMatchArray => !!x)
        .map((x) => ({ name: x[1], type: x[3].replace(/[,;]$/, '').trim(), optional: x[2] === '?' }));
      if (fields.length) models.push({ name: m[1] ?? m[2], file, fields: fields.slice(0, 25) });
    }
  }
  return models.slice(0, 20);
}

function readPackage(contents: Map<string, string>): { file: string; pkg: any } | null {
  const candidates = [...contents.keys()].filter((f) => f.endsWith('package.json')).sort((a, b) => a.split('/').length - b.split('/').length);
  for (const file of candidates) {
    try { return { file, pkg: JSON.parse(contents.get(file)!) }; } catch { /* next */ }
  }
  return null;
}

/** Run instructions built only from scripts and files that exist. */
function buildHowToRun(files: string[], contents: Map<string, string>, github: ProjectReport['git']['github'], processId: string) {
  const prerequisites: string[] = [];
  const steps: ReportRunStep[] = [];
  const notes: string[] = [];
  const pkg = readPackage(contents);
  const has = (re: RegExp) => files.some((f) => re.test(f));

  steps.push(github
    ? { label: 'Get the code', command: `git clone ${github.repoUrl}.git` }
    : { label: 'Get the code', command: `# Download the workspace from MyceliumOps (Files → Download all)\n# or: GET /api/processes/${processId}/artifacts.zip` });

  if (pkg) {
    const dir = path.posix.dirname(pkg.file);
    const pm = has(/(^|\/)pnpm-lock\.yaml$/) ? 'pnpm' : has(/(^|\/)yarn\.lock$/) ? 'yarn' : 'npm';
    const engines = pkg.pkg.engines?.node;
    prerequisites.push(`Node.js${engines ? ` ${engines}` : ''}`, pm === 'npm' ? 'npm (ships with Node.js)' : pm);
    if (dir !== '.') steps.push({ label: 'Enter the project folder', command: `cd ${dir}` });
    steps.push({ label: 'Install dependencies', command: `${pm} install` });
    if (has(/(^|\/)\.env\.example$/)) steps.push({ label: 'Create your environment file', command: 'cp .env.example .env' });

    const scripts: Record<string, string> = pkg.pkg.scripts ?? {};
    const run = (name: string) => (name === 'start' || name === 'test' ? `${pm} ${name}` : `${pm} run ${name}`);
    const labels: Record<string, string> = {
      dev: 'Start the development server', start: 'Start the app', build: 'Build for production',
      test: 'Run the tests', typecheck: 'Type-check', lint: 'Lint', preview: 'Preview the production build',
    };
    for (const name of ['dev', 'start', 'build', 'test', 'typecheck', 'lint', 'preview']) {
      if (scripts[name]) steps.push({ label: labels[name], command: run(name) });
    }
    if (!scripts.dev && !scripts.start && has(/(^|\/)index\.html$/)) notes.push('No dev or start script; open index.html in a browser.');
    const deps = { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies };
    if (deps.vite && (scripts.dev || scripts.preview)) notes.push('Vite serves on http://localhost:5173 by default.');
  } else if (has(/(^|\/)index\.html$/)) {
    steps.push({ label: 'Open the app', command: 'open index.html   # or double-click it' });
  } else {
    notes.push('No package.json or index.html was produced, so there is no runnable entry point yet.');
  }

  if (has(/(^|\/)docker-compose\.ya?ml$/)) {
    prerequisites.push('Docker');
    steps.push({ label: 'Or run with Docker Compose', command: 'docker compose up --build' });
  } else if (has(/(^|\/)Dockerfile$/)) {
    prerequisites.push('Docker');
    steps.push({ label: 'Or run in Docker', command: 'docker build -t app . && docker run --rm -p 3000:3000 app' });
    notes.push('Check the Dockerfile for the port it exposes.');
  }
  return { prerequisites, steps, notes };
}

const SECRET_PATTERNS: Array<[string, RegExp]> = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['OpenAI-style key', /\bsk-[A-Za-z0-9]{20,}/],
  ['GitHub token', /\b(ghp|gho|github_pat)_[A-Za-z0-9_]{20,}/],
  ['Private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['Hard-coded password', /\bpassword\s*[:=]\s*['"][^'"\s]{6,}['"]/i],
];

/** Last meaningful paragraph of an agent's narration ("I'll start by…" first). */
function outcomeOf(summary: string | null): string {
  if (!summary) return '';
  const paras = summary.split(/\n{2,}|\n(?=[A-Z])/).map((p) => p.trim()).filter(Boolean);
  const last = paras[paras.length - 1] ?? '';
  return last.length > 600 ? `${last.slice(0, 599)}…` : last;
}

// ─── Report ────────────────────────────────────────────────────────────────

export async function generateProjectReport(processId: string, organizationId: string): Promise<ProjectReport> {
  const proc = await prisma.process.findFirst({
    where: { id: processId, organizationId },
    include: {
      agents: { orderBy: { processStage: 'asc' } },
      runs: { orderBy: { startedAt: 'desc' }, take: 20, include: { steps: true } },
    },
  });
  if (!proc) throw new Error('Process not found');

  const workspaceDir = workspaceFor(processId);
  const rawFiles = await listWorkspaceFiles(processId);
  const contents = await readWorkspace(workspaceDir, rawFiles);

  // Files & stack
  const files: ReportFile[] = rawFiles.map((f) => {
    const content = contents.get(f.path);
    return {
      path: f.path,
      language: languageOf(f.path),
      lines: content === undefined ? 0 : content.split('\n').length,
      bytes: f.size,
      description: describeFile(f.path, content),
    };
  });
  const langTotals = new Map<string, { lines: number; files: number }>();
  for (const f of files) {
    if (isLockfile(f.path) || f.language === 'Other') continue;
    const t = langTotals.get(f.language) ?? { lines: 0, files: 0 };
    t.lines += f.lines; t.files += 1;
    langTotals.set(f.language, t);
  }
  const countedLines = [...langTotals.values()].reduce((a, b) => a + b.lines, 0) || 1;
  const languages = [...langTotals.entries()]
    .map(([name, t]) => ({ name, ...t, percent: Math.round((t.lines / countedLines) * 100) }))
    .sort((a, b) => b.lines - a.lines);

  const pkg = readPackage(contents);
  const deps = pkg ? { ...pkg.pkg.dependencies, ...pkg.pkg.devDependencies } : {};
  const dependencies = Object.entries<string>(deps).map(([n, v]) => `${n} ${v}`);
  const fileNames = rawFiles.map((f) => f.path);
  const packageManager = !pkg ? null
    : fileNames.some((f) => f.endsWith('pnpm-lock.yaml')) ? 'pnpm'
    : fileNames.some((f) => f.endsWith('yarn.lock')) ? 'yarn' : 'npm';

  // Runs & usage
  const latest = proc.runs[0] ?? null;
  const agentIds = proc.agents.map((a) => a.id);
  const [usage, modelRows] = await Promise.all([
    prisma.tokenUsage.aggregate({ where: { agentId: { in: agentIds } }, _sum: { totalTokens: true, cost: true } }),
    prisma.tokenUsage.findMany({ where: { agentId: { in: agentIds } }, distinct: ['model'], select: { model: true } }),
  ]);
  const plannedModel = proc.plannedBy?.includes(':') ? proc.plannedBy.slice(proc.plannedBy.indexOf(':') + 1) : null;
  const models = [...new Set([...modelRows.map((r) => r.model), ...(plannedModel ? [plannedModel] : [])])];

  const stepsByAgent = new Map((latest?.steps ?? []).map((s) => [s.agentId, s]));
  const stages: ReportStage[] = proc.agents.map((a) => {
    const s = stepsByAgent.get(a.id);
    const stepFiles = Array.isArray(s?.files) ? (s!.files as unknown[]).filter((x): x is string => typeof x === 'string') : [];
    return {
      stage: a.processStage ?? 1,
      agent: a.displayName || a.name,
      role: a.processRole || a.description || '',
      state: s?.state ?? (latest ? 'NOT_RUN' : 'NO_RUN'),
      durationMs: s ? s.durationMs : null,
      tokens: s ? s.tokens : null,
      costUsd: s ? s.costUsd : null,
      files: stepFiles,
      outcome: s ? (s.state === 'FAILED' ? (s.error ?? 'Failed without an error message.') : outcomeOf(s.summary)) : '',
    };
  });

  // Git
  const local = await readWorkspaceGit(workspaceDir);
  const pushActivity = await prisma.activity.findFirst({
    where: { processId, organizationId, message: { startsWith: '✓ Autonomous delivery: Pushed' } },
    orderBy: { createdAt: 'desc' },
  });
  const pushMeta = (pushActivity?.metadata as any)?.githubPush;
  const github = pushMeta?.repoUrl
    ? { repoUrl: String(pushMeta.repoUrl), commitSha: pushMeta.commitSha ?? null, branch: pushMeta.branch ?? 'main', at: pushMeta.at ?? pushActivity!.createdAt.toISOString() }
    : null;
  const targetRepo = proc.prompt.match(/Target GitHub Repository:\s*([^\s(\n]+)/i)?.[1]?.trim() ?? null;

  // Checks
  const checks: ReportCheck[] = [];
  const minutes = (ms: number) => formatDuration(ms);
  if (!latest) checks.push({ name: 'Latest run', status: 'warn', detail: 'This production has not been run yet.' });
  else if (latest.state === 'COMPLETED') checks.push({ name: 'Latest run', status: 'pass', detail: `All ${latest.steps.length} agent steps completed in ${minutes(latest.durationMs || 0)}.` });
  else if (latest.state === 'FAILED') checks.push({ name: 'Latest run', status: 'fail', detail: latest.error || 'The run failed.' });
  else checks.push({ name: 'Latest run', status: 'info', detail: `Run is ${latest.state.toLowerCase().replace(/_/g, ' ')}.` });

  const sourceFiles = files.filter((f) => !isLockfile(f.path) && !isAgentNote(f.path));
  checks.push(sourceFiles.length > 0
    ? { name: 'Files produced', status: 'pass', detail: `${sourceFiles.length} project files (${files.reduce((a, f) => a + f.lines, 0).toLocaleString('en-US')} lines).` }
    : { name: 'Files produced', status: 'fail', detail: 'The workspace has no project files.' });

  checks.push(fileNames.some((f) => /(^|\/)index\.html$/.test(f))
    ? { name: 'Previewable', status: 'pass', detail: 'index.html exists, so Watch Preview can open the app.' }
    : { name: 'Previewable', status: 'warn', detail: 'No index.html, so Watch Preview has nothing to show.' });

  const tests = files.filter((f) => isTestFile(f.path));
  const testCases = tests.reduce((n, f) => n + ((contents.get(f.path) ?? '').match(/\b(?:it|test)\s*\(/g) ?? []).length, 0);
  checks.push(tests.length
    ? { name: 'Automated tests', status: 'pass', detail: `${tests.length} test file(s) with ${testCases} test case(s). The report lists them; it does not run them.` }
    : { name: 'Automated tests', status: 'warn', detail: 'No test files were written.' });

  if (fileNames.some((f) => /(^|\/)tsconfig\.json$/.test(f))) {
    const strict = /"strict"\s*:\s*true/.test(contents.get(fileNames.find((f) => /(^|\/)tsconfig\.json$/.test(f))!) ?? '');
    checks.push({ name: 'Type checking', status: 'pass', detail: `tsconfig.json present${strict ? ' with strict mode on' : ' (strict mode off)'}.` });
  }

  const scripts = pkg?.pkg.scripts ?? {};
  checks.push(scripts.dev || scripts.start || scripts.build
    ? { name: 'Run scripts', status: 'pass', detail: `package.json defines: ${Object.keys(scripts).join(', ')}.` }
    : { name: 'Run scripts', status: pkg ? 'warn' : 'info', detail: pkg ? 'package.json has no dev, start or build script.' : 'No package.json.' });

  const leaks: string[] = [];
  for (const [file, content] of contents) {
    if (isLockfile(file) || /\.env\.example$/.test(file)) continue;
    for (const [label, re] of SECRET_PATTERNS) if (re.test(content)) leaks.push(`${label} in ${file}`);
  }
  checks.push(leaks.length
    ? { name: 'Hard-coded secrets', status: 'fail', detail: leaks.slice(0, 5).join('; ') }
    : { name: 'Hard-coded secrets', status: 'pass', detail: 'No key, token or password patterns found in the source.' });
  if (fileNames.some((f) => /(^|\/)\.env$/.test(f))) {
    checks.push({ name: '.env file', status: 'warn', detail: 'A .env file exists. It is never committed or pushed, but check it holds no production secrets.' });
  }

  checks.push(local
    ? { name: 'Version control', status: 'pass', detail: `Committed as ${local.latestCommit.slice(0, 8)} on ${local.branch} (${local.commitCount} commit${local.commitCount === 1 ? '' : 's'}).` }
    : { name: 'Version control', status: 'info', detail: 'No commit yet. A snapshot commit is made when a run finishes.' });
  checks.push(github
    ? { name: 'GitHub', status: 'pass', detail: `Pushed to ${github.repoUrl}${github.commitSha ? ` (${github.commitSha.slice(0, 8)})` : ''}.` }
    : targetRepo
      ? { name: 'GitHub', status: 'warn', detail: `Target ${targetRepo} is set but nothing has been pushed. Connect GitHub in Settings → Integrations.` }
      : { name: 'GitHub', status: 'info', detail: 'No target repository configured.' });

  const report: Omit<ProjectReport, 'markdown'> = {
    processId: proc.id,
    processName: proc.name,
    generatedAt: new Date().toISOString(),
    goal: proc.prompt,
    summary: proc.summary,
    status: proc.status,
    models,
    run: latest ? {
      state: latest.state,
      startedAt: latest.startedAt.toISOString(),
      finishedAt: latest.finishedAt?.toISOString() ?? null,
      durationMs: latest.durationMs || null,
      totalTokens: latest.totalTokens,
      totalCostUsd: latest.totalCostUsd,
      error: latest.error,
    } : null,
    runsTotal: proc.runs.length,
    runsCompleted: proc.runs.filter((r) => r.state === 'COMPLETED').length,
    usage: { totalTokens: usage._sum.totalTokens ?? 0, totalCostUsd: usage._sum.cost ?? 0 },
    stages,
    stack: {
      languages,
      dependencies,
      packageManager,
      totalFiles: files.length,
      totalLines: files.reduce((a, f) => a + (isLockfile(f.path) ? 0 : f.lines), 0),
      totalBytes: files.reduce((a, f) => a + f.bytes, 0),
    },
    howToRun: buildHowToRun(fileNames, contents, github, processId),
    apiEndpoints: findApiEndpoints(contents),
    envVariables: findEnvVariables(contents),
    dataModels: findDataModels(contents),
    files,
    git: { local, github, targetRepo },
    checks,
  };
  return { ...report, markdown: renderReportMarkdown(report) };
}

// ─── Markdown ──────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ${s % 60} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

const formatBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);
const ICON: Record<CheckStatus, string> = { pass: '✅', warn: '⚠️', fail: '❌', info: 'ℹ️' };
const STATE_LABEL: Record<string, string> = {
  COMPLETED: '✅ Completed', FAILED: '❌ Failed', RUNNING: '⏳ Running', QUEUED: '⏳ Queued',
  AWAITING_APPROVAL: '⏸️ Awaiting approval', CANCELLED: '⏹️ Cancelled', NOT_RUN: '— Not run', NO_RUN: '— Not run',
};
/** Table cells can't hold pipes or newlines. */
const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export function renderReportMarkdown(r: Omit<ProjectReport, 'markdown'>): string {
  const out: string[] = [];
  const stageCount = new Set(r.stages.map((s) => s.stage)).size;
  const when = new Date(r.generatedAt).toUTCString().replace(' GMT', ' UTC');

  out.push(`# ${r.processName}`, '');
  out.push(`Production report · generated ${when}`, '');
  out.push(`> ${r.goal.trim().split('\n').join('\n> ')}`, '');

  // At a glance
  out.push('## At a glance', '');
  out.push('| | |', '|---|---|');
  out.push(`| Status | ${r.run ? STATE_LABEL[r.run.state] ?? r.run.state : 'Not run yet'}${r.run?.durationMs ? ` in ${formatDuration(r.run.durationMs)}` : ''} |`);
  out.push(`| Team | ${r.stages.length} agent${r.stages.length === 1 ? '' : 's'} across ${stageCount} stage${stageCount === 1 ? '' : 's'} |`);
  out.push(`| Code | ${r.stack.totalFiles} files · ${r.stack.totalLines.toLocaleString('en-US')} lines · ${formatBytes(r.stack.totalBytes)} |`);
  if (r.stack.languages.length) out.push(`| Languages | ${r.stack.languages.slice(0, 5).map((l) => `${l.name} ${l.percent}%`).join(' · ')} |`);
  if (r.models.length) out.push(`| Model${r.models.length > 1 ? 's' : ''} | ${r.models.map((m) => `\`${m}\``).join(', ')} |`);
  out.push(`| Usage | ${r.usage.totalTokens.toLocaleString('en-US')} tokens · $${r.usage.totalCostUsd.toFixed(4)} · ${r.runsCompleted} of ${r.runsTotal} run${r.runsTotal === 1 ? '' : 's'} completed |`);
  out.push(`| Repository | ${r.git.github ? `[${r.git.github.repoUrl.replace('https://github.com/', '')}](${r.git.github.repoUrl})` : r.git.targetRepo ? `${r.git.targetRepo} (not pushed yet)` : 'Not pushed'} |`);
  out.push('');

  // Checks
  out.push('## Checks', '');
  out.push('| | Check | Details |', '|---|---|---|');
  for (const c of r.checks) out.push(`| ${ICON[c.status]} | ${c.name} | ${cell(c.detail)} |`);
  out.push('');

  // How to run
  out.push('## How to run it', '');
  if (r.howToRun.prerequisites.length) out.push(`**You need:** ${r.howToRun.prerequisites.join(', ')}`, '');
  r.howToRun.steps.forEach((s, i) => {
    out.push(`**${i + 1}. ${s.label}**`, '', '```bash', s.command, '```', '');
  });
  for (const n of r.howToRun.notes) out.push(`- ${n}`);
  if (r.howToRun.notes.length) out.push('');

  // Agents
  out.push('## What each agent did', '');
  for (const s of [...r.stages].sort((a, b) => a.stage - b.stage)) {
    out.push(`### Stage ${s.stage} · ${s.agent}`, '');
    const facts = [
      STATE_LABEL[s.state] ?? s.state,
      s.durationMs != null ? formatDuration(s.durationMs) : null,
      s.files.length ? `${s.files.length} file${s.files.length === 1 ? '' : 's'}` : null,
      s.tokens ? `${s.tokens.toLocaleString('en-US')} tokens` : null,
    ].filter(Boolean);
    out.push(`*${s.role || 'Agent'}* — ${facts.join(' · ')}`, '');
    if (s.outcome) out.push(s.outcome, '');
    if (s.files.length) out.push(`Files: ${s.files.slice(0, 12).map((f) => `\`${f}\``).join(', ')}${s.files.length > 12 ? `, and ${s.files.length - 12} more` : ''}`, '');
  }

  // Structure
  if (r.apiEndpoints.length) {
    out.push('## API endpoints', '', '| Method | Path | Defined in |', '|---|---|---|');
    for (const e of r.apiEndpoints) out.push(`| \`${e.method}\` | \`${cell(e.path)}\` | \`${e.file}\` |`);
    out.push('');
  }
  if (r.envVariables.length) {
    out.push('## Environment variables', '', '| Variable | Example | Found in |', '|---|---|---|');
    for (const v of r.envVariables) out.push(`| \`${v.key}\` | ${v.example ? `\`${cell(v.example)}\`` : '—'} | \`${v.source}\` |`);
    out.push('');
  }
  if (r.dataModels.length) {
    out.push('## Data models', '');
    for (const m of r.dataModels) {
      out.push(`### ${m.name}`, '', `Defined in \`${m.file}\``, '', '| Field | Type | |', '|---|---|---|');
      for (const f of m.fields) out.push(`| \`${f.name}\` | \`${cell(f.type)}\` | ${f.optional ? 'optional' : ''} |`);
      out.push('');
    }
  }

  // Files
  out.push('## Files', '', '| File | Lines | Size | What it is |', '|---|--:|--:|---|');
  for (const f of [...r.files].sort((a, b) => a.path.localeCompare(b.path))) {
    out.push(`| \`${f.path}\` | ${f.lines ? f.lines.toLocaleString('en-US') : '—'} | ${formatBytes(f.bytes)} | ${cell(f.description) || '—'} |`);
  }
  out.push('');

  // Git
  out.push('## Version control', '');
  if (r.git.local) {
    const g = r.git.local;
    out.push(`- **Latest commit:** \`${g.latestCommit.slice(0, 8)}\` on \`${g.branch}\` — ${g.commitMessage}`);
    out.push(`- **Author:** ${g.author} · ${new Date(g.date).toUTCString().replace(' GMT', ' UTC')}`);
    out.push(`- **History:** ${g.commitCount} commit${g.commitCount === 1 ? '' : 's'} in the project's own repository`);
  } else {
    out.push('- No commits yet. MyceliumOps commits the workspace when a run finishes.');
  }
  out.push(r.git.github
    ? `- **GitHub:** pushed to [${r.git.github.repoUrl}](${r.git.github.repoUrl}) on \`${r.git.github.branch}\`${r.git.github.commitSha ? ` as \`${r.git.github.commitSha.slice(0, 8)}\`` : ''}`
    : '- **GitHub:** not pushed');
  out.push('');
  if (r.git.local?.diffStat) out.push('Changes in the latest commit:', '', '```', r.git.local.diffStat, '```', '');

  out.push('---', '', '*Generated by MyceliumOps from this production\'s workspace, run history and git data.*', '');
  return out.join('\n');
}

// ─── Printable HTML ────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(s: string): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/**
 * Renders the report's own Markdown, so the printable page and the download
 * are the same document. Handles exactly the subset renderReportMarkdown
 * emits; everything is escaped first, since agents wrote much of the text.
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const html: string[] = [];
  let i = 0;
  const splitRow = (l: string) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) body.push(lines[i++]);
      i++;
      html.push(`<pre><code>${esc(body.join('\n'))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { html.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }
    if (line.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) body.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${body.map(inline).join('<br>')}</blockquote>`);
      continue;
    }
    if (line.startsWith('|')) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      const [head, , ...body] = rows;
      const ths = splitRow(head).map((c) => `<th>${inline(c)}</th>`).join('');
      const trs = body.map((r) => `<tr>${splitRow(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      html.push(`<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`);
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(lines[i++].slice(2));
      html.push(`<ul>${items.map((t) => `<li>${inline(t)}</li>`).join('')}</ul>`);
      continue;
    }
    if (line.trim() === '---') { html.push('<hr>'); i++; continue; }
    if (line.trim()) html.push(`<p>${inline(line)}</p>`);
    i++;
  }
  return html.join('\n');
}

export function renderReportHtml(report: ProjectReport): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(report.processName)} — Production report</title>
<style>
  :root { color-scheme: light; --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --soft:#f9fafb; --accent:#2563eb; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; color: var(--ink); font: 15px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 860px; margin: 0 auto; padding: 40px 24px 64px; }
  h1 { font-size: 28px; line-height: 1.2; margin: 0 0 4px; }
  h2 { font-size: 19px; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 1px solid var(--line); }
  h3 { font-size: 16px; margin: 22px 0 6px; }
  p { margin: 0 0 10px; }
  h1 + p { color: var(--muted); font-size: 13px; }
  blockquote { margin: 16px 0; padding: 10px 14px; border-left: 3px solid var(--accent); background: var(--soft); color: #374151; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 14px; font-size: 13.5px; }
  th, td { text-align: left; vertical-align: top; padding: 7px 10px; border-bottom: 1px solid var(--line); }
  th { font-weight: 600; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .03em; }
  code { font: 12.5px ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--soft); border: 1px solid var(--line); border-radius: 4px; padding: 1px 5px; }
  pre { background: #0f172a; color: #e2e8f0; border-radius: 8px; padding: 12px 14px; overflow-x: auto; margin: 6px 0 14px; }
  pre code { background: none; border: 0; padding: 0; color: inherit; }
  ul { padding-left: 20px; margin: 6px 0 14px; }
  a { color: var(--accent); }
  hr { border: 0; border-top: 1px solid var(--line); margin: 32px 0 12px; }
  hr + p { color: var(--muted); font-size: 12px; }
  @media print { main { padding: 0; } pre { white-space: pre-wrap; } h2 { break-after: avoid; } table, pre { break-inside: avoid; } }
</style>
</head>
<body><main>
${markdownToHtml(report.markdown)}
</main></body>
</html>`;
}
