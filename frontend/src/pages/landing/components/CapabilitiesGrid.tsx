import {
  Puzzle,
  FileText,
  Tags,
  Fingerprint,
  SlidersHorizontal,
  ShieldAlert,
  BrainCircuit,
  Database,
  Webhook,
  GraduationCap,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
}

const capabilities: Capability[] = [
  {
    icon: Puzzle,
    title: 'Skills Marketplace',
    description:
      'Browse, create, and assign reusable AI agent skills. Organize skill packs from Git repositories for rapid agent provisioning across your organization.',
  },
  {
    icon: FileText,
    title: 'Soul Templates',
    description:
      'Reusable SOUL.md templates for standardized agent identities. Create, search, and apply personality templates across teams and projects.',
  },
  {
    icon: Tags,
    title: 'Task Tags & Labels',
    description:
      'Color-coded tags for task categorization and filtering. Assign multiple tags per task for cross-board search, analytics, and workflow automation.',
  },
  {
    icon: Fingerprint,
    title: 'Task Fingerprints',
    description:
      'Unique content-based fingerprints for automatic duplicate detection and task lineage tracking across boards, agents, and workflows.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Custom Fields',
    description:
      'Define custom metadata fields — text, integer, boolean, or JSON — for tasks. Attach fields to boards with configurable visibility rules.',
  },
  {
    icon: ShieldAlert,
    title: 'Board Policies',
    description:
      'Enforce governance rules on agent boards. Require human approval before tasks move to done, set auto-assignment policies, and configure escalation paths.',
  },
  {
    icon: BrainCircuit,
    title: 'Agent-to-Agent (A2A)',
    description:
      'Enable direct agent-to-agent communication via the A2A protocol. Agents collaborate, delegate sub-tasks, and share context autonomously.',
  },
  {
    icon: Database,
    title: 'Board Group Memory',
    description:
      'Shared persistent memory across board groups. Agents access organizational knowledge through tagged, searchable memory entries.',
  },
  {
    icon: Webhook,
    title: 'Inbound Webhooks',
    description:
      'Receive events from external systems via HMAC-authenticated webhooks. Trigger board actions, create tasks, and sync with CI/CD pipelines.',
  },
  {
    icon: GraduationCap,
    title: 'Board Onboarding',
    description:
      'Guided AI-assisted onboarding sessions for new boards. Walk through goals, agent assignment, and initial task creation in minutes.',
  },
  {
    icon: UserPlus,
    title: 'Invitation System',
    description:
      'Email-based team invitations with role assignment — Admin, Member, or Viewer. Track pending, accepted, and revoked invitation status.',
  },
];

export function CapabilitiesGrid() {
  return (
    <section id="capabilities" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section heading */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Mission Control Capabilities
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
            Advanced tools for enterprise AI agent operations — from skill
            management and governance policies to webhook integrations
          </p>
        </div>

        {/* 3-column compact grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((cap) => (
            <div
              key={cap.title}
              className="group rounded-xl border border-white/5 bg-surface-850 p-5 transition-all duration-300 hover:border-nexus-500/30 hover:bg-surface-850/80"
            >
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-nexus-500/10 text-nexus-400 transition-colors group-hover:bg-nexus-500/20">
                <cap.icon className="h-5 w-5" />
              </div>
              <h3 className="mb-1.5 text-base font-semibold text-white">
                {cap.title}
              </h3>
              <p className="text-sm leading-relaxed text-gray-400">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
