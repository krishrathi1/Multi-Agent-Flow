export function DashboardPreview() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        {/* Section heading */}
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            See it in action
          </h2>
          <p className="mt-3 text-lg text-gray-400">
            A glimpse of your AI agent mission control
          </p>
        </div>

        {/* Outer glow wrapper */}
        <div className="animate-glow rounded-2xl border border-white/10 bg-surface-900 shadow-2xl shadow-nexus-500/10 overflow-hidden">
          <div className="flex h-[440px] sm:h-[500px]">
            {/* Sidebar */}
            <div className="hidden w-14 flex-shrink-0 flex-col items-center border-r border-white/5 bg-surface-850 py-4 sm:flex">
              {/* Logo mark */}
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-nexus-500 to-nexus-700 text-xs font-bold text-white shadow-lg shadow-nexus-600/30">
                N
              </div>
              <div className="mt-6 flex flex-col items-center gap-3.5">
                <NavDot color="bg-nexus-500" active tooltip="Dashboard" />
                <NavDot color="bg-emerald-500" tooltip="Agents" />
                <NavDot color="bg-amber-500" tooltip="Boards" />
                <NavDot color="bg-violet-500" tooltip="Chat" />
                <NavDot color="bg-gray-600" tooltip="Settings" />
              </div>
              {/* User avatar at bottom */}
              <div className="mt-auto">
                <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-nexus-400 to-violet-500">
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white">
                    JD
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface-850 bg-emerald-500" />
                </div>
              </div>
            </div>

            {/* Main content area */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Top header bar */}
              <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/5 bg-surface-850 px-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-white/80">Mission Control</span>
                  <span className="text-[10px] text-white/30">/</span>
                  <span className="text-[10px] text-white/40">Dashboard</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                    All systems go
                  </span>
                  <div className="h-5 w-5 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Dashboard body */}
              <div className="flex flex-1 overflow-hidden">
                {/* Left + center area */}
                <div className="flex flex-1 flex-col overflow-hidden p-3 sm:p-4">
                  {/* Stats row */}
                  <div className="mb-3 grid grid-cols-2 gap-2 sm:mb-4 sm:grid-cols-4 sm:gap-3">
                    <StatCard
                      label="Agents Online"
                      value={7}
                      accent="emerald"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Active Boards"
                      value={3}
                      accent="nexus"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" />
                          <rect x="14" y="3" width="7" height="7" rx="1" />
                          <rect x="3" y="14" width="7" height="7" rx="1" />
                          <rect x="14" y="14" width="7" height="7" rx="1" />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Pending Approvals"
                      value={2}
                      accent="amber"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      }
                    />
                    <StatCard
                      label="Chat Sessions"
                      value={5}
                      accent="violet"
                      icon={
                        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                        </svg>
                      }
                    />
                  </div>

                  {/* Board view */}
                  <div className="flex flex-1 gap-2 overflow-hidden sm:gap-3">
                    {/* TODO column */}
                    <BoardColumn title="TODO" count={3} color="text-gray-400" borderColor="border-gray-600/50">
                      <TaskCard
                        title="Research competitor analysis"
                        tag="Research"
                        tagColor="bg-violet-500/20 text-violet-400"
                        agent="RA"
                        agentColor="from-violet-400 to-violet-600"
                        priority="medium"
                      />
                      <TaskCard
                        title="Update API documentation"
                        tag="Docs"
                        tagColor="bg-nexus-500/20 text-nexus-400"
                        agent="DW"
                        agentColor="from-nexus-400 to-nexus-600"
                        priority="low"
                      />
                    </BoardColumn>

                    {/* IN PROGRESS column */}
                    <BoardColumn title="IN PROGRESS" count={2} color="text-nexus-400" borderColor="border-nexus-500/40">
                      <TaskCard
                        title="Fix auth session bug"
                        tag="Bug"
                        tagColor="bg-red-500/20 text-red-400"
                        agent="CR"
                        agentColor="from-amber-400 to-orange-500"
                        priority="high"
                        active
                      />
                      <TaskCard
                        title="Optimize DB queries"
                        tag="Perf"
                        tagColor="bg-amber-500/20 text-amber-400"
                        agent="DP"
                        agentColor="from-emerald-400 to-teal-500"
                        priority="medium"
                      />
                    </BoardColumn>

                    {/* DONE column */}
                    <BoardColumn title="DONE" count={4} color="text-emerald-400" borderColor="border-emerald-500/40">
                      <TaskCard
                        title="Deploy v2.1 to staging"
                        tag="Deploy"
                        tagColor="bg-emerald-500/20 text-emerald-400"
                        agent="DB"
                        agentColor="from-sky-400 to-blue-500"
                        done
                      />
                      <TaskCard
                        title="Write unit tests for auth"
                        tag="Test"
                        tagColor="bg-sky-500/20 text-sky-400"
                        agent="CR"
                        agentColor="from-amber-400 to-orange-500"
                        done
                      />
                    </BoardColumn>
                  </div>
                </div>

                {/* Right panel - Approvals */}
                <div className="hidden w-56 flex-shrink-0 flex-col border-l border-white/5 bg-surface-850/50 lg:flex">
                  <div className="border-b border-white/5 px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider">Approvals</span>
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[9px] font-bold text-amber-400">2</span>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col gap-2.5 p-3 overflow-y-auto">
                    {/* Primary approval card */}
                    <ApprovalCard
                      title="Deploy to Production"
                      agent="deploy-bot"
                      agentColor="from-sky-400 to-blue-500"
                      confidence={92}
                      time="2m ago"
                      urgent
                    />

                    {/* Secondary approval card */}
                    <ApprovalCard
                      title="Merge PR #184"
                      agent="code-reviewer"
                      agentColor="from-amber-400 to-orange-500"
                      confidence={78}
                      time="8m ago"
                    />

                    {/* Recent activity */}
                    <div className="mt-auto border-t border-white/5 pt-2.5">
                      <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">Recent</span>
                      <div className="mt-2 flex flex-col gap-2">
                        <RecentItem text="Auth fix approved" color="bg-emerald-500" time="12m" />
                        <RecentItem text="DB migration rejected" color="bg-red-500" time="1h" />
                        <RecentItem text="Cache update approved" color="bg-emerald-500" time="2h" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function NavDot({
  color,
  active,
  tooltip: _tooltip,
}: {
  color: string;
  active?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="group relative flex items-center justify-center">
      <div
        className={`h-2.5 w-2.5 rounded-full transition-all ${color} ${
          active
            ? 'ring-2 ring-nexus-500/40 ring-offset-2 ring-offset-surface-850 scale-110'
            : 'opacity-50 hover:opacity-80'
        }`}
      />
      {active && (
        <span className="absolute -left-0.5 h-4 w-0.5 -translate-x-3 rounded-r bg-nexus-500" />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'nexus' | 'amber' | 'violet';
  icon: React.ReactNode;
}) {
  const styles = {
    emerald: {
      dot: 'bg-emerald-500',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/5',
      border: 'border-emerald-500/10',
      icon: 'text-emerald-500/60',
    },
    nexus: {
      dot: 'bg-nexus-500',
      text: 'text-nexus-400',
      bg: 'bg-nexus-500/5',
      border: 'border-nexus-500/10',
      icon: 'text-nexus-500/60',
    },
    amber: {
      dot: 'bg-amber-500',
      text: 'text-amber-400',
      bg: 'bg-amber-500/5',
      border: 'border-amber-500/10',
      icon: 'text-amber-500/60',
    },
    violet: {
      dot: 'bg-violet-500',
      text: 'text-violet-400',
      bg: 'bg-violet-500/5',
      border: 'border-violet-500/10',
      icon: 'text-violet-500/60',
    },
  }[accent];

  return (
    <div className={`rounded-lg border ${styles.border} ${styles.bg} p-2.5 sm:p-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${styles.dot} animate-pulse-dot`} />
          <span className="text-[10px] text-white/40 leading-none hidden sm:inline">{label}</span>
        </div>
        <span className={styles.icon}>{icon}</span>
      </div>
      <div className={`mt-1.5 text-xl font-bold ${styles.text} sm:text-2xl`}>{value}</div>
      <span className="text-[10px] text-white/40 leading-none sm:hidden">{label}</span>
    </div>
  );
}

function BoardColumn({
  title,
  count,
  color,
  borderColor,
  children,
}: {
  title: string;
  count: number;
  color: string;
  borderColor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className={`mb-2 flex items-center gap-2 border-b pb-2 ${borderColor}`}>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${color}`}>{title}</span>
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/5 px-1 text-[9px] font-medium text-white/40">
          {count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto">{children}</div>
    </div>
  );
}

function TaskCard({
  title,
  tag,
  tagColor,
  agent,
  agentColor,
  priority,
  active,
  done,
}: {
  title: string;
  tag: string;
  tagColor: string;
  agent: string;
  agentColor: string;
  priority?: 'low' | 'medium' | 'high';
  active?: boolean;
  done?: boolean;
}) {
  const priorityDot = {
    low: 'bg-gray-500',
    medium: 'bg-amber-500',
    high: 'bg-red-500',
  };

  return (
    <div
      className={`rounded-lg border p-2.5 transition-all ${
        active
          ? 'border-nexus-500/30 bg-nexus-500/5 shadow-sm shadow-nexus-500/10'
          : done
            ? 'border-white/5 bg-surface-900/40'
            : 'border-white/5 bg-surface-900/80 hover:border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <span
          className={`text-[11px] leading-snug ${
            done ? 'text-white/30 line-through' : 'text-white/70'
          }`}
        >
          {title}
        </span>
        {active && (
          <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-nexus-500 animate-pulse-dot" />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[8px] font-medium ${tagColor}`}>{tag}</span>
          {priority && !done && (
            <span className={`h-1.5 w-1.5 rounded-full ${priorityDot[priority]}`} />
          )}
        </div>
        <div
          className={`flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br ${agentColor}`}
        >
          <span className="text-[7px] font-bold text-white">{agent}</span>
        </div>
      </div>
    </div>
  );
}

function ApprovalCard({
  title,
  agent,
  agentColor,
  confidence,
  time,
  urgent,
}: {
  title: string;
  agent: string;
  agentColor: string;
  confidence: number;
  time: string;
  urgent?: boolean;
}) {
  const confidenceColor =
    confidence >= 90 ? 'bg-emerald-500' : confidence >= 70 ? 'bg-amber-500' : 'bg-red-500';
  const confidenceTextColor =
    confidence >= 90 ? 'text-emerald-400' : confidence >= 70 ? 'text-amber-400' : 'text-red-400';

  return (
    <div
      className={`rounded-lg border p-2.5 ${
        urgent
          ? 'border-amber-500/20 bg-amber-500/5'
          : 'border-white/5 bg-surface-900/60'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-white/80">{title}</span>
        {urgent && (
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse-dot" />
        )}
      </div>

      {/* Agent line */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div
          className={`flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br ${agentColor}`}
        >
          <span className="text-[6px] font-bold text-white">
            {agent
              .split('-')
              .map((w) => w[0])
              .join('')
              .toUpperCase()}
          </span>
        </div>
        <span className="text-[10px] text-white/40">{agent}</span>
        <span className="ml-auto text-[9px] text-white/20">{time}</span>
      </div>

      {/* Confidence bar */}
      <div className="mb-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-white/30">Confidence</span>
          <span className={`text-[9px] font-medium ${confidenceTextColor}`}>{confidence}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <div
            className={`h-full rounded-full ${confidenceColor} transition-all`}
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-1.5">
        <button className="flex-1 rounded-md bg-emerald-500/15 py-1 text-[9px] font-medium text-emerald-400 hover:bg-emerald-500/25 transition-colors cursor-default">
          Approve
        </button>
        <button className="flex-1 rounded-md bg-red-500/10 py-1 text-[9px] font-medium text-red-400 hover:bg-red-500/20 transition-colors cursor-default">
          Reject
        </button>
      </div>
    </div>
  );
}

function RecentItem({ text, color, time }: { text: string; color: string; time: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${color}`} />
      <span className="text-[10px] text-white/40 truncate">{text}</span>
      <span className="ml-auto text-[8px] text-white/20 flex-shrink-0">{time}</span>
    </div>
  );
}
