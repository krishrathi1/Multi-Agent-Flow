import {
  LayoutDashboard,
  ShieldCheck,
  MessageCircle,
  Server,
  Brain,
  Building2,
  Check,
  X,
  ChevronRight,
  GripVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  preview: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Mini preview components for each feature card                     */
/* ------------------------------------------------------------------ */

function BoardPreview() {
  const columns = [
    {
      label: 'To Do',
      color: 'bg-gray-500/60',
      items: ['Research API docs', 'Draft proposal'],
    },
    {
      label: 'In Progress',
      color: 'bg-nexus-500/60',
      items: ['Code review PR #42'],
    },
    {
      label: 'Done',
      color: 'bg-emerald-500/60',
      items: ['Deploy v2.1'],
    },
  ];

  return (
    <div className="mt-4 flex gap-2 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-2.5">
      {columns.map((col) => (
        <div key={col.label} className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${col.color}`}
            />
            <span className="truncate text-[10px] font-medium text-gray-400">
              {col.label}
            </span>
          </div>
          {col.items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-1 rounded border border-white/5 bg-surface-850 px-1.5 py-1"
            >
              <GripVertical className="h-2.5 w-2.5 shrink-0 text-gray-600" />
              <span className="truncate text-[9px] text-gray-300">
                {item}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ApprovalPreview() {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        <span className="text-[10px] font-medium text-amber-400">
          Pending Approval
        </span>
      </div>
      <p className="mb-2.5 text-[10px] leading-relaxed text-gray-400">
        Agent <span className="text-gray-300">@scout</span> wants to execute{' '}
        <span className="rounded bg-surface-850 px-1 font-mono text-nexus-400">
          deploy:production
        </span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-emerald-600/20 px-2.5 py-1 text-[10px] font-medium text-emerald-400 transition-colors hover:bg-emerald-600/30"
        >
          <Check className="h-3 w-3" />
          Approve
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md bg-red-600/20 px-2.5 py-1 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-600/30"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      </div>
    </div>
  );
}

function ChatPreview() {
  const messages = [
    { from: 'you', text: 'Summarize the Q4 report and highlight risks.' },
    {
      from: 'agent',
      text: 'Revenue grew 18% YoY. Two risks flagged: supply chain delays and FX exposure...',
    },
    { from: 'you', text: 'Draft a mitigation plan for supply chain.' },
  ];

  return (
    <div className="mt-4 flex flex-col gap-1.5 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-2.5">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.from === 'you' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[85%] rounded-lg px-2 py-1 text-[9px] leading-relaxed ${
              msg.from === 'you'
                ? 'bg-nexus-600/30 text-nexus-200'
                : 'bg-surface-850 text-gray-300'
            }`}
          >
            {msg.text}
          </div>
        </div>
      ))}
      <div className="mt-0.5 flex items-center gap-1 rounded border border-white/5 bg-surface-850 px-2 py-1">
        <span className="flex-1 text-[9px] text-gray-500">
          Message @analyst...
        </span>
        <ChevronRight className="h-2.5 w-2.5 text-nexus-500" />
      </div>
    </div>
  );
}

function GatewayPreview() {
  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-medium text-gray-300">
            production-gw
          </span>
        </div>
        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-medium text-emerald-400">
          Connected
        </span>
      </div>
      <div className="space-y-1 font-mono text-[9px] leading-relaxed text-gray-500">
        <div>
          <span className="text-gray-400">models:</span>{' '}
          <span className="text-nexus-400">714</span> available
        </div>
        <div>
          <span className="text-gray-400">agents:</span>{' '}
          <span className="text-nexus-400">12</span> provisioned
        </div>
        <div>
          <span className="text-gray-400">uptime:</span>{' '}
          <span className="text-emerald-400">99.97%</span>
        </div>
      </div>
    </div>
  );
}

function SoulPreview() {
  const lines = [
    { key: 'name', value: '"analyst"' },
    { key: 'role', value: '"Senior Data Analyst"' },
    { key: 'tone', value: '"precise, concise"' },
    { key: 'tools', value: '["sql", "python", "charts"]' },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="text-[9px] font-medium text-gray-500">SOUL.md</span>
        <span className="rounded bg-nexus-500/10 px-1 py-0.5 text-[8px] text-nexus-400">
          editing
        </span>
      </div>
      <div className="space-y-0.5 font-mono text-[9px] leading-relaxed">
        {lines.map((line) => (
          <div key={line.key}>
            <span className="text-nexus-400">{line.key}</span>
            <span className="text-gray-500">: </span>
            <span className="text-amber-300/80">{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamPreview() {
  const members = [
    { initials: 'JD', role: 'Owner', color: 'bg-nexus-600' },
    { initials: 'AL', role: 'Admin', color: 'bg-violet-600' },
    { initials: 'MK', role: 'Member', color: 'bg-emerald-600' },
    { initials: 'SR', role: 'Viewer', color: 'bg-gray-600' },
  ];

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-white/5 bg-surface-950/80 p-3">
      <div className="space-y-1.5">
        {members.map((m) => (
          <div key={m.initials} className="flex items-center gap-2">
            <div
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-bold text-white ${m.color}`}
            >
              {m.initials}
            </div>
            <span className="flex-1 text-[10px] text-gray-300">
              {m.initials === 'JD'
                ? 'Jane Doe'
                : m.initials === 'AL'
                  ? 'Alex Lee'
                  : m.initials === 'MK'
                    ? 'Maria K.'
                    : 'Sam R.'}
            </span>
            <span className="rounded bg-surface-850 px-1.5 py-0.5 text-[8px] font-medium text-gray-400">
              {m.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature definitions                                               */
/* ------------------------------------------------------------------ */

const features: Feature[] = [
  {
    icon: LayoutDashboard,
    title: 'Agent Boards',
    description:
      'Kanban-style boards to organize agent goals and tasks. Drag-and-drop task management with status columns that give you a clear view of every agent\'s workload at a glance.',
    preview: <BoardPreview />,
  },
  {
    icon: ShieldCheck,
    title: 'Approval Workflows',
    description:
      'Human-in-the-loop control for critical actions. Agents request permission before executing sensitive operations, and you approve or reject directly from the dashboard.',
    preview: <ApprovalPreview />,
  },
  {
    icon: MessageCircle,
    title: 'Live Agent Chat',
    description:
      'Talk to any agent in real-time. Send instructions, ask questions, and get immediate responses. Full conversation history with search across every session.',
    preview: <ChatPreview />,
  },
  {
    icon: Server,
    title: 'Gateway Integration',
    description:
      'Connect your own OpenClaw gateway for access to 700+ LLM models. Provision and configure new agents directly from the dashboard without touching a config file.',
    preview: <GatewayPreview />,
  },
  {
    icon: Brain,
    title: 'Agent Identity (SOUL.md)',
    description:
      'Define each agent\'s personality, capabilities, and constraints via SOUL.md files. Edit them directly in the browser with syntax highlighting and live preview.',
    preview: <SoulPreview />,
  },
  {
    icon: Building2,
    title: 'Multi-Org Teams',
    description:
      'Isolated organizations with role-based access control. Owner, Admin, Member, and Viewer roles ensure the right people have the right level of access with complete data separation.',
    preview: <TeamPreview />,
  },
];

/* ------------------------------------------------------------------ */
/*  Feature Grid component                                            */
/* ------------------------------------------------------------------ */

export function FeatureGrid() {
  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* Section heading */}
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Enterprise AI Agent Management Features
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
            Everything you need to deploy, manage, and control autonomous AI
            agents at scale with enterprise-grade agentic workflows.
          </p>
        </div>

        {/* 2-column grid, 3 rows */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-white/5 bg-surface-850 p-6 transition-all duration-300 hover:border-nexus-500/30 hover:bg-surface-850/80"
            >
              {/* Icon + title row */}
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-nexus-500/10 text-nexus-400 transition-colors group-hover:bg-nexus-500/20">
                  <feature.icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-gray-400">
                    {feature.description}
                  </p>
                </div>
              </div>

              {/* Mini preview */}
              {feature.preview}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
