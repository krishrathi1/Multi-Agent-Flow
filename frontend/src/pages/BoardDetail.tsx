import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CustomSelect } from '@/components/ui/CustomSelect';
import type { Board, Task, TaskStatus, Agent } from '@/types';

const COLUMNS: TaskStatus[] = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];

const columnConfig: Record<TaskStatus, { label: string; bg: string; border: string; dot: string }> = {
  BACKLOG: { label: 'Backlog', bg: 'bg-gray-500/5', border: 'border-gray-500/20', dot: 'bg-gray-500' },
  ASSIGNED: { label: 'Assigned', bg: 'bg-blue-500/5', border: 'border-blue-500/20', dot: 'bg-blue-500' },
  IN_PROGRESS: { label: 'In Progress', bg: 'bg-violet-500/5', border: 'border-violet-500/20', dot: 'bg-violet-500' },
  REVIEW: { label: 'Review', bg: 'bg-amber-500/5', border: 'border-amber-500/20', dot: 'bg-amber-500' },
  DONE: { label: 'Done', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', dot: 'bg-emerald-500' },
};

const priorityBadge: Record<string, string> = {
  LOW: 'text-gray-400 bg-gray-500/10',
  MEDIUM: 'text-blue-400 bg-blue-500/10',
  HIGH: 'text-amber-400 bg-amber-500/10',
  CRITICAL: 'text-red-400 bg-red-500/10',
};

const boardTypeBadge: Record<string, { className: string; label: string }> = {
  goal: { className: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Goal' },
  sprint: { className: 'text-violet-400 bg-violet-500/10 border-violet-500/20', label: 'Sprint' },
  continuous: { className: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Continuous' },
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
        agentId: undefined,
      });
      // Also update board association via task update if needed
      setTasks(prev => [...prev, { ...task, status }]);
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
      <div className="flex items-center gap-2 text-sm text-gray-500 pt-6 mb-2">
        <Link to="/boards" className="hover:text-white transition-colors">Boards</Link>
        <span>/</span>
        <span className="text-white">{board.name}</span>
      </div>

      {/* Board header card */}
      <div className="rounded-xl border border-white/5 bg-surface-850 p-5 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-white">{board.name}</h2>
              <span
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border',
                  btStyle.className
                )}
              >
                {btStyle.label}
              </span>
            </div>
            {board.objective && (
              <p className="text-sm text-nexus-400 mt-1">{board.objective}</p>
            )}
            {board.description && (
              <p className="text-xs text-gray-500 mt-1">{board.description}</p>
            )}
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
          >
            {showSettings ? 'Close Settings' : 'Settings'}
          </button>
        </div>

        {/* Progress + stats row */}
        <div className="flex items-center gap-6">
          {/* Progress bar */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Progress</span>
              <span className="text-xs text-white font-medium">{progressPct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-nexus-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4">
            <div className="text-center px-3">
              <div className="text-lg font-bold text-white">{totalTasks}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Tasks</div>
            </div>
            <div className="text-center px-3">
              <div className="text-lg font-bold text-emerald-400">{doneTasks}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Done</div>
            </div>
            <div className="text-center px-3">
              <div className="text-lg font-bold text-white">{agents.length}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wider">Agents</div>
            </div>
            {board.targetDate && (
              <div className="text-center px-3">
                <div className="text-sm font-medium text-white">
                  {new Date(board.targetDate).toLocaleDateString()}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">Target</div>
              </div>
            )}
          </div>
        </div>

        {/* Agent avatars bar */}
        {agents.length > 0 && (
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-white/5">
            <span className="text-xs text-gray-500 mr-1">Agents:</span>
            {agents.map(agent => (
              <div
                key={agent.id}
                className="relative group"
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full bg-surface-900 border border-white/10 flex items-center justify-center text-sm',
                    agent.isBoardLead && 'ring-2 ring-nexus-500/50'
                  )}
                >
                  {agent.avatar || agent.displayName.charAt(0)}
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded bg-surface-900 border border-white/10 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
                  {agent.displayName}
                  {agent.isBoardLead && ' (Lead)'}
                </div>
              </div>
            ))}
            <button
              onClick={() => { setShowAddAgent(true); loadAllAgents(); }}
              className="w-8 h-8 rounded-full bg-white/5 border border-white/10 border-dashed flex items-center justify-center text-gray-500 hover:text-white hover:border-white/20 transition-colors text-sm"
            >
              +
            </button>
          </div>
        )}
        {agents.length === 0 && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => { setShowAddAgent(true); loadAllAgents(); }}
              className="text-xs text-gray-500 hover:text-nexus-400 transition-colors"
            >
              + Add agents to this board
            </button>
          </div>
        )}
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
        <div className="grid grid-cols-5 gap-4">
          {COLUMNS.map(status => {
            const col = columnConfig[status];
            const statusTasks = tasksByStatus(status);

            return (
              <div key={status} className={cn('rounded-xl border p-3 min-h-[400px]', col.bg, col.border)}>
                {/* Column header */}
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-2.5 h-2.5 rounded-full', col.dot)} />
                    <span className="text-sm font-semibold text-white">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                      {statusTasks.length}
                    </span>
                    <button
                      onClick={() => setShowAddTask(status)}
                      className="text-gray-600 hover:text-white transition-colors text-sm leading-none"
                      title="Add task"
                    >
                      +
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
                        'min-h-[300px] rounded-lg transition-colors p-1',
                        snapshot.isDraggingOver && 'bg-white/5'
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
                                'rounded-lg border p-3 mb-2 transition-all',
                                dragSnapshot.isDragging
                                  ? 'bg-surface-700 border-nexus-500/40 shadow-lg shadow-nexus-500/10 rotate-2'
                                  : 'bg-surface-850 border-white/5 hover:border-white/10'
                              )}
                            >
                              {/* Priority + delete */}
                              <div className="flex items-center justify-between mb-2">
                                <span
                                  className={cn(
                                    'text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider',
                                    priorityBadge[task.priority] || priorityBadge.MEDIUM
                                  )}
                                >
                                  {task.priority}
                                </span>
                                <button
                                  onClick={e => { e.stopPropagation(); handleDeleteTask(task.id); }}
                                  className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                                >
                                  &#10005;
                                </button>
                              </div>

                              {/* Title */}
                              <h4 className="text-sm font-medium text-white mb-1">{task.title}</h4>

                              {/* Description */}
                              {task.description && (
                                <p className="text-xs text-gray-500 mb-2 line-clamp-2">{task.description}</p>
                              )}

                              {/* Agent avatar */}
                              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                {task.agent ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs">{task.agent.avatar}</span>
                                    <span className="text-xs text-gray-400">{task.agent.displayName}</span>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-600">Unassigned</span>
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-850 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-4">
          Add Task to {colLabel}
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-nexus-500/50"
              placeholder="Task title..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Priority</label>
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

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface-850 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-white mb-4">Add Agent to Board</h3>

        {availableAgents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-gray-500 mb-4">All agents are already assigned to this board.</p>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Agent</label>
              <CustomSelect
                value={selectedAgent}
                onChange={(val) => setSelectedAgent(val)}
                placeholder="Select an agent..."
                options={availableAgents.map((a) => ({
                  value: a.id,
                  label: `${a.avatar} ${a.displayName}`,
                }))}
              />
            </div>

            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-900 border border-white/10">
              <div>
                <span className="text-sm text-white">Board Lead</span>
                <p className="text-xs text-gray-500 mt-0.5">This agent can delegate tasks to other board members</p>
              </div>
              <button
                type="button"
                onClick={() => setIsLead(!isLead)}
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  isLead ? 'bg-nexus-600' : 'bg-white/10'
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                    isLead ? 'translate-x-5' : 'translate-x-0.5'
                  )}
                />
              </button>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!selectedAgent}
                className="px-4 py-2 bg-nexus-600 hover:bg-nexus-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
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
    <div className="rounded-xl border border-white/5 bg-surface-850 p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Board Settings</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors text-sm"
        >
          &#10005;
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Objective */}
        <div className="col-span-2">
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Objective</label>
          <input
            type="text"
            value={objective}
            onChange={e => setObjective(e.target.value)}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-nexus-500/50"
            placeholder="Board objective..."
          />
        </div>

        {/* Target Date */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Target Date</label>
          <input
            type="date"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nexus-500/50"
          />
        </div>

        {/* Max Agents */}
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Max Agents</label>
          <input
            type="number"
            value={maxAgents}
            onChange={e => setMaxAgents(parseInt(e.target.value) || 1)}
            min={1}
            max={50}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nexus-500/50"
          />
        </div>
      </div>

      {/* Require approval toggle */}
      <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-surface-900 border border-white/10 mb-4">
        <div>
          <span className="text-sm text-white">Require approval for done</span>
          <p className="text-xs text-gray-500 mt-0.5">Tasks need manual approval before moving to Done</p>
        </div>
        <button
          type="button"
          onClick={() => setRequireApproval(!requireApproval)}
          className={cn(
            'relative w-10 h-5 rounded-full transition-colors',
            requireApproval ? 'bg-nexus-600' : 'bg-white/10'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
              requireApproval ? 'translate-x-5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>

      {/* Assigned agents */}
      {agents.length > 0 && (
        <div className="mb-4">
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Assigned Agents</label>
          <div className="space-y-2">
            {agents.map(agent => (
              <div
                key={agent.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg bg-surface-900 border border-white/10"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{agent.avatar || agent.displayName.charAt(0)}</span>
                  <span className="text-sm text-white">{agent.displayName}</span>
                  {agent.isBoardLead && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-nexus-600/20 text-nexus-400 font-medium uppercase tracking-wider">
                      Lead
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveAgent(agent.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors text-xs"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-medium bg-nexus-600 text-white hover:bg-nexus-500 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
