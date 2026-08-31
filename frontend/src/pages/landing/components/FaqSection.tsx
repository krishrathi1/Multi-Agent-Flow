import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

interface FaqItem {
  question: string;
  answer: string;
}

const faqs: FaqItem[] = [
  {
    question: 'What is MyceliumOps by Blostem?',
    answer:
      'MyceliumOps is an AI agent orchestration and mission control platform built by Blostem. It lets you deploy, manage, and monitor autonomous AI agents from a single dashboard. You can create agentic workflows, set up human-in-the-loop approval gates, chat with agents in real time, and organize work across kanban-style boards — all designed for enterprise-grade AI agent operations.',
  },
  {
    question: 'What is an agentic workflow?',
    answer:
      'An agentic workflow is an automated process where autonomous AI agents independently plan, execute, and complete tasks with minimal human intervention. In MyceliumOps, agentic workflows are structured through boards, tasks, and approval gates. Agents pick up tasks, execute them using connected LLM models, and request human approval before taking critical actions — combining autonomy with enterprise-level control.',
  },
  {
    question: 'How does MyceliumOps manage enterprise AI agents?',
    answer:
      'MyceliumOps provides enterprise-grade AI agent management through multi-organization support with role-based access control (Owner, Admin, Member, Viewer), goal-oriented boards for organizing agent work, human-in-the-loop approval workflows for critical decisions, real-time monitoring dashboards, activity audit trails, and multi-gateway integration for distributed agent deployment across infrastructure.',
  },
  {
    question: 'What is human-in-the-loop AI and why does it matter?',
    answer:
      'Human-in-the-loop AI is an approach where autonomous agents operate independently but require human approval for critical or high-stakes actions. MyceliumOps implements this through its approval workflow system — agents submit requests with confidence scores, and human operators can approve or reject actions before execution. This ensures safety, compliance, and accountability in enterprise AI agent deployments.',
  },
  {
    question: 'What LLM models does MyceliumOps support?',
    answer:
      'MyceliumOps supports 700+ LLM models through its gateway integration, including models from OpenAI (GPT-4o, GPT-4), Anthropic (Claude), Google (Gemini), Mistral, Groq, and OpenRouter. You can use Bring Your Own Key (BYOK) to connect your existing API keys, or use platform-managed keys with a usage credits system. Each agent can be configured with a different model based on its specialization.',
  },
  {
    question: 'How does AI agent orchestration work in MyceliumOps?',
    answer:
      'AI agent orchestration in MyceliumOps works through a layered system: you connect one or more LLM gateways, create specialized agents with custom identities (SOUL.md), organize their work on goal-oriented boards with kanban task management, set up approval workflows for quality control, and monitor everything through real-time dashboards with activity feeds, metrics, and alerts. Agents communicate via WebSocket for instant updates.',
  },
  {
    question: 'How is MyceliumOps different from other AI agent platforms?',
    answer:
      'MyceliumOps stands out as a complete mission control for AI agents rather than just a framework. It combines agent deployment, real-time chat, kanban-style task boards, human-in-the-loop approvals, multi-organization teams, gateway-based distributed execution, and full observability with OpenTelemetry — all in one unified platform. Built by Blostem, it focuses on giving operators full visibility and control over autonomous AI agent operations.',
  },
  {
    question: 'What are Soul Templates and the Skills Marketplace?',
    answer:
      'Soul Templates are reusable SOUL.md templates that define standardized agent identities — personality, capabilities, tone, and constraints. Create templates once and apply them across multiple agents for consistent behavior. The Skills Marketplace lets you browse, create, and assign reusable agent skills. You can organize skills into packs sourced from Git repositories, making it easy to provision new agents with pre-built capabilities across your organization.',
  },
  {
    question: 'How do board policies and custom fields work?',
    answer:
      'Board policies let you enforce governance rules on agent boards. For example, you can require human approval before any task moves to "done" status, set auto-assignment policies, or configure escalation paths. Custom fields allow you to define additional metadata for tasks — text, integer, boolean, or JSON types — with configurable visibility rules (always visible, on hover, or hidden). Fields can be attached to specific boards so every task on that board carries the custom data your workflow needs.',
  },
  {
    question: 'Can AI agents communicate with each other in MyceliumOps?',
    answer:
      'Yes, MyceliumOps supports Agent-to-Agent (A2A) communication. When A2A is enabled, agents can directly collaborate with each other — delegating sub-tasks, sharing context, and coordinating work autonomously. Combined with board group memory (shared persistent knowledge across board groups), agents can access organizational knowledge and work together as a coordinated team rather than isolated units.',
  },
  {
    question: 'How does MyceliumOps integrate with external systems?',
    answer:
      'MyceliumOps supports inbound webhooks with HMAC-based authentication for secure integration with external systems. You can receive events from CI/CD pipelines, monitoring tools, or any HTTP-capable service to trigger board actions and create tasks automatically. Additionally, the invitation system enables email-based team onboarding with role-based permissions, and the board onboarding wizard provides AI-assisted setup for new project boards.',
  },
];

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

function FaqItem({ faq }: { faq: FaqItem }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 py-5 text-left transition-colors hover:text-nexus-400"
      >
        <h3 className="text-base font-medium text-white sm:text-lg">
          {faq.question}
        </h3>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-gray-500 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`grid transition-all duration-200 ${
          isOpen ? 'grid-rows-[1fr] pb-5' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="text-sm leading-relaxed text-gray-400 sm:text-base">
            {faq.answer}
          </p>
        </div>
      </div>
    </div>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="px-6 py-24">
      <Helmet>
        <script type="application/ld+json">
          {JSON.stringify(faqStructuredData)}
        </script>
      </Helmet>

      <div className="mx-auto max-w-3xl">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
            Everything you need to know about AI agent orchestration with MyceliumOps
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-surface-850 px-6">
          {faqs.map((faq) => (
            <FaqItem key={faq.question} faq={faq} />
          ))}
        </div>
      </div>
    </section>
  );
}
