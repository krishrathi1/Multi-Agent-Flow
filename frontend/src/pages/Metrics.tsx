import { useEffect, useState, useMemo, useCallback } from 'react';
import Chart from 'react-apexcharts';
import {
  CircleDollarSign,
  Gauge,
  Hash,
  RefreshCw,
  Timer,
  TrendingUp,
  Wrench,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
  ChevronRight,
  Sparkles,
  Bot,
  Activity,
  BarChart3,
  Calendar,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { TokenUsage, MetricSnapshot, AgentInsight, RunStats } from '@/types';
import { formatCompact, formatCurrency, formatMs } from '@/lib/design';
import { PageHeader } from '@/components/ui/PageHeader';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { LiveWaveform } from '@/components/ui/LiveIcon';
import { UsageDetailSheet } from '@/components/cost/UsageDetailSheet';

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

type TimeFilter = '24h' | '7d' | '30d' | 'all';
type ViewTab = 'spend' | 'models' | 'performance' | 'activity';

export function Metrics() {
  const [tokens, setTokens] = useState<TokenUsage[]>([]);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [runStats, setRunStats] = useState<RunStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Mobile filters & tabs
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const [activeTab, setActiveTab] = useState<ViewTab>('spend');
  const [selectedUsage, setSelectedUsage] = useState<TokenUsage | null>(null);

  const resolvedTheme = useUiStore((s) => s.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const hoursMap: Record<TimeFilter, number | undefined> = {
        '24h': 24,
        '7d': 168,
        '30d': 720,
        'all': undefined,
      };
      const hours = hoursMap[timeFilter];

      const [tokList, metList, tokSum, metSum, insList, rStats] = await Promise.all([
        api.tokens.usage({ hours }).catch(() => []),
        api.metrics.list({ limit: 1000 }).catch(() => []),
        api.tokens.summary().catch(() => null),
        api.metrics.summary().catch(() => null),
        api.orchestration.agentInsights().catch(() => []),
        api.orchestration.runStats().catch(() => null),
      ]);

      setTokens(Array.isArray(tokList) ? tokList : []);
      setMetrics(Array.isArray(metList) ? metList : []);
      setTokenSummary(tokSum);
      setMetricsSummary(metSum);
      setInsights(Array.isArray(insList) ? insList : []);
      setRunStats(rStats);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const socket = getSocket();
    const update = () => fetchData(false);
    socket.on('activity:new', update);
    socket.on('metrics:new', update);
    socket.on('token:usage', update);
    socket.on('process:run:created', update);
    socket.on('process:run:updated', update);
    socket.on('process:run', update);
    setSocketConnected(socket.connected);
    const onConn = () => setSocketConnected(true);
    const onDis = () => setSocketConnected(false);
    socket.on('connect', onConn);
    socket.on('disconnect', onDis);

    return () => {
      socket.off('activity:new', update);
      socket.off('metrics:new', update);
      socket.off('token:usage', update);
      socket.off('process:run:created', update);
      socket.off('process:run:updated', update);
      socket.off('process:run', update);
      socket.off('connect', onConn);
      socket.off('disconnect', onDis);
    };
  }, [fetchData]);

  // Aggregate KPIs
  const kpis = useMemo(() => {
    const totalTokens = tokens.reduce((a, t) => a + t.totalTokens, 0);
    const inputTokens = tokens.reduce((a, t) => a + t.inputTokens, 0);
    const outputTokens = tokens.reduce((a, t) => a + t.outputTokens, 0);
    const totalCost = tokens.reduce((a, t) => a + t.cost, 0);
    const calls = metrics.length;
    const avgResponseTime = calls > 0 ? metrics.reduce((a, m) => a + m.responseTimeMs, 0) / calls : 0;
    const metricSuccessCount = metrics.filter((m) => m.success).length;

    // Accurately reflect both agent API calls and run history execution outcomes
    const runTotal = runStats?.total ?? 0;
    const runCompleted = runStats?.completed ?? 0;
    const totalExecutions = calls + runTotal;
    const totalSuccesses = metricSuccessCount + runCompleted;

    let successRate = 0;
    if (totalExecutions > 0) {
      successRate = Math.round((totalSuccesses / totalExecutions) * 100);
    } else if (runStats && runStats.total > 0) {
      successRate = runStats.successRate;
    } else if (calls > 0) {
      successRate = Math.round((metricSuccessCount / calls) * 100);
    } else {
      successRate = 0;
    }

    return {
      totalTokens: totalTokens || tokenSummary?.totalTokens || (runStats?.totalTokens ?? 0),
      inputTokens,
      outputTokens,
      totalCost: totalCost || tokenSummary?.totalCost || (runStats?.totalCostUsd ?? 0),
      calls: totalExecutions,
      avgResponseTime,
      successRate,
    };
  }, [tokens, metrics, tokenSummary, runStats]);

  // Spending trend by time slices
  const chartData = useMemo(() => {
    if (timeFilter === '24h') {
      // Create 12 x 2h buckets, keyed by a unique date+hour string
      const ordered: Array<{ key: string; label: string; cost: number; tokens: number }> = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 2 * 3600 * 1000);
        // Round to 2h boundary (same formula used for matching below)
        const roundedHour = Math.floor(d.getHours() / 2) * 2;
        const dateStr = d.toISOString().slice(0, 10); // YYYY-MM-DD for uniqueness
        const key = `${dateStr}-${String(roundedHour).padStart(2, '0')}`;
        const label = `${String(roundedHour).padStart(2, '0')}:00`;
        ordered.push({ key, label, cost: 0, tokens: 0 });
      }
      const bucketMap: Record<string, typeof ordered[0]> = {};
      for (const b of ordered) bucketMap[b.key] = b;

      for (const t of tokens) {
        const d = new Date(t.createdAt);
        const roundedHour = Math.floor(d.getHours() / 2) * 2;
        const dateStr = d.toISOString().slice(0, 10);
        const key = `${dateStr}-${String(roundedHour).padStart(2, '0')}`;
        if (bucketMap[key]) {
          bucketMap[key].cost += t.cost ?? 0;
          bucketMap[key].tokens += t.totalTokens ?? 0;
        }
      }
      return ordered.map(({ label, cost, tokens: tk }) => ({ label, cost, tokens: tk }));
    }

    // 7d or 30d daily buckets
    const days = timeFilter === '7d' ? 7 : 14;
    const ordered: Array<{ key: string; label: string; cost: number; tokens: number }> = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 3600 * 1000);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'numeric', day: 'numeric' });
      ordered.push({ key, label, cost: 0, tokens: 0 });
    }
    const bucketMap: Record<string, typeof ordered[0]> = {};
    for (const b of ordered) bucketMap[b.key] = b;

    for (const t of tokens) {
      const d = new Date(t.createdAt);
      const key = d.toISOString().slice(0, 10);
      if (bucketMap[key]) {
        bucketMap[key].cost += t.cost ?? 0;
        bucketMap[key].tokens += t.totalTokens ?? 0;
      }
    }
    return ordered.map(({ label, cost, tokens: tk }) => ({ label, cost, tokens: tk }));
  }, [tokens, timeFilter]);

  const hasChartData = useMemo(() => chartData.some((d) => d.cost > 0 || d.tokens > 0), [chartData]);
  const hasSpendData = useMemo(() => chartData.some((d) => d.cost > 0), [chartData]);

  // Use token count as Y-axis when cost data is all-zero (cost not yet computed)
  const chartMode: 'cost' | 'tokens' = hasSpendData ? 'cost' : 'tokens';

  // Spend Area Chart Options
  const spendChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: {
      type: 'area',
      height: 220,
      toolbar: { show: false },
      zoom: { enabled: false },
      background: 'transparent',
      fontFamily: 'inherit',
      animations: { enabled: true, easing: 'easeinout', speed: 500 },
    },
    colors: [chartMode === 'cost' ? '#10b981' : '#6366f1'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: isDark ? 0.45 : 0.35,
        opacityTo: 0.02,
        stops: [0, 90, 100],
      },
    },
    grid: {
      borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
      strokeDashArray: 3,
      padding: { top: 0, right: 0, bottom: 0, left: 10 },
    },
    xaxis: {
      categories: chartData.map((d) => d.label),
      labels: {
        style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' },
        rotate: 0,
      },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        formatter: (v) => chartMode === 'cost' ? formatCurrency(v) : formatCompact(v),
        style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' },
      },
      min: 0,
    },
    tooltip: {
      theme: isDark ? 'dark' : 'light',
      y: { formatter: (v) => chartMode === 'cost' ? formatCurrency(v) : `${formatCompact(v)} tokens` },
    },
  }), [chartData, isDark, chartMode]);

  const spendChartSeries = useMemo(() => [
    {
      name: chartMode === 'cost' ? 'Estimated Cost' : 'Token Usage',
      data: chartMode === 'cost'
        ? chartData.map((d) => Number(d.cost.toFixed(4)))
        : chartData.map((d) => d.tokens),
    },
  ], [chartData, chartMode]);
  const modelBreakdown = useMemo(() => {
    const map = new Map<string, { model: string; tokens: number; cost: number; count: number }>();
    for (const t of tokens) {
      const modelName = t.model || 'nexus-engine';
      const existing = map.get(modelName) || { model: modelName, tokens: 0, cost: 0, count: 0 };
      existing.tokens += t.totalTokens;
      existing.cost += t.cost;
      existing.count += 1;
      map.set(modelName, existing);
    }
    const totalSpent = kpis.totalCost || 0.0001;
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentage: Math.min(100, Math.round((item.cost / totalSpent) * 100)),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokens, kpis.totalCost]);

  // Agent Cost Breakdown
  const agentCostBreakdown = useMemo(() => {
    if (!tokenSummary?.byAgent) return [];
    const totalSpent = tokenSummary.totalCost || 0.0001;
    return tokenSummary.byAgent
      .map((a) => ({
        id: a.agentId,
        name: a.displayName || a.agentName,
        cost: a.totalCost,
        tokens: a.totalTokens,
        percentage: Math.min(100, Math.round((a.totalCost / totalSpent) * 100)),
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokenSummary]);

  // Recent usage grouped by Day
  const groupedUsage = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    const groups: { title: string; items: TokenUsage[] }[] = [
      { title: 'Today', items: [] },
      { title: 'Yesterday', items: [] },
      { title: 'Earlier', items: [] },
    ];

    for (const t of tokens.slice(0, 30)) {
      const itemDate = new Date(t.createdAt).toDateString();
      if (itemDate === today) groups[0].items.push(t);
      else if (itemDate === yesterday) groups[1].items.push(t);
      else groups[2].items.push(t);
    }

    return groups.filter((g) => g.items.length > 0);
  }, [tokens]);

  // Latency & Success rate metrics
  const responseTimeByAgent = useMemo(() => {
    if (!metricsSummary?.byAgent) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName || a.agentName,
      avg: Math.round(a.avgResponseTime),
      p95: Math.round(a.p95ResponseTime),
      calls: a.totalCalls,
    }));
  }, [metricsSummary]);

  const toolUsage = useMemo(() => {
    const toolMap = new Map<string, number>();
    for (const m of metrics) {
      const tool = m.toolName || 'system-run';
      toolMap.set(tool, (toolMap.get(tool) || 0) + 1);
    }
    return Array.from(toolMap.entries())
      .map(([name, calls]) => ({ name, calls }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 8);
  }, [metrics]);




  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto pb-12">
        <PageHeader icon={Gauge} title="Cost & Usage" description="Loading telemetry..." />
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Loading real-time cost telemetry..." />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-3.5 max-w-5xl mx-auto pb-4">
      {/* Mobile Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
              <CircleDollarSign size={15} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-ink tracking-tight flex items-center gap-2">
                Cost & Usage
                <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
                  {socketConnected ? 'Live' : 'Offline'}
                </Badge>
              </h1>
              <p className="text-2xs text-ink-muted">AI token throughput, estimated spend, and model metrics</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {lastUpdated && (
            <span className="text-2xs font-mono text-ink-muted flex items-center gap-1 bg-inset px-2 py-0.5 rounded-lg border border-line-subtle">
              <Clock size={11} className="text-ink-faint" />
              {timeAgo(lastUpdated.toISOString())}
            </span>
          )}
          <Button
            variant="secondary"
            size="xs"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => fetchData(true)}
            aria-label="Refresh telemetry"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range Selector Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
        {(
          [
            { id: '24h', label: 'Today (24h)' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'all', label: 'All Time' },
          ] as const
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => setTimeFilter(chip.id)}
            className={cn(
              'shrink-0 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-2xs',
              timeFilter === chip.id
                ? 'bg-brand-600 text-white shadow-xs'
                : 'border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover'
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* 1. PRIMARY COST HERO CARD */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-3.5 sm:p-4 shadow-xs relative overflow-hidden group">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
              <Sparkles size={12} className="text-brand-500" />
              Total Estimated Spend
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-tight">
              {formatCurrency(kpis.totalCost)}
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-2xs font-bold border border-emerald-500/20 font-mono">
            <ArrowUpRight size={12} />
            Active Fleet
          </span>
        </div>

        <p className="text-2xs text-ink-muted">
          Estimated AI spend across all connected LLM providers & autonomous agents.
        </p>

        {/* Mini progress track */}
        <div className="mt-2.5 pt-2.5 border-t border-line-subtle flex flex-wrap items-center justify-between gap-2 text-2xs font-mono text-ink-muted">
          <span>{formatCompact(kpis.totalTokens)} total tokens</span>
          <span>{kpis.calls.toLocaleString()} LLM requests</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            avg {kpis.calls > 0 ? formatCurrency(kpis.totalCost / kpis.calls) : '$0.00'}/call
          </span>
        </div>
      </div>

      {/* 2. SECONDARY 2-COLUMN METRICS GRID */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
        <div className="p-2.5 sm:p-3 rounded-xl border border-line-subtle bg-surface shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-ink-muted text-2xs font-bold uppercase tracking-wider">
            <span>Tokens</span>
            <Hash size={12} className="text-brand-500" />
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-ink">
            {formatCompact(kpis.totalTokens)}
          </div>
          <span className="text-[10px] text-ink-faint font-mono block truncate">
            In: {formatCompact(kpis.inputTokens)} · Out: {formatCompact(kpis.outputTokens)}
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl border border-line-subtle bg-surface shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-ink-muted text-2xs font-bold uppercase tracking-wider">
            <span>Requests</span>
            <Activity size={12} className="text-purple-500" />
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-ink">
            {kpis.calls.toLocaleString()}
          </div>
          <span className="text-[10px] text-ink-faint font-mono block truncate">
            Total LLM tool calls
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl border border-line-subtle bg-surface shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-ink-muted text-2xs font-bold uppercase tracking-wider">
            <span>Avg Latency</span>
            <Timer size={12} className="text-amber-500" />
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-ink">
            {formatMs(kpis.avgResponseTime)}
          </div>
          <span className="text-[10px] text-ink-faint font-mono block truncate">
            Execution duration
          </span>
        </div>

        <div className="p-2.5 sm:p-3 rounded-xl border border-line-subtle bg-surface shadow-2xs space-y-0.5">
          <div className="flex items-center justify-between text-ink-muted text-2xs font-bold uppercase tracking-wider">
            <span>Success Rate</span>
            <TrendingUp size={12} className="text-cyan-500" />
          </div>
          <div className="text-base sm:text-lg font-bold font-mono text-ink">
            {kpis.successRate}%
          </div>
          <span className="text-[10px] text-ink-faint font-mono block truncate">
            {runStats && runStats.total > 0
              ? `${runStats.completed}/${runStats.total} runs completed`
              : 'Zero-anomaly execution'}
          </span>
        </div>
      </div>

      {/* 3. INTERACTIVE SPENDING TREND CHART */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-3 sm:p-3.5 shadow-2xs space-y-2">
        <div className="flex items-center justify-between border-b border-line-subtle pb-2">
          <div className="flex items-center gap-1.5">
            <div className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center',
              chartMode === 'cost'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
            )}>
              <BarChart3 size={13} />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              {chartMode === 'cost' ? 'Spending Trend' : 'Token Usage Trend'}
            </span>
          </div>
          <span className="text-2xs font-mono text-ink-muted">
            {chartMode === 'cost' ? 'Estimated cost over time' : 'Tokens processed over time'}
          </span>
        </div>

        <div className="w-full h-[180px]">
          {hasChartData ? (
            <Chart
              options={spendChartOptions}
              series={spendChartSeries}
              type="area"
              height={180}
              width="100%"
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-3 bg-inset/40 rounded-xl border border-dashed border-line-subtle">
              <BarChart3 size={20} className="text-ink-faint mb-1 opacity-40" />
              <p className="text-xs font-bold text-ink mb-0.5">No usage data yet</p>
              <p className="text-2xs text-ink-muted">
                Run agents or LLM calls to see token usage and cost trends here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section View Tabs: Models | Agents | Activity | Performance */}
      <div className="border-b border-line-subtle flex items-center gap-2 overflow-x-auto no-scrollbar pt-1 mb-2">
        {(
          [
            { id: 'models', label: 'By Model', count: modelBreakdown.length },
            { id: 'spend', label: 'By Agent', count: agentCostBreakdown.length },
            { id: 'activity', label: 'Recent Usage', count: tokens.length },
            { id: 'performance', label: 'Performance' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'pb-2 px-1 text-xs font-bold tracking-tight border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5',
              activeTab === tab.id
                ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                : 'border-transparent text-ink-muted hover:text-ink'
            )}
          >
            <span>{tab.label}</span>
            {'count' in tab && tab.count !== undefined && (
              <span className="px-1.5 py-0.2 rounded-md bg-inset text-[10px] font-mono text-ink-muted">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* TAB 1: BY MODEL BREAKDOWN */}
      {activeTab === 'models' && (
        <div>
          {modelBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line-subtle">
              No model usage records found for this period.
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto no-scrollbar space-y-2 p-0.5">
              {modelBreakdown.map((item) => (
                <div
                  key={item.model}
                  className="rounded-xl border border-line-subtle bg-surface p-2.5 sm:p-3 shadow-2xs hover:border-line transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                        <Layers size={14} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold font-mono text-ink truncate">{item.model}</h4>
                        <p className="text-[10px] text-ink-muted font-mono">{formatCompact(item.tokens)} tokens · {item.count} calls</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(item.cost)}
                      </span>
                      <span className="text-[10px] text-ink-muted font-mono block">
                        {item.percentage}% of total
                      </span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1 rounded-full bg-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${Math.max(item.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BY AGENT BREAKDOWN */}
      {activeTab === 'spend' && (
        <div>
          {agentCostBreakdown.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line-subtle">
              No agent spend recorded yet. Run a production chain to generate usage.
            </div>
          ) : (
            <div className="max-h-[380px] overflow-y-auto no-scrollbar space-y-2 p-0.5">
              {agentCostBreakdown.map((agent, i) => (
                <div
                  key={agent.id}
                  className="rounded-xl border border-line-subtle bg-surface p-2.5 sm:p-3 shadow-2xs hover:border-line transition-all space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-md bg-brand-500/10 text-brand-600 dark:text-brand-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                        #{i + 1}
                      </span>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-ink truncate">{agent.name}</h4>
                        <p className="text-[10px] text-ink-muted font-mono">{formatCompact(agent.tokens)} tokens</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(agent.cost)}
                      </span>
                      <span className="text-[10px] text-ink-muted font-mono block">
                        {agent.percentage}%
                      </span>
                    </div>
                  </div>

                  <div className="w-full h-1 rounded-full bg-inset overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500 transition-all duration-500"
                      style={{ width: `${Math.max(agent.percentage, 4)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RECENT USAGE ACTIVITY STREAM */}
      {activeTab === 'activity' && (
        <div>
          {groupedUsage.length === 0 ? (
            <div className="py-8 text-center text-xs text-ink-muted bg-surface rounded-xl border border-line-subtle">
              No recent usage entries found.
            </div>
          ) : (
            <div className="max-h-[340px] sm:max-h-[350px] overflow-y-auto no-scrollbar space-y-3 p-0.5">
              {groupedUsage.map((group) => (
                <div key={group.title} className="space-y-1">
                  <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted px-1 block sticky top-0 bg-canvas/80 backdrop-blur-xs py-0.5 z-10">
                    {group.title}
                  </span>

                  <div className="space-y-1">
                    {group.items.map((usage) => {
                      const agentName = usage.agent?.displayName || usage.agent?.name || 'Agent Execution';
                      return (
                        <button
                          key={usage.id}
                          type="button"
                          onClick={() => setSelectedUsage(usage)}
                          className="w-full rounded-xl border border-line-subtle bg-surface p-2.5 sm:p-3 shadow-2xs hover:border-line hover:bg-hover/40 transition-all flex items-center justify-between gap-2.5 text-left cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center shrink-0">
                              <Bot size={14} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-ink block truncate">{agentName}</span>
                              <div className="flex items-center gap-1.5 text-[10px] text-ink-muted font-mono mt-0.5">
                                <span className="px-1.5 py-0.2 rounded bg-inset border border-line-subtle">{usage.model}</span>
                                <span>•</span>
                                <span>{formatCompact(usage.totalTokens)} tok</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <div className="text-right">
                              <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 block">
                                {formatCurrency(usage.cost)}
                              </span>
                              <span className="text-[10px] text-ink-faint font-mono">
                                {timeAgo(usage.createdAt)}
                              </span>
                            </div>
                            <ChevronRight size={13} className="text-ink-muted" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PERFORMANCE & TOOL USAGE */}
      {activeTab === 'performance' && (
        <div className="space-y-3">
          {/* Latency Breakdown */}
          <div className="rounded-2xl border border-line-subtle bg-surface p-3.5 sm:p-4 shadow-2xs space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink block">
              Response Time & Tail Latency
            </span>
            <div className="space-y-1.5">
              {responseTimeByAgent.map((agent) => (
                <div key={agent.name} className="p-2.5 rounded-lg bg-inset/50 border border-line-subtle flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-ink truncate">{agent.name}</span>
                  <div className="text-2xs font-mono text-ink-muted flex items-center gap-2.5 shrink-0">
                    <span>Avg: <strong className="text-ink">{agent.avg}ms</strong></span>
                    <span>p95: <strong className="text-ink">{agent.p95}ms</strong></span>
                    <span className="text-brand-600 dark:text-brand-400 font-bold">{agent.calls} calls</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Tools */}
          <div className="rounded-2xl border border-line-subtle bg-surface p-3.5 sm:p-4 shadow-2xs space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-ink block">
              Top Tool Invocations
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {toolUsage.map((tool, i) => (
                <div key={tool.name} className="p-2 rounded-lg bg-inset/50 border border-line-subtle flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                      #{i + 1}
                    </span>
                    <span className="text-xs font-mono font-semibold text-ink truncate">{tool.name}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded-md bg-surface border border-line text-2xs font-mono font-bold text-ink shrink-0">
                    {tool.calls} calls
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Usage Detail Bottom Sheet */}
      <UsageDetailSheet
        usage={selectedUsage}
        onClose={() => setSelectedUsage(null)}
      />
    </div>
  );
}
