import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import type { AgentStatus, ActivityType, Priority } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function timeAgo(date: string | null): string {
  if (!date) return 'Never';
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

/* Colour maps are derived from the shared tone system in `design.tsx` so a
   change to a tone propagates everywhere instead of drifting per screen. */
import { tones, agentStatusTone, activityTone, priorityTone } from './design';

const mapTone = <K extends string>(
  source: Record<K, keyof typeof tones>,
  pick: (t: (typeof tones)[keyof typeof tones]) => string,
) =>
  Object.fromEntries(
    Object.entries(source).map(([k, tone]) => [k, pick(tones[tone as keyof typeof tones])]),
  ) as Record<K, string>;

export const statusColors = mapTone<AgentStatus>(agentStatusTone, (t) => t.solid);
export const statusTextColors = mapTone<AgentStatus>(agentStatusTone, (t) => t.text);
export const activityTypeColors = mapTone<ActivityType>(activityTone, (t) => t.text);
export const activityTypeBgColors = mapTone<ActivityType>(
  activityTone,
  (t) => `${t.soft} border`,
);
export const priorityColors = mapTone<Priority>(
  priorityTone,
  (t) => `${t.text} ${t.soft}`,
);
