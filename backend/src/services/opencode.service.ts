import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { config } from '../config.js';

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

export async function run(prompt: string, model?: string, cwd?: string) {
  const args = ['run', prompt];
  if (model?.trim()) args.push('--model', model.trim());
  const workingDirectory = cwd?.trim() || process.env.OPENCODE_WORKDIR || process.cwd();
  if (!existsSync(workingDirectory)) throw new Error(`OpenCode working directory does not exist: ${workingDirectory}`);
  const { stdout, stderr } = await execFileAsync(commandName(), args, {
    cwd: workingDirectory,
    timeout: config.opencodeTimeoutMs,
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024,
    env: process.env,
  });
  return { result: (stdout || stderr).trim(), model: model || config.opencodeModel || null };
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
