import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { ProcessScope } from '../components/process/ProcessScope';
import { useProcessStore } from '../stores/process-store';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { HourglassLoader } from '../components/ui/HourglassLoader';
import { ScrollText, RefreshCw, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import type { Session } from '@/types';

// ─── Types ─────────────────────────────────────────────

interface TimelineAgent {
  id: string;
  name: string;
  displayName: string;
  avatar: string | null;
  status: string;
  processId?: string | null;
  processRole?: string | null;
  processStage?: number | null;
}

interface TimelineRow {
  agent: TimelineAgent;
  /** The row already carries the agent, so sessions don't repeat it. */
  sessions: Session[];
}

interface TimelineData {
  timeline: TimelineRow[];
  windowStart: string;
  windowEnd: string;
}

// ─── Constants ─────────────────────────────────────────

const SESSION_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  HEARTBEAT:  { fill: '#3b82f6', stroke: '#2563eb', label: 'Heartbeat' },
  TASK:       { fill: '#8b5cf6', stroke: '#7c3aed', label: 'Task' },
  REVIEW:     { fill: '#f59e0b', stroke: '#d97706', label: 'Review' },
  MONITORING: { fill: '#10b981', stroke: '#059669', label: 'Monitoring' },
  MESSAGE:    { fill: '#0ea5e9', stroke: '#0284c7', label: 'Message' },
  DELEGATION: { fill: '#f97316', stroke: '#ea580c', label: 'Delegation' },
};

const ROW_HEIGHT = 56;
const LABEL_WIDTH = 180;
const TOP_AXIS_HEIGHT = 36;
const BOTTOM_PADDING = 20;
const MIN_BAR_WIDTH = 4;

// ─── Helpers ───────────────────────────────────────────

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return 'Running...';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes < 60) return `${minutes}m ${secs}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function formatCost(cost: number | null): string {
  if (cost == null) return '--';
  return `$${cost.toFixed(4)}`;
}

// ─── Tooltip Component ─────────────────────────────────

interface TooltipData {
  x: number;
  y: number;
  session: Session & { agent: TimelineAgent };
}

function SessionTooltip({ data }: { data: TooltipData }) {
  const { session } = data;
  const color = SESSION_COLORS[session.type] ?? { fill: '#6b7280', label: session.type };
  const isFailed = session.status === 'FAILED';

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: data.x + 12, top: data.y - 10 }}
    >
      <div className="bg-surface-900 border border-white/10 rounded-lg shadow-2xl px-4 py-3 min-w-[240px] max-w-[340px]">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color.fill }} />
          <span className="text-sm font-semibold text-white">{color.label}</span>
          <span
            className={`ml-auto text-xs font-medium px-1.5 py-0.5 rounded ${
              isFailed
                ? 'bg-red-500/20 text-red-400'
                : session.status === 'RUNNING'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-white/10 text-gray-400'
            }`}
          >
            {session.status}
          </span>
        </div>

        {/* Summary */}
        {session.summary && (
          <p className="text-xs text-gray-400 mb-2 leading-relaxed">{session.summary}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-gray-500">Duration</div>
          <div className="text-gray-300 font-mono">{formatDuration(session.durationMs)}</div>
          <div className="text-gray-500">Tokens</div>
          <div className="text-gray-300 font-mono">{session.tokensUsed?.toLocaleString() ?? '--'}</div>
          <div className="text-gray-500">Cost</div>
          <div className="text-gray-300 font-mono">{formatCost(session.cost)}</div>
          <div className="text-gray-500">Started</div>
          <div className="text-gray-300 font-mono">{formatTime(new Date(session.startedAt))}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Legend Component ──────────────────────────────────

function TimelineLegend() {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {Object.entries(SESSION_COLORS).map(([type, color]) => (
        <div key={type} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color.fill }} />
          <span className="text-xs text-gray-500">{color.label}</span>
        </div>
      ))}
      <div className="flex items-center gap-1.5 ml-2">
        <div className="w-3 h-3 rounded-sm border-2 border-red-500 bg-transparent" />
        <span className="text-xs text-gray-500">Failed</span>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────

export function Timeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [now, setNow] = useState(Date.now());
  const [hours, setHours] = useState(4);
  const { scopeId, processes } = useProcessStore();
  const activeProcess = processes.find((p) => p.id === scopeId) ?? null;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch timeline data
  const fetchData = useCallback(async () => {
    try {
      const result = await api.sessions.timeline({
        processId: scopeId || undefined,
        hours,
      });
      setData(result);
      setError(null);
    } catch (e) {
      setError('Failed to load timeline data');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [scopeId, hours]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  // Update "now" every second for the red line
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Computed layout values
  const layout = useMemo(() => {
    if (!data) return null;
    const windowStart = new Date(data.windowStart).getTime();
    const windowEnd = new Date(data.windowEnd).getTime();
    const rowCount = data.timeline.length || 7;
    const chartHeight = TOP_AXIS_HEIGHT + rowCount * ROW_HEIGHT + BOTTOM_PADDING;

    return { windowStart, windowEnd, rowCount, chartHeight };
  }, [data]);

  // Convert timestamp to X position
  const timeToX = useCallback(
    (timestamp: number, chartWidth: number) => {
      if (!layout) return 0;
      const { windowStart, windowEnd } = layout;
      const pct = (timestamp - windowStart) / (windowEnd - windowStart);
      return LABEL_WIDTH + pct * (chartWidth - LABEL_WIDTH);
    },
    [layout]
  );

  // Generate 30-minute grid lines
  const gridLines = useMemo(() => {
    if (!layout) return [];
    const { windowStart, windowEnd } = layout;
    const lines: { time: number; label: string }[] = [];
    // Round up to the next 30-min mark
    const thirtyMin = 30 * 60 * 1000;
    let t = Math.ceil(windowStart / thirtyMin) * thirtyMin;
    while (t <= windowEnd) {
      lines.push({ time: t, label: formatTime(new Date(t)) });
      t += thirtyMin;
    }
    return lines;
  }, [layout]);

  // Container width
  const [chartWidth, setChartWidth] = useState(1200);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse handlers for tooltip
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, session: Session & { agent: TimelineAgent }) => {
      setTooltip({ x: e.clientX, y: e.clientY, session });
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (tooltip) {
        setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
      }
    },
    [tooltip]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader
        icon={ScrollText}
        title="Timeline"
        description="Session Gantt across agents."
        badge={activeProcess ? <Badge tone="brand">{activeProcess.name}</Badge> : undefined}
        actions={
          <>
            <ProcessScope align="right" />
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-line-subtle bg-inset p-0.5">
              {[4, 12, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  aria-pressed={hours === h}
                  className={
                    'flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors ' +
                    (hours === h
                      ? 'bg-raised text-ink shadow-e1'
                      : 'text-ink-subtle hover:text-ink-muted hover:wash')
                  }
                >
                  {h === 4 && <Clock size={12} strokeWidth={1.75} aria-hidden />}
                  {h}h
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={RefreshCw} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />
        <div className="flex flex-col items-center justify-center py-24">
          <HourglassLoader size={48} label="Loading session timeline..." />
        </div>
      </div>
    );
  }

  if (error || !data || !layout) {
    return (
      <div>
        <PageHeader
        icon={ScrollText}
        title="Timeline"
        description="Session Gantt across agents."
        badge={activeProcess ? <Badge tone="brand">{activeProcess.name}</Badge> : undefined}
        actions={
          <>
            <ProcessScope align="right" />
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-line-subtle bg-inset p-0.5">
              {[4, 12, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  aria-pressed={hours === h}
                  className={
                    'flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors ' +
                    (hours === h
                      ? 'bg-raised text-ink shadow-e1'
                      : 'text-ink-subtle hover:text-ink-muted hover:wash')
                  }
                >
                  {h === 4 && <Clock size={12} strokeWidth={1.75} aria-hidden />}
                  {h}h
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={RefreshCw} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />
        <div className="flex items-center justify-center h-96 text-red-400 text-sm">
          {error ?? 'No data available'}
        </div>
      </div>
    );
  }

  const { windowStart, windowEnd, chartHeight } = layout;
  const nowX = timeToX(now, chartWidth);

  return (
    <div>
      <PageHeader
        icon={ScrollText}
        title="Timeline"
        description="Session Gantt across agents."
        badge={activeProcess ? <Badge tone="brand">{activeProcess.name}</Badge> : undefined}
        actions={
          <>
            <ProcessScope align="right" />
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-line-subtle bg-inset p-0.5">
              {[4, 12, 24].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  aria-pressed={hours === h}
                  className={
                    'flex h-7 items-center gap-1 rounded-md px-2.5 text-sm font-medium transition-colors ' +
                    (hours === h
                      ? 'bg-raised text-ink shadow-e1'
                      : 'text-ink-subtle hover:text-ink-muted hover:wash')
                  }
                >
                  {h === 4 && <Clock size={12} strokeWidth={1.75} aria-hidden />}
                  {h}h
                </button>
              ))}
            </div>
            <Button variant="secondary" icon={RefreshCw} onClick={fetchData} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      {/* Legend + info */}
      <div className="flex items-center justify-between mb-4">
        <TimelineLegend />
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Last 4 hours</span>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-dot" />
            <span>Now</span>
          </div>
        </div>
      </div>

      {/* Timeline chart */}
      <div
        ref={containerRef}
        className="rounded-xl border border-white/5 bg-surface-850 overflow-x-auto"
      >
        <svg
          ref={svgRef}
          width={chartWidth}
          height={chartHeight}
          className="select-none"
        >
          {/* Background */}
          <rect width={chartWidth} height={chartHeight} fill="transparent" />

          {/* Time axis grid lines */}
          {gridLines.map((line) => {
            const x = timeToX(line.time, chartWidth);
            return (
              <g key={line.time}>
                <line
                  x1={x}
                  y1={TOP_AXIS_HEIGHT}
                  x2={x}
                  y2={chartHeight - BOTTOM_PADDING}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={1}
                />
                <text
                  x={x}
                  y={TOP_AXIS_HEIGHT - 10}
                  textAnchor="middle"
                  fill="#6b7280"
                  fontSize={11}
                  fontFamily="monospace"
                >
                  {line.label}
                </text>
              </g>
            );
          })}

          {/* Row backgrounds and labels */}
          {data.timeline.map((row, i) => {
            const y = TOP_AXIS_HEIGHT + i * ROW_HEIGHT;
            return (
              <g key={row.agent.id}>
                {/* Alternating row background */}
                {i % 2 === 0 && (
                  <rect
                    x={0}
                    y={y}
                    width={chartWidth}
                    height={ROW_HEIGHT}
                    fill="rgba(255,255,255,0.015)"
                  />
                )}
                {/* Row separator */}
                <line
                  x1={LABEL_WIDTH}
                  y1={y + ROW_HEIGHT}
                  x2={chartWidth}
                  y2={y + ROW_HEIGHT}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1}
                />
                {/* Agent label */}
                <text
                  x={12}
                  y={y + ROW_HEIGHT / 2 - 2}
                  dominantBaseline="middle"
                  fill="#9ca3af"
                  fontSize={20}
                >
                  {row.agent.avatar ?? ''}
                </text>
                <text
                  x={38}
                  y={y + ROW_HEIGHT / 2 - 2}
                  dominantBaseline="middle"
                  fill="#e5e7eb"
                  fontSize={12}
                  fontWeight={500}
                >
                  {row.agent.displayName}
                </text>
                {/* Session count badge */}
                {row.sessions.length > 0 && (
                  <text
                    x={LABEL_WIDTH - 16}
                    y={y + ROW_HEIGHT / 2 - 2}
                    dominantBaseline="middle"
                    textAnchor="end"
                    fill="#6b7280"
                    fontSize={10}
                    fontFamily="monospace"
                  >
                    {row.sessions.length}
                  </text>
                )}
              </g>
            );
          })}

          {/* Label column separator */}
          <line
            x1={LABEL_WIDTH}
            y1={0}
            x2={LABEL_WIDTH}
            y2={chartHeight}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />

          {/* Session bars */}
          {data.timeline.map((row, rowIndex) => {
            const y = TOP_AXIS_HEIGHT + rowIndex * ROW_HEIGHT;
            const barY = y + 12;
            const barHeight = ROW_HEIGHT - 24;

            return row.sessions.map((session) => {
              const startMs = new Date(session.startedAt).getTime();
              const endMs = session.endedAt
                ? new Date(session.endedAt).getTime()
                : Math.min(now, windowEnd);
              const x1 = timeToX(startMs, chartWidth);
              const x2 = timeToX(endMs, chartWidth);
              const barWidth = Math.max(x2 - x1, MIN_BAR_WIDTH);
              const color = SESSION_COLORS[session.type] ?? { fill: '#6b7280', stroke: '#4b5563' };
              const isFailed = session.status === 'FAILED';
              const isRunning = session.status === 'RUNNING';

              return (
                <g
                  key={session.id}
                  onMouseEnter={(e) => handleMouseEnter(e, session as Session & { agent: TimelineAgent })}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  className="cursor-pointer"
                >
                  {/* Session bar */}
                  <rect
                    x={x1}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={4}
                    fill={color.fill}
                    opacity={isRunning ? 0.9 : 0.7}
                    stroke={isFailed ? '#ef4444' : color.stroke}
                    strokeWidth={isFailed ? 2 : 0.5}
                  />

                  {/* Failed: red diagonal stripes */}
                  {isFailed && (
                    <g clipPath={`url(#clip-${session.id})`}>
                      <defs>
                        <clipPath id={`clip-${session.id}`}>
                          <rect x={x1} y={barY} width={barWidth} height={barHeight} rx={4} />
                        </clipPath>
                        <pattern
                          id={`stripe-${session.id}`}
                          width={8}
                          height={8}
                          patternUnits="userSpaceOnUse"
                          patternTransform="rotate(45)"
                        >
                          <line x1={0} y1={0} x2={0} y2={8} stroke="rgba(239,68,68,0.3)" strokeWidth={3} />
                        </pattern>
                      </defs>
                      <rect
                        x={x1}
                        y={barY}
                        width={barWidth}
                        height={barHeight}
                        rx={4}
                        fill={`url(#stripe-${session.id})`}
                      />
                    </g>
                  )}

                  {/* Running: pulse glow */}
                  {isRunning && (
                    <rect
                      x={x1}
                      y={barY}
                      width={barWidth}
                      height={barHeight}
                      rx={4}
                      fill="none"
                      stroke={color.fill}
                      strokeWidth={1.5}
                      opacity={0.6}
                    >
                      <animate
                        attributeName="opacity"
                        values="0.6;0.2;0.6"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    </rect>
                  )}

                  {/* Hover highlight (invisible, for hit area) */}
                  <rect
                    x={x1 - 1}
                    y={barY - 1}
                    width={barWidth + 2}
                    height={barHeight + 2}
                    rx={5}
                    fill="transparent"
                    stroke="transparent"
                  />
                </g>
              );
            });
          })}

          {/* Current time indicator (red line) */}
          {nowX >= LABEL_WIDTH && nowX <= chartWidth && (
            <g>
              <line
                x1={nowX}
                y1={TOP_AXIS_HEIGHT}
                x2={nowX}
                y2={chartHeight - BOTTOM_PADDING}
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="4 2"
              />
              {/* Triangle at top */}
              <polygon
                points={`${nowX - 5},${TOP_AXIS_HEIGHT} ${nowX + 5},${TOP_AXIS_HEIGHT} ${nowX},${TOP_AXIS_HEIGHT + 7}`}
                fill="#ef4444"
              />
              {/* "Now" label */}
              <text
                x={nowX}
                y={TOP_AXIS_HEIGHT - 14}
                textAnchor="middle"
                fill="#ef4444"
                fontSize={10}
                fontWeight={600}
                fontFamily="monospace"
              >
                NOW
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && <SessionTooltip data={tooltip} />}

      {/* Session summary stats */}
      {data.timeline.length > 0 && (
        <div className="mt-4 grid grid-cols-4 gap-3">
          <StatCard
            label="Total Sessions"
            value={data.timeline.reduce((sum, r) => sum + r.sessions.length, 0).toString()}
          />
          <StatCard
            label="Active Now"
            value={data.timeline
              .reduce((sum, r) => sum + r.sessions.filter((s) => s.status === 'RUNNING').length, 0)
              .toString()}
            accent="emerald"
          />
          <StatCard
            label="Failed"
            value={data.timeline
              .reduce((sum, r) => sum + r.sessions.filter((s) => s.status === 'FAILED').length, 0)
              .toString()}
            accent="red"
          />
          <StatCard
            label="Avg Duration"
            value={(() => {
              const durations = data.timeline
                .flatMap((r) => r.sessions)
                .filter((s) => s.durationMs != null)
                .map((s) => s.durationMs!);
              if (durations.length === 0) return '--';
              const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
              return formatDuration(avg);
            })()}
          />
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: 'emerald' | 'red';
}) {
  const accentClasses =
    accent === 'emerald'
      ? 'text-emerald-400'
      : accent === 'red'
        ? 'text-red-400'
        : 'text-white';

  return (
    <div className="rounded-lg border border-white/5 bg-surface-900 px-4 py-3">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold font-mono ${accentClasses}`}>{value}</div>
    </div>
  );
}
