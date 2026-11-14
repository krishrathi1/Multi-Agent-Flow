import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from '../lib/logger.js';

export interface A2AMessage {
  protocol: string;
  message_id: string;
  timestamp: string;
  sender: { framework: string; name: string };
  recipient: { framework: string; name: string };
  intent: string;
  payload: Record<string, unknown>;
}

export interface A2AExecutionResult {
  status: string;
  protocol: string;
  frameworks_used: string[];
  goal: string;
  a2a_messages_count: number;
  a2a_trace: A2AMessage[];
  crewai_events: Array<{ framework: string; event: string; data: Record<string, unknown> }>;
  adk_events: Array<{ framework: string; event: string; data: Record<string, unknown> }>;
  final_output: string;
}

export async function runA2AInteroperability(goal: string): Promise<A2AExecutionResult> {
  const candidates = [
    path.resolve(process.cwd(), 'backend', 'frameworks', 'a2a_bridge.py'),
    path.resolve(process.cwd(), 'frameworks', 'a2a_bridge.py'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'frameworks', 'a2a_bridge.py'),
  ];
  const bridgeScript = candidates.find((c) => existsSync(c)) || candidates[0];
  const bridgeDir = path.dirname(bridgeScript);
  
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pythonCmd, [bridgeScript, '--goal', goal], { cwd: bridgeDir });

    let finalResult: A2AExecutionResult | null = null;
    let stdoutBuffer = '';
    let stderrBuffer = '';

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdoutBuffer += text;
      const lines = text.split('\n');
      for (const line of lines) {
        if (line.startsWith('__FINAL_RESULT__:')) {
          try {
            finalResult = JSON.parse(line.replace('__FINAL_RESULT__:', ''));
          } catch (e) {
            logger.warn({ err: e }, 'Failed to parse A2A final result line');
          }
        }
      }
    });

    proc.stderr.on('data', (data) => {
      stderrBuffer += data.toString();
    });

    proc.on('close', (code) => {
      if (finalResult) {
        resolve(finalResult);
      } else if (code === 0) {
        // Fallback parse from stdout
        const match = stdoutBuffer.match(/__FINAL_RESULT__:(.*)/);
        if (match) {
          try {
            return resolve(JSON.parse(match[1]));
          } catch (e) {}
        }
        reject(new Error(`A2A execution finished with code 0 but no result parsed: ${stdoutBuffer}`));
      } else {
        reject(new Error(`A2A execution failed with code ${code}: ${stderrBuffer || stdoutBuffer}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}
