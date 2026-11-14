import { spawn } from 'node:child_process';
import path from 'node:path';
import { existsSync } from 'node:fs';

export interface GuardrailInspection {
  status: 'APPROVED' | 'FLAGGED';
  persona: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  risk_type: 'SAFE' | 'TOXIC_LANGUAGE' | 'PROMPT_INJECTION';
  injections_found: string[];
  toxic_terms_found: string[];
  sanitized_prompt: string;
  explanation: string;
  passed_test?: boolean;
}

export async function inspectPromptSecurity(prompt: string, persona = 'User'): Promise<GuardrailInspection> {
  const candidates = [
    path.resolve(process.cwd(), 'backend', 'frameworks', 'guardrails.py'),
    path.resolve(process.cwd(), 'frameworks', 'guardrails.py'),
  ];
  const scriptPath = candidates.find((c) => existsSync(c)) || candidates[0];
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [scriptPath, '--prompt', prompt, '--persona', persona]);
    let output = '';

    proc.stdout.on('data', (d) => {
      output += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const match = output.match(/__GUARDRAILS_RESULT__:(.*)/);
        if (match) {
          try {
            return resolve(JSON.parse(match[1]));
          } catch (e) {}
        }
      }
      reject(new Error(`Guardrails execution failed: ${output}`));
    });
  });
}

export async function runGuardrailsPersonaSuite(): Promise<GuardrailInspection[]> {
  const candidates = [
    path.resolve(process.cwd(), 'backend', 'frameworks', 'guardrails.py'),
    path.resolve(process.cwd(), 'frameworks', 'guardrails.py'),
  ];
  const scriptPath = candidates.find((c) => existsSync(c)) || candidates[0];
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

  return new Promise((resolve, reject) => {
    const proc = spawn(pythonCmd, [scriptPath, '--suite']);
    let output = '';

    proc.stdout.on('data', (d) => {
      output += d.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        const match = output.match(/__GUARDRAILS_SUITE__:(.*)/);
        if (match) {
          try {
            return resolve(JSON.parse(match[1]));
          } catch (e) {}
        }
      }
      reject(new Error(`Guardrails suite failed: ${output}`));
    });
  });
}
