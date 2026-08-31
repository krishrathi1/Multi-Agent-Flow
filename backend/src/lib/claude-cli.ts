import { spawn } from 'node:child_process';
import { logger } from './logger.js';

/**
 * Runs a one-shot prompt through the locally installed Claude Code CLI.
 *
 * This lets Nexus use a real model without an API key — the CLI is already
 * authenticated on the host. It is a fallback *between* a configured API key
 * and the rule-based planner.
 *
 * SECURITY: the prompt originates from an HTTP request, so it is written to
 * the child's stdin and never interpolated into a shell string. `spawn` is
 * called with an argument array and `shell: false`, so there is no command
 * injection surface. Tools are disabled, so the model can only produce text —
 * it cannot read files or run commands on the host.
 */

export interface ClaudeCliResult {
  text: string;
  model: string;
  costUsd: number;
  /** Token counts, so callers can record real usage metrics. */
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

/** `claude` on PATH unless the operator pins a path. */
function cliBinary(): string {
  return process.env.CLAUDE_CLI_PATH || 'claude';
}

export function isClaudeCliEnabled(): boolean {
  // Opt-out switch for environments where shelling out isn't acceptable.
  return process.env.CLAUDE_CLI_PLANNER !== 'false';
}

interface CliEnvelope {
  is_error?: boolean;
  result?: string;
  subtype?: string;
  total_cost_usd?: number;
  duration_ms?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  modelUsage?: Record<string, unknown>;
}

export interface RunOptions {
  systemPrompt?: string;
  timeoutMs?: number;
  model?: string;
  /**
   * Working directory for the run. When set, the model's file tools operate
   * here — this is the sandbox boundary for agent work.
   */
  cwd?: string;
  /**
   * Tools the agent may use. Omit for a text-only run (planning, chat).
   * Passing tools implies `acceptEdits`, since headless runs cannot prompt.
   */
  allowedTools?: string[];
  /**
   * Receives a kill function once the child is spawned, so a long run can be
   * cancelled mid-flight instead of only between steps.
   */
  onSpawn?: (abort: () => void) => void;
}

export async function runClaudeCli(
  prompt: string,
  options: RunOptions = {},
): Promise<ClaudeCliResult | null> {
  if (!isClaudeCliEnabled()) return null;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const model = options.model ?? process.env.CLAUDE_CLI_MODEL;
  const tools = options.allowedTools ?? [];

  const args = ['-p', '--output-format', 'json'];

  if (tools.length > 0) {
    // Work mode: the agent may touch files inside its sandboxed workspace.
    args.push('--allowedTools', ...tools);
    // Headless runs can't answer a permission prompt, so edits are accepted
    // automatically. The blast radius is the workspace directory in `cwd`.
    args.push('--permission-mode', 'acceptEdits');
  } else {
    // Think mode: planning and chat produce text only. No filesystem, no shell.
    args.push(
      '--disallowed-tools',
      'Bash,Read,Write,Edit,Glob,Grep,WebFetch,WebSearch,Task,NotebookEdit',
    );
  }

  if (options.systemPrompt) args.push('--append-system-prompt', options.systemPrompt);
  if (model) args.push('--model', model);

  return new Promise<ClaudeCliResult | null>((resolve) => {
    let child;
    try {
      child = spawn(cliBinary(), args, {
        shell: false,
        // Sandbox: file tools resolve relative to this directory. Without an
        // explicit workspace we run outside any repo so the CLI doesn't pick
        // up unrelated project context.
        cwd: options.cwd || process.env.TEMP || process.cwd(),
        env: { ...process.env, CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      logger.warn({ err }, 'Claude CLI could not be spawned');
      return resolve(null);
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    let aborted = false;

    // Hand the caller a way to stop this run.
    options.onSpawn?.(() => {
      aborted = true;
      child.kill('SIGKILL');
    });

    const finish = (value: ClaudeCliResult | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      logger.warn({ timeoutMs }, 'Claude CLI timed out; falling back');
      child.kill('SIGKILL');
      finish(null);
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      logger.warn({ err: err.message }, 'Claude CLI unavailable; falling back');
      finish(null);
    });

    child.on('close', (code) => {
      if (aborted) {
        logger.info('Claude CLI run aborted by request');
        return finish(null);
      }
      if (code !== 0) {
        logger.warn({ code, stderr: stderr.slice(0, 300) }, 'Claude CLI exited non-zero');
        return finish(null);
      }
      try {
        const env = JSON.parse(stdout) as CliEnvelope;
        if (env.is_error || typeof env.result !== 'string') {
          logger.warn({ subtype: env.subtype }, 'Claude CLI returned an error envelope');
          return finish(null);
        }
        const usedModel = Object.keys(env.modelUsage ?? {})[0] ?? model ?? 'claude-cli';
        const u = env.usage ?? {};
        finish({
          text: env.result,
          model: usedModel,
          costUsd: env.total_cost_usd ?? 0,
          // Cache tokens are still billed input, so fold them in.
          inputTokens:
            (u.input_tokens ?? 0) +
            (u.cache_creation_input_tokens ?? 0) +
            (u.cache_read_input_tokens ?? 0),
          outputTokens: u.output_tokens ?? 0,
          durationMs: env.duration_ms ?? 0,
        });
      } catch (err) {
        logger.warn({ err }, 'Claude CLI produced unparseable output');
        finish(null);
      }
    });

    // Prompt goes over stdin — never the command line.
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

/** Cheap availability probe used by the settings/status endpoint. */
export async function probeClaudeCli(): Promise<{ available: boolean; version?: string }> {
  if (!isClaudeCliEnabled()) return { available: false };

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cliBinary(), ['--version'], { shell: false, stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return resolve({ available: false });
    }
    let out = '';
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ available: false });
    }, 10_000);

    child.stdout.on('data', (d) => (out += d.toString()));
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ available: false });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve(code === 0 ? { available: true, version: out.trim() } : { available: false });
    });
  });
}
