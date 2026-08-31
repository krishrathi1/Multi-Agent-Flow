import type { PromptTemplate } from './index.js';

export const refactoringPrompt: PromptTemplate = {
  id: 'refactoring-v2',
  name: 'Code Refactoring Advisor',
  version: '2.0',
  description:
    'Analyzes code and suggests refactoring opportunities using established patterns ' +
    '(Extract Method, Replace Conditional with Polymorphism, etc.). Produces before/after diffs.',
  category: 'refactoring',
  models: ['gpt-4', 'claude-sonnet-4-20250514', 'starcoder2-15b', 'deepseek-coder-33b'],
  systemPrompt: `You are a senior software architect specializing in code refactoring for {{language}}.

Analyze the following code and identify refactoring opportunities. For each suggestion:

1. **Pattern**: Name the refactoring pattern (e.g., Extract Method, Replace Magic Numbers, Simplify Conditional)
2. **Motivation**: Why this refactoring improves the code (readability, maintainability, testability)
3. **Before**: The original code segment
4. **After**: The refactored version
5. **Impact**: Low / Medium / High — how much it improves the codebase

Focus on these refactoring categories:
- **Structural**: Extract Method, Extract Class, Inline Variable, Move Method
- **Simplification**: Replace Conditional with Polymorphism, Remove Dead Code, Simplify Boolean
- **Naming**: Rename for Clarity, Replace Magic Numbers with Named Constants
- **DRY**: Eliminate Duplication, Parameterize Method
- **SOLID**: Single Responsibility violations, Dependency Inversion opportunities

Code to refactor:
\`\`\`{{language}}
{{code}}
\`\`\`

Refactoring goals: {{goals}}`,
  fewShotExamples: [
    {
      input: `Language: TypeScript
Code:
function processOrder(order: any) {
  if (order.type === 'digital') {
    const tax = order.amount * 0.1;
    const total = order.amount + tax;
    sendEmail(order.email, 'Digital order: $' + total);
    return { total, tax, delivery: 'instant' };
  } else if (order.type === 'physical') {
    const tax = order.amount * 0.15;
    const shipping = order.weight * 2.5;
    const total = order.amount + tax + shipping;
    sendEmail(order.email, 'Physical order: $' + total);
    return { total, tax, shipping, delivery: '3-5 days' };
  }
}`,
      output: `## Refactoring Suggestions

### 1. Replace Magic Numbers with Named Constants
- **Pattern**: Replace Magic Numbers
- **Impact**: Medium
- **Before**: \`order.amount * 0.1\`, \`order.amount * 0.15\`, \`order.weight * 2.5\`
- **After**:
\`\`\`typescript
const TAX_RATE_DIGITAL = 0.10;
const TAX_RATE_PHYSICAL = 0.15;
const SHIPPING_RATE_PER_KG = 2.50;
\`\`\`

### 2. Replace Conditional with Strategy Pattern
- **Pattern**: Replace Conditional with Polymorphism
- **Impact**: High
- **Motivation**: Each order type has distinct tax/shipping/delivery logic — encapsulate per type.
- **After**:
\`\`\`typescript
interface OrderStrategy {
  calculateTotal(order: Order): OrderResult;
}

class DigitalOrderStrategy implements OrderStrategy { ... }
class PhysicalOrderStrategy implements OrderStrategy { ... }
\`\`\`

### 3. Extract Method — Email Notification
- **Pattern**: Extract Method
- **Impact**: Medium
- **Motivation**: Email sending is duplicated — extract into a shared method.`,
    },
  ],
  temperature: 0.4,
  maxTokens: 2048,
  variables: [
    { name: 'language', description: 'Programming language', required: true },
    { name: 'code', description: 'Code to refactor', required: true },
    { name: 'goals', description: 'Specific refactoring goals (e.g., improve testability, reduce duplication)', required: false },
  ],
  changelog: [
    { version: '1.0', date: '2026-08-05', changes: 'Basic refactoring prompt with before/after' },
    { version: '2.0', date: '2026-08-25', changes: 'Added pattern classification, impact ratings, SOLID analysis, strategy pattern example' },
  ],
};
