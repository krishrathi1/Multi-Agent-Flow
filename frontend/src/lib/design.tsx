import {
  Activity as ActivityIcon,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CircleDot,
  Cog,
  HeartPulse,
  MessageSquare,
  Play,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { AgentStatus, ActivityType, Priority } from '../types';

/* ============================================================================
   Semantic tone system.

   Every status, priority and activity type resolves to one of these tones, and
   a tone carries a full set of matched classes. Components ask for a tone —
   they never hand-pick a colour. That is what keeps 30 screens consistent.
   ========================================================================= */

export type Tone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'accent';

export interface ToneClasses {
  /** Solid fill for dots and bars. */
  solid: string;
  /** Foreground text/icon colour. */
  text: string;
  /** Tinted surface + hairline, for badges and soft chips. */
  soft: string;
  /** Border only. */
  border: string;
  /** Glow ring for live/emphasis states. */
  ring: string;
}

/* Light values first, `dark:` overrides second. Dark mode wants a light text
   step on a tinted fill; light mode needs a *darker* step of the same hue to
   clear 4.5:1 on white. A straight inversion fails that, so both are stated. */
export const tones: Record<Tone, ToneClasses> = {
  neutral: {
    solid: 'bg-ink-faint',
    text: 'text-ink-muted',
    soft: 'wash border-line',
    border: 'border-line',
    ring: 'ring-line',
  },
  brand: {
    solid: 'bg-brand-500',
    text: 'text-brand-700 dark:text-brand-300',
    soft: 'bg-brand-500/10 border-brand-600/25 dark:border-brand-500/25',
    border: 'border-brand-600/30 dark:border-brand-500/30',
    ring: 'ring-brand-500/30',
  },
  success: {
    solid: 'bg-emerald-500 dark:bg-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    soft: 'bg-emerald-500/10 border-emerald-600/25 dark:border-emerald-500/25',
    border: 'border-emerald-600/30 dark:border-emerald-500/30',
    ring: 'ring-emerald-500/30',
  },
  warning: {
    solid: 'bg-amber-500 dark:bg-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    soft: 'bg-amber-500/10 border-amber-600/25 dark:border-amber-500/25',
    border: 'border-amber-600/30 dark:border-amber-500/30',
    ring: 'ring-amber-500/30',
  },
  danger: {
    solid: 'bg-red-500 dark:bg-red-400',
    text: 'text-red-700 dark:text-red-300',
    soft: 'bg-red-500/10 border-red-600/25 dark:border-red-500/25',
    border: 'border-red-600/30 dark:border-red-500/30',
    ring: 'ring-red-500/30',
  },
  info: {
    solid: 'bg-sky-500 dark:bg-sky-400',
    text: 'text-sky-700 dark:text-sky-300',
    soft: 'bg-sky-500/10 border-sky-600/25 dark:border-sky-500/25',
    border: 'border-sky-600/30 dark:border-sky-500/30',
    ring: 'ring-sky-500/30',
  },
  accent: {
    solid: 'bg-violet-500 dark:bg-violet-400',
    text: 'text-violet-700 dark:text-violet-300',
    soft: 'bg-violet-500/10 border-violet-600/25 dark:border-violet-500/25',
    border: 'border-violet-600/30 dark:border-violet-500/30',
    ring: 'ring-violet-500/30',
  },
};

/* ---- Agent status ------------------------------------------------------- */

export const agentStatusTone: Record<AgentStatus, Tone> = {
  ONLINE: 'success',
  IDLE: 'warning',
  OFFLINE: 'neutral',
  ERROR: 'danger',
};

export const agentStatusLabel: Record<AgentStatus, string> = {
  ONLINE: 'Online',
  IDLE: 'Idle',
  OFFLINE: 'Offline',
  ERROR: 'Error',
};

/* ---- Activity types ----------------------------------------------------- */

export const activityTone: Record<ActivityType, Tone> = {
  HEARTBEAT: 'info',
  TASK_START: 'accent',
  TASK_COMPLETE: 'success',
  ERROR: 'danger',
  MESSAGE: 'brand',
  DELEGATION: 'warning',
  ALERT: 'warning',
  SYSTEM: 'neutral',
};

/** Real vector icons — never emoji. Consistent 1.75 stroke via <Icon/>. */
export const activityIcon: Record<ActivityType, LucideIcon> = {
  HEARTBEAT: HeartPulse,
  TASK_START: Play,
  TASK_COMPLETE: CheckCircle2,
  ERROR: XCircle,
  MESSAGE: MessageSquare,
  DELEGATION: ArrowRightLeft,
  ALERT: AlertTriangle,
  SYSTEM: Cog,
};

export const activityLabel: Record<ActivityType, string> = {
  HEARTBEAT: 'Heartbeat',
  TASK_START: 'Task started',
  TASK_COMPLETE: 'Task complete',
  ERROR: 'Error',
  MESSAGE: 'Message',
  DELEGATION: 'Delegation',
  ALERT: 'Alert',
  SYSTEM: 'System',
};

export function activityIconFor(type: ActivityType): LucideIcon {
  return activityIcon[type] ?? ActivityIcon;
}

export function activityToneFor(type: ActivityType): Tone {
  return activityTone[type] ?? 'neutral';
}

/* ---- Priority ----------------------------------------------------------- */

export const priorityTone: Record<Priority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

export const priorityLabel: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

/* ---- Task status -------------------------------------------------------- */

export const taskStatusTone: Record<string, Tone> = {
  BACKLOG: 'neutral',
  ASSIGNED: 'info',
  IN_PROGRESS: 'accent',
  REVIEW: 'warning',
  DONE: 'success',
};

export const taskStatusLabel: Record<string, string> = {
  BACKLOG: 'Backlog',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  REVIEW: 'Review',
  DONE: 'Done',
};

/* ---- Approval + gateway status ------------------------------------------ */

export const approvalTone: Record<string, Tone> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  EXPIRED: 'neutral',
};

export const gatewayTone: Record<string, Tone> = {
  CONNECTED: 'success',
  DISCONNECTED: 'neutral',
  ERROR: 'danger',
  CONNECTING: 'info',
};

export const severityTone: Record<string, Tone> = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'danger',
  CRITICAL: 'danger',
};

/* ---- Chart palette ------------------------------------------------------
   Categorical hues in FIXED order — assign slot 1, 2, 3… never cycle, never
   reorder by rank, so an entity keeps its colour when a filter changes the
   series count.

   Validated for the dark chart surface (#11151c) with the dataviz palette
   checker: lightness band, chroma floor, adjacent-pair CVD separation
   (worst ΔE 8.4 protan), normal-vision floor (19.3) and >=3:1 contrast all
   pass. Do not hand-edit these hexes — re-run the validator if they change.

   NOTE: the full eight only clear the gates on the *adjacent* pairlist
   (stacks, bars, lines). Forms that compare every pair at once — scatter,
   bubble, small multiples — must cap at `chartColorsAllPairs`.
   ---------------------------------------------------------------------- */
const chartColorsDark = [
  '#3987e5', // 1 blue
  '#d95926', // 2 orange
  '#199e70', // 3 aqua
  '#c98500', // 4 yellow
  '#d55181', // 5 magenta
  '#008300', // 6 green
  '#9085e9', // 7 violet
  '#e66767', // 8 red
];

/* Same eight hues, re-stepped for the light surface — not an inversion.
   Validated on #ffffff: bands, chroma, CVD (worst adjacent ΔE 9.1) and
   normal-vision (19.6) all pass. Three slots sit under 3:1 contrast, so the
   relief rule applies — every chart here ships legends and axis labels. */
const chartColorsLight = [
  '#2a78d6', // 1 blue
  '#eb6834', // 2 orange
  '#1baf7a', // 3 aqua
  '#eda100', // 4 yellow
  '#e87ba4', // 5 magenta
  '#008300', // 6 green
  '#4a3aa7', // 7 violet
  '#e34948', // 8 red
];

/** Default export kept for non-reactive callers; prefer `useChartTheme()`. */
export const chartColors = chartColorsDark;

export type ChartTheme = {
  colors: string[];
  /** Safe when every pair is on screen at once (scatter, small multiples). */
  colorsAllPairs: string[];
  surface: string;
  axis: { stroke: string; tick: { fill: string; fontSize: number } };
  tooltip: Record<string, unknown>;
  status: { good: string; warn: string; bad: string };
};

export function getChartTheme(mode: 'light' | 'dark'): ChartTheme {
  const dark = mode === 'dark';
  const colors = dark ? chartColorsDark : chartColorsLight;
  const surface = dark ? '#11151c' : '#ffffff';

  return {
    colors,
    colorsAllPairs: colors.slice(0, 3),
    surface,
    axis: {
      stroke: dark ? '#232b37' : '#d9dee7',
      tick: { fill: dark ? '#7d8798' : '#6b7488', fontSize: 11 },
    },
    tooltip: {
      contentStyle: {
        background: dark ? '#1c222d' : '#ffffff',
        border: `1px solid ${dark ? '#333c4b' : '#d9dee7'}`,
        borderRadius: 8,
        fontSize: 12,
        boxShadow: dark
          ? '0 8px 24px -6px rgb(0 0 0 / 0.55)'
          : '0 8px 24px -6px rgb(16 24 40 / 0.12)',
        color: dark ? '#e8ecf3' : '#101623',
      },
      labelStyle: {
        color: dark ? '#a2acbd' : '#59637a',
        marginBottom: 4,
        fontSize: 11,
      },
      itemStyle: { color: dark ? '#e8ecf3' : '#101623' },
      cursor: { fill: dark ? 'rgba(255,255,255,0.04)' : 'rgba(16,24,40,0.04)' },
    },
    /* Reserved status ramp — never reused as a categorical series colour. */
    status: dark
      ? { good: '#199e70', warn: '#c98500', bad: '#e66767' }
      : { good: '#1baf7a', warn: '#eda100', bad: '#e34948' },
  };
}

/** Static fallbacks for modules that can't use the hook. */
export const chartAxis = getChartTheme('dark').axis;
export const chartTooltipStyle = getChartTheme('dark').tooltip;

/** Format an integer with locale separators; keeps columns aligned. */
export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return n.toLocaleString('en-US');
}

/** Compact form for large counters (12.4k). */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 1000) return String(n);
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);
}

export function formatCurrency(n: number | null | undefined, digits = 4): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return `$${n.toFixed(digits)}`;
}

export function formatMs(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}s`;
  return `${Math.round(n)}ms`;
}
