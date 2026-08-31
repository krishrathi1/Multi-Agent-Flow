/**
 * Prompt Engineering Module — Structured Prompt Templates
 *
 * Each template follows a standardized format with:
 * - Unique ID and versioning for iteration tracking
 * - System prompt with role, constraints, and output format
 * - Few-shot examples demonstrating expected input/output
 * - Model-specific tuning parameters (temperature, max tokens)
 * - Metadata for the prompt playground UI
 */

export interface PromptTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  category: 'code-review' | 'refactoring' | 'bug-detection' | 'code-completion' | 'code-explanation';
  /** Recommended models for this prompt */
  models: string[];
  systemPrompt: string;
  /** Optional few-shot examples */
  fewShotExamples: { input: string; output: string }[];
  /** Suggested LLM parameters */
  temperature: number;
  maxTokens: number;
  /** Template variables that the user fills in */
  variables: { name: string; description: string; required: boolean }[];
  /** Prompt iteration notes — shows refinement history */
  changelog: { version: string; date: string; changes: string }[];
}

export { codeReviewPrompt } from './code-review.js';
export { refactoringPrompt } from './refactoring.js';
export { bugDetectionPrompt } from './bug-detection.js';
export { codeCompletionPrompt } from './code-completion.js';
export { codeExplanationPrompt } from './code-explanation.js';

import { codeReviewPrompt } from './code-review.js';
import { refactoringPrompt } from './refactoring.js';
import { bugDetectionPrompt } from './bug-detection.js';
import { codeCompletionPrompt } from './code-completion.js';
import { codeExplanationPrompt } from './code-explanation.js';

/** Registry of all available prompt templates */
export const promptRegistry: PromptTemplate[] = [
  codeReviewPrompt,
  refactoringPrompt,
  bugDetectionPrompt,
  codeCompletionPrompt,
  codeExplanationPrompt,
];

/** Look up a template by ID */
export function getPromptById(id: string): PromptTemplate | undefined {
  return promptRegistry.find(p => p.id === id);
}

/**
 * Renders a prompt template by substituting variable placeholders.
 *
 * Variables in the system prompt are written as {{variableName}}.
 */
export function renderPrompt(template: PromptTemplate, variables: Record<string, string>): string {
  let rendered = template.systemPrompt;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replaceAll(`{{${key}}}`, value);
  }
  return rendered;
}
