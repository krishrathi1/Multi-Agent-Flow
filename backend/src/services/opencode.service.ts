import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const execFileAsync = promisify(execFile);

function commandName() {
  return process.env.OPENCODE_BIN?.trim() || (process.platform === 'win32' ? 'opencode.exe' : 'opencode');
}

export async function status() {
  try {
    const { stdout, stderr } = await execFileAsync(commandName(), ['--version'], {
      timeout: 8000,
      windowsHide: true,
      env: process.env,
    });
    return { installed: true, version: (stdout || stderr).trim(), command: commandName() };
  } catch (error: any) {
    return { installed: false, version: null, command: commandName(), error: error?.code === 'ENOENT' ? 'OpenCode CLI not found' : error?.message };
  }
}

export interface OpenCodeModelItem {
  id: string;
  name: string;
  provider: string;
  family?: string;
  status?: string;
  context?: number;
  output?: number;
  free?: boolean;
}

export function parseOpenCodeModels(rawOutput: string): OpenCodeModelItem[] {
  const lines = rawOutput.split(/\r?\n/);
  const result: OpenCodeModelItem[] = [];
  let currentHeader = '';
  let jsonBuffer = '';
  let braceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (braceDepth === 0) {
      if (trimmed.startsWith('{')) {
        braceDepth = 1;
        jsonBuffer = trimmed + '\n';
      } else if (trimmed && !trimmed.startsWith('}')) {
        currentHeader = trimmed;
      }
    } else {
      jsonBuffer += line + '\n';
      for (const char of line) {
        if (char === '{') braceDepth++;
        else if (char === '}') braceDepth--;
      }
      if (braceDepth === 0) {
        try {
          const parsed = JSON.parse(jsonBuffer);
          const id = currentHeader || (parsed.providerID ? `${parsed.providerID}/${parsed.id}` : parsed.id);
          const parts = id.split('/');
          const provider = parsed.providerID || parts[0] || 'opencode';
          const isFree = (parsed.cost && parsed.cost.input === 0 && parsed.cost.output === 0) || id.includes('free') || (parsed.name && parsed.name.toLowerCase().includes('free'));
          result.push({
            id,
            name: parsed.name || parts[parts.length - 1] || id,
            provider,
            family: parsed.family,
            status: parsed.status,
            context: parsed.limit?.context,
            output: parsed.limit?.output,
            free: Boolean(isFree),
          });
        } catch {
          // ignore malformed JSON block
        }
        jsonBuffer = '';
        currentHeader = '';
      }
    }
  }

  // Fallback if no JSON blocks could be parsed
  if (result.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('/') && !trimmed.startsWith('{') && !trimmed.startsWith('}')) {
        const parts = trimmed.split('/');
        result.push({
          id: trimmed,
          name: parts[parts.length - 1],
          provider: parts[0],
          free: trimmed.includes('free'),
        });
      }
    }
  }

  return result;
}

export async function models() {
  try {
    const { stdout, stderr } = await execFileAsync(commandName(), ['models', '--verbose'], {
      timeout: 15000,
      windowsHide: true,
      env: process.env,
    });
    const raw = stdout || stderr;
    const parsedModels = parseOpenCodeModels(raw);
    return { installed: true, output: raw, models: parsedModels };
  } catch (error: any) {
    return { installed: false, output: '', models: [], error: error?.message || 'Unable to query OpenCode models' };
  }
}

/**
 * OpenCode treats the nearest enclosing git repository as the project. Agent
 * workspaces live under `backend/.nexus-workspaces/`, inside MyceliumOps' own
 * checkout, so without a repo of their own the agents read the platform's
 * source and config as "the project" — and the preview ended up reflecting it.
 */
async function ensureOwnProjectRoot(dir: string): Promise<void> {
  if (existsSync(path.join(dir, '.git'))) return;
  try {
    await execFileAsync('git', ['init', '-q'], { cwd: dir, windowsHide: true });
  } catch (err) {
    logger.warn({ err, dir }, 'Could not isolate agent workspace as its own git root');
  }
}

/** Empty directory for prompt-only turns (chat, Q&A) — never a real project. */
const PROMPT_SANDBOX = path.join(os.tmpdir(), 'mycelium-chat-sandbox');

/**
 * Runs a question-and-answer turn. Without a cwd, OpenCode ran inside the
 * backend's own source tree with its file tools enabled, so a chat message
 * could steer it into reading or editing the platform itself.
 */
export async function ask(prompt: string, model?: string, timeoutMs = 45000) {
  await mkdir(PROMPT_SANDBOX, { recursive: true });
  return run(prompt, model, PROMPT_SANDBOX, timeoutMs);
}

export async function run(prompt: string, model?: string, cwd?: string, timeoutMs?: number): Promise<{ result: string; model: string | null; exitCode: number | null }> {
  const args = ['run', prompt];
  if (model?.trim()) args.push('--model', model.trim());
  args.push('--pure');
  const workingDirectory = cwd?.trim() || process.env.OPENCODE_WORKDIR || process.cwd();
  if (!existsSync(workingDirectory)) throw new Error(`OpenCode working directory does not exist: ${workingDirectory}`);
  if (cwd?.trim()) await ensureOwnProjectRoot(workingDirectory);

  const effectiveTimeout = timeoutMs || config.opencodeTimeoutMs;

  return new Promise((resolve, reject) => {
    const child = spawn(commandName(), args, {
      cwd: workingDirectory,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      // OpenCode resolves its project directory from PWD, not the spawn cwd,
      // so an inherited PWD would point agents at the backend's own source.
      env: { ...process.env, PWD: workingDirectory },
    });

    let stdout = '';
    let stderr = '';
    let isTimedOut = false;

    const timer = setTimeout(() => {
      isTimedOut = true;
      try { child.kill('SIGTERM'); } catch { /* ignore */ }
      reject(new Error(`OpenCode execution timed out after ${effectiveTimeout}ms`));
    }, effectiveTimeout);

    child.stdout?.on('data', (d) => { stdout += d.toString(); });
    child.stderr?.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (err) => {
      clearTimeout(timer);
      if (!isTimedOut) reject(err);
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (isTimedOut) return;
      let cleanResult = (stdout || stderr).trim();
      cleanResult = cleanResult.replace(/^>\s*build\s*·\s*[^\n\r]+\r?\n+/i, '').trim();
      if (cleanResult.length === 0 && code !== 0) {
        reject(new Error(`OpenCode exited with code ${code}`));
      } else {
        // exitCode lets callers tell a finished session from one that died
        // part-way but had already printed some of its transcript.
        resolve({ result: cleanResult, model: model || config.opencodeModel || null, exitCode: code });
      }
    });
  });
}

export async function install() {
  if (process.env.OPENCODE_INSTALL_DISABLED === 'true') {
    throw new Error('OpenCode installation is disabled by OPENCODE_INSTALL_DISABLED.');
  }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const { stdout, stderr } = await execFileAsync(npm, ['install', '-g', 'opencode-ai@latest'], {
    timeout: config.opencodeInstallTimeoutMs,
    windowsHide: true,
    maxBuffer: 2 * 1024 * 1024,
    env: process.env,
  });
  return { output: stdout || stderr, status: await status() };
}
