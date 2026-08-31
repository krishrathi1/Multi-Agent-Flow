import { Brain, Cpu, Sparkles } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Live Animated Audio / Activity Equalizer Bar Waveform
 */
export function LiveWaveform({
  className,
  color = 'bg-emerald-500',
}: {
  className?: string;
  color?: string;
}) {
  return (
    <span className={cn('inline-flex items-end gap-0.5 h-3.5 w-3.5 shrink-0', className)} aria-hidden>
      <span className={cn('w-0.75 rounded-full wave-bar-1', color)} />
      <span className={cn('w-0.75 rounded-full wave-bar-2', color)} />
      <span className={cn('w-0.75 rounded-full wave-bar-3', color)} />
      <span className={cn('w-0.75 rounded-full wave-bar-4', color)} />
    </span>
  );
}

/**
 * Live Radar Beacon with pulsating concentric signal rings
 */
export function LiveRadarBeacon({
  size = 8,
  tone = 'emerald',
  className,
}: {
  size?: number;
  tone?: 'emerald' | 'brand' | 'amber' | 'rose' | 'violet';
  className?: string;
}) {
  const toneColors = {
    emerald: { dot: 'bg-emerald-500', ring: 'bg-emerald-400' },
    brand: { dot: 'bg-brand-500', ring: 'bg-brand-400' },
    amber: { dot: 'bg-amber-500', ring: 'bg-amber-400' },
    rose: { dot: 'bg-rose-500', ring: 'bg-rose-400' },
    violet: { dot: 'bg-violet-500', ring: 'bg-violet-400' },
  };

  const selected = toneColors[tone] || toneColors.emerald;

  return (
    <span className={cn('relative inline-flex items-center justify-center shrink-0', className)} style={{ width: size, height: size }}>
      <span className={cn('absolute inset-0 rounded-full opacity-75 animate-ping', selected.ring)} />
      <span className={cn('relative rounded-full shadow-xs', selected.dot)} style={{ width: size, height: size }} />
    </span>
  );
}

/**
 * Live Glowing Brain with Neural Pulses
 */
export function LiveBrainIcon({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={cn('relative inline-flex items-center justify-center animate-glow-pulse', className)}>
      <Brain size={size} className="animate-float-soft transition-transform duration-300" />
      <span className="absolute -top-1 -right-1 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping opacity-80" />
    </div>
  );
}

/**
 * Live Shimmering Sparkle Icon
 */
export function LiveSparkleIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center justify-center animate-shimmer-sparkle text-amber-500 dark:text-amber-400', className)}>
      <Sparkles size={size} />
    </span>
  );
}

/**
 * Live Rotating Gear / Activity Loader
 */
export function LiveGearIcon({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center justify-center animate-spin-slow text-brand-500', className)}>
      <Cpu size={size} />
    </span>
  );
}

/**
 * Live Gateway Status Capsule with pulsating radar and wave
 */
export function LiveGatewayBadge({
  connected = true,
  className,
}: {
  connected?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex h-6.5 sm:h-7 items-center gap-1.5 rounded-full px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold backdrop-blur-md shadow-2xs transition-all duration-300',
        connected
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
        className,
      )}
    >
      {connected ? (
        <>
          <LiveRadarBeacon size={6} tone="emerald" />
          <span className="tracking-wide">Live</span>
          <LiveWaveform color="bg-emerald-500 dark:bg-emerald-400" className="scale-75 origin-left" />
        </>
      ) : (
        <>
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          <span>Offline</span>
        </>
      )}
    </div>
  );
}
