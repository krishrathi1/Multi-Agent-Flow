import type { PromptTemplate } from './index.js';

export const codeExplanationPrompt: PromptTemplate = {
  id: 'code-explanation-v2',
  name: 'Code Explanation & Documentation',
  version: '2.0',
  description:
    'Explains complex code in plain language, generates JSDoc/TSDoc documentation, ' +
    'and creates visual flow diagrams for logic-heavy functions.',
  category: 'code-explanation',
  models: ['gpt-4', 'claude-sonnet-4-20250514', 'code-llama-34b', 'deepseek-coder-33b'],
  systemPrompt: `You are a technical writer and code educator specializing in {{language}}.

Analyze and explain the following code at multiple levels:

## 1. High-Level Summary (1-2 sentences)
What does this code do and why does it exist?

## 2. Detailed Walkthrough
Step-by-step explanation of the logic flow:
- What each major block/function does
- Data transformations and state changes
- Control flow (conditionals, loops, async operations)

## 3. Key Concepts
Technical concepts a junior developer needs to understand:
- Design patterns used (and why)
- Language-specific features (generics, closures, async/await)
- External dependencies and their role

## 4. Data Flow Diagram
A Mermaid flowchart showing the data flow:
\`\`\`mermaid
graph TD
    A[Input] --> B[Process] --> C[Output]
\`\`\`

## 5. Generated Documentation
JSDoc/TSDoc comments for the main functions.

## 6. Potential Gotchas
Non-obvious behaviors, edge cases, or common mistakes.

Audience level: {{audience}}

Code to explain:
\`\`\`{{language}}
{{code}}
\`\`\``,
  fewShotExamples: [
    {
      input: `Language: TypeScript
Audience: intermediate
Code:
const debounce = <T extends (...args: any[]) => any>(fn: T, ms: number) => {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};`,
      output: `## 1. High-Level Summary
A generic \`debounce\` utility that delays function execution until a pause in calls, commonly used to limit API calls on rapid user input like search typing.

## 2. Detailed Walkthrough
1. **Generic type \`T\`** constrains the input to any function type
2. **Closure** captures a \`timer\` variable shared across all calls
3. On each call: clears the previous timer, starts a new one
4. The actual function \`fn\` only executes after \`ms\` milliseconds of silence

## 3. Key Concepts
- **Generics**: \`T extends (...args: any[]) => any\` preserves the original function's type signature
- **Closure**: The returned function "closes over" the \`timer\` variable
- **\`Parameters<T>\`**: TypeScript utility type that extracts the parameter types of \`T\`
- **\`ReturnType<typeof setTimeout>\`**: Cross-environment compatible timer type

## 4. Data Flow
\`\`\`mermaid
graph TD
    A[User calls debounced fn] --> B{Timer active?}
    B -->|Yes| C[Clear existing timer]
    B -->|No| D[Start new timer]
    C --> D
    D --> E{ms elapsed without new call?}
    E -->|Yes| F[Execute original fn]
    E -->|No| A
\`\`\`

## 5. Generated Documentation
\`\`\`typescript
/**
 * Creates a debounced version of the given function that delays
 * invocation until \`ms\` milliseconds have elapsed since the last call.
 *
 * @param fn - The function to debounce
 * @param ms - Delay in milliseconds
 * @returns A debounced wrapper with the same parameter types
 */
\`\`\``,
    },
  ],
  temperature: 0.5,
  maxTokens: 2048,
  variables: [
    { name: 'language', description: 'Programming language', required: true },
    { name: 'code', description: 'Code to explain', required: true },
    { name: 'audience', description: 'Target audience level: beginner, intermediate, advanced', required: false },
  ],
  changelog: [
    { version: '1.0', date: '2026-08-06', changes: 'Basic explanation prompt' },
    { version: '1.5', date: '2026-08-18', changes: 'Added Mermaid diagram generation and audience levels' },
    { version: '2.0', date: '2026-08-25', changes: 'Added JSDoc generation, gotchas section, debounce few-shot example' },
  ],
};
