import { cn } from '../../lib/utils';

interface HourglassLoaderProps {
  size?: number;
  className?: string;
  label?: string;
}

export function HourglassLoader({ size = 52, className, label }: HourglassLoaderProps) {
  return (
    <div className={cn('inline-flex flex-col items-center justify-center gap-3 select-none', className)}>
      <div
        style={{ width: size, height: size * 1.3 }}
        className="relative flex items-center justify-center animate-[hourglass-flip_3s_cubic-bezier(0.45,0.05,0.55,0.95)_infinite]"
      >
        <svg
          viewBox="0 0 100 130"
          className="w-full h-full drop-shadow-xs"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Top Cap */}
          <rect x="15" y="6" width="70" height="9" rx="4.5" fill="#ea580c" />

          {/* Bottom Cap */}
          <rect x="15" y="115" width="70" height="9" rx="4.5" fill="#ea580c" />

          {/* Glass Contour / Bulb */}
          <path
            d="M22 15 Q22 45 46 65 Q22 85 22 115 L78 115 Q78 85 54 65 Q78 45 78 15 Z"
            fill="currentColor"
            className="text-slate-100 dark:text-slate-800/80"
            stroke="#cbd5e1"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />

          {/* Glass Shine Highlight */}
          <path
            d="M26 20 Q26 40 44 58"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            className="opacity-70"
          />

          {/* Top Sand draining */}
          <g className="animate-[sand-drain_3s_linear_infinite] origin-bottom">
            <path
              d="M28 22 Q50 34 72 22 L62 50 Q50 56 38 50 Z"
              fill="#ea580c"
            />
          </g>

          {/* Continuous Sand Stream */}
          <line
            x1="50"
            y1="55"
            x2="50"
            y2="108"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
            className="animate-[sand-stream_3s_ease-in-out_infinite]"
          />

          {/* Bottom Sand filling */}
          <g className="animate-[sand-fill_3s_linear_infinite] origin-bottom">
            <path
              d="M26 113 Q50 92 74 113 Z"
              fill="#ea580c"
            />
          </g>
        </svg>
      </div>

      {label && (
        <span className="text-xs font-semibold text-ink-muted animate-pulse">
          {label}
        </span>
      )}
    </div>
  );
}
