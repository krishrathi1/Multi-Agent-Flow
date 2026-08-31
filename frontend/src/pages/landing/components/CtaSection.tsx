import { Link } from 'react-router-dom';
import { ArrowRight, CreditCard, ShieldCheck, Server } from 'lucide-react';

const trustIndicators = [
  { icon: CreditCard, label: 'No credit card required' },
  { icon: ShieldCheck, label: 'Enterprise-grade security' },
  { icon: Server, label: 'Self-hosted option' },
];

export function CtaSection() {
  return (
    <section className="relative overflow-hidden px-6 py-32">
      {/* Gradient background */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-nexus-950/30 to-surface-950"
        aria-hidden="true"
      />

      {/* Subtle glow orb */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[600px] rounded-full bg-nexus-600/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="animate-fade-in-up text-3xl font-bold tracking-tight text-white sm:text-5xl">
          Start Building Agentic Workflows&nbsp;Today
        </h2>

        <p className="animate-fade-in-up-delay-1 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400">
          Connect your gateway, deploy autonomous AI agents, and orchestrate
          enterprise agentic workflows&nbsp;&mdash; all in under
          5&nbsp;minutes.
        </p>

        {/* CTA Buttons */}
        <div className="animate-fade-in-up-delay-2 mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            to="/signup"
            className="group inline-flex items-center gap-2 rounded-lg bg-nexus-600 px-8 py-4 text-lg font-medium text-white shadow-lg shadow-nexus-600/20 transition-all hover:bg-nexus-500 hover:shadow-xl hover:shadow-nexus-500/25"
          >
            Get Started Free
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-8 py-4 text-lg font-medium text-gray-300 transition-all hover:border-white/20 hover:bg-white/10"
          >
            Read the Docs
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="animate-fade-in-up-delay-3 mt-10 flex flex-wrap items-center justify-center gap-6">
          {trustIndicators.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="inline-flex items-center gap-2 text-sm text-gray-500"
            >
              <Icon className="h-4 w-4 text-nexus-500/70" />
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
