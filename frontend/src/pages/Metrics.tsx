import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import {
  Bot,
  CircleDollarSign,
  Gauge,
  Hash,
  RefreshCw,
  Timer,
  TrendingUp,
  Wrench,
  Activity,
  Zap,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { TokenUsage, MetricSnapshot, AgentInsight } from '@/types';
import { formatCompact, formatCurrency, formatMs } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { TableWrap, Table, Th, Td, Tr } from '@/components/ui/Table';
import { LiveWaveform, LiveRadarBeacon } from '@/components/ui/LiveIcon';
import { HourglassLoader } from '@/components/ui/HourglassLoader';

interface TokenSummary {
  totalTokens: number;
  totalCost: number;
  byAgent: Array<{
    agentId: string;
    agentName: string;
    displayName: string;
    avatar: string | null;
    totalTokens: number;
    totalCost: number;
  }>;
}

interface MetricsSummary {
  byAgent: Array<{
    agentId: string;
    agentName: string;
    displayName: string;
    avatar: string | null;
    avgResponseTime: number;
    p95ResponseTime: number;
    successRate: number;
    totalCalls: number;
  }>;
}

const CHART_H = 260;

/** Modern Glassmorphic Tooltip for Recharts */
function CustomChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (val: any, name?: string) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-2xl border border-line bg-surface/95 backdrop-blur-xl p-3 shadow-xl text-xs space-y-1.5 min-w-[150px] animate-scale-in">
      {label && (
        <p className="text-[11px] font-bold text-ink-muted border-b border-line-subtle pb-1">
          {label}
        </p>
      )}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-3 text-2xs font-semibold">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: item.color || item.fill || '#3b82f6' }}
            />
            <span className="text-ink-muted capitalize truncate">{item.name}</span>
          </div>
          <span className="text-ink font-mono font-bold shrink-0">
            {valueFormatter ? valueFormatter(item.value, item.name) : typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Chart panel card container with consistent header and responsive body */
function ChartPanel({
  title,
  description,
  icon: Icon,
  empty,
  emptyLabel,
  action,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  empty?: boolean;
  emptyLabel?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs hover:border-line-strong transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 border-b border-line-subtle pb-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink truncate">{title}</h3>
            {description && <p className="text-[11px] text-ink-muted truncate">{description}</p>}
          </div>
        </div>
        {action}
      </div>

      <div className="flex-1 min-h-0">
        {empty ? (
          <div style={{ height: CHART_H }} className="flex flex-col items-center justify-center text-center p-6">
            <Icon size={28} className="text-ink-faint mb-2 opacity-50" />
            <p className="text-xs font-semibold text-ink">No data recorded</p>
            <p className="text-[11px] text-ink-muted mt-0.5 max-w-xs">{emptyLabel ?? 'Metrics will populate automatically as agents process tasks.'}</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function Metrics() {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const chart = useChartTheme();
  const socketConnected = useUiStore((s) => s.socketConnected);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (silent) setRefreshing(true);
    else setLoading(true);
    try {
      const [usage, tSummary, metricsList, mSummary, agentStats] = await Promise.all([
        api.tokens.usage({ hours: 24 }),
        api.tokens.summary(),
        api.metrics.list({ limit: 1000 }),
        api.metrics.summary(),
        api.orchestration.agentInsights().catch(() => [] as AgentInsight[]),
      ]);
      setTokenUsage(usage);
      setTokenSummary(tSummary);
      setMetrics(metricsList);
      setMetricsSummary(mSummary);
      setInsights(agentStats);
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      console.error('Failed to fetch metrics data:', err);
    } finally {
      inFlight.current = false;
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') fetchData(true);
    };
    const interval = setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [fetchData]);

  useEffect(() => {
    const s = getSocket();
    let queued: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (queued) clearTimeout(queued);
      queued = setTimeout(() => fetchData(true), 800);
    };
    const events = [
      'activity:new',
      'metrics:new',
      'token:usage',
      'agent:status',
      'agent:heartbeat',
      'process:updated',
    ];
    events.forEach((e) => s.on(e, refresh));
    return () => {
      if (queued) clearTimeout(queued);
      events.forEach((e) => s.off(e, refresh));
    };
  }, [fetchData]);

  const stats24h = useMemo(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recent = tokenUsage.filter((t) => t.createdAt >= cutoff);
    const totalTokens24h = recent.reduce((sum, t) => sum + t.totalTokens, 0);
    const totalCost24h = recent.reduce((sum, t) => sum + t.cost, 0);

    const recentMetrics = metrics.filter((m) => m.createdAt >= cutoff);
    const avgResponseTime =
      recentMetrics.length > 0
        ? Math.round(
            recentMetrics.reduce((sum, m) => sum + m.responseTimeMs, 0) / recentMetrics.length,
          )
        : 0;
    const successCount = recentMetrics.filter((m) => m.success).length;
    const successRate =
      recentMetrics.length > 0
        ? Math.round((successCount / recentMetrics.length) * 10000) / 100
        : 0;

    return { totalTokens24h, totalCost24h, avgResponseTime, successRate, calls: recentMetrics.length };
  }, [tokenUsage, metrics]);

  const hourlyTokenData = useMemo(() => {
    const now = Date.now();
    const buckets: Array<{ hour: string; input: number; output: number; total: number }> = [];
    for (let i = 23; i >= 0; i--) {
      const start = now - (i + 1) * 60 * 60 * 1000;
      const end = now - i * 60 * 60 * 1000;
      const hourLabel = new Date(end).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const inRange = tokenUsage.filter((t) => {
        const ts = new Date(t.createdAt).getTime();
        return ts >= start && ts < end;
      });
      const input = inRange.reduce((sum, t) => sum + t.inputTokens, 0);
      const output = inRange.reduce((sum, t) => sum + t.outputTokens, 0);
      buckets.push({
        hour: hourLabel,
        input,
        output,
        total: input + output,
      });
    }
    return buckets;
  }, [tokenUsage]);

  const hasTokenSeries = hourlyTokenData.some((b) => b.input > 0 || b.output > 0);

  const costByAgent = useMemo(() => {
    if (!tokenSummary) return [];
    return tokenSummary.byAgent
      .map((a) => ({
        name: a.displayName,
        agentName: a.agentName,
        cost: Math.round(a.totalCost * 10000) / 10000,
        tokens: a.totalTokens,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokenSummary]);

  const responseTimeByAgent = useMemo(() => {
    if (!metricsSummary) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName,
      avg: a.avgResponseTime,
      p95: a.p95ResponseTime,
      calls: a.totalCalls,
    }));
  }, [metricsSummary]);

  const successRateByAgent = useMemo(() => {
    if (!metricsSummary) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName,
      rate: a.successRate,
      calls: a.totalCalls,
    }));
  }, [metricsSummary]);

  const toolUsage = useMemo(() => {
    const toolMap = new Map<string, number>();
    for (const m of metrics) {
      const tool = m.toolName || 'Unknown';
      toolMap.set(tool, (toolMap.get(tool) || 0) + 1);
    }
    return Array.from(toolMap.entries())
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);
  }, [metrics]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon={Gauge}
          title="Metrics & Cost"
          description="Real-time telemetry, model token consumption, latency, and fleet spend analysis"
        />
        <div className="flex flex-col items-center justify-center py-24">
          <HourglassLoader size={52} label="Compiling fleet analytics..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        title="Metrics & Cost"
        description="Real-time telemetry, model token consumption, latency, and fleet spend analysis"
        badge={
          <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
            {socketConnected ? 'Live Feed' : 'Offline'}
          </Badge>
        }
        actions={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-2xs font-semibold tabular-nums text-ink-muted flex items-center gap-1 bg-inset px-2.5 py-1 rounded-xl border border-line-subtle">
                <Clock size={11} /> {timeAgo(lastUpdated)}
              </span>
            )}
            <Button
              variant="secondary"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchData(true)}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* 4 Core Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Tokens</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <Hash size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {formatCompact(stats24h.totalTokens24h)}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Last 24 hours throughput</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Spend</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CircleDollarSign size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {formatCurrency(stats24h.totalCost24h)}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Across all connected LLMs</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Avg Response</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Timer size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {formatMs(stats24h.avgResponseTime)}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">{formatCompact(stats24h.calls)} total LLM calls</p>
        </div>

        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Success Rate</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {stats24h.successRate}%
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Zero-anomaly threshold</p>
        </div>
      </div>

      {/* Row 1: Token Usage Gradient Area Chart & Cost by Agent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Token Usage Area Chart */}
        <ChartPanel
          icon={Hash}
          title="Token Usage Over Time"
          description="Input vs. Output tokens hourly breakdown (24h)"
          empty={!hasTokenSeries}
          emptyLabel="No token activity recorded in the past 24 hours."
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <AreaChart data={hourlyTokenData} margin={{ top: 8, right: 12, bottom: 0, left: -6 }}>
              <defs>
                <linearGradient id="tokenInputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="tokenOutputGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-line-subtle)" />
              <XAxis
                dataKey="hour"
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--c-line)' }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={formatCompact}
              />
              <Tooltip
                content={
                  <CustomChartTooltip
                    valueFormatter={(val, name) => `${formatCompact(val)} ${name === 'input' ? 'Input' : 'Output'}`}
                  />
                }
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 600, color: 'var(--c-ink-muted)', paddingBottom: 10 }}
                formatter={(v) => (v === 'input' ? 'Input Tokens' : 'Output Tokens')}
              />
              <Area
                type="monotone"
                dataKey="input"
                stackId="1"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#tokenInputGradient)"
                name="input"
              />
              <Area
                type="monotone"
                dataKey="output"
                stackId="1"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#tokenOutputGradient)"
                name="output"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Cost by Agent Ranked List */}
        <ChartPanel
          icon={CircleDollarSign}
          title="Cost Breakdown by Agent"
          description="Cumulative token expenditure per agent"
          empty={costByAgent.length === 0}
          emptyLabel="No spend incurred yet."
        >
          <div className="space-y-3.5 max-h-[260px] overflow-y-auto pr-1">
            {costByAgent.map((agent, i) => {
              const maxCost = Math.max(...costByAgent.map((a) => a.cost), 0.0001);
              const percentage = Math.min(Math.round((agent.cost / maxCost) * 100), 100);
              return (
                <div key={agent.name} className="p-3 rounded-xl bg-inset/60 border border-line-subtle hover:border-line transition-all">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                        #{i + 1}
                      </span>
                      <span className="text-xs font-bold text-ink truncate">{agent.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(agent.cost)}
                      </span>
                      <span className="text-[10px] text-ink-faint font-mono ml-1.5">
                        ({formatCompact(agent.tokens)} tok)
                      </span>
                    </div>
                  </div>
                  {/* Progress Meter */}
                  <div className="w-full h-2 rounded-full bg-surface border border-line-subtle overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 4)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </ChartPanel>
      </div>

      {/* Row 2: Response Time, Success Rate, Tool Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Response Latency */}
        <ChartPanel
          icon={Timer}
          title="Response Time (Latency)"
          description="Average vs. p95 tail latency per agent"
          empty={responseTimeByAgent.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={responseTimeByAgent}
              margin={{ top: 8, right: 8, bottom: 42, left: -6 }}
              barGap={4}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-line-subtle)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--c-line)' }}
                tickFormatter={(n: string) => n.length > 14 ? `${n.slice(0, 12)}…` : n}
                angle={-22}
                textAnchor="end"
                height={42}
                interval={0}
              />
              <YAxis
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={46}
                tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}s` : `${v}ms`)}
              />
              <Tooltip
                content={
                  <CustomChartTooltip
                    valueFormatter={(val, name) => `${formatMs(val)} (${name === 'avg' ? 'Avg' : 'p95'})`}
                  />
                }
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, fontWeight: 600, color: 'var(--c-ink-muted)', paddingBottom: 10 }}
                formatter={(v) => (v === 'avg' ? 'Average Latency' : 'p95 Tail Latency')}
              />
              <Bar dataKey="avg" fill="#3b82f6" radius={[4, 4, 0, 0]} name="avg" maxBarSize={20} />
              <Bar dataKey="p95" fill="#f97316" radius={[4, 4, 0, 0]} name="p95" maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Success Rate */}
        <ChartPanel
          icon={TrendingUp}
          title="Reliability & Success Rate"
          description="Zero-error task execution benchmark"
          empty={successRateByAgent.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={successRateByAgent}
              margin={{ top: 8, right: 8, bottom: 42, left: -14 }}
              barCategoryGap="28%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--c-line-subtle)" />
              <XAxis
                dataKey="name"
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={{ stroke: 'var(--c-line)' }}
                tickFormatter={(n: string) => n.length > 14 ? `${n.slice(0, 12)}…` : n}
                angle={-22}
                textAnchor="end"
                height={42}
                interval={0}
              />
              <YAxis
                tick={{ fill: 'var(--c-ink-subtle)', fontSize: 10, fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={38}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                content={
                  <CustomChartTooltip
                    valueFormatter={(val) => `${val}% Success`}
                  />
                }
              />
              <Bar dataKey="rate" radius={[6, 6, 0, 0]} maxBarSize={32}>
                {successRateByAgent.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.rate >= 95
                        ? '#10b981'
                        : entry.rate >= 80
                          ? '#f59e0b'
                          : '#ef4444'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        {/* Tool Invocations */}
        <ChartPanel
          icon={Wrench}
          title="Top Tool Invocations"
          description="Most called agent functions & tools"
          empty={toolUsage.length === 0}
        >
          <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
            {toolUsage.map((tool, i) => {
              const maxCalls = Math.max(...toolUsage.map((t) => t.calls), 1);
              const percentage = Math.round((tool.calls / maxCalls) * 100);
              return (
                <div key={tool.name} className="p-2.5 rounded-xl bg-inset/50 border border-line-subtle flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs font-mono font-semibold text-ink truncate">{tool.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-16 h-1.5 rounded-full bg-surface border border-line-subtle overflow-hidden hidden sm:block">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="px-2 py-0.5 rounded-md bg-surface border border-line text-2xs font-mono font-bold text-ink">
                      {tool.calls} calls
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </ChartPanel>
      </div>

      {/* Row 3: Ranked Agent Performance Table */}
      {insights.length > 0 && (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-line-subtle pb-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                <Bot size={16} />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Agent Performance Ranking</h3>
                <p className="text-[11px] text-ink-muted">Cumulative run metrics, duration, token usage, and total spend</p>
              </div>
            </div>
            <LiveWaveform color="bg-brand-500" />
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse min-w-[620px]">
              <thead>
                <tr className="border-b border-line-subtle text-[11px] uppercase tracking-wider text-ink-muted font-bold">
                  <th className="py-2.5 px-3">Agent</th>
                  <th className="py-2.5 px-3 text-right">Steps/Runs</th>
                  <th className="py-2.5 px-3 text-right">Success</th>
                  <th className="py-2.5 px-3 text-right">Avg Time</th>
                  <th className="py-2.5 px-3 text-right">Tokens</th>
                  <th className="py-2.5 px-3 text-right">Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle font-medium">
                {insights.map((agent) => (
                  <tr key={agent.agentId} className="hover:bg-hover/50 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-inset border border-line flex items-center justify-center text-xs shrink-0">
                          🤖
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-ink block truncate max-w-[200px]">{agent.agentName}</span>
                          <span className="text-[10px] text-ink-faint font-mono truncate max-w-[140px] block" title={agent.agentId}>
                            {agent.agentId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-ink">
                      {agent.runs}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className={cn(
                        'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border',
                        agent.successRate >= 90
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                          : agent.successRate >= 75
                            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                      )}>
                        {agent.successRate}%
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-ink-muted">
                      {formatMs(agent.avgDurationMs)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-ink-muted">
                      {formatCompact(agent.totalTokens)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(agent.totalCostUsd)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

