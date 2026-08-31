import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Activity } from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  color: string;
  weight?: number;
  status?: string;
  stage?: number | null;
  avatar?: string | null;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
  label?: string;
}

interface Positioned extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
}

const BASE_R = 28;

export function ForceGraph({
  nodes,
  edges,
  onSelect,
  selectedId,
  className,
  width: WIDTH = 1000,
  height: HEIGHT = 620,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  className?: string;
  width?: number;
  height?: number;
}) {
  const [positions, setPositions] = useState<Positioned[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const maxWeight = useMemo(
    () => Math.max(1, ...nodes.map((n) => n.weight ?? 1)),
    [nodes],
  );

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions([]);
      return;
    }

    const seed = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return Math.abs(h);
    };

    const items: Positioned[] = nodes.map((n, i) => {
      const s = seed(n.id);
      const angle = (i / nodes.length) * Math.PI * 2 + (s % 100) / 300;
      const radius = 160 + (s % 100);
      return {
        ...n,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        r: BASE_R + Math.min(14, ((n.weight ?? 1) / maxWeight) * 14),
      };
    });

    const index = new Map(items.map((n, i) => [n.id, i]));
    const links = edges
      .map((e) => ({
        s: index.get(e.source),
        t: index.get(e.target),
        w: e.weight ?? 1,
      }))
      .filter((l): l is { s: number; t: number; w: number } => l.s !== undefined && l.t !== undefined);

    const ITERATIONS = 350;
    const REPULSION = Math.max(30000, 110000 / Math.max(3, nodes.length));
    const SPRING = 0.012;
    const IDEAL = Math.min(240, Math.max(140, Math.min(WIDTH, HEIGHT) / 2.5));
    const GRAVITY = 0.007;
    const DAMPING = 0.88;

    for (let step = 0; step < ITERATIONS; step++) {
      const cool = 1 - step / ITERATIONS;

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          if (dist < 0.5) {
            dx = (i % 2 === 0 ? 1 : -1) * 0.5;
            dy = (j % 2 === 0 ? 1 : -1) * 0.5;
            dist = 0.7;
          }
          const force = (REPULSION / (dist * dist)) * cool;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const l of links) {
        const a = items[l.s];
        const b = items[l.t];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = (dist - IDEAL) * SPRING * Math.min(2.5, l.w);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const n of items) {
        n.vx += (WIDTH / 2 - n.x) * GRAVITY;
        n.vy += (HEIGHT / 2 - n.y) * GRAVITY;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += Math.max(-30, Math.min(30, n.vx));
        n.y += Math.max(-30, Math.min(30, n.vy));
      }

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          const minDist = a.r + b.r + 42;
          if (dist < minDist) {
            const push = (minDist - dist) / 2;
            const ux = dx / dist;
            const uy = dy / dist;
            a.x -= ux * push;
            a.y -= uy * push;
            b.x += ux * push;
            b.y += uy * push;
          }
        }
      }

      for (const n of items) {
        n.x = Math.max(n.r + 20, Math.min(WIDTH - n.r - 20, n.x));
        n.y = Math.max(n.r + 20, Math.min(HEIGHT - n.r - 36, n.y));
      }
    }

    setPositions(items);
  }, [nodes, edges, maxWeight, WIDTH, HEIGHT]);

  const posById = useMemo(
    () => new Map(positions.map((p) => [p.id, p])),
    [positions],
  );

  const maxEdgeWeight = useMemo(
    () => Math.max(1, ...edges.map((e) => e.weight ?? 1)),
    [edges],
  );

  const isEdgeActive = useCallback(
    (e: GraphEdge) => {
      const focus = hovered ?? selectedId;
      return !!focus && (e.source === focus || e.target === focus);
    },
    [hovered, selectedId],
  );

  const focus = hovered ?? selectedId ?? null;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const set = new Set<string>([focus]);
    for (const e of edges) {
      if (e.source === focus) set.add(e.target);
      if (e.target === focus) set.add(e.source);
    }
    return set;
  }, [focus, edges]);

  // Pan and Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.min(2.5, Math.max(0.4, z * zoomFactor)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full h-full select-none overflow-hidden', className)}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      {/* Interactive Controls Overlay */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-surface/90 backdrop-blur-xl border border-line p-1.5 rounded-xl shadow-lg">
        <button
          type="button"
          onClick={() => setZoom((z) => Math.min(2.5, z * 1.2))}
          title="Zoom In"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          <ZoomIn size={15} />
        </button>
        <button
          type="button"
          onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))}
          title="Zoom Out"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          <ZoomOut size={15} />
        </button>
        <div className="w-[1px] h-4 bg-line mx-0.5" />
        <button
          type="button"
          onClick={resetView}
          title="Reset View"
          className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-full pointer-events-auto"
        role="img"
        aria-label={`Agent communication graph: ${nodes.length} agents, ${edges.length} links`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect?.(null);
        }}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <marker
            id="graph-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-brand-500/80" />
          </marker>
          <marker
            id="graph-arrow-dimmed"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="4"
            markerHeight="4"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ink-faint opacity-40" />
          </marker>
        </defs>

        <g
          transform={`translate(${pan.x + (WIDTH * (1 - zoom)) / 2}, ${pan.y + (HEIGHT * (1 - zoom)) / 2}) scale(${zoom})`}
          className="transition-transform duration-75 ease-out"
        >
          {/* ---- Edges ---- */}
          <g>
            {edges.map((e, i) => {
              const a = posById.get(e.source);
              const b = posById.get(e.target);
              if (!a || !b) return null;

              const active = isEdgeActive(e);
              const dimmed = !!focus && !active;
              const w = 1.5 + ((e.weight ?? 1) / maxEdgeWeight) * 3;

              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist;
              const uy = dy / dist;
              const x1 = a.x + ux * (a.r + 3);
              const y1 = a.y + uy * (a.r + 3);
              const x2 = b.x - ux * (b.r + 10);
              const y2 = b.y - uy * (b.r + 10);

              return (
                <g key={`${e.source}-${e.target}-${i}`}>
                  {/* Subtle outer glow line for active connections */}
                  {active && (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      strokeWidth={w + 5}
                      strokeLinecap="round"
                      stroke="#3b82f6"
                      opacity={0.3}
                      filter="url(#glow)"
                    />
                  )}

                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    strokeWidth={active ? w + 1 : w}
                    strokeLinecap="round"
                    markerEnd={active ? 'url(#graph-arrow)' : 'url(#graph-arrow-dimmed)'}
                    className={cn(
                      'transition-all duration-200',
                      active ? 'stroke-brand-500' : 'stroke-ink-muted/30',
                    )}
                    opacity={dimmed ? 0.08 : active ? 1 : 0.45}
                  />

                  {/* Animated data packet traveling on active lines */}
                  {active && (
                    <circle r={3} fill="#60a5fa" className="animate-ping" opacity={0.8}>
                      <animateMotion
                        path={`M ${x1} ${y1} L ${x2} ${y2}`}
                        dur="1.8s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {active && e.label && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                      <rect
                        x={-24}
                        y={-14}
                        width={48}
                        height={16}
                        rx={6}
                        fill="var(--c-surface)"
                        stroke="var(--c-line)"
                        strokeWidth={1}
                        className="shadow-2xs"
                      />
                      <text
                        y={-3}
                        textAnchor="middle"
                        className="fill-ink font-mono text-[9px] font-bold select-none"
                      >
                        {e.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>

          {/* ---- Nodes ---- */}
          <g>
            {positions.map((n) => {
              const dimmed = neighbours ? !neighbours.has(n.id) : false;
              const isFocus = focus === n.id;

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer transition-opacity duration-200"
                  opacity={dimmed ? 0.2 : 1}
                  onMouseEnter={() => setHovered(n.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(selectedId === n.id ? null : n.id);
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.label}${n.sublabel ? `, ${n.sublabel}` : ''}`}
                >
                  {/* Outer pulse aura */}
                  {isFocus && (
                    <circle
                      r={n.r + 10}
                      fill={n.color}
                      opacity={0.2}
                      filter="url(#glow)"
                      className="animate-pulse"
                    />
                  )}

                  {/* Node Outer Ring */}
                  <circle
                    r={n.r + 3}
                    fill="none"
                    stroke={n.color}
                    strokeWidth={isFocus ? 2.5 : 1.2}
                    strokeDasharray={isFocus ? '4 2' : 'none'}
                    opacity={isFocus ? 1 : 0.4}
                  />

                  {/* Node Main Circle Body */}
                  <circle
                    r={n.r}
                    fill={n.color}
                    fillOpacity={0.18}
                    stroke={n.color}
                    strokeWidth={isFocus ? 2.5 : 1.8}
                    className="backdrop-blur-md"
                  />

                  {/* Center Monogram / Initials */}
                  <text
                    textAnchor="middle"
                    dy="0.35em"
                    className="pointer-events-none select-none text-[13px] font-bold font-mono tracking-wider"
                    fill={n.color}
                  >
                    {n.label
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </text>

                  {/* Live Status Pip Badge */}
                  {n.status && (
                    <g transform={`translate(${n.r * 0.75}, ${-n.r * 0.75})`}>
                      <circle
                        r={5.5}
                        className={cn(
                          n.status === 'ONLINE' && 'fill-emerald-500',
                          n.status === 'IDLE' && 'fill-amber-500',
                          n.status === 'ERROR' && 'fill-rose-500',
                          n.status === 'OFFLINE' && 'fill-ink-faint',
                        )}
                        stroke="var(--c-surface)"
                        strokeWidth={2}
                      />
                    </g>
                  )}

                  {/* Node Label Pill Background */}
                  <g transform={`translate(0, ${n.r + 14})`}>
                    <text
                      textAnchor="middle"
                      className="pointer-events-none select-none fill-ink text-[12px] font-bold"
                    >
                      {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                    </text>
                    {n.sublabel && (
                      <text
                        y={14}
                        textAnchor="middle"
                        className="pointer-events-none select-none fill-ink-muted text-[10px] font-medium"
                      >
                        {n.sublabel.length > 24 ? `${n.sublabel.slice(0, 23)}…` : n.sublabel}
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}


