import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  Cpu,
  KanbanSquare,
  Puzzle,
  ShieldCheck,
  Webhook,
} from 'lucide-react';

const stats = [
  { icon: Cpu, label: '700+ LLM Models' },
  { icon: Puzzle, label: 'Skills Marketplace' },
  { icon: ShieldCheck, label: 'Board Policies' },
  { icon: KanbanSquare, label: 'Kanban Boards' },
  { icon: BrainCircuit, label: 'Agent-to-Agent' },
  { icon: Webhook, label: 'Webhook Integrations' },
];

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20">
      {/* ── Animated gradient orbs ── */}
      <div
        className="animate-float-slow pointer-events-none absolute -left-32 top-1/4 h-[500px] w-[500px] rounded-full bg-nexus-600/15 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-float pointer-events-none absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-nexus-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="animate-float-fast pointer-events-none absolute bottom-1/4 left-1/3 h-[350px] w-[350px] rounded-full bg-nexus-700/20 blur-3xl"
        aria-hidden="true"
      />
      {/* Subtle extra orb top-right for depth */}
      <div
        className="animate-float pointer-events-none absolute -top-24 right-1/4 h-[280px] w-[280px] rounded-full bg-nexus-400/5 blur-3xl"
        aria-hidden="true"
      />

      {/* ── Content ── */}
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <div className="animate-fade-in-up mb-8 inline-flex items-center gap-2.5 rounded-full border border-nexus-500/30 bg-nexus-500/10 px-4 py-1.5 text-sm font-medium text-nexus-400">
          <span className="animate-pulse-dot h-2 w-2 rounded-full bg-nexus-400" />
          AI Agent Platform by Blostem
        </div>

        {/* Heading */}
        <h1 className="animate-fade-in-up-delay-1 text-5xl font-bold leading-[1.1] tracking-tight text-white lg:text-7xl">
          AI Agent Orchestration{' '}
          <span className="bg-gradient-to-r from-nexus-400 via-nexus-500 to-nexus-600 bg-clip-text text-transparent">
            &amp; Mission Control
          </span>
        </h1>

        {/* Subtitle */}
        <p className="animate-fade-in-up-delay-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
          Deploy autonomous AI agents, build agentic workflows with
          human-in-the-loop approvals, and manage enterprise multi-agent
          operations&nbsp;&mdash; all from one unified mission control dashboard.
        </p>

        {/* CTA Buttons */}
        <div className="animate-fade-in-up-delay-3 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 rounded-lg bg-nexus-600 px-7 py-3.5 font-semibold text-white shadow-lg shadow-nexus-600/20 transition-all hover:bg-nexus-500 hover:shadow-xl hover:shadow-nexus-500/25"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-7 py-3.5 font-semibold text-gray-300 transition-all hover:border-white/20 hover:bg-white/10"
          >
            <ChevronDown className="h-4 w-4" />
            See How It Works
          </a>
        </div>

        {/* Stat Chips */}
        <div className="animate-fade-in-up-delay-3 mt-14 flex flex-wrap items-center justify-center gap-3">
          {stats.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 text-sm text-gray-400 backdrop-blur-sm transition-colors hover:border-nexus-500/20 hover:text-gray-300"
            >
              <Icon className="h-3.5 w-3.5 text-nexus-500" />
              {label}
            </div>
          ))}
        </div>

        {/* Scroll indicator */}
        <div className="mt-16 flex animate-fade-in-up-delay-3 justify-center">
          <div className="flex h-8 w-5 items-start justify-center rounded-full border border-white/20 p-1">
            <div className="h-1.5 w-1 animate-float-fast rounded-full bg-white/40" />
          </div>
        </div>
      </div>
    </section>
  );
}
