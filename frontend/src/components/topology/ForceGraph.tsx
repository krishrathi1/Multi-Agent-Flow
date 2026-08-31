import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../../lib/utils';

export interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  /** Drives the node's tint. */
  color: string;
  /** Relative importance — scales the radius. */
  weight?: number;
  status?: string;
  /** Groups nodes into stage columns when a layout hint is supplied. */
  stage?: number | null;
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

const BASE_R = 26;

/**
 * Force-directed graph with collision resolution.
 *
 * The previous version placed nodes on a fixed circle, so labels and circles
 * overlapped as soon as there were more than a handful of agents. This runs a
 * short simulation — repulsion, spring-loaded edges, centring gravity and a
 * hard collision pass — then renders the settled result. Deterministic seeding
 * keeps the layout stable across re-renders instead of reshuffling each time.
 */
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
  /** viewBox dimensions — match the container's aspect ratio so the graph
   *  fills it instead of letterboxing inside a fixed 1000x620 box. */
  width?: number;
  height?: number;
}) {
  const [positions, setPositions] = useState<Positioned[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxWeight = useMemo(
    () => Math.max(1, ...nodes.map((n) => n.weight ?? 1)),
    [nodes],
  );

  // Simulate once per topology change. Nodes are few (tens), so a synchronous
  // fixed-iteration run is cheaper and steadier than an animated ticker.
  useEffect(() => {
    if (nodes.length === 0) {
      setPositions([]);
      return;
    }

    // Deterministic pseudo-random seeding from the node id — same graph, same
    // layout, every mount.
    const seed = (id: string) => {
      let h = 0;
      for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
      return Math.abs(h);
    };

    const items: Positioned[] = nodes.map((n, i) => {
      const s = seed(n.id);
      // Start on a jittered ring so the simulation has something to relax.
      const angle = (i / nodes.length) * Math.PI * 2 + (s % 100) / 300;
      const radius = 150 + (s % 90);
      return {
        ...n,
        x: WIDTH / 2 + Math.cos(angle) * radius,
        y: HEIGHT / 2 + Math.sin(angle) * radius,
        vx: 0,
        vy: 0,
        r: BASE_R + Math.min(12, ((n.weight ?? 1) / maxWeight) * 12),
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

    const ITERATIONS = 320;
    // Repulsion scales down with node count so a big fleet doesn't explode
    // past the viewBox while a small one still fills it.
    const REPULSION = Math.max(26000, 90000 / Math.max(3, nodes.length));
    const SPRING = 0.010;
    const IDEAL = Math.min(230, Math.max(120, Math.min(WIDTH, HEIGHT) / 2.6));
    const GRAVITY = 0.008;
    const DAMPING = 0.88;

    for (let step = 0; step < ITERATIONS; step++) {
      // Cooling factor: big moves early, fine adjustments late.
      const cool = 1 - step / ITERATIONS;

      // Pairwise repulsion.
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy) || 0.01;
          // Nudge exact overlaps apart so the force has a direction.
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

      // Edge springs.
      for (const l of links) {
        const a = items[l.s];
        const b = items[l.t];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const force = (dist - IDEAL) * SPRING * Math.min(2, l.w);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      // Gravity toward centre keeps disconnected nodes from drifting away.
      for (const n of items) {
        n.vx += (WIDTH / 2 - n.x) * GRAVITY;
        n.vy += (HEIGHT / 2 - n.y) * GRAVITY;
        n.vx *= DAMPING;
        n.vy *= DAMPING;
        n.x += Math.max(-30, Math.min(30, n.vx));
        n.y += Math.max(-30, Math.min(30, n.vy));
      }

      // Hard collision pass — the guarantee that circles never overlap, which
      // the soft repulsion alone doesn't provide.
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i];
          const b = items[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.01;
          // Extra padding leaves room for the label under each node.
          const minDist = a.r + b.r + 34;
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

      // Keep everything inside the viewBox, allowing for labels.
      for (const n of items) {
        n.x = Math.max(n.r + 12, Math.min(WIDTH - n.r - 12, n.x));
        n.y = Math.max(n.r + 12, Math.min(HEIGHT - n.r - 30, n.y));
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

  /** An edge is emphasised when either end is hovered or selected. */
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

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`Agent communication graph: ${nodes.length} agents, ${edges.length} links`}
      onClick={(e) => {
        if (e.target === svgRef.current) onSelect?.(null);
      }}
    >
      <defs>
        <marker
          id="graph-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="fill-ink-faint" />
        </marker>
      </defs>

      {/* ---- Edges ---- */}
      <g>
        {edges.map((e, i) => {
          const a = posById.get(e.source);
          const b = posById.get(e.target);
          if (!a || !b) return null;

          const active = isEdgeActive(e);
          const dimmed = !!focus && !active;
          const w = 1 + ((e.weight ?? 1) / maxEdgeWeight) * 3;

          // Trim the line to the circle edges so it doesn't run under the node.
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 1;
          const ux = dx / dist;
          const uy = dy / dist;
          const x1 = a.x + ux * (a.r + 2);
          const y1 = a.y + uy * (a.r + 2);
          const x2 = b.x - ux * (b.r + 8);
          const y2 = b.y - uy * (b.r + 8);

          return (
            <g key={`${e.source}-${e.target}-${i}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                strokeWidth={active ? w + 1 : w}
                strokeLinecap="round"
                markerEnd="url(#graph-arrow)"
                className={cn(
                  'transition-opacity duration-200',
                  active ? 'stroke-brand-500' : 'stroke-ink-faint',
                )}
                opacity={dimmed ? 0.12 : active ? 0.95 : 0.55}
              />
              {active && e.label && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 6}
                  textAnchor="middle"
                  className="fill-ink-subtle text-[10px]"
                >
                  {e.label}
                </text>
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
              opacity={dimmed ? 0.25 : 1}
              onMouseEnter={() => setHovered(n.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.(selectedId === n.id ? null : n.id);
              }}
              role="button"
              tabIndex={0}
              aria-label={`${n.label}${n.sublabel ? `, ${n.sublabel}` : ''}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(selectedId === n.id ? null : n.id);
                }
              }}
            >
              {isFocus && (
                <circle r={n.r + 8} fill={n.color} opacity={0.16} className="animate-breathe" />
              )}
              <circle
                r={n.r}
                fill={n.color}
                fillOpacity={0.16}
                stroke={n.color}
                strokeWidth={isFocus ? 2.5 : 1.75}
              />
              {/* Initials, not emoji — they scale and stay legible. */}
              <text
                textAnchor="middle"
                dy="0.35em"
                className="pointer-events-none select-none text-[13px] font-semibold"
                fill={n.color}
              >
                {n.label
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()}
              </text>

              {n.status && (
                <circle
                  cx={n.r * 0.72}
                  cy={-n.r * 0.72}
                  r={4.5}
                  className={cn(
                    n.status === 'ONLINE' && 'fill-emerald-500',
                    n.status === 'IDLE' && 'fill-amber-500',
                    n.status === 'ERROR' && 'fill-red-500',
                    n.status === 'OFFLINE' && 'fill-ink-faint',
                  )}
                  stroke="var(--c-surface)"
                  strokeWidth={2}
                />
              )}

              <text
                y={n.r + 16}
                textAnchor="middle"
                className="pointer-events-none select-none fill-ink text-[12px] font-medium"
              >
                {n.label.length > 18 ? `${n.label.slice(0, 17)}…` : n.label}
              </text>
              {n.sublabel && (
                <text
                  y={n.r + 29}
                  textAnchor="middle"
                  className="pointer-events-none select-none fill-ink-faint text-[10px]"
                >
                  {n.sublabel.length > 22 ? `${n.sublabel.slice(0, 21)}…` : n.sublabel}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
