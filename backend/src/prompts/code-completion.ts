import type { PromptTemplate } from './index.js';

export const codeCompletionPrompt: PromptTemplate = {
  id: 'code-completion-v2',
  name: 'Intelligent Code Completion',
  version: '2.0',
  description:
    'Completes partial code by inferring intent from context, imports, types, and surrounding code. ' +
    'Generates idiomatic, type-safe completions that integrate seamlessly.',
  category: 'code-completion',
  models: ['starcoder2-15b', 'code-llama-34b', 'deepseek-coder-33b', 'gpt-4', 'claude-sonnet-4-20250514'],
  systemPrompt: `You are an AI code completion engine for {{language}}.

Given the following partial code, complete it by:

1. **Inferring intent** from function names, types, comments, and surrounding code
2. **Maintaining consistency** with the existing code style (naming, formatting, patterns)
3. **Using available imports** — don't introduce new dependencies unless necessary
4. **Adding type annotations** where the language supports them
5. **Handling edge cases** (null checks, error handling, empty inputs)

Rules:
- Output ONLY the completed code — no explanation
- Preserve existing code exactly; only fill in the missing parts
- If the cursor is marked with \`/* CURSOR */\`, complete from that position
- Follow the project's existing patterns (e.g., if they use arrow functions, use arrow functions)

Existing imports and context:
\`\`\`{{language}}
{{context}}
\`\`\`

Partial code to complete:
\`\`\`{{language}}
{{code}}
\`\`\``,
  fewShotExamples: [
    {
      input: `Language: TypeScript
Context:
import { prisma } from '../lib/prisma';
import type { Agent, AgentStatus } from '@prisma/client';

Partial code:
export async function updateAgentStatus(
  agentId: string,
  organizationId: string,
  status: AgentStatus,
  currentTask?: string,
): /* CURSOR */`,
      output: `\`\`\`typescript
export async function updateAgentStatus(
  agentId: string,
  organizationId: string,
  status: AgentStatus,
  currentTask?: string,
): Promise<Agent> {
  return prisma.agent.update({
    where: {
      id: agentId,
      organizationId,
    },
    data: {
      status,
      currentTask: currentTask ?? null,
      lastHeartbeat: status === 'ONLINE' ? new Date() : undefined,
    },
  });
}
\`\`\``,
    },
  ],
  temperature: 0.2,
  maxTokens: 1024,
  variables: [
    { name: 'language', description: 'Programming language', required: true },
    { name: 'code', description: 'Partial code with cursor position', required: true },
    { name: 'context', description: 'Surrounding imports, types, and related code', required: false },
  ],
  changelog: [
    { version: '1.0', date: '2026-08-04', changes: 'Basic code completion prompt' },
    { version: '2.0', date: '2026-08-25', changes: 'Added context window, cursor marker, Prisma-aware example, type inference focus' },
  ],
};
