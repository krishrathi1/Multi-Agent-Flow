import type { PromptTemplate } from './index.js';

export const bugDetectionPrompt: PromptTemplate = {
  id: 'bug-detection-v2',
  name: 'Bug Detection Scanner',
  version: '2.0',
  description:
    'Scans code for potential bugs, race conditions, null pointer issues, off-by-one errors, ' +
    'resource leaks, and common anti-patterns. Prioritizes findings by likelihood and severity.',
  category: 'bug-detection',
  models: ['gpt-4', 'claude-sonnet-4-20250514', 'code-llama-34b', 'deepseek-coder-33b'],
  systemPrompt: `You are a static analysis expert specializing in finding bugs in {{language}} code.

Scan the following code for potential bugs and issues. Check for:

1. **Null/Undefined Errors**: Missing null checks, optional chaining needed
2. **Race Conditions**: Async operations without proper synchronization
3. **Resource Leaks**: Unclosed connections, file handles, event listeners
4. **Logic Errors**: Off-by-one, incorrect comparisons, wrong operator precedence
5. **Type Safety**: Implicit any, unsafe casts, missing type guards
6. **Error Handling**: Swallowed exceptions, missing catch blocks, error propagation
7. **Security**: Injection risks, unsafe deserialization, exposure of secrets
8. **Concurrency**: Unhandled promise rejections, missing awaits, deadlocks

For each bug found, report:
- **Bug ID**: B001, B002, ...
- **Severity**: 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low
- **Category**: One of the categories above
- **Location**: File and line number
- **Description**: What the bug is and how it manifests
- **Trigger**: Under what conditions this bug occurs
- **Fix**: Corrected code

Code to scan:
\`\`\`{{language}}
{{code}}
\`\`\``,
  fewShotExamples: [
    {
      input: `Language: TypeScript
Code:
async function fetchUsers() {
  const response = await fetch('/api/users');
  const data = response.json();
  return data.users.map(u => u.name);
}`,
      output: `## Bug Detection Results — 3 issues found

### B001 — Missing \`await\` on \`.json()\`
- **Severity**: 🔴 Critical
- **Category**: Logic Error (Missing Await)
- **Location**: Line 3
- **Description**: \`response.json()\` returns a Promise, but it's not awaited. \`data\` will be a Promise object, not the parsed JSON.
- **Trigger**: Every call to this function.
- **Fix**: \`const data = await response.json();\`

### B002 — No HTTP status check
- **Severity**: 🟠 High
- **Category**: Error Handling
- **Location**: Line 2
- **Description**: The response status is not checked. A 404 or 500 response will still attempt to parse JSON, likely causing a runtime error.
- **Fix**: \`if (!response.ok) throw new Error(\\\`HTTP \${response.status}\\\`);\`

### B003 — Unsafe property access on \`data.users\`
- **Severity**: 🟡 Medium
- **Category**: Null/Undefined Error
- **Location**: Line 4
- **Description**: If the API returns \`{}\` or \`{ users: null }\`, accessing \`.map()\` on undefined/null throws a TypeError.
- **Fix**: \`return (data.users ?? []).map(u => u.name);\``,
    },
  ],
  temperature: 0.2,
  maxTokens: 2048,
  variables: [
    { name: 'language', description: 'Programming language', required: true },
    { name: 'code', description: 'Code to scan for bugs', required: true },
  ],
  changelog: [
    { version: '1.0', date: '2026-08-03', changes: 'Initial bug detection prompt' },
    { version: '1.5', date: '2026-08-12', changes: 'Added concurrency and resource leak categories' },
    { version: '2.0', date: '2026-08-25', changes: 'Added bug IDs, trigger conditions, few-shot example with missing await pattern' },
  ],
};
