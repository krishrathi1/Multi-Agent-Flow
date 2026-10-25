import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

// Base directory for cloned repositories
const BASE_REPOS_DIR = process.env.REPOS_STORAGE_PATH || path.join(process.cwd(), 'data', 'repos');

export interface RepoFileInfo {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
}

export interface RepoDetails {
  commitHash?: string;
  commitMessage?: string;
  filesCount?: number;
  clonedAt?: string;
}

/**
 * Ensures the target repository folder exists and returns its absolute path.
 */
export function getRepoPath(orgId: string, category: 'packs' | 'skills', id: string): string {
  // Sanitize parts to prevent directory traversal
  const safeOrg = orgId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  return path.join(BASE_REPOS_DIR, safeOrg, category, safeId);
}

/**
 * Validates that a git URL is safe and well-formed.
 */
export function validateGitUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) throw new Error('Repository URL is required');

  // Allow standard git protocols: https://, http://, git@, ssh://
  const isHttp = /^https?:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/.test(trimmed);
  const isSsh = /^(git@[a-zA-Z0-9\-._]+:[a-zA-Z0-9\-._~/-]+|ssh:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+)$/.test(trimmed);

  if (!isHttp && !isSsh) {
    throw new Error('Invalid repository URL format. Please use a valid HTTPS or SSH Git URL.');
  }

  return trimmed;
}

/**
 * Clones or updates a Git repository into local VPS storage.
 */
export async function cloneOrPullRepo(
  orgId: string,
  category: 'packs' | 'skills',
  id: string,
  repoUrl: string,
  branch: string = 'main'
): Promise<RepoDetails> {
  const safeUrl = validateGitUrl(repoUrl);
  const targetDir = getRepoPath(orgId, category, id);
  const safeBranch = branch.trim().replace(/[^a-zA-Z0-9._/-]/g, '') || 'main';

  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  const isAlreadyCloned = fs.existsSync(path.join(targetDir, '.git'));

  try {
    if (!isAlreadyCloned) {
      // Clean up targetDir if partially created
      if (fs.existsSync(targetDir)) {
        fs.rmSync(targetDir, { recursive: true, force: true });
      }

      logger.info({ orgId, id, safeUrl, safeBranch, targetDir }, 'Cloning git repository to VPS storage');

      // Shallow clone for rapid download
      try {
        await execFileAsync(
          'git',
          ['clone', '--depth', '1', '--branch', safeBranch, safeUrl, targetDir],
          { timeout: 60000 }
        );
      } catch (err: any) {
        // Fallback: If specified branch doesn't exist, clone default branch
        logger.warn({ err: err.message }, 'Failed to clone specific branch, falling back to default branch');
        if (fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
        await execFileAsync(
          'git',
          ['clone', '--depth', '1', safeUrl, targetDir],
          { timeout: 60000 }
        );
      }
    } else {
      logger.info({ orgId, id, targetDir }, 'Pulling latest updates for existing git repo on VPS');
      await execFileAsync('git', ['fetch', '--depth', '1', 'origin'], { cwd: targetDir, timeout: 45000 });
      await execFileAsync('git', ['reset', '--hard', 'FETCH_HEAD'], { cwd: targetDir, timeout: 30000 });
    }

    // Inspect commit details
    let commitHash = '';
    let commitMessage = '';
    try {
      const { stdout: hashOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: targetDir });
      commitHash = hashOut.trim().slice(0, 8);

      const { stdout: msgOut } = await execFileAsync('git', ['log', '-1', '--pretty=%B'], { cwd: targetDir });
      commitMessage = msgOut.trim().split('\n')[0] || '';
    } catch {
      // Non-fatal if git rev-parse fails
    }

    const filesCount = countFilesInDir(targetDir);

    logger.info({ targetDir, commitHash, filesCount }, 'Successfully saved repo to VPS storage');

    return {
      commitHash,
      commitMessage,
      filesCount,
      clonedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    logger.error({ error: error.message, targetDir }, 'Failed to download git repository on VPS');
    throw new Error(`Git clone failed: ${error.message || 'Unknown error during clone'}`);
  }
}

/**
 * Reads a directory tree inside a cloned repo (safe against path traversal).
 */
export async function getRepoFileTree(
  orgId: string,
  category: 'packs' | 'skills',
  id: string,
  subPath: string = ''
): Promise<{ files: RepoFileInfo[]; currentPath: string; isCloned: boolean }> {
  const targetDir = getRepoPath(orgId, category, id);

  if (!fs.existsSync(targetDir)) {
    return { files: [], currentPath: '', isCloned: false };
  }

  const normalizedSubPath = path.normalize(subPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absoluteTarget = path.resolve(targetDir, normalizedSubPath);

  // Path traversal check
  if (!absoluteTarget.startsWith(path.resolve(targetDir))) {
    throw new Error('Access denied: Invalid directory path');
  }

  if (!fs.existsSync(absoluteTarget) || !fs.statSync(absoluteTarget).isDirectory()) {
    return { files: [], currentPath: normalizedSubPath, isCloned: true };
  }

  const entries = fs.readdirSync(absoluteTarget, { withFileTypes: true });
  const files: RepoFileInfo[] = [];

  for (const entry of entries) {
    // Ignore .git internal directory
    if (entry.name === '.git') continue;

    const fullEntryPath = path.join(absoluteTarget, entry.name);
    const relPath = path.relative(targetDir, fullEntryPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      files.push({
        name: entry.name,
        path: relPath,
        isDirectory: true,
      });
    } else if (entry.isFile()) {
      const stats = fs.statSync(fullEntryPath);
      files.push({
        name: entry.name,
        path: relPath,
        isDirectory: false,
        size: stats.size,
        extension: path.extname(entry.name).slice(1),
      });
    }
  }

  // Sort directories first, then alphabetically
  files.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    return a.name.localeCompare(b.name);
  });

  return {
    files,
    currentPath: normalizedSubPath.replace(/\\/g, '/'),
    isCloned: true,
  };
}

/**
 * Reads a specific file content inside a cloned repo (safe against path traversal).
 */
export async function getRepoFileContent(
  orgId: string,
  category: 'packs' | 'skills',
  id: string,
  filePath: string
): Promise<{ name: string; path: string; content: string; size: number; isBinary: boolean }> {
  const targetDir = getRepoPath(orgId, category, id);

  if (!fs.existsSync(targetDir)) {
    throw new Error('Repository is not downloaded yet.');
  }

  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absoluteTarget = path.resolve(targetDir, normalizedPath);

  if (!absoluteTarget.startsWith(path.resolve(targetDir))) {
    throw new Error('Access denied: Invalid file path');
  }

  if (!fs.existsSync(absoluteTarget) || !fs.statSync(absoluteTarget).isFile()) {
    throw new Error('File not found in repository.');
  }

  const stats = fs.statSync(absoluteTarget);
  // Cap at 2MB for browser viewing
  if (stats.size > 2 * 1024 * 1024) {
    return {
      name: path.basename(absoluteTarget),
      path: normalizedPath.replace(/\\/g, '/'),
      content: `[File size is ${(stats.size / (1024 * 1024)).toFixed(2)} MB — too large for web preview]`,
      size: stats.size,
      isBinary: true,
    };
  }

  const buffer = fs.readFileSync(absoluteTarget);
  const isBinary = isBinaryBuffer(buffer);

  return {
    name: path.basename(absoluteTarget),
    path: normalizedPath.replace(/\\/g, '/'),
    content: isBinary ? '[Binary File]' : buffer.toString('utf-8'),
    size: stats.size,
    isBinary,
  };
}

/**
 * Cleans up repository folder from disk.
 */
export function removeRepo(orgId: string, category: 'packs' | 'skills', id: string): void {
  const targetDir = getRepoPath(orgId, category, id);
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    logger.info({ targetDir }, 'Removed repository directory from VPS storage');
  }
}

function countFilesInDir(dir: string): number {
  let count = 0;
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      if (item.name === '.git') continue;
      if (item.isDirectory()) {
        count += countFilesInDir(path.join(dir, item.name));
      } else {
        count++;
      }
    }
  } catch {}
  return count;
}

function isBinaryBuffer(buf: Buffer): boolean {
  const maxCheck = Math.min(buf.length, 8000);
  for (let i = 0; i < maxCheck; i++) {
    if (buf[i] === 0) return true; // null byte typically denotes binary
  }
  return false;
}
