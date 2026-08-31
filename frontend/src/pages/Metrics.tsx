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
import { Bot, CircleDollarSign, Gauge, Hash, RefreshCw, Timer, TrendingUp, Wrench } from 'lucide-react';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { useUiStore } from '@/stores/ui-store';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { TokenUsage, MetricSnapshot, AgentInsight } from '@/types';
import { formatCompact, formatCurrency, formatMs } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState, Skeleton } from '@/components/ui/States';
import { TableWrap, Table, Th, Td, Tr } from '@/components/ui/Table';

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

/** Chart body with a consistent title, height and empty state. */
function ChartPanel({
  title,
  description,
  icon,
  empty,
  emptyLabel,
  children,
}: {
  title: string;
  description?: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  empty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className="min-w-0">
      <CardHeader bordered icon={icon as never} title={title} description={description} />
      <div className="p-3">
        {empty ? (
          <div style={{ height: CHART_H }} className="flex items-center justify-center">
            <EmptyState
              compact
              icon={icon as never}
              title="No data yet"
              description={emptyLabel ?? 'Data appears once agents report activity.'}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </Card>
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
  // Guards against overlapping refreshes when a burst of events arrives.
  const inFlight = useRef(false);

  /**
   * `silent` keeps the charts on screen during background refreshes — showing
   * the skeleton every 15s would make the page flicker.
   */
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

  // Poll while the tab is visible. Metrics are aggregates, so a 15s cadence is
  // plenty and avoids hammering the API in a background tab.
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

  // Anything that produces token usage or a metric snapshot should pull fresh
  // numbers immediately rather than waiting for the next poll.
  useEffect(() => {
    const s = getSocket();
    let queued: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      // Debounce: a chain starting can emit many events at once.
      if (queued) clearTimeout(queued);
      queued = setTimeout(() => fetchData(true), 800);
    };
    const events = [
      'activity:new', 'metrics:new', 'token:usage',
      'agent:status', 'agent:heartbeat', 'process:updated',
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
    const buckets: Array<{ hour: string; input: number; output: number }> = [];
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
      buckets.push({
        hour: hourLabel,
        input: inRange.reduce((sum, t) => sum + t.inputTokens, 0),
        output: inRange.reduce((sum, t) => sum + t.outputTokens, 0),
      });
    }
    return buckets;
  }, [tokenUsage]);

  const hasTokenSeries = hourlyTokenData.some((b) => b.input > 0 || b.output > 0);

  const costByAgent = useMemo(() => {
    if (!tokenSummary) return [];
    return tokenSummary.byAgent
      .map((a) => ({ name: a.displayName, cost: Math.round(a.totalCost * 10000) / 10000 }))
      .sort((a, b) => b.cost - a.cost);
  }, [tokenSummary]);

  const responseTimeByAgent = useMemo(() => {
    if (!metricsSummary) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName,
      avg: a.avgResponseTime,
      p95: a.p95ResponseTime,
    }));
  }, [metricsSummary]);

  const successRateByAgent = useMemo(() => {
    if (!metricsSummary) return [];
    return metricsSummary.byAgent.map((a) => ({
      name: a.displayName,
      rate: a.successRate,
    }));
  }, [metricsSummary]);

  /* Tool usage was a donut. A donut can't carry 8 slices legibly, so this is a
     ranked horizontal bar — same data, actually comparable. */
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
      <>
        <PageHeader
          icon={Gauge}
          title="Metrics & Cost"
          description="Token usage, latency, and spend across the fleet."
        />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Skeleton className="h-[340px] rounded-xl" />
          <Skeleton className="h-[340px] rounded-xl" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        icon={Gauge}
        title="Metrics & Cost"
        description="Token usage, latency, and spend across the fleet."
        badge={
          <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
            {socketConnected ? 'Live' : 'Offline'}
          </Badge>
        }
        actions={
          <>
            {lastUpdated && (
              <span className="text-xs tabular-nums text-ink-faint">
                Updated {timeAgo(lastUpdated)}
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
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Tokens"
          value={formatCompact(stats24h.totalTokens24h)}
          sublabel="Last 24 hours"
          icon={Hash}
          tone="brand"
          muted={stats24h.totalTokens24h === 0}
        />
        <StatCard
          label="Spend"
          value={formatCurrency(stats24h.totalCost24h)}
          sublabel="Last 24 hours"
          icon={CircleDollarSign}
          tone="success"
          muted={stats24h.totalCost24h === 0}
        />
        <StatCard
          label="Avg Response"
          value={formatMs(stats24h.avgResponseTime)}
          sublabel={`${formatCompact(stats24h.calls)} calls`}
          icon={Timer}
          tone="warning"
          muted={stats24h.avgResponseTime === 0}
        />
        <StatCard
          label="Success Rate"
          value={`${stats24h.successRate}%`}
          sublabel="Last 24 hours"
          icon={TrendingUp}
          tone={stats24h.successRate >= 95 ? 'success' : stats24h.successRate >= 80 ? 'warning' : 'danger'}
          muted={stats24h.calls === 0}
        />
      </div>

      {/* ---- Row 1 ---- */}
      <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartPanel
          icon={Hash}
          title="Token Usage"
          description="Input vs. output, hourly over 24h"
          empty={!hasTokenSeries}
          emptyLabel="No token usage recorded in the last 24 hours."
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <AreaChart data={hourlyTokenData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke={chart.axis.stroke} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="hour"
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={{ stroke: chart.axis.stroke }}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={formatCompact}
              />
              <Tooltip
                {...chart.tooltip}
                formatter={(value: number, name: string) => [
                  formatCompact(value),
                  name === 'input' ? 'Input' : 'Output',
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: '#a2acbd', paddingTop: 4 }}
                formatter={(v) => (v === 'input' ? 'Input tokens' : 'Output tokens')}
              />
              {/* 2px surface-coloured stroke keeps stacked bands from bleeding
                  into each other. */}
              <Area
                type="monotone"
                dataKey="input"
                stackId="1"
                stroke={chart.surface}
                strokeWidth={2}
                fill={chart.colors[0]}
                fillOpacity={0.85}
                name="input"
              />
              <Area
                type="monotone"
                dataKey="output"
                stackId="1"
                stroke={chart.surface}
                strokeWidth={2}
                fill={chart.colors[2]}
                fillOpacity={0.85}
                name="output"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          icon={CircleDollarSign}
          title="Cost by Agent"
          description="Total spend, highest first"
          empty={costByAgent.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={costByAgent}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid stroke={chart.axis.stroke} strokeDasharray="2 4" horizontal={false} />
              <XAxis
                type="number"
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={false}
                width={112}
              />
              <Tooltip
                {...chart.tooltip}
                formatter={(value: number) => [formatCurrency(value), 'Cost']}
              />
              {/* Single measure → one hue. Colour here would encode nothing. */}
              <Bar dataKey="cost" radius={[0, 4, 4, 0]} fill={chart.colors[0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* ---- Row 2 ---- */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartPanel
          icon={Timer}
          title="Response Time"
          description="Average vs. p95, per agent"
          empty={responseTimeByAgent.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={responseTimeByAgent}
              margin={{ top: 4, right: 8, bottom: 30, left: 0 }}
              barGap={2}
            >
              <CartesianGrid stroke={chart.axis.stroke} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ ...chart.axis.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: chart.axis.stroke }}
                angle={-25}
                textAnchor="end"
                height={44}
                interval={0}
              />
              <YAxis
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={(v) => `${v}ms`}
              />
              <Tooltip
                {...chart.tooltip}
                formatter={(value: number, name: string) => [
                  formatMs(value),
                  name === 'avg' ? 'Average' : 'p95',
                ]}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 12, color: '#a2acbd' }}
                formatter={(v) => (v === 'avg' ? 'Average' : 'p95')}
              />
              <Bar dataKey="avg" fill={chart.colors[0]} radius={[3, 3, 0, 0]} name="avg" maxBarSize={18} />
              <Bar dataKey="p95" fill={chart.colors[1]} radius={[3, 3, 0, 0]} name="p95" maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          icon={TrendingUp}
          title="Success Rate"
          description="Green ≥95%, amber ≥80%, red below"
          empty={successRateByAgent.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={successRateByAgent}
              margin={{ top: 4, right: 8, bottom: 30, left: 0 }}
              barCategoryGap="24%"
            >
              <CartesianGrid stroke={chart.axis.stroke} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ ...chart.axis.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: chart.axis.stroke }}
                angle={-25}
                textAnchor="end"
                height={44}
                interval={0}
              />
              <YAxis
                tick={chart.axis.tick}
                tickLine={false}
                axisLine={false}
                width={40}
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                {...chart.tooltip}
                formatter={(value: number) => [`${value}%`, 'Success rate']}
              />
              {/* Status encoding, not categorical — the threshold is stated in
                  the panel description so colour isn't the only cue. */}
              <Bar dataKey="rate" radius={[3, 3, 0, 0]} maxBarSize={30}>
                {successRateByAgent.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={entry.rate >= 95 ? chart.status.good : entry.rate >= 80 ? chart.status.warn : chart.status.bad}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel
          icon={Wrench}
          title="Tool Usage"
          description="Top 10 tools by call count"
          empty={toolUsage.length === 0}
        >
          <ResponsiveContainer width="100%" height={CHART_H}>
            <BarChart
              data={toolUsage}
              layout="vertical"
              margin={{ top: 4, right: 16, bottom: 0, left: 0 }}
              barCategoryGap="20%"
            >
              <CartesianGrid stroke={chart.axis.stroke} strokeDasharray="2 4" horizontal={false} />
              <XAxis type="number" tick={chart.axis.tick} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ ...chart.axis.tick, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={104}
              />
              <Tooltip
                {...chart.tooltip}
                formatter={(value: number) => [`${value} calls`, 'Usage']}
              />
              <Bar dataKey="calls" radius={[0, 4, 4, 0]} fill={chart.colors[2]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      {/* Which agents actually cost money and which are unreliable. Averages
          across charts hide this; a ranked table does not. */}
      {insights.length > 0 && (
        <div className="mt-4">
          <Card padding="none">
            <CardHeader
              bordered
              icon={Bot}
              title="Agent performance"
              description="Ranked by spend across every chain run"
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Agent</Th>
                    <Th align="right">Steps</Th>
                    <Th align="right">Success</Th>
                    <Th align="right">Avg time</Th>
                    <Th align="right">Tokens</Th>
                    <Th align="right">Spend</Th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((a) => (
                    <Tr key={a.agentId}>
                      <Td className="font-medium text-ink">{a.agentName}</Td>
                      <Td align="right">{a.runs}</Td>
                      <Td align="right">
                        <Badge
                          tone={
                            a.successRate >= 80
                              ? 'success'
                              : a.successRate >= 50
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {a.successRate}%
                        </Badge>
                      </Td>
                      <Td align="right">{formatMs(a.avgDurationMs)}</Td>
                      <Td align="right">{formatCompact(a.totalTokens)}</Td>
                      <Td align="right" className="font-medium text-ink">
                        {formatCurrency(a.totalCostUsd)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>
        </div>
      )}
    </>
  );
}
