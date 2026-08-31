import { useEffect, useState, useMemo, useCallback } from 'react';
import Chart from 'react-apexcharts';
import {
  Bot,
  CircleDollarSign,
  Gauge,
  Hash,
  RefreshCw,
  Timer,
  TrendingUp,
  Wrench,
  Clock,
} from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { TokenUsage, MetricSnapshot, AgentInsight } from '@/types';
import { formatCompact, formatCurrency, formatMs } from '@/lib/design';
import { PageHeader } from '@/components/ui/PageHeader';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { LiveWaveform } from '@/components/ui/LiveIcon';

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

/** Chart panel card container with consistent header and responsive body */
function ChartPanel({
  title,
  description,
  icon: Icon,
  children,
  empty,
  emptyLabel = 'No data recorded for this time range.',
  action,
}: {
  title: string;
  description?: string;
  icon: typeof Hash;
  children: React.ReactNode;
  empty?: boolean;
  emptyLabel?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-xs flex flex-col justify-between transition-all">
      <div className="flex items-center justify-between border-b border-line-subtle pb-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400 shrink-0">
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink truncate">{title}</h3>
            {description && (
              <p className="text-[11px] text-ink-muted truncate">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {empty ? (
          <div className="py-12 text-center text-xs text-ink-muted bg-inset/40 rounded-xl border border-dashed border-line">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function Metrics() {
  const [tokens, setTokens] = useState<TokenUsage[]>([]);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const resolvedTheme = useUiStore((s) => s.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [tokList, metList, tokSum, metSum, insList] = await Promise.all([
        api.tokens.usage({ hours: 24 }).catch(() => []),
        api.metrics.list({ limit: 1000 }).catch(() => []),
        api.tokens.summary().catch(() => null),
        api.metrics.summary().catch(() => null),
        api.orchestration.agentInsights().catch(() => []),
      ]);

      setTokens(Array.isArray(tokList) ? tokList : []);
      setMetrics(Array.isArray(metList) ? metList : []);
      setTokenSummary(tokSum);
      setMetricsSummary(metSum);
      setInsights(Array.isArray(insList) ? insList : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    const update = () => fetchData(false);
    socket.on('activity:new', update);
    socket.on('metrics:new', update);
    socket.on('token:usage', update);
    setSocketConnected(socket.connected);
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    return () => {
      socket.off('activity:new', update);
      socket.off('metrics:new', update);
      socket.off('token:usage', update);
    };
  }, [fetchData]);

  const stats24h = useMemo(() => {
    const totalTokens24h = tokenSummary?.totalTokens || tokens.reduce((a, t) => a + t.totalTokens, 0);
    const totalCost24h = tokenSummary?.totalCost || tokens.reduce((a, t) => a + t.cost, 0);
    const calls = metrics.length;
    const avgResponseTime = calls > 0 ? metrics.reduce((a, m) => a + m.responseTimeMs, 0) / calls : 0;
    const successCount = metrics.filter((m) => m.success).length;
    const successRate = calls > 0 ? Math.round((successCount / calls) * 100) : 100;
    return { totalTokens24h, totalCost24h, avgResponseTime, calls, successRate };
  }, [tokens, metrics, tokenSummary]);

  const hourlyTokenData = useMemo(() => {
    const buckets: Record<string, { hour: string; input: number; output: number; total: number }> = {};
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600 * 1000);
      const hourKey = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets[hourKey] = { hour: hourKey, input: 0, output: 0, total: 0 };
    }
    for (const t of tokens) {
      const d = new Date(t.createdAt);
      if (now.getTime() - d.getTime() <= 24 * 3600 * 1000) {
        const hourKey = `${String(d.getHours()).padStart(2, '0')}:00`;
        if (buckets[hourKey]) {
          buckets[hourKey].input += t.inputTokens;
          buckets[hourKey].output += t.outputTokens;
          buckets[hourKey].total += t.totalTokens;
        }
      }
    }
    return Object.values(buckets);
  }, [tokens]);

  const hasTokenSeries = useMemo(() => hourlyTokenData.some((d) => d.input > 0 || d.output > 0), [hourlyTokenData]);

  const costByAgent = useMemo(() => {
    if (!tokenSummary?.byAgent) return [];
    return tokenSummary.byAgent
      .map((a) => ({ name: a.displayName || a.agentName, cost: a.totalCost, tokens: a.totalTokens }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokenSummary]);

  const responseTimeByAgent = useMemo(() => {
    if (!metricsSummary?.byAgent) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName || a.agentName,
      avg: Math.round(a.avgResponseTime),
      p95: Math.round(a.p95ResponseTime),
      calls: a.totalCalls,
    }));
  }, [metricsSummary]);

  const successRateByAgent = useMemo(() => {
    if (!metricsSummary?.byAgent) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName || a.agentName,
      rate: Math.round(a.successRate),
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
      .slice(0, 10);
  }, [metrics]);

  const tokenAreaChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'area', height: CHART_H, toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent', fontFamily: 'inherit' },
    colors: ['#3b82f6', '#10b981'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: isDark ? 0.45 : 0.35, opacityTo: 0.02, stops: [0, 90, 100] } },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: hourlyTokenData.map((d) => d.hour), labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { formatter: (v) => formatCompact(v), style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => `${formatCompact(v)} tokens` } },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: isDark ? '#a1a1aa' : '#64748b' } },
  }), [hourlyTokenData, isDark]);

  const tokenAreaSeries = useMemo(() => [
    { name: 'Input', data: hourlyTokenData.map((d) => d.input) },
    { name: 'Output', data: hourlyTokenData.map((d) => d.output) },
  ], [hourlyTokenData]);

  const latencyChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: CHART_H, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
    plotOptions: { bar: { columnWidth: '40%', borderRadius: 4 } },
    colors: ['#3b82f6', '#f97316'],
    dataLabels: { enabled: false },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: responseTimeByAgent.map((d) => d.name), labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' }, trim: true } },
    yaxis: { labels: { formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`), style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => formatMs(v) } },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: isDark ? '#a1a1aa' : '#64748b' } },
  }), [responseTimeByAgent, isDark]);

  const latencySeries = useMemo(() => [
    { name: 'Average', data: responseTimeByAgent.map((d) => d.avg) },
    { name: 'p95', data: responseTimeByAgent.map((d) => d.p95) },
  ], [responseTimeByAgent]);

  const successRateChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: CHART_H, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
    plotOptions: { bar: { horizontal: true, barHeight: '38%', borderRadius: 6 } },
    colors: ['#10b981'],
    dataLabels: { enabled: true, formatter: (val) => `${val}%`, style: { colors: [isDark ? '#e4e4e7' : '#18181b'] } },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: successRateByAgent.map((d) => d.name), max: 100, labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: isDark ? '#a1a1aa' : '#475569', fontSize: '11px', fontWeight: 600 } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => `${v}% Success` } },
  }), [successRateByAgent, isDark]);

  const successRateSeries = useMemo(() => [{ name: 'Success Rate', data: successRateByAgent.map((d) => d.rate) }], [successRateByAgent]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Gauge} title="Metrics & Cost" description="Loading telemetry..." />
        <div className="flex flex-col items-center justify-center py-24">
          <HourglassLoader size={52} />
      <div className="flex-1 flex flex-col justify-center">
        {empty ? (
          <div className="py-12 text-center text-xs text-ink-muted bg-inset/40 rounded-xl border border-dashed border-line">
            {emptyLabel}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

export function Metrics() {
  const [tokens, setTokens] = useState<TokenUsage[]>([]);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [metricsSummary, setMetricsSummary] = useState<MetricsSummary | null>(null);
  const [insights, setInsights] = useState<AgentInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const resolvedTheme = useUiStore((s) => s.resolvedTheme);
  const isDark = resolvedTheme === 'dark';

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [tokList, metList, tokSum, metSum, insList] = await Promise.all([
        api.tokens.usage({ hours: 24 }).catch(() => []),
        api.metrics.list({ limit: 1000 }).catch(() => []),
        api.tokens.summary().catch(() => null),
        api.metrics.summary().catch(() => null),
        api.orchestration.agentInsights().catch(() => []),
      ]);

      setTokens(Array.isArray(tokList) ? tokList : []);
      setMetrics(Array.isArray(metList) ? metList : []);
      setTokenSummary(tokSum);
      setMetricsSummary(metSum);
      setInsights(Array.isArray(insList) ? insList : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const socket = getSocket();
    const update = () => fetchData(false);
    socket.on('activity:new', update);
    socket.on('metrics:new', update);
    socket.on('token:usage', update);
    setSocketConnected(socket.connected);
    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));
    return () => {
      socket.off('activity:new', update);
      socket.off('metrics:new', update);
      socket.off('token:usage', update);
    };
  }, [fetchData]);

  const stats24h = useMemo(() => {
    const totalTokens24h = tokenSummary?.totalTokens || tokens.reduce((a, t) => a + t.totalTokens, 0);
    const totalCost24h = tokenSummary?.totalCost || tokens.reduce((a, t) => a + t.cost, 0);
    const calls = metrics.length;
    const avgResponseTime = calls > 0 ? metrics.reduce((a, m) => a + m.responseTimeMs, 0) / calls : 0;
    const successCount = metrics.filter((m) => m.success).length;
    const successRate = calls > 0 ? Math.round((successCount / calls) * 100) : 100;
    return { totalTokens24h, totalCost24h, avgResponseTime, calls, successRate };
  }, [tokens, metrics, tokenSummary]);

  const hourlyTokenData = useMemo(() => {
    const buckets: Record<string, { hour: string; input: number; output: number; total: number }> = {};
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 3600 * 1000);
      const hourKey = `${String(d.getHours()).padStart(2, '0')}:00`;
      buckets[hourKey] = { hour: hourKey, input: 0, output: 0, total: 0 };
    }
    for (const t of tokens) {
      const d = new Date(t.createdAt);
      if (now.getTime() - d.getTime() <= 24 * 3600 * 1000) {
        const hourKey = `${String(d.getHours()).padStart(2, '0')}:00`;
        if (buckets[hourKey]) {
          buckets[hourKey].input += t.inputTokens;
          buckets[hourKey].output += t.outputTokens;
          buckets[hourKey].total += t.totalTokens;
        }
      }
    }
    return Object.values(buckets);
  }, [tokens]);

  const hasTokenSeries = useMemo(() => hourlyTokenData.some((d) => d.input > 0 || d.output > 0), [hourlyTokenData]);

  const costByAgent = useMemo(() => {
    if (!tokenSummary?.byAgent) return [];
    return tokenSummary.byAgent
      .map((a) => ({ name: a.displayName || a.agentName, cost: a.totalCost, tokens: a.totalTokens }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokenSummary]);

  const responseTimeByAgent = useMemo(() => {
    if (!metricsSummary?.byAgent) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName || a.agentName,
      avg: Math.round(a.avgResponseTime),
      p95: Math.round(a.p95ResponseTime),
      calls: a.totalCalls,
    }));
  }, [metricsSummary]);

  const successRateByAgent = useMemo(() => {
    if (!metricsSummary?.byAgent) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName || a.agentName,
      rate: Math.round(a.successRate),
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
      .slice(0, 10);
  }, [metrics]);

  const tokenAreaChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'area', height: CHART_H, toolbar: { show: false }, zoom: { enabled: false }, background: 'transparent', fontFamily: 'inherit' },
    colors: ['#3b82f6', '#10b981'],
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 2.5 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: isDark ? 0.45 : 0.35, opacityTo: 0.02, stops: [0, 90, 100] } },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: hourlyTokenData.map((d) => d.hour), labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { formatter: (v) => formatCompact(v), style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => `${formatCompact(v)} tokens` } },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: isDark ? '#a1a1aa' : '#64748b' } },
  }), [hourlyTokenData, isDark]);

  const tokenAreaSeries = useMemo(() => [
    { name: 'Input', data: hourlyTokenData.map((d) => d.input) },
    { name: 'Output', data: hourlyTokenData.map((d) => d.output) },
  ], [hourlyTokenData]);

  const latencyChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: CHART_H, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
    plotOptions: { bar: { columnWidth: '40%', borderRadius: 4 } },
    colors: ['#3b82f6', '#f97316'],
    dataLabels: { enabled: false },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: responseTimeByAgent.map((d) => d.name), labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' }, trim: true } },
    yaxis: { labels: { formatter: (v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`), style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => formatMs(v) } },
    legend: { position: 'top', horizontalAlign: 'right', fontSize: '11px', labels: { colors: isDark ? '#a1a1aa' : '#64748b' } },
  }), [responseTimeByAgent, isDark]);

  const latencySeries = useMemo(() => [
    { name: 'Average', data: responseTimeByAgent.map((d) => d.avg) },
    { name: 'p95', data: responseTimeByAgent.map((d) => d.p95) },
  ], [responseTimeByAgent]);

  const successRateChartOptions: ApexCharts.ApexOptions = useMemo(() => ({
    chart: { type: 'bar', height: CHART_H, toolbar: { show: false }, background: 'transparent', fontFamily: 'inherit' },
    plotOptions: { bar: { horizontal: true, barHeight: '38%', borderRadius: 6 } },
    colors: ['#10b981'],
    dataLabels: { enabled: true, formatter: (val) => `${val}%`, style: { colors: [isDark ? '#e4e4e7' : '#18181b'] } },
    grid: { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)', strokeDashArray: 3 },
    xaxis: { categories: successRateByAgent.map((d) => d.name), max: 100, labels: { style: { colors: isDark ? '#71717a' : '#94a3b8', fontSize: '10px' } } },
    yaxis: { labels: { style: { colors: isDark ? '#a1a1aa' : '#475569', fontSize: '11px', fontWeight: 600 } } },
    tooltip: { theme: isDark ? 'dark' : 'light', y: { formatter: (v) => `${v}% Success` } },
  }), [successRateByAgent, isDark]);

  const successRateSeries = useMemo(() => [{ name: 'Success Rate', data: successRateByAgent.map((d) => d.rate) }], [successRateByAgent]);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Gauge} title="Metrics & Cost" description="Loading telemetry..." />
        <div className="flex flex-col items-center justify-center py-24">
          <HourglassLoader size={52} />
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
        badge={<Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>{socketConnected ? 'Live Feed' : 'Offline'}</Badge>}
        actions={
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-2xs font-semibold tabular-nums text-ink-muted flex items-center gap-1 bg-inset px-2.5 py-1 rounded-xl border border-line-subtle">
                <Clock size={11} /> {timeAgo(lastUpdated.toISOString())}
              </span>
            )}
            <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={() => fetchData(true)}>Refresh</Button>
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

      {/* Row 1: Token Usage ApexChart & Cost by Agent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartPanel
          icon={Hash}
          title="Token Usage Over Time"
          description="Input vs. Output tokens hourly breakdown (24h)"
          empty={!hasTokenSeries}
          emptyLabel="No token activity recorded in the past 24 hours."
        >
          <div className="w-full h-[260px]">
            <Chart
              options={tokenAreaChartOptions}
              series={tokenAreaSeries}
              type="area"
              height={CHART_H}
              width="100%"
            />
          </div>
        </ChartPanel>

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
        <ChartPanel
          icon={Timer}
          title="Response Time (Latency)"
          description="Average vs. p95 tail latency per agent"
          empty={responseTimeByAgent.length === 0}
        >
          <div className="w-full h-[260px]">
            <Chart
              options={latencyChartOptions}
              series={latencySeries}
              type="bar"
              height={CHART_H}
              width="100%"
            />
          </div>
        </ChartPanel>

        <ChartPanel
          icon={TrendingUp}
          title="Reliability & Success Rate"
          description="Zero-error task execution benchmark"
          empty={successRateByAgent.length === 0}
        >
          <div className="w-full h-[260px]">
            <Chart
              options={successRateChartOptions}
              series={successRateSeries}
              type="bar"
              height={CHART_H}
              width="100%"
            />
          </div>
        </ChartPanel>

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

          <div className="hidden sm:block overflow-x-auto no-scrollbar">
            <table className="w-full text-left text-xs border-collapse">
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

          <div className="sm:hidden space-y-3">
            {insights.map((agent) => (
              <div key={agent.agentId} className="p-3.5 rounded-xl bg-inset/60 border border-line-subtle space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-surface border border-line flex items-center justify-center text-xs shrink-0">
                      🤖
                    </div>
                    <span className="font-bold text-ink text-xs truncate">{agent.agentName}</span>
                  </div>
                  <span className={cn(
                    'inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0',
                    agent.successRate >= 90
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25'
                  )}>
                    {agent.successRate}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-line-subtle text-[11px]">
                  <div>
                    <span className="text-ink-muted block text-[10px]">Spend</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(agent.totalCostUsd)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block text-[10px]">Tokens</span>
                    <span className="font-mono text-ink">{formatCompact(agent.totalTokens)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block text-[10px]">Avg Latency</span>
                    <span className="font-mono text-ink">{formatMs(agent.avgDurationMs)}</span>
                  </div>
                  <div>
                    <span className="text-ink-muted block text-[10px]">Steps/Runs</span>
                    <span className="font-mono text-ink">{agent.runs}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
