import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Default target: Desktop myc.zip if on Windows, else project root
const defaultDest = process.platform === 'win32'
  ? path.join(os.homedir(), 'Desktop', 'myc.zip')
  : path.join(projectRoot, 'myc.zip');

const targetZip = process.argv[2] ? path.resolve(process.argv[2]) : defaultDest;

console.log(`[Release Builder] Packaging project from: ${projectRoot}`);
console.log(`[Release Builder] Target archive: ${targetZip}`);

// Patterns and exact names to strictly exclude
const EXCLUDE_DIRS = new Set([
  'node_modules',
  '.git',
  '.nexus-workspaces',
  'dist',
  'build',
  'playwright-report',
  'test-results',
  'coverage',
  '.auth',
  'postgres-data',
  '.idea',
  '.turbo',
  '.cache',
]);

const EXCLUDE_EXTENSIONS = new Set([
  '.log',
  '.tmp',
  '.swp',
  '.swo',
  '.zip',
  '.tsbuildinfo',
]);

function shouldExcludeFile(relPath, fileName) {
  // Never exclude .env.example
  if (fileName === '.env.example' || fileName.endsWith('.env.example')) {
    return false;
  }

  // Exclude all other .env and .env.* files
  if (fileName === '.env' || fileName.startsWith('.env.') || fileName.includes('.env')) {
    return true;
  }

  // Exclude auth credentials/cookies
  if (relPath.includes('.auth') || (fileName === 'user.json' && relPath.includes('e2e'))) {
    return true;
  }

  // Exclude generated build/bundle config files ignored by git
  if (fileName === 'vite.config.js' || fileName === 'vite.config.d.ts') {
    return true;
  }

  // Exclude specific file extensions
  const ext = path.extname(fileName).toLowerCase();
  if (EXCLUDE_EXTENSIONS.has(ext)) {
    return true;
  }

  return false;
}

function collectFiles(currentDir, relativeDir = '') {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    const relPath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) {
        continue;
      }
      result.push(...collectFiles(fullPath, relPath));
    } else if (entry.isFile()) {
      if (shouldExcludeFile(relPath, entry.name)) {
        continue;
      }
      result.push({ fullPath, relPath });
    }
  }

  return result;
}

const filesToPackage = collectFiles(projectRoot);
console.log(`[Release Builder] Collected ${filesToPackage.length} clean source files.`);

// Pre-archive safety validation check
const illegalEntries = filesToPackage.filter(f => {
  const norm = f.relPath.replace(/\\/g, '/');
  return (
    (norm.includes('.env') && !norm.endsWith('.env.example')) ||
    norm.includes('.auth/') ||
    norm.includes('node_modules/') ||
    norm.includes('.git/') ||
    norm.endsWith('vite.config.js') ||
    norm.endsWith('vite.config.d.ts')
  );
});

if (illegalEntries.length > 0) {
  console.error('[SECURITY ERROR] Archive contains forbidden secret/system files:', illegalEntries);
  process.exit(1);
}

// ── Content-level Secret Scanner ─────────────────────────────
console.log(`[Release Builder] Running deep content secret scan over ${filesToPackage.length} files...`);

const SECRET_PATTERNS = [
  { name: 'Google API Key', regex: /AIzaSy[A-Za-z0-9_-]{33}/ },
  { name: 'GitHub Personal Token', regex: /ghp_[A-Za-z0-9]{36}/ },
  { name: 'GitHub Fine-grained PAT', regex: /github_pat_[A-Za-z0-9_]{82}/ },
  { name: 'Anthropic Live Key', regex: /sk-ant-api03-[A-Za-z0-9_-]{80,}/ },
  { name: 'OpenAI Live Key', regex: /sk-(?:proj-)?[A-Za-z0-9_-]{48,}/ },
  { name: 'AWS Access Key ID', regex: /(?:A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/ },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32}/ },
  { name: 'SendGrid Key', regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/ },
  { name: 'Private Key Header', regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PRIVATE) KEY-----/ },
];

const TEXT_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs',
  '.md', '.html', '.css', '.yml', '.yaml', '.txt',
  '.sql', '.prisma', '.sh', '.ps1', '.conf', '.toml', '.env.example'
]);

let detectedSecrets = 0;
for (const item of filesToPackage) {
  const ext = path.extname(item.fileName || item.relPath).toLowerCase();
  if (!TEXT_EXTS.has(ext)) continue;

  try {
    const content = fs.readFileSync(item.fullPath, 'utf8');
    for (const pat of SECRET_PATTERNS) {
      if (pat.regex.test(content)) {
        console.error(`[SECURITY LEAK DETECTED] ${pat.name} matched in file: ${item.relPath}`);
        detectedSecrets++;
      }
    }
  } catch {
    /* binary or unreadable file */
  }
}

if (detectedSecrets > 0) {
  console.error(`[CRITICAL SECURITY HALT] Detected ${detectedSecrets} real secret token pattern(s) in source code.`);
  process.exit(1);
}

console.log(`[Release Builder] Content scan PASSED: 0 active credential patterns detected across all text and test files.`);

// Staging directory
const stagingBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-release-'));
const stagingDir = path.join(stagingBase, 'nexusqa');
fs.mkdirSync(stagingDir, { recursive: true });

console.log(`[Release Builder] Staging clean files into: ${stagingDir}`);
for (const item of filesToPackage) {
  const destPath = path.join(stagingDir, item.relPath);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(item.fullPath, destPath);
}

// Remove existing target zip if present
if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

// Ensure parent dir of target exists
fs.mkdirSync(path.dirname(targetZip), { recursive: true });

console.log(`[Release Builder] Compressing archive...`);
execFileSync('tar', ['-a', '-c', '-f', targetZip, 'nexusqa'], {
  cwd: stagingBase,
  stdio: 'inherit',
});

// Clean up staging directory
fs.rmSync(stagingBase, { recursive: true, force: true });

// Post-archive verification
const zipStats = fs.statSync(targetZip);
console.log(`[Release Builder] Archive created successfully: ${targetZip} (${(zipStats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`[Release Builder] Archive hygiene check passed: verified absence of local .env files, session artifacts, and tested credential patterns across packaged source files.`);
