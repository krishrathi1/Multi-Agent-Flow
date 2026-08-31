import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Bot,
  MessageSquare,
  MessagesSquare,
  Network,
  RefreshCw,
  Send,
  Sparkles,
  Waypoints,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { cn, timeAgo } from '../lib/utils';
import { agentStatusLabel, agentStatusTone } from '../lib/design';
import { useChartTheme } from '../lib/use-chart-theme';
import { useProcessStore } from '../stores/process-store';
import { ProcessScope } from '../components/process/ProcessScope';
import { ForceGraph, type GraphEdge, type GraphNode } from '../components/topology/ForceGraph';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge, Chip } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState, Spinner } from '../components/ui/States';
import type { Thread, Message, AgentStatus } from '../types';

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

/** One row in the thread list. */
function ThreadCard({
  thread,
  selected,
  onClick,
}: {
  thread: Thread;
  selected: boolean;
  onClick: () => void;
}) {
  const last = thread.messages[thread.messages.length - 1];
  const participants = useMemo(() => {
    const seen = new Map<string, { name: string; avatar: string | null }>();
    for (const m of thread.messages) {
      if (m.sender) seen.set(m.sender.id, { name: m.sender.displayName, avatar: m.sender.avatar });
      if (m.receiver)
        seen.set(m.receiver.id, { name: m.receiver.displayName, avatar: m.receiver.avatar });
    }
    return [...seen.values()];
  }, [thread.messages]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-xl border p-4 text-left shadow-sm transition-all duration-150',
        selected
          ? 'border-brand-500/50 bg-brand-500/5 ring-1 ring-brand-500/30'
          : 'border-line-subtle bg-surface hover:border-line-strong hover:bg-raised'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="min-w-0 font-semibold text-sm text-ink truncate">{thread.title}</h4>
        <Chip>
          {thread.messages.length} msg{thread.messages.length === 1 ? '' : 's'}
        </Chip>
      </div>

      {last && (
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {last.content}
        </p>
      )}

      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
        <div className="flex items-center gap-1.5">
          {participants.slice(0, 4).map((p) => (
            <span key={p.name} title={p.name}>
              <Avatar name={p.name} emoji={p.avatar} size="xs" />
            </span>
          ))}
          {participants.length > 4 && (
            <span className="text-2xs text-ink-faint font-medium">+{participants.length - 4}</span>
          )}
        </div>
        <time className="text-2xs tabular-nums text-ink-faint" dateTime={thread.updatedAt}>
          {timeAgo(thread.updatedAt)}
        </time>
      </div>
    </button>
  );
}

/** Message transcript for one thread. */
function ThreadDetail({ thread }: { thread: Thread }) {
  return (
    <div className="space-y-4 p-4">
      {thread.messages.map((msg: Message) => (
        <div key={msg.id} className="flex items-start gap-3 rounded-xl border border-line-subtle bg-raised/30 p-3.5 shadow-sm">
          <Avatar
            name={msg.sender?.displayName ?? 'Agent'}
            emoji={msg.sender?.avatar}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-ink">
                {msg.sender?.displayName ?? 'Unknown'}
              </span>
              <span className="text-2xs text-brand-600 dark:text-brand-400 font-medium">→</span>
              <span className="text-xs font-medium text-ink-muted">
                {msg.receiver?.displayName ?? 'Unknown'}
              </span>
              <time className="ml-auto text-2xs tabular-nums text-ink-faint" dateTime={msg.createdAt}>
                {timeAgo(msg.createdAt)}
              </time>
            </div>
            <div className="mt-2 rounded-lg border border-line-subtle bg-surface p-3 text-xs leading-relaxed text-ink shadow-inner">
              <pre className="whitespace-pre-wrap font-sans break-words text-xs leading-relaxed text-ink">
                {msg.content}
              </pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Communications() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [nodes, setNodes] = useState<GraphNodeApi[]>([]);
  const [edges, setEdges] = useState<GraphEdgeApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const chart = useChartTheme();
  const { scopeId, processes } = useProcessStore();
  const activeProcess = processes.find((p) => p.id === scopeId) ?? null;

  const loadData = useCallback(async () => {
    try {
      const [threadList, graph] = await Promise.all([
        api.threads.list(scopeId || undefined),
        api.threads.graph(scopeId || undefined),
      ]);
      setThreads(threadList);
      setNodes(graph.nodes as GraphNodeApi[]);
      setEdges(graph.edges as GraphEdgeApi[]);
    } catch (err) {
      console.error('Failed to load communications data:', err);
    }
  }, [scopeId]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // Refresh when new agent-to-agent messages arrive.
  useEffect(() => {
    const s = getSocket();
    const onMessage = () => loadData();
    s.on('thread:message', onMessage);
    s.on('agent:message', onMessage);
    return () => {
      s.off('thread:message', onMessage);
      s.off('agent:message', onMessage);
    };
  }, [loadData]);

  const graphNodes: GraphNode[] = useMemo(() => {
    const volume = new Map<string, number>();
    for (const e of edges) {
      volume.set(e.source, (volume.get(e.source) ?? 0) + e.messageCount);
      volume.set(e.target, (volume.get(e.target) ?? 0) + e.messageCount);
    }
    return nodes.map((n, i) => ({
      id: n.id,
      label: n.displayName,
      sublabel: n.processRole ?? undefined,
      color: chart.colors[i % chart.colors.length],
      weight: volume.get(n.id) ?? 1,
      status: n.status,
    }));
  }, [nodes, edges, chart.colors]);

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

  // Selecting a node in the graph filters the thread list beside it.
  const filteredThreads = useMemo(() => {
    if (!selectedNodeId) return threads;
    return threads.filter((t) =>
      t.messages.some(
        (m) => m.senderId === selectedNodeId || m.receiverId === selectedNodeId,
      ),
    );
  }, [threads, selectedNodeId]);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;
  const selectedAgent = nodes.find((n) => n.id === selectedNodeId) ?? null;

  return (
    <>
      <PageHeader
        icon={Waypoints}
        title="Communications"
        description="Agent-to-agent message threads and who they flow between."
        badge={activeProcess ? <Badge tone="brand">{activeProcess.name}</Badge> : undefined}
        actions={
          <div className="flex items-center gap-2">
            <ProcessScope align="right" />
            <Button variant="secondary" size="sm" icon={RefreshCw} onClick={loadData} loading={loading}>
              Refresh
            </Button>
          </div>
        }
      />

      {loading && threads.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner size={24} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,500px)]">
          {/* ---- Left: Threads List or Detail ---- */}
          <div className="min-w-0">
            {selectedThread ? (
              <Card padding="none" className="overflow-hidden border-line-subtle shadow-md">
                <div className="flex items-center justify-between border-b border-line-subtle bg-raised/40 px-4 py-3">
                  <Button
                    variant="ghost"
                    size="xs"
                    icon={ArrowLeft}
                    onClick={() => setSelectedThreadId(null)}
                  >
                    All threads
                  </Button>
                  <span className="truncate text-xs font-semibold text-ink">
                    {selectedThread.title}
                  </span>
                  <Badge tone="brand">{selectedThread.messages.length} Messages</Badge>
                </div>
                <div className="max-h-[640px] overflow-y-auto">
                  <ThreadDetail thread={selectedThread} />
                </div>
              </Card>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-ink-muted">
                    <span className="font-semibold text-ink">{filteredThreads.length}</span> active thread{filteredThreads.length === 1 ? '' : 's'}
                  </p>
                  {selectedAgent && (
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-2xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors"
                    >
                      Filtered: {selectedAgent.displayName}
                      <X size={10} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                {filteredThreads.length === 0 ? (
                  <Card padding="none">
                    <EmptyState
                      icon={MessagesSquare}
                      title={selectedAgent ? 'No threads for this agent' : 'No message threads yet'}
                      description={
                        activeProcess
                          ? `Agents in "${activeProcess.name}" haven't exchanged messages yet.`
                          : 'Threads appear once autonomous agents begin collaborative handoffs.'
                      }
                    />
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredThreads.map((thread) => (
                      <ThreadCard
                        key={thread.id}
                        thread={thread}
                        selected={thread.id === selectedThreadId}
                        onClick={() => setSelectedThreadId(thread.id)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ---- Right: Message Flow Topology Graph ---- */}
          <div className="min-w-0 space-y-4">
            <Card padding="none" className="overflow-hidden border-line-subtle shadow-md">
              <CardHeader
                bordered
                icon={Network}
                title="Message Flow Network"
                description={`${nodes.length} agents · ${edges.length} active links`}
              />
              <div className="relative h-[430px] bg-grid">
                {nodes.length === 0 ? (
                  <div className="absolute inset-0 grid place-items-center">
                    <EmptyState
                      compact
                      icon={Network}
                      title="No message flow yet"
                      description="Links appear as agents exchange messages."
                    />
                  </div>
                ) : (
                  <ForceGraph
                    nodes={graphNodes}
                    edges={graphEdges}
                    selectedId={selectedNodeId}
                    onSelect={setSelectedNodeId}
                    width={500}
                    height={430}
                  />
                )}
              </div>
            </Card>

            {selectedAgent && (
              <Card className="border-line-subtle shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar
                    name={selectedAgent.displayName}
                    emoji={selectedAgent.avatar}
                    size="md"
                    status={agentStatusTone[selectedAgent.status as AgentStatus]}
                    statusLabel={agentStatusLabel[selectedAgent.status as AgentStatus]}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">
                      {selectedAgent.displayName}
                    </p>
                    <p className="truncate text-xs text-brand-600 dark:text-brand-400 font-medium">
                      {selectedAgent.processRole ?? selectedAgent.name}
                    </p>
                  </div>
                  <Badge tone={agentStatusTone[selectedAgent.status as AgentStatus]} dot>
                    {agentStatusLabel[selectedAgent.status as AgentStatus]}
                  </Badge>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
