import { cn } from '../../lib/utils';
import { Sparkles } from 'lucide-react';

interface HourglassLoaderProps {
  size?: number;
  className?: string;
  label?: string;
}

export function HourglassLoader({ size = 56, className, label }: HourglassLoaderProps) {
  const scaledSize = Math.max(size, 48);

  return (
    <div className={cn('inline-flex flex-col items-center justify-center gap-4 select-none', className)}>
      <div
        style={{ width: scaledSize, height: scaledSize }}
        className="relative flex items-center justify-center"
      >
        {/* Ambient Glow Backdrop */}
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-indigo-600/30 via-purple-600/25 to-cyan-500/20 blur-xl animate-[quantum-pulse_3s_ease-in-out_infinite]"
        />

        {/* Outer Orbital Ring 1 */}
        <div
          className="absolute inset-0 rounded-full border border-indigo-500/40 border-t-indigo-400 border-r-transparent animate-[quantum-spin-cw_4s_linear_infinite]"
        />

        {/* Middle Orbital Ring 2 (Counter Rotating) */}
        <div
          className="absolute inset-1.5 rounded-full border border-purple-500/40 border-b-purple-400 border-l-transparent animate-[quantum-spin-ccw_3s_ease-in-out_infinite]"
        />

        {/* Inner Gyro Ring 3 */}
        <div
          className="absolute inset-3 rounded-full border border-cyan-500/40 border-t-cyan-300 border-b-transparent animate-[quantum-spin-cw_2s_linear_infinite]"
        />

        {/* Quantum Energy Orbiting Particle */}
        <div
          className="absolute w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-[quantum-particle_2.5s_linear_infinite]"
        />

        {/* Center Nucleus AI Core */}
        <div className="relative z-10 w-4 h-4 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-400 shadow-[0_0_12px_rgba(129,140,248,0.9)] animate-[quantum-pulse_2s_ease-in-out_infinite] flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping opacity-75" />
        </div>
      </div>

      {label && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-surface/80 dark:bg-slate-900/80 border border-line/60 dark:border-indigo-500/20 shadow-xs backdrop-blur-md">
          <Sparkles size={13} className="text-indigo-500 dark:text-indigo-400 animate-spin animate-duration-[4s]" />
          <span className="text-xs font-semibold tracking-wide bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 dark:from-indigo-300 dark:via-purple-300 dark:to-cyan-300 bg-clip-text text-transparent bg-[length:200%_auto] animate-[shimmer-text_3s_linear_infinite]">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}
