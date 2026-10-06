import { config } from '../config.js';
import type { PromptTemplate } from './index.js';

export const codeReviewPrompt: PromptTemplate = {
  id: 'code-review-v2',
  name: 'Code Review Assistant',
  version: '2.0',
  description:
    'Reviews code for best practices, potential bugs, security issues, and performance concerns. ' +
    'Provides structured feedback with severity levels and actionable suggestions.',
  category: 'code-review',
  models: config.promptModels['code-review'] ?? config.geminiModels,
  systemPrompt: `You are an expert code reviewer specializing in {{language}} development.

Analyze the following code and provide a structured review covering:

1. **Critical Issues** (bugs, security vulnerabilities, data races)
2. **Performance Concerns** (inefficient algorithms, memory leaks, unnecessary allocations)
3. **Code Quality** (naming, structure, DRY violations, SOLID principles)
4. **Best Practices** (idiomatic patterns, error handling, edge cases)
5. **Suggestions** (concrete improvements with code examples)

For each finding, use this format:
- **Severity**: 🔴 Critical | 🟡 Warning | 🔵 Info
- **Location**: Line number or function name
- **Issue**: Clear description
- **Fix**: Suggested code change

Code to review:
\`\`\`{{language}}
{{code}}
\`\`\`

Context: {{context}}`,
  fewShotExamples: [
    {
      input: `Language: TypeScript
Code:
async function getUser(id: string) {
  const user = await db.query("SELECT * FROM users WHERE id = " + id);
  return user;
}`,
      output: `## Code Review Results

### 🔴 Critical Issues

- **Severity**: 🔴 Critical
- **Location**: Line 2 — \`db.query()\` call
- **Issue**: SQL Injection vulnerability. User-supplied \`id\` is concatenated directly into the query string.
- **Fix**:
\`\`\`typescript
const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);
\`\`\`

### 🟡 Warnings

- **Severity**: 🟡 Warning
- **Location**: Line 2 — \`SELECT *\`
- **Issue**: Using \`SELECT *\` fetches all columns including potentially sensitive data. Prefer explicit column selection.
- **Fix**:
\`\`\`typescript
const user = await db.query("SELECT id, name, email FROM users WHERE id = $1", [id]);
\`\`\`

### 🔵 Suggestions

- Add input validation for the \`id\` parameter (UUID format check)
- Add null check for missing user (return 404)
- Add TypeScript return type annotation`,
    },
  ],
  temperature: 0.3,
  maxTokens: 2048,
  variables: [
    { name: 'language', description: 'Programming language of the code', required: true },
    { name: 'code', description: 'The code to review', required: true },
    { name: 'context', description: 'Additional context (what the code does, constraints)', required: false },
  ],
  changelog: [
    { version: '1.0', date: '2026-08-01', changes: 'Initial prompt with basic review structure' },
    { version: '1.5', date: '2026-08-15', changes: 'Added severity levels, structured output format, and security focus' },
    { version: '2.0', date: '2026-08-25', changes: 'Added few-shot examples, context variable, multi-model support' },
  ],
};
