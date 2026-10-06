import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Header } from '@/components/layout/Header';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { Settings, Plus, X, Users, ArrowLeft } from 'lucide-react';
import type { Board, Task, TaskStatus, Agent } from '@/types';

const COLUMNS: TaskStatus[] = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];

const columnConfig: Record<TaskStatus, { label: string; bg: string; border: string; dot: string }> = {
  BACKLOG: { label: 'Backlog', bg: 'bg-surface/70', border: 'border-line', dot: 'bg-slate-400' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-blue-500/[0.04]', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-violet-500/[0.04]', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  REVIEW: { label: 'Review', bg: 'bg-amber-500/[0.04]', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  DONE: { label: 'Done', bg: 'bg-emerald-500/[0.04]', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

const priorityBadge: Record<string, string> = {
  LOW: 'text-slate-600 dark:text-slate-400 bg-slate-500/10 border-slate-500/20',
  MEDIUM: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20',
  HIGH: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20',
  CRITICAL: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
};

const boardTypeBadge: Record<string, { className: string; label: string }> = {
  goal: { className: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/25', label: 'Goal' },
  sprint: { className: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/25', label: 'Sprint' },
  continuous: { className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25', label: 'Continuous' },
};

interface BoardAgent {
  id: string;
  displayName: string;
  avatar: string | null;
  status: string;
  isBoardLead: boolean;
}

export function BoardDetail() {
  const { id } = useParams<{ id: string }>();
  const [board, setBoard] = useState<Board | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<BoardAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showAddTask, setShowAddTask] = useState<TaskStatus | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [allAgents, setAllAgents] = useState<Agent[]>([]);

  const loadBoard = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.boards.get(id);
      setBoard(data);
      setTasks(data.tasks || []);
      setAgents((data.agents || []) as BoardAgent[]);
    } catch (err) {
      console.error('Failed to load board:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // Keep this board live while a production is running. The app-level socket
  // store is useful elsewhere, but BoardDetail owns a board-scoped task list,
  // so it must apply task events directly to the visible board.
  useEffect(() => {
    const socket = getSocket();
    const onTaskUpdate = (task: Task) => {
      if (task.boardId !== id) return;
      setTasks((prev) => {
        const exists = prev.some((t) => t.id === task.id);
        return exists
          ? prev.map((t) => (t.id === task.id ? task : t))
          : [...prev, task];
      });
    };
    const onTaskDelete = ({ id: taskId }: { id: string }) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    };
    socket.on('task:update', onTaskUpdate);
    socket.on('task:delete', onTaskDelete);
    return () => {
      socket.off('task:update', onTaskUpdate);
      socket.off('task:delete', onTaskDelete);
    };
  }, [id]);

  const tasksByStatus = useCallback(
    (status: TaskStatus) => tasks.filter(t => t.status === status),
    [tasks]
  );

  async function handleDragEnd(result: DropResult) {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as TaskStatus;
    const taskId = result.draggableId;
    if (newStatus === result.source.droppableId) return;

    // Optimistic update
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    try {
      await api.tasks.update(taskId, { status: newStatus } as Partial<Task>);
    } catch {
      // Revert on failure
      loadBoard();
    }
  }

  async function handleAddTask(status: TaskStatus, title: string, priority: string) {
    try {
      const task = await api.tasks.create({
        title,
        priority,
        status,
        boardId: id,
        agentId: undefined,
      });
      setTasks(prev => [...prev, task]);
      setShowAddTask(null);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  }

  async function handleDeleteTask(taskId: string) {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      await api.tasks.delete(taskId);
    } catch {
      loadBoard();
    }
  }

  async function handleAddAgent(agentId: string, isLead: boolean) {
    if (!id) return;
    try {
      const agent = await api.boards.addAgent(id, { agentId, isLead });
      setAgents(prev => [...prev, agent as unknown as BoardAgent]);
      setShowAddAgent(false);
    } catch (err) {
      console.error('Failed to add agent:', err);
    }
  }

  async function handleRemoveAgent(agentId: string) {
    if (!id) return;
    setAgents(prev => prev.filter(a => a.id !== agentId));
    try {
      await api.boards.removeAgent(id, agentId);
    } catch {
      loadBoard();
    }
  }

  async function handleUpdateBoard(data: Record<string, unknown>) {
    if (!id) return;
    try {
      const updated = await api.boards.update(id, data);
      setBoard(updated);
    } catch (err) {
      console.error('Failed to update board:', err);
    }
  }

  async function loadAllAgents() {
    try {
      const data = await api.agents.list();
      setAllAgents(data);
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Board" subtitle="Loading..." />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-nexus-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div>
        <Header title="Board" subtitle="Not found" />
        <div className="rounded-xl border border-white/5 bg-surface-850 p-12 text-center">
          <h3 className="text-lg font-semibold text-white mb-1">Board Not Found</h3>
          <p className="text-sm text-gray-500 mb-4">This board may have been deleted.</p>
          <Link
            to="/boards"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors"
          >
            Back to Boards
          </Link>
        </div>
      </div>
    );
  }

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter(t => t.status === 'DONE').length;
  const progressPct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
  const btStyle = boardTypeBadge[board.boardType] || boardTypeBadge.goal;

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted pt-4 mb-3">
        <Link to="/boards" className="hover:text-ink transition-colors flex items-center gap-1">
          <ArrowLeft size={13} />
          <span>Boards</span>
        </Link>
        <span>/</span>
        <span className="text-ink font-bold">{board.name}</span>
      </div>

      {/* Board header card */}
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 mb-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-1.5">
              <h1 className="text-xl sm:text-2xl font-bold text-ink tracking-tight">{board.name}</h1>
              <span
                className={cn(
                  'text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider border shadow-2xs',
                  btStyle.className
                )}
              >
                {btStyle.label}
              </span>
            </div>
            {board.description && (
              <p className="text-xs text-ink-muted leading-relaxed max-w-3xl">{board.description}</p>
            )}
            {board.objective && (
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 mt-1 flex items-center gap-1.5">
                <span>🎯 Objective:</span>
                <span>{board.objective}</span>
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-surface border border-line text-ink hover:bg-hover hover:border-line-strong transition-all shadow-2xs cursor-pointer flex items-center gap-1.5 self-start shrink-0"
          >
            <Settings size={14} className="text-ink-muted" />
            <span>{showSettings ? 'Close Settings' : 'Settings'}</span>
          </button>
        </div>

        {/* Progress + stats row */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 pt-2 border-t border-line-subtle">
          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-ink-muted">Execution Progress</span>
              <span className="text-xs font-bold text-ink font-mono">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-inset overflow-hidden border border-line-subtle">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-indigo-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 overflow-x-auto pb-1 sm:pb-0">
            <div className="text-center px-3.5 py-2 rounded-xl bg-inset border border-line-subtle min-w-[72px]">
              <div className="text-base font-bold font-mono text-ink">{totalTasks}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Tasks</div>
            </div>
            <div className="text-center px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 min-w-[72px]">
              <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{doneTasks}</div>
              <div className="text-[10px] font-bold text-emerald-600/80 dark:text-emerald-400/80 uppercase tracking-wider">Done</div>
            </div>
            <div className="text-center px-3.5 py-2 rounded-xl bg-inset border border-line-subtle min-w-[72px]">
              <div className="text-base font-bold font-mono text-ink">{agents.length}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Agents</div>
            </div>
            {board.targetDate && (
              <div className="text-center px-3.5 py-2 rounded-xl bg-inset border border-line-subtle min-w-[80px]">
                <div className="text-xs font-bold font-mono text-ink">
                  {new Date(board.targetDate).toLocaleDateString()}
                </div>
                <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">Target</div>
              </div>
            )}
          </div>
        </div>

        {/* Agent avatars bar */}
        <div className="flex items-center gap-2.5 pt-3 border-t border-line-subtle flex-wrap">
          <span className="text-xs font-semibold text-ink-muted mr-1 flex items-center gap-1.5">
            <Users size={14} />
            <span>Assigned Agents:</span>
          </span>
          {agents.map(agent => (
            <div
              key={agent.id}
              className="relative group"
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-xl bg-inset border border-line flex items-center justify-center text-sm shadow-2xs transition-transform hover:scale-105',
                  agent.isBoardLead && 'ring-2 ring-brand-500 border-brand-500'
                )}
              >
                {agent.avatar || agent.displayName.charAt(0)}
              </div>
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-xl bg-surface border border-line text-xs font-semibold text-ink shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                {agent.displayName}
                {agent.isBoardLead && ' (Lead)'}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setShowAddAgent(true); loadAllAgents(); }}
            className="px-2.5 py-1.5 rounded-xl border border-dashed border-line hover:border-brand-500 hover:bg-hover text-xs font-semibold text-ink-muted hover:text-ink transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus size={13} className="text-brand-500" />
            <span>Add Agent</span>
          </button>
        </div>
      </div>

      {/* Settings sidebar */}
      {showSettings && (
        <BoardSettings
          board={board}
          agents={agents}
          onUpdate={handleUpdateBoard}
          onRemoveAgent={handleRemoveAgent}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Kanban board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {COLUMNS.map(status => {
            const col = columnConfig[status];
            const statusTasks = tasksByStatus(status);

            return (
              <div key={status} className={cn('rounded-2xl border p-3.5 min-h-[480px] shadow-2xs flex flex-col', col.bg, col.border)}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', col.dot)} />
                    <span className="text-xs font-bold text-ink uppercase tracking-wider">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold font-mono text-ink-muted bg-surface border border-line px-2 py-0.5 rounded-full shadow-2xs">
                      {statusTasks.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddTask(status)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-hover transition-colors text-xs font-bold cursor-pointer"
                      title="Add task"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </div>

                {/* Droppable area */}
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        'min-h-[350px] rounded-xl transition-colors p-1 flex-1 space-y-2',
                        snapshot.isDraggingOver && 'bg-brand-500/5 ring-1 ring-brand-500/20'
                      )}
                    >
                      {statusTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className={cn(
                                'rounded-xl border p-3 transition-all cursor-grab active:cursor-grabbing',
                                dragSnapshot.isDragging
                                  ? 'bg-surface border-brand-500 shadow-xl ring-2 ring-brand-500/20 rotate-1'
                                  : 'bg-surface border-line hover:border-line-strong hover:shadow-xs shadow-2xs'
                              )}
                            >
                              {/* Priority + delete */}
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border',
                                    priorityBadge[task.priority] || priorityBadge.MEDIUM
                                  )}
                                >
                                  {task.priority}
                                </span>
                                <button
                                  type="button"
                                  onClick={e => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                  className="text-ink-muted hover:text-rose-500 transition-colors p-1 rounded-md hover:bg-hover cursor-pointer"
                                  title="Delete task"
                                >
                                  <X size={12} />
                                </button>
                              </div>

                              {/* Title */}
                              <h4 className="text-xs font-bold text-ink leading-snug mb-1">{task.title}</h4>

                              {/* Description */}
                              {task.description && (
                                <p className="text-[11px] text-ink-muted mb-2.5 line-clamp-2 leading-relaxed">{task.description}</p>
                              )}

                              {/* Agent avatar footer */}
                              <div className="flex items-center justify-between pt-2 border-t border-line-subtle text-[11px]">
                                {task.agent ? (
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-xs shrink-0">{task.agent.avatar || '🤖'}</span>
                                    <span className="font-semibold text-ink truncate max-w-[120px]">{task.agent.displayName}</span>
                                  </div>
                                ) : (
                                  <span className="text-ink-muted italic">Unassigned</span>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Add task inline modal */}
      {showAddTask && (
        <AddTaskInline
          status={showAddTask}
          boardAgents={agents}
          onClose={() => setShowAddTask(null)}
          onSubmit={handleAddTask}
        />
      )}

      {/* Add agent modal */}
      {showAddAgent && (
        <AddAgentModal
          allAgents={allAgents}
          boardAgents={agents}
          onClose={() => setShowAddAgent(false)}
          onSubmit={handleAddAgent}
        />
      )}
    </div>
  );
}

// ─── Add Task Inline Modal ───────────────────────────

function AddTaskInline({
  status,
  boardAgents,
  onClose,
  onSubmit,
}: {
  status: TaskStatus;
  boardAgents: { id: string; displayName: string; avatar: string | null }[];
  onClose: () => void;
  onSubmit: (status: TaskStatus, title: string, priority: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState('MEDIUM');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(status, title.trim(), priority);
  }

  const colLabel = columnConfig[status].label;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-base font-bold text-ink">
            Add Task to {colLabel}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-inset border border-line rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
              placeholder="Task title..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Priority</label>
            <CustomSelect
              value={priority}
              onChange={(val) => setPriority(val)}
              options={[
                { value: 'LOW', label: 'Low' },
                { value: 'MEDIUM', label: 'Medium' },
                { value: 'HIGH', label: 'High' },
                { value: 'CRITICAL', label: 'Critical' },
              ]}
            />
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              Add Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Add Agent Modal ─────────────────────────────────

function AddAgentModal({
  allAgents,
  boardAgents,
  onClose,
  onSubmit,
}: {
  allAgents: Agent[];
  boardAgents: { id: string }[];
  onClose: () => void;
  onSubmit: (agentId: string, isLead: boolean) => void;
}) {
  const [selectedAgent, setSelectedAgent] = useState('');
  const [isLead, setIsLead] = useState(false);

  const boardAgentIds = new Set(boardAgents.map(a => a.id));
  const availableAgents = allAgents.filter(a => !boardAgentIds.has(a.id));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    onSubmit(selectedAgent, isLead);
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-3xl w-full max-w-md p-6 shadow-2xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h3 className="text-base font-bold text-ink">Add Agent to Board</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {availableAgents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs font-medium text-ink-muted mb-4">All available agents are already assigned to this board.</p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface border border-line text-ink hover:bg-hover transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Select Agent</label>
              <CustomSelect
                value={selectedAgent}
                onChange={(val) => setSelectedAgent(val)}
                placeholder="Select an agent..."
                options={availableAgents.map((a) => ({
                  value: a.id,
                  label: `${a.avatar || '🤖'} ${a.displayName}`,
                }))}
              />
            </div>

            <div className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-inset border border-line">
              <div>
                <span className="text-xs font-bold text-ink">Board Lead Role</span>
                <p className="text-[11px] text-ink-muted mt-0.5">This agent can direct & delegate tasks to other board members</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLead(!isLead)}
                className={cn(
                  'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
                  isLead ? 'bg-brand-600' : 'bg-line-strong'
                )}
              >
                <span
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-xs',
                    isLead ? 'translate-x-6' : 'translate-x-1'
                  )}
                />
              </button>
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedAgent}
                className="px-4.5 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                Add Agent
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Board Settings Panel ────────────────────────────

function BoardSettings({
  board,
  agents,
  onUpdate,
  onRemoveAgent,
  onClose,
}: {
  board: Board;
  agents: { id: string; displayName: string; avatar: string | null; isBoardLead: boolean }[];
  onUpdate: (data: Record<string, unknown>) => void;
  onRemoveAgent: (agentId: string) => void;
  onClose: () => void;
}) {
  const [objective, setObjective] = useState(board.objective || '');
  const [targetDate, setTargetDate] = useState(
    board.targetDate ? new Date(board.targetDate).toISOString().split('T')[0] : ''
  );
  const [maxAgents, setMaxAgents] = useState(board.maxAgents);
  const [requireApproval, setRequireApproval] = useState(board.requireApprovalForDone);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onUpdate({
      objective: objective.trim() || null,
      targetDate: targetDate || null,
      maxAgents,
      requireApprovalForDone: requireApproval,
    });
    setSaving(false);
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6 mb-6 shadow-xs space-y-4">
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h3 className="text-sm font-bold text-ink">Board Settings</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Objective */}
        <div className="sm:col-span-2">
          <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Objective</label>
          <input
            type="text"
            value={objective}
            onChange={e => setObjective(e.target.value)}
            className="w-full bg-inset border border-line rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink placeholder:text-ink-muted focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
            placeholder="Board objective..."
          />
        </div>

        {/* Target Date */}
        <div>
          <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full bg-inset border border-line rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
          />
        </div>

        {/* Max Agents */}
        <div>
          <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">Max Agents</label>
          <input
            type="number"
            value={maxAgents}
            onChange={e => setMaxAgents(parseInt(e.target.value) || 1)}
            min={1}
            max={50}
            className="w-full bg-inset border border-line rounded-xl px-3.5 py-2.5 text-xs font-semibold text-ink focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 shadow-2xs transition-all"
          />
        </div>
      </div>

      {/* Require approval toggle */}
      <div className="flex items-center justify-between px-3.5 py-3 rounded-2xl bg-inset border border-line">
        <div>
          <span className="text-xs font-bold text-ink">Require approval for Done status</span>
          <p className="text-[11px] text-ink-muted mt-0.5">Tasks need human review & approval before transitioning to Done</p>
        </div>
        <button
          type="button"
          onClick={() => setRequireApproval(!requireApproval)}
          className={cn(
            'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
            requireApproval ? 'bg-brand-600' : 'bg-line-strong'
          )}
        >
          <span
            className={cn(
              'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-xs',
              requireApproval ? 'translate-x-6' : 'translate-x-1'
            )}
          />
        </button>
      </div>

      {/* Assigned agents */}
      {agents.length > 0 && (
        <div className="space-y-2">
          <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted block">Assigned Agents ({agents.length})</label>
          <div className="space-y-2">
            {agents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-inset border border-line"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{agent.avatar || '🤖'}</span>
                  <span className="text-xs font-bold text-ink">{agent.displayName}</span>
                  {agent.isBoardLead && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold uppercase tracking-wider border border-brand-500/20">
                      Lead
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveAgent(agent.id)}
                  className="text-xs font-semibold text-ink-muted hover:text-rose-500 transition-colors cursor-pointer p-1 rounded-md hover:bg-hover"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 rounded-xl text-xs font-bold bg-brand-600 text-white hover:bg-brand-500 transition-all shadow-xs cursor-pointer disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
