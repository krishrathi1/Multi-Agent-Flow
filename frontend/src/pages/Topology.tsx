import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Network, RefreshCw, Share2 } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import { agentStatusLabel, agentStatusTone, tones } from '@/lib/design';
import { useChartTheme } from '@/lib/use-chart-theme';
import { useProcessStore } from '@/stores/process-store';
import { ProcessScope } from '@/components/process/ProcessScope';
import { ForceGraph, type GraphEdge, type GraphNode } from '@/components/topology/ForceGraph';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, Chip } from '@/components/ui/Badge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState, Spinner } from '@/components/ui/States';

interface GraphNodeApi {
  id: string;
  name: string;
  displayName: string;
  avatar: string | null;
  status: string;
  processId?: string | null;
  processRole?: string | null;
  processStage?: number | null;
}

interface GraphEdgeApi {
  source: string;
  target: string;
  messageCount: number;
  lastMessage: string;
}

export function Topology() {
  const [nodes, setNodes] = useState<GraphNodeApi[]>([]);
  const [edges, setEdges] = useState<GraphEdgeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const chart = useChartTheme();
  const { scopeId, setScope, processes } = useProcessStore();
  const [searchParams] = useSearchParams();

  const linked = searchParams.get('processId');
  useEffect(() => {
    if (linked && linked !== scopeId) setScope(linked);
  }, [linked, scopeId, setScope]);

  const load = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const graph = await api.threads.graph(scopeId || undefined);
        setNodes(graph.nodes as GraphNodeApi[]);
        setEdges(graph.edges as GraphEdgeApi[]);
      } catch (err) {
        console.error('Failed to load topology:', err);
      } finally {
        setLoading(false);
      }
    },
    [scopeId],
  );

  useEffect(() => {
    load();
  }, [load]);

  const activeProcess = processes.find((p) => p.id === scopeId) ?? null;

  /* Colour by pipeline stage when scoped to one production (the stage is the
     meaningful grouping there); otherwise give each agent a stable hue. */
  const graphNodes: GraphNode[] = useMemo(() => {
    const outbound = new Map<string, number>();
    for (const e of edges) {
      outbound.set(e.source, (outbound.get(e.source) ?? 0) + e.messageCount);
      outbound.set(e.target, (outbound.get(e.target) ?? 0) + e.messageCount);
    }

    return nodes.map((n, i) => ({
      id: n.id,
      label: n.displayName,
      sublabel: n.processRole ?? undefined,
      color:
        activeProcess && n.processStage != null
          ? chart.colors[(n.processStage - 1) % chart.colors.length]
          : chart.colors[i % chart.colors.length],
      weight: outbound.get(n.id) ?? 1,
      status: n.status,
      stage: n.processStage ?? null,
    }));
  }, [nodes, edges, chart.colors, activeProcess]);

  const graphEdges: GraphEdge[] = useMemo(
    () =>
      edges.map((e) => ({
        source: e.source,
        target: e.target,
        weight: e.messageCount,
        label: `${e.messageCount} msg`,
      })),
    [edges],
  );

  const selectedNode = nodes.find((n) => n.id === selected) ?? null;
  const selectedEdges = edges.filter(
    (e) => e.source === selected || e.target === selected,
  );

  const totalMessages = edges.reduce((n, e) => n + e.messageCount, 0);

  return (
    <>
      <PageHeader
        icon={Network}
        title="Network Graph"
        description="Who talks to whom, and how often."
        badge={
          activeProcess ? (
            <Badge tone="brand" icon={Share2}>
              {activeProcess.name}
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <ProcessScope align="right" />
            <Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card padding="none" className="overflow-hidden">
          <CardHeader
            bordered
            icon={Network}
            title="Communication topology"
            description={`${nodes.length} agents · ${edges.length} links · ${totalMessages} messages`}
          />
          <div className="relative h-[620px] bg-grid">
            {loading ? (
              <div className="absolute inset-0 grid place-items-center">
                <Spinner size={22} />
              </div>
            ) : nodes.length === 0 ? (
              <div className="absolute inset-0 grid place-items-center">
                <EmptyState
                  icon={Network}
                  title="No agent communication yet"
                  description={
                    activeProcess
                      ? `Agents in "${activeProcess.name}" haven't messaged each other yet.`
                      : 'Once agents start messaging each other, the network appears here.'
                  }
                />
              </div>
            ) : (
              <ForceGraph
                nodes={graphNodes}
                edges={graphEdges}
                selectedId={selected}
                onSelect={setSelected}
              />
            )}
          </div>
        </Card>

        {/* ---- Inspector ---- */}
        <div className="space-y-4">
          {selectedNode ? (
            <Card padding="none">
              <CardHeader
                bordered
                title={selectedNode.displayName}
                description={selectedNode.processRole ?? selectedNode.name}
                actions={
                  <Link
                    to={`/agents/${selectedNode.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-ink-subtle transition-colors hover:text-brand-700 dark:hover:text-brand-300"
                  >
                    Open
                    <ArrowUpRight size={12} strokeWidth={2} aria-hidden />
                  </Link>
                }
              />
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2.5">
                  <Avatar
                    name={selectedNode.displayName}
                    emoji={selectedNode.avatar}
                    size="md"
                    status={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                    statusLabel={agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                  />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-ink-faint">{selectedNode.name}</p>
                    <Badge
                      tone={agentStatusTone[selectedNode.status as keyof typeof agentStatusTone]}
                      dot
                    >
                      {agentStatusLabel[selectedNode.status as keyof typeof agentStatusLabel]}
                    </Badge>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
                    Connections
                  </p>
                  <ul className="space-y-1.5">
                    {selectedEdges.map((e, i) => {
                      const otherId = e.source === selected ? e.target : e.source;
                      const other = nodes.find((n) => n.id === otherId);
                      const outgoing = e.source === selected;
                      return (
                        <li
                          key={`${e.source}-${e.target}-${i}`}
                          className="flex items-center gap-2 rounded-md bg-inset px-2.5 py-2"
                        >
                          <span
                            className={cn(
                              'text-2xs font-semibold uppercase',
                              outgoing
                                ? 'text-brand-700 dark:text-brand-300'
                                : 'text-ink-faint',
                            )}
                          >
                            {outgoing ? 'to' : 'from'}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                            {other?.displayName ?? 'Unknown'}
                          </span>
                          <Chip>{e.messageCount}</Chip>
                        </li>
                      );
                    })}
                    {selectedEdges.length === 0 && (
                      <li className="text-xs text-ink-faint">No connections yet.</li>
                    )}
                  </ul>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                compact
                icon={Share2}
                title="Select an agent"
                description="Click any node to inspect its connections."
              />
            </Card>
          )}

          {/* ---- Busiest links ---- */}
          <Card padding="none">
            <CardHeader bordered title="Busiest links" description="By message volume" />
            <ul className="p-2">
              {[...edges]
                .sort((a, b) => b.messageCount - a.messageCount)
                .slice(0, 6)
                .map((e, i) => {
                  const s = nodes.find((n) => n.id === e.source);
                  const t = nodes.find((n) => n.id === e.target);
                  return (
                    <li
                      key={`${e.source}-${e.target}-${i}`}
                      className="flex items-center gap-2 rounded-md p-2 transition-colors hover:wash"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs text-ink-muted">
                        {s?.displayName ?? '—'} → {t?.displayName ?? '—'}
                      </span>
                      <Chip>{e.messageCount}</Chip>
                    </li>
                  );
                })}
              {edges.length === 0 && (
                <li className="px-2 py-4 text-center text-xs text-ink-faint">
                  No links recorded.
                </li>
              )}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
