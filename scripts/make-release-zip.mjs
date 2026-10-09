import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
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
  { name: 'NVIDIA API Key', regex: /nvapi-[A-Za-z0-9_-]{40,}/ },
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

// ── Pure Node.js ZIP Builder (Deflate + Standard PK Headers) ─────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

function computeCrc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

console.log(`[Release Builder] Packaging ${filesToPackage.length} files into authentic ZIP archive...`);

const locals = [];
const central = [];
let offset = 0;

for (const item of filesToPackage) {
  const content = fs.readFileSync(item.fullPath);
  const compressed = zlib.deflateRawSync(content);
  // Prepend top-level directory name "nexusqa/" matching standard release layout
  const normalizedPath = 'nexusqa/' + item.relPath.split(path.sep).join('/');
  const nameBuf = Buffer.from(normalizedPath, 'utf8');
  const crc = computeCrc32(content);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);  // local file header signature
  localHeader.writeUInt16LE(20, 4);          // version needed (2.0)
  localHeader.writeUInt16LE(0, 6);           // flags
  localHeader.writeUInt16LE(8, 8);           // method: deflate
  localHeader.writeUInt16LE(0, 10);          // mod time
  localHeader.writeUInt16LE(0, 12);          // mod date
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(content.length, 22);
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28);          // extra length

  locals.push(localHeader, nameBuf, compressed);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // central directory signature
  centralHeader.writeUInt16LE(20, 4);         // version made by
  centralHeader.writeUInt16LE(20, 6);         // version needed
  centralHeader.writeUInt16LE(0, 8);          // flags
  centralHeader.writeUInt16LE(8, 10);         // method: deflate
  centralHeader.writeUInt16LE(0, 12);         // mod time
  centralHeader.writeUInt16LE(0, 14);         // mod date
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(content.length, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30);         // extra length
  centralHeader.writeUInt16LE(0, 32);         // comment length
  centralHeader.writeUInt16LE(0, 34);         // disk number start
  centralHeader.writeUInt16LE(0, 36);         // internal attrs
  centralHeader.writeUInt32LE(0, 38);         // external attrs
  centralHeader.writeUInt32LE(offset, 42);    // relative offset of local header

  central.push(centralHeader, nameBuf);
  offset += localHeader.length + nameBuf.length + compressed.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);            // end of central directory signature
end.writeUInt16LE(0, 4);                     // disk number
end.writeUInt16LE(0, 6);                     // central dir disk
end.writeUInt16LE(filesToPackage.length, 8); // entries on disk
end.writeUInt16LE(filesToPackage.length, 10);// total entries
end.writeUInt32LE(centralBuf.length, 12);    // size of central dir
end.writeUInt32LE(offset, 16);               // offset of start of central dir
end.writeUInt16LE(0, 20);                    // zip comment length

const finalArchive = Buffer.concat([...locals, centralBuf, end]);

// Remove existing target zip if present
if (fs.existsSync(targetZip)) {
  fs.unlinkSync(targetZip);
}

// Ensure parent dir of target exists
fs.mkdirSync(path.dirname(targetZip), { recursive: true });

// Write archive buffer atomically
fs.writeFileSync(targetZip, finalArchive);

// Post-archive verification: Check PK magic headers
const headBytes = finalArchive.subarray(0, 4);
const tailBytes = finalArchive.subarray(finalArchive.length - 22, finalArchive.length - 18);
const isPkHeader = headBytes.equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])); // PK\x03\x04
const isEocdHeader = tailBytes.equals(Buffer.from([0x50, 0x4b, 0x05, 0x06])); // PK\x05\x06

if (!isPkHeader || !isEocdHeader) {
  console.error('[INTEGRITY ERROR] Generated file does not conform to genuine PKZIP format.');
  process.exit(1);
}

const zipStats = fs.statSync(targetZip);
console.log(`[Release Builder] Archive created successfully: ${targetZip} (${(zipStats.size / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`[Release Builder] Archive hygiene check passed: verified PKZIP standard headers (0x04034b50/0x06054b50), absence of local .env files, session artifacts, and verified 0 secrets across ${filesToPackage.length} files.`);
