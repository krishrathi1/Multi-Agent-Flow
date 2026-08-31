import { useEffect, useState } from 'react';
import { Lottie } from 'lottie-react';
import { cn } from '../../lib/utils';

// High-precision curated Lottie animation data definitions
// Lightweight JSON animation data for zero external latency and instant offline rendering

export const lottieAnimations = {
  // 1. Neural AI Brain / Mother Core Pulse
  aiBrain: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'AI Brain',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Core Ring Pulse',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [80] }, { t: 30, s: [20] }, { t: 60, s: [80] }] },
          r: { k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [90, 90, 100] }, { t: 30, s: [115, 115, 100] }, { t: 60, s: [90, 90, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [60, 60] },
          },
          {
            ty: 'st',
            c: { k: [0.2, 0.52, 0.98, 1] },
            o: { k: 100 },
            w: { k: 3 },
            d: [{ n: 'd', v: { k: 8 } }, { n: 'g', v: { k: 6 } }],
          },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Inner Brain Core',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 30, s: [-10] }, { t: 60, s: [0] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [100, 100, 100] }, { t: 30, s: [108, 108, 100] }, { t: 60, s: [100, 100, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [36, 36] },
          },
          {
            ty: 'fl',
            c: { k: [0.55, 0.35, 0.98, 0.85] },
          },
          {
            ty: 'st',
            c: { k: [0.3, 0.7, 1, 1] },
            w: { k: 2.5 },
          },
        ],
      },
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Center Synapse Dot',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [100] }, { t: 30, s: [40] }, { t: 60, s: [100] }] },
          r: { k: 0 },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [80, 80, 100] }, { t: 30, s: [140, 140, 100] }, { t: 60, s: [80, 80, 100] }] },
        },
        shapes: [
          {
            ty: 'el',
            p: { k: [0, 0] },
            s: { k: [12, 12] },
          },
          {
            ty: 'fl',
            c: { k: [1, 1, 1, 1] },
          },
        ],
      },
    ],
  },

  // 2. Robot Assistant / Autonomous Agent
  robotAgent: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Robot Agent',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Antenna Glow',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [40] }, { t: 30, s: [100] }, { t: 60, s: [40] }] },
          r: { k: 0 },
          p: { k: [50, 20, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [80, 80, 100] }, { t: 30, s: [120, 120, 100] }, { t: 60, s: [80, 80, 100] }] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [10, 10] } },
          { ty: 'fl', c: { k: [0.1, 0.8, 0.5, 1] } },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Robot Head',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 15, s: [-4] }, { t: 45, s: [4] }, { t: 60, s: [0] }] },
          p: { k: [50, 52, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          { ty: 'rc', p: { k: [0, 0] }, s: { k: [46, 36] }, r: { k: 8 } },
          { ty: 'fl', c: { k: [0.18, 0.22, 0.32, 1] } },
          { ty: 'st', c: { k: [0.25, 0.55, 0.95, 1] }, w: { k: 3 } },
        ],
      },
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Robot Eyes Visor',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 15, s: [-4] }, { t: 45, s: [4] }, { t: 60, s: [0] }] },
          p: { k: [50, 52, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [100, 100, 100] }, { t: 30, s: [100, 20, 100] }, { t: 35, s: [100, 100, 100] }] },
        },
        shapes: [
          { ty: 'rc', p: { k: [0, 0] }, s: { k: [32, 10] }, r: { k: 5 } },
          { ty: 'fl', c: { k: [0.2, 0.85, 0.95, 1] } },
        ],
      },
    ],
  },

  // 3. Rocket / Milestone Launch
  rocketLaunch: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Rocket Launch',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Exhaust Flame',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [80] }, { t: 30, s: [100] }, { t: 60, s: [80] }] },
          r: { k: 0 },
          p: { k: [50, 72, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [80, 70, 100] }, { t: 30, s: [110, 130, 100] }, { t: 60, s: [80, 70, 100] }] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [16, 26] } },
          { ty: 'fl', c: { k: [1, 0.45, 0.1, 0.9] } },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Rocket Body',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 30, s: [3] }, { t: 60, s: [0] }] },
          p: { k: [{ t: 0, s: [50, 46, 0] }, { t: 30, s: [50, 40, 0] }, { t: 60, s: [50, 46, 0] }] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [26, 44] } },
          { ty: 'fl', c: { k: [0.95, 0.95, 0.98, 1] } },
          { ty: 'st', c: { k: [0.2, 0.55, 0.95, 1] }, w: { k: 3 } },
        ],
      },
    ],
  },

  // 4. Live Shield / Security Radar
  securityShield: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Security Shield',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Shield Barrier',
        sr: 1,
        ks: {
          o: { k: [{ t: 0, s: [90] }, { t: 30, s: [60] }, { t: 60, s: [90] }] },
          r: { k: 0 },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [95, 95, 100] }, { t: 30, s: [105, 105, 100] }, { t: 60, s: [95, 95, 100] }] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [54, 54] } },
          { ty: 'fl', c: { k: [0.1, 0.75, 0.5, 0.15] } },
          { ty: 'st', c: { k: [0.1, 0.8, 0.5, 1] }, w: { k: 3 } },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Shield Center Check',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: 0 },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [22, 22] } },
          { ty: 'fl', c: { k: [0.1, 0.8, 0.5, 1] } },
        ],
      },
    ],
  },

  // 5. Quantum Gateway / MCP Connection Hub
  quantumHub: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Quantum Hub',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Orbit Ring 1',
        sr: 1,
        ks: {
          o: { k: 80 },
          r: { k: [{ t: 0, s: [0] }, { t: 60, s: [360] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 45, 100] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [68, 68] } },
          { ty: 'st', c: { k: [0.35, 0.65, 1, 0.9] }, w: { k: 2.5 } },
        ],
      },
      {
        ddd: 0,
        ind: 2,
        ty: 4,
        nm: 'Orbit Ring 2',
        sr: 1,
        ks: {
          o: { k: 80 },
          r: { k: [{ t: 0, s: [90] }, { t: 60, s: [-270] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [45, 100, 100] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [68, 68] } },
          { ty: 'st', c: { k: [0.75, 0.35, 1, 0.9] }, w: { k: 2.5 } },
        ],
      },
      {
        ddd: 0,
        ind: 3,
        ty: 4,
        nm: 'Center Quantum Core',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: 0 },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [{ t: 0, s: [85, 85, 100] }, { t: 30, s: [120, 120, 100] }, { t: 60, s: [85, 85, 100] }] },
        },
        shapes: [
          { ty: 'el', p: { k: [0, 0] }, s: { k: [24, 24] } },
          { ty: 'fl', c: { k: [0.2, 0.7, 1, 1] } },
        ],
      },
    ],
  },
  // 6. Hourglass Sand Timer Loading Animation (LottieFiles)
  loading: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Loading Hourglass',
    ddd: 0,
    assets: [],
    layers: [
      {
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Hourglass Flip Group',
        sr: 1,
        ks: {
          o: { k: 100 },
          r: { k: [{ t: 0, s: [0] }, { t: 45, s: [0] }, { t: 60, s: [180] }] },
          p: { k: [50, 50, 0] },
          a: { k: [0, 0, 0] },
          s: { k: [100, 100, 100] },
        },
        shapes: [
          { ty: 'rc', p: { k: [0, -38] }, s: { k: [60, 8] }, r: { k: 4 } },
          { ty: 'fl', c: { k: [0.92, 0.35, 0.05, 1] } },
          { ty: 'rc', p: { k: [0, 38] }, s: { k: [60, 8] }, r: { k: 4 } },
          { ty: 'fl', c: { k: [0.92, 0.35, 0.05, 1] } },
        ],
      },
    ],
  },
  hourglassLoader: {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: 'Hourglass Loader',
    ddd: 0,
    assets: [],
    layers: [],
  },
};

export type AnimationType = keyof typeof lottieAnimations;

interface LottieAnimationProps {
  type: AnimationType;
  size?: number | string;
  loop?: boolean;
  autoplay?: boolean;
  className?: string;
}

import { HourglassLoader } from './HourglassLoader';

export function LottieAnimation({
  type,
  size = 48,
  loop = true,
  autoplay = true,
  className,
}: LottieAnimationProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: size, height: size }} className={cn('shrink-0', className)} />;
  }

  if (type === 'loading' || type === 'hourglassLoader') {
    return <HourglassLoader size={typeof size === 'number' ? size : 48} className={className} />;
  }

  const animationData = lottieAnimations[type] || lottieAnimations.aiBrain;

  return (
    <div
      style={{ width: size, height: size }}
      className={cn('shrink-0 select-none flex items-center justify-center', className)}
    >
      <Lottie
        src={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
