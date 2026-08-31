import {
  Cable,
  UserPlus,
  LayoutDashboard,
  ShieldCheck,
  Check,
  X,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Step data                                                          */
/* ------------------------------------------------------------------ */

interface Step {
  number: number;
  icon: LucideIcon;
  title: string;
  description: string;
  visual: React.ReactNode;
}

/** Mini code-snippet card for step 1 */
function GatewayVisual() {
  return (
    <div className="mt-4 w-full max-w-[220px] overflow-hidden rounded-lg border border-white/5 bg-surface-900 font-mono text-[11px] leading-relaxed text-gray-400 shadow-lg">
      <div className="flex items-center gap-1.5 border-b border-white/5 px-3 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-red-400/60" />
        <span className="h-1.5 w-1.5 rounded-full bg-yellow-400/60" />
        <span className="h-1.5 w-1.5 rounded-full bg-green-400/60" />
        <span className="ml-auto text-[10px] text-gray-600">config</span>
      </div>
      <div className="px-3 py-2.5">
        <div>
          <span className="text-nexus-400">url</span>
          <span className="text-gray-600">: </span>
          <span className="text-emerald-400">ws://gateway:18789</span>
        </div>
        <div>
          <span className="text-nexus-400">token</span>
          <span className="text-gray-600">: </span>
          <span className="text-emerald-400">sk-****</span>
        </div>
        <div className="mt-1 text-[10px] text-nexus-500/70">
          739 models connected
        </div>
      </div>
    </div>
  );
}

/** Mini agent card for step 2 */
function AgentVisual() {
  return (
    <div className="mt-4 w-full max-w-[220px] rounded-lg border border-white/5 bg-surface-900 p-3 shadow-lg">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-nexus-500 to-nexus-700 text-xs font-bold text-white">
          R
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-white">
            Researcher
          </div>
          <div className="text-[10px] text-gray-500">opus-4 &middot; SOUL.md</div>
        </div>
        <span className="inline-flex h-4 items-center rounded-full bg-emerald-500/10 px-1.5 text-[9px] font-medium text-emerald-400">
          online
        </span>
      </div>
      <div className="mt-2 rounded-md bg-surface-950/60 px-2 py-1.5 font-mono text-[10px] leading-snug text-gray-500">
        You are a meticulous research&nbsp;agent...
      </div>
    </div>
  );
}

/** Mini kanban board for step 3 */
function BoardVisual() {
  return (
    <div className="mt-4 w-full max-w-[220px] rounded-lg border border-white/5 bg-surface-900 p-2.5 shadow-lg">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold text-white">
          Sprint Board
        </span>
        <LayoutDashboard className="h-3 w-3 text-nexus-500/50" />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {/* Column: To Do */}
        <div className="space-y-1">
          <div className="rounded bg-surface-950/60 px-1.5 py-0.5 text-center text-[8px] font-medium text-gray-500">
            To Do
          </div>
          <div className="flex items-center gap-0.5 rounded bg-surface-950/40 px-1 py-1 text-[8px] text-gray-500">
            <GripVertical className="h-2 w-2 shrink-0 text-gray-700" />
            <span className="truncate">Research API</span>
          </div>
          <div className="flex items-center gap-0.5 rounded bg-surface-950/40 px-1 py-1 text-[8px] text-gray-500">
            <GripVertical className="h-2 w-2 shrink-0 text-gray-700" />
            <span className="truncate">Draft RFC</span>
          </div>
        </div>
        {/* Column: In Progress */}
        <div className="space-y-1">
          <div className="rounded bg-nexus-500/10 px-1.5 py-0.5 text-center text-[8px] font-medium text-nexus-400">
            Active
          </div>
          <div className="flex items-center gap-0.5 rounded border border-nexus-500/20 bg-nexus-500/5 px-1 py-1 text-[8px] text-nexus-300">
            <GripVertical className="h-2 w-2 shrink-0 text-nexus-600" />
            <span className="truncate">Write tests</span>
          </div>
        </div>
        {/* Column: Done */}
        <div className="space-y-1">
          <div className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-center text-[8px] font-medium text-emerald-400">
            Done
          </div>
          <div className="flex items-center gap-0.5 rounded bg-surface-950/40 px-1 py-1 text-[8px] text-gray-600 line-through">
            <Check className="h-2 w-2 shrink-0 text-emerald-500/50" />
            <span className="truncate">Setup repo</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Approve / reject button pair for step 4 */
function ApprovalVisual() {
  return (
    <div className="mt-4 w-full max-w-[220px] rounded-lg border border-white/5 bg-surface-900 p-3 shadow-lg">
      <div className="mb-2 text-[10px] text-gray-500">
        Agent requests approval:
      </div>
      <div className="mb-3 rounded-md bg-surface-950/60 px-2.5 py-1.5 font-mono text-[10px] leading-snug text-gray-400">
        Deploy <span className="text-nexus-400">v2.1.0</span> to production?
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          tabIndex={-1}
          className="flex flex-1 cursor-default items-center justify-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-[10px] font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/25"
        >
          <Check className="h-3 w-3" />
          Approve
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="flex flex-1 cursor-default items-center justify-center gap-1 rounded-md bg-red-500/15 px-2 py-1.5 text-[10px] font-semibold text-red-400 transition-colors hover:bg-red-500/25"
        >
          <X className="h-3 w-3" />
          Reject
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Steps                                                              */
/* ------------------------------------------------------------------ */

const steps: Step[] = [
  {
    number: 1,
    icon: Cable,
    title: 'Connect Your Gateway',
    description:
      'Point MyceliumOps at your OpenClaw gateway instance. Enter the URL and token. Instantly access 700+ LLM models.',
    visual: <GatewayVisual />,
  },
  {
    number: 2,
    icon: UserPlus,
    title: 'Create Specialized Agents',
    description:
      'Provision agents with custom SOUL.md personalities. Define their workspace, capabilities, and identity.',
    visual: <AgentVisual />,
  },
  {
    number: 3,
    icon: LayoutDashboard,
    title: 'Organize Work on Boards',
    description:
      'Create goal-oriented boards. Add tasks, assign agents, track progress with kanban columns.',
    visual: <BoardVisual />,
  },
  {
    number: 4,
    icon: ShieldCheck,
    title: 'Stay in Control',
    description:
      'Approve agent actions, chat in real-time, monitor everything from your mission control dashboard.',
    visual: <ApprovalVisual />,
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        {/* ── Section heading ── */}
        <div className="mb-20 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            How AI Agent Orchestration Works
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-gray-400">
            From zero to full agentic workflow orchestration in minutes
          </p>
        </div>

        {/* ── Timeline (desktop: horizontal, mobile: vertical) ── */}
        <div className="relative">
          {/* ── Connecting line — desktop ── */}
          <div
            className="pointer-events-none absolute top-7 hidden h-0.5 md:block"
            aria-hidden="true"
            style={{
              left: 'calc(12.5% + 24px)',
              right: 'calc(12.5% + 24px)',
            }}
          >
            <div className="h-full w-full bg-gradient-to-r from-nexus-600/60 via-nexus-500/40 to-nexus-600/60" />
          </div>

          {/* ── Connecting line — mobile (vertical) ── */}
          <div
            className="pointer-events-none absolute bottom-0 left-7 top-14 w-0.5 md:hidden"
            aria-hidden="true"
          >
            <div className="h-full w-full bg-gradient-to-b from-nexus-600/60 via-nexus-500/40 to-nexus-600/60" />
          </div>

          {/* ── Steps grid ── */}
          <div className="grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-6">
            {steps.map((step) => (
              <div
                key={step.number}
                className="group relative flex gap-5 md:flex-col md:items-center md:gap-0 md:text-center"
              >
                {/* ── Number circle ── */}
                <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-nexus-500 to-nexus-700 text-lg font-bold text-white shadow-lg shadow-nexus-600/30 ring-4 ring-surface-950 transition-shadow group-hover:shadow-xl group-hover:shadow-nexus-500/25">
                  {step.number}
                </div>

                {/* ── Content ── */}
                <div className="flex min-w-0 flex-1 flex-col md:items-center">
                  {/* Icon pill */}
                  <div className="mb-3 mt-1 flex h-9 w-9 items-center justify-center rounded-lg bg-nexus-500/10 text-nexus-400 transition-colors group-hover:bg-nexus-500/20 md:mt-5">
                    <step.icon className="h-[18px] w-[18px]" />
                  </div>

                  {/* Title */}
                  <h3 className="mb-1.5 text-base font-semibold text-white">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="max-w-xs text-sm leading-relaxed text-gray-400">
                    {step.description}
                  </p>

                  {/* Visual element */}
                  <div className="flex md:justify-center">{step.visual}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
