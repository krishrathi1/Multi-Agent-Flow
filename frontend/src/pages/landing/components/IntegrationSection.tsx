import { Code2, Microscope, Server, ArrowRight, Bell, MessageSquare, Hash, Video } from 'lucide-react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ */
/*  Platform Integration Types                                         */
/* ------------------------------------------------------------------ */

interface PlatformIntegration {
  name: string;
  icon: ReactNode;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
  features: string[];
  setupSteps: { step: string; detail: string }[];
  config: ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Platform SVG Icons                                                 */
/* ------------------------------------------------------------------ */

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
    </svg>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" />
    </svg>
  );
}

function GoogleChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.372 0 0 5.373 0 12s5.372 12 12 12 12-5.373 12-12S18.628 0 12 0zm5.568 16.8H16.2l-1.2-1.2H8.4v-1.2h6L16.8 12H8.4V7.2h8.4l-2.4 2.4h-4.8v1.2h5.568l2.4 2.4v3.6z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Config preview snippets                                            */
/* ------------------------------------------------------------------ */

function TelegramConfigPreview() {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-950/80 p-3 font-mono text-[10px] leading-relaxed">
      <div className="text-gray-500">// openclaw config</div>
      <div><span className="text-gray-400">channels:</span></div>
      <div className="pl-2"><span className="text-gray-400">telegram:</span></div>
      <div className="pl-4"><span className="text-nexus-400">botToken</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"123:abc..."</span></div>
      <div className="pl-4"><span className="text-nexus-400">dmPolicy</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"pairing"</span></div>
      <div className="pl-4"><span className="text-nexus-400">groups</span><span className="text-gray-500">: </span><span className="text-gray-400">{'{ "*": { requireMention: true } }'}</span></div>
    </div>
  );
}

function SlackConfigPreview() {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-950/80 p-3 font-mono text-[10px] leading-relaxed">
      <div className="text-gray-500">// openclaw config</div>
      <div><span className="text-gray-400">channels:</span></div>
      <div className="pl-2"><span className="text-gray-400">slack:</span></div>
      <div className="pl-4"><span className="text-nexus-400">mode</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"socket"</span></div>
      <div className="pl-4"><span className="text-nexus-400">appToken</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"xapp-..."</span></div>
      <div className="pl-4"><span className="text-nexus-400">botToken</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"xoxb-..."</span></div>
    </div>
  );
}

function GoogleChatConfigPreview() {
  return (
    <div className="rounded-lg border border-white/5 bg-surface-950/80 p-3 font-mono text-[10px] leading-relaxed">
      <div className="text-gray-500">// openclaw config</div>
      <div><span className="text-gray-400">channels:</span></div>
      <div className="pl-2"><span className="text-gray-400">googlechat:</span></div>
      <div className="pl-4"><span className="text-nexus-400">serviceAccountFile</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"sa.json"</span></div>
      <div className="pl-4"><span className="text-nexus-400">webhookPath</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"/googlechat"</span></div>
      <div className="pl-4"><span className="text-nexus-400">audienceType</span><span className="text-gray-500">: </span><span className="text-amber-300/80">"app-url"</span></div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Platform definitions                                               */
/* ------------------------------------------------------------------ */

const platforms: PlatformIntegration[] = [
  {
    name: 'Telegram',
    icon: <TelegramIcon className="h-6 w-6" />,
    description: 'Connect your AI agents to Telegram via Bot API. Users message your bot, and the agent responds in real-time with full context awareness.',
    color: 'text-sky-400',
    borderColor: 'border-sky-500/30',
    bgColor: 'bg-sky-500/10',
    features: [
      'Direct messages & group chats',
      'Pairing-based access control',
      'Mention-gated group responses',
      'Inline keyboard buttons',
      'Media & file sharing',
      'Streaming partial replies',
    ],
    setupSteps: [
      { step: 'Create Bot', detail: 'Message @BotFather on Telegram, run /newbot, and save the token' },
      { step: 'Configure', detail: 'Add the bot token in your agent\'s integration settings' },
      { step: 'Set Policy', detail: 'Choose DM policy: pairing (default), allowlist, or open' },
      { step: 'Go Live', detail: 'Enable the integration — your agent starts responding to messages' },
    ],
    config: <TelegramConfigPreview />,
  },
  {
    name: 'Slack',
    icon: <SlackIcon className="h-6 w-6" />,
    description: 'Bring your AI agents into Slack workspaces. Agents join channels, respond to mentions, handle threads, and execute actions via slash commands.',
    color: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    bgColor: 'bg-purple-500/10',
    features: [
      'Socket Mode (real-time)',
      'Channel & DM support',
      'Thread-aware conversations',
      'Reactions & emoji responses',
      'Slash commands',
      'File & pin management',
    ],
    setupSteps: [
      { step: 'Create App', detail: 'Go to api.slack.com/apps, create a new app with Socket Mode enabled' },
      { step: 'Get Tokens', detail: 'Generate App Token (xapp-...) and Bot Token (xoxb-...) with required scopes' },
      { step: 'Add Scopes', detail: 'chat:write, channels:history, app_mentions:read, reactions:read/write, and more' },
      { step: 'Connect', detail: 'Add both tokens to your agent — Socket Mode connects automatically' },
    ],
    config: <SlackConfigPreview />,
  },
  {
    name: 'Google Chat',
    icon: <GoogleChatIcon className="h-6 w-6" />,
    description: 'Deploy AI agents into Google Chat spaces. Agents respond via HTTP webhooks using service account authentication for enterprise-grade security.',
    color: 'text-emerald-400',
    borderColor: 'border-emerald-500/30',
    bgColor: 'bg-emerald-500/10',
    features: [
      'Google Workspace native',
      'Service account auth (JWT)',
      'Spaces & DM support',
      'Mention-gated responses',
      'Reaction indicators',
      'Enterprise SSO compatible',
    ],
    setupSteps: [
      { step: 'GCP Project', detail: 'Enable the Google Chat API and create a Service Account with JSON key' },
      { step: 'Chat App', detail: 'Configure your Chat app in GCP Console with HTTP endpoint connection' },
      { step: 'Webhook URL', detail: 'Point the Chat app to your gateway\'s /googlechat endpoint' },
      { step: 'Activate', detail: 'Upload the service account JSON — the agent goes live in Google Chat' },
    ],
    config: <GoogleChatConfigPreview />,
  },
];

/* ------------------------------------------------------------------ */
/*  Use Cases Types & Components (existing)                            */
/* ------------------------------------------------------------------ */

interface UseCase {
  icon: LucideIcon;
  title: string;
  description: string;
  visual: ReactNode;
}

function AgentAvatar({
  initials,
  role,
  color,
  statusColor = 'bg-emerald-400',
}: {
  initials: string;
  role: string;
  color: string;
  statusColor?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative">
        <div className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${color}`}>
          {initials}
        </div>
        <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-surface-900 ${statusColor}`} />
      </div>
      <span className="text-[9px] font-medium text-gray-400">{role}</span>
    </div>
  );
}

function TeamVisual() {
  const agents = [
    { initials: 'PR', role: 'Reviewer', color: 'bg-gradient-to-br from-nexus-500 to-nexus-700', statusColor: 'bg-emerald-400' },
    { initials: 'BF', role: 'Fixer', color: 'bg-gradient-to-br from-violet-500 to-violet-700', statusColor: 'bg-emerald-400' },
    { initials: 'TW', role: 'Tester', color: 'bg-gradient-to-br from-amber-500 to-amber-700', statusColor: 'bg-amber-400' },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-white/5 bg-surface-900/80 p-4">
      <div className="flex items-start justify-center gap-6">
        {agents.map((agent) => (
          <AgentAvatar key={agent.initials} {...agent} />
        ))}
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2 rounded-md bg-surface-950/60 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-gray-400"><span className="font-medium text-gray-300">PR</span> approved merge for <span className="font-mono text-nexus-400">#247</span></span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-surface-950/60 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-nexus-400" />
          <span className="text-[10px] text-gray-400"><span className="font-medium text-gray-300">BF</span> patched null-ref in <span className="font-mono text-nexus-400">auth.ts</span></span>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-surface-950/60 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
          <span className="text-[10px] text-gray-400"><span className="font-medium text-gray-300">TW</span> running integration suite&hellip;</span>
        </div>
      </div>
    </div>
  );
}

function PipelineArrow(props: LucideProps) {
  return <ArrowRight className="h-3.5 w-3.5 shrink-0 text-nexus-500/50" {...props} />;
}

function ResearchPipelineVisual() {
  const stages = [
    { label: 'Search', color: 'text-nexus-400', bg: 'bg-nexus-500/10' },
    { label: 'Analyze', color: 'text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Summarize', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Report', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-white/5 bg-surface-900/80 p-4">
      <div className="flex items-center justify-center gap-2">
        {stages.map((stage, i) => (
          <div key={stage.label} className="flex items-center gap-2">
            <div className={`rounded-md ${stage.bg} px-2.5 py-1.5 text-[10px] font-semibold ${stage.color}`}>{stage.label}</div>
            {i < stages.length - 1 && <PipelineArrow />}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-white/5 bg-surface-950/60 p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-medium text-emerald-400">Report Ready</span>
        </div>
        <p className="text-[10px] leading-relaxed text-gray-400">
          Analyzed <span className="text-gray-300">23 sources</span>. Key finding: competitor Y launched a new pricing tier, undercutting current rates by <span className="font-medium text-amber-400">18%</span>.
        </p>
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded bg-nexus-500/10 px-1.5 py-0.5 text-[8px] font-medium text-nexus-400">3 attachments</span>
          <span className="rounded bg-surface-850 px-1.5 py-0.5 text-[8px] font-medium text-gray-500">2 min ago</span>
        </div>
      </div>
    </div>
  );
}

function DevOpsDashboardVisual() {
  const servers = [
    { name: 'api-prod-1', uptime: 99.99, load: 24 },
    { name: 'api-prod-2', uptime: 99.95, load: 61 },
    { name: 'worker-01', uptime: 100, load: 38 },
    { name: 'db-primary', uptime: 99.97, load: 45 },
  ];

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-white/5 bg-surface-900/80 p-4">
      <div className="space-y-2">
        {servers.map((srv) => (
          <div key={srv.name} className="flex items-center gap-2.5">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-gray-300">{srv.name}</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-950">
              <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${srv.load}%` }} />
            </div>
            <span className="w-12 text-right text-[9px] tabular-nums text-emerald-400">{srv.uptime}%</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-2">
        <Bell className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
        <div>
          <p className="text-[10px] font-medium text-amber-300">Memory alert on api-prod-2</p>
          <p className="mt-0.5 text-[9px] text-gray-500">Agent auto-scaled to 4 GB &middot; awaiting approval to restart</p>
        </div>
      </div>
    </div>
  );
}

const useCases: UseCase[] = [
  {
    icon: Code2,
    title: 'Engineering Team Copilots',
    description: 'Deploy a fleet of coding agents \u2014 PR reviewers, bug fixers, test writers. Organize their work on boards, approve deployments, and track their progress in real-time.',
    visual: <TeamVisual />,
  },
  {
    icon: Microscope,
    title: 'Autonomous Research Agents',
    description: 'Create research agents that crawl the web, analyze competitors, summarize papers, and report findings. Set up approval gates for critical decisions.',
    visual: <ResearchPipelineVisual />,
  },
  {
    icon: Server,
    title: 'DevOps & Infrastructure Bots',
    description: 'Agents that monitor server health, deploy code, manage databases, and alert you when things go wrong. Full audit trail and human-in-the-loop controls.',
    visual: <DevOpsDashboardVisual />,
  },
];

/* ------------------------------------------------------------------ */
/*  Message flow visual                                                */
/* ------------------------------------------------------------------ */

function MessageFlowVisual() {
  return (
    <div className="mx-auto mt-12 max-w-4xl">
      <div className="rounded-xl border border-white/5 bg-surface-850 p-6">
        <h4 className="mb-4 text-center text-sm font-semibold text-white">How It Works</h4>
        <div className="flex items-center justify-between gap-4">
          {/* User */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium text-gray-400">User Message</span>
            <span className="text-[9px] text-gray-600">Telegram / Slack / GChat</span>
          </div>

          <ArrowRight className="h-5 w-5 shrink-0 text-nexus-500/40" />

          {/* Gateway */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-nexus-500/10 text-nexus-400">
              <Server className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium text-gray-400">OpenClaw Gateway</span>
            <span className="text-[9px] text-gray-600">Routes & authenticates</span>
          </div>

          <ArrowRight className="h-5 w-5 shrink-0 text-nexus-500/40" />

          {/* Agent */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 text-violet-400">
              <Hash className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium text-gray-400">AI Agent</span>
            <span className="text-[9px] text-gray-600">Processes & responds</span>
          </div>

          <ArrowRight className="h-5 w-5 shrink-0 text-nexus-500/40" />

          {/* Response */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-medium text-gray-400">Reply Sent</span>
            <span className="text-[9px] text-gray-600">Back to platform</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Section component                                                  */
/* ------------------------------------------------------------------ */

export function IntegrationSection() {
  return (
    <>
      {/* ── Platform Integrations ─────────────────────────────────── */}
      <section id="integrations" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          {/* Section heading */}
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Connect Agents to Any Platform
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              Deploy AI agents on Telegram, Slack, and Google Chat. Users interact naturally through their favorite platforms while agents handle the intelligence.
            </p>
          </div>

          {/* Platform cards */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {platforms.map((platform) => (
              <div
                key={platform.name}
                className={`group rounded-xl border ${platform.borderColor} bg-surface-850 p-6 transition-all duration-300 hover:bg-surface-850/80`}
              >
                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${platform.bgColor} ${platform.color}`}>
                    {platform.icon}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{platform.name}</h3>
                    <p className="text-[11px] text-gray-500">Chat Integration</p>
                  </div>
                </div>

                <p className="text-sm leading-relaxed text-gray-400 mb-4">
                  {platform.description}
                </p>

                {/* Features */}
                <div className="mb-4">
                  <div className="grid grid-cols-2 gap-1.5">
                    {platform.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-1.5">
                        <span className={`h-1 w-1 shrink-0 rounded-full ${platform.color.replace('text-', 'bg-')}`} />
                        <span className="text-[11px] text-gray-400">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Setup Steps */}
                <div className="mb-4">
                  <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">Quick Setup</h4>
                  <div className="space-y-2">
                    {platform.setupSteps.map((s, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${platform.bgColor} ${platform.color}`}>
                          {i + 1}
                        </div>
                        <div>
                          <span className="text-[11px] font-medium text-gray-300">{s.step}</span>
                          <p className="text-[10px] text-gray-500 leading-relaxed">{s.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Config preview */}
                {platform.config}
              </div>
            ))}
          </div>

          {/* Message flow diagram */}
          <MessageFlowVisual />
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────────── */}
      <section id="use-cases" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Agentic Workflow Use Cases
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-gray-400">
              MyceliumOps is the mission control for any enterprise AI agent workflow
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="group rounded-xl border border-white/5 bg-surface-850 p-6 transition-all duration-300 hover:border-nexus-500/30 hover:bg-surface-850/80"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-nexus-500/10 text-nexus-400 transition-colors group-hover:bg-nexus-500/20">
                    <useCase.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{useCase.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-gray-400">{useCase.description}</p>
                  </div>
                </div>
                {useCase.visual}
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
