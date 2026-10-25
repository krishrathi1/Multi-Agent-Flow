import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { Board, BoardGroup } from '@/types';
import { LayoutGrid, Plus, ChevronRight, Users, CheckCircle, Calendar, ShieldCheck, Sparkles, Folder } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { HourglassLoader } from '@/components/ui/HourglassLoader';

const boardTypeStyles: Record<string, { badge: string; label: string }> = {
  goal: { badge: 'text-blue-700 dark:text-blue-300 bg-blue-500/15 border-blue-500/30', label: 'Goal' },
  sprint: { badge: 'text-purple-700 dark:text-purple-300 bg-purple-500/15 border-purple-500/30', label: 'Sprint' },
  continuous: { badge: 'text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border-emerald-500/30', label: 'Continuous' },
};

interface BoardWithGroup extends Board {
  boardGroup?: { id: string; name: string } | null;
}

interface CreateBoardData {
  name: string;
  description?: string;
  boardType?: string;
  objective?: string;
  targetDate?: string;
  maxAgents?: number;
  requireApprovalForDone?: boolean;
  boardGroupId?: string;
}

export function Boards() {
  const [boards, setBoards] = useState<BoardWithGroup[]>([]);
  const [groups, setGroups] = useState<BoardGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [boardsData, groupsData] = await Promise.all([
        api.boards.list(),
        api.boardGroups.list(),
      ]);
      setBoards(boardsData as BoardWithGroup[]);
      setGroups(groupsData);
    } catch (err) {
      console.error('Failed to load boards data:', err);
    } finally {
      setLoading(false);
    }
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <HourglassLoader size={48} label="Loading task boards..." />
      </div>
    );
  }

  async function handleCreateBoard(data: CreateBoardData) {
    try {
      const created = await api.boards.create(data as unknown as Record<string, unknown>);
      setBoards(prev => [created as BoardWithGroup, ...prev]);
      setShowCreateModal(false);
    } catch (err) {
      console.error('Failed to create board:', err);
    }
  }

  const groupedBoards = groups
    .map(group => ({
      group,
      boards: boards.filter(b => b.boardGroupId === group.id),
    }))
    .filter(g => g.boards.length > 0);

  const ungroupedBoards = boards.filter(b => !b.boardGroupId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Header title="Boards" subtitle="Organize agents and tasks into focused collaborative workstreams" />
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setShowCreateModal(true)}
        >
          Create Board
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-2xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 mx-auto flex items-center justify-center shadow-xs">
            <LayoutGrid size={24} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-ink">No Boards Configured Yet</h3>
            <p className="text-xs text-ink-muted leading-relaxed">
              Create your first board to start organizing autonomous agents, dispatching tasks, and tracking multi-agent progress.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => setShowCreateModal(true)}
          >
            Create First Board
          </Button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Grouped boards */}
          {groupedBoards.map(({ group, boards: groupBoards }) => (
            <div key={group.id} className="space-y-3">
              <button
                onClick={() => toggleGroup(group.id)}
                className="flex items-center gap-2.5 group w-full text-left py-1"
              >
                <ChevronRight
                  size={16}
                  className={cn(
                    'text-ink-muted transition-transform',
                    !collapsedGroups.has(group.id) && 'rotate-90',
                  )}
                />
                <Folder size={16} className="text-brand-600 dark:text-brand-400" />
                <h3 className="text-xs font-bold text-ink uppercase tracking-wider group-hover:text-brand-600 transition-colors">
                  {group.name}
                </h3>
                <span className="text-[10px] font-bold text-ink-muted bg-inset border border-line-subtle px-2 py-0.5 rounded-full">
                  {groupBoards.length}
                </span>
              </button>
              {!collapsedGroups.has(group.id) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupBoards.map(board => (
                    <BoardCard key={board.id} board={board} />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Ungrouped boards */}
          {ungroupedBoards.length > 0 && (
            <div className="space-y-3">
              {groupedBoards.length > 0 && (
                <h3 className="text-xs font-bold text-ink-muted uppercase tracking-wider">
                  Ungrouped Boards ({ungroupedBoards.length})
                </h3>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {ungroupedBoards.map(board => (
                  <BoardCard key={board.id} board={board} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Board Modal */}
      {showCreateModal && (
        <CreateBoardModal
          groups={groups}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateBoard}
        />
      )}
    </div>
  );
}

function BoardCard({ board }: { board: BoardWithGroup }) {
  const typeStyle = boardTypeStyles[board.boardType || 'goal'] || boardTypeStyles.goal;

  return (
    <Link
      to={`/boards/${board.id}`}
      className="bg-surface border border-line hover:border-brand-500/50 rounded-2xl p-5 shadow-2xs transition-all hover:shadow-md flex flex-col justify-between space-y-4 group"
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold text-ink group-hover:text-brand-600 transition-colors truncate">
            {board.name}
          </h4>
          <span className={cn('px-2 py-0.5 text-[10px] font-bold uppercase rounded-full border shrink-0', typeStyle.badge)}>
            {typeStyle.label}
          </span>
        </div>

        {board.description && (
          <p className="text-xs text-ink-muted line-clamp-2 leading-relaxed">
            {board.description}
          </p>
        )}
      </div>

      <div className="pt-3 border-t border-line-subtle flex items-center justify-between text-2xs text-ink-muted font-medium">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Users size={12} className="text-ink-faint" />
            <span>Max {board.maxAgents || 3}</span>
          </span>
          {board.requireApprovalForDone && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <ShieldCheck size={12} />
              <span>Approvals</span>
            </span>
          )}
        </div>
        <span className="text-ink-faint">{timeAgo(board.createdAt)}</span>
      </div>
    </Link>
  );
}

function CreateBoardModal({
  groups,
  onClose,
  onSubmit,
}: {
  groups: BoardGroup[];
  onClose: () => void;
  onSubmit: (data: CreateBoardData) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [boardType, setBoardType] = useState('goal');
  const [objective, setObjective] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [maxAgents, setMaxAgents] = useState(3);
  const [requireApprovalForDone, setRequireApprovalForDone] = useState(true);
  const [boardGroupId, setBoardGroupId] = useState('');
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      boardType,
      objective: objective.trim() || undefined,
      targetDate: targetDate || undefined,
      maxAgents,
      requireApprovalForDone,
      boardGroupId: boardGroupId || undefined,
    });
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-line rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold uppercase tracking-wider text-ink">Create New Board</h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
              Board Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500"
              placeholder="e.g. SRE Production Incident Stream"
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500 h-16 resize-none"
              placeholder="What is this board designed to coordinate..."
            />
          </div>

          {/* Board Type + Board Group */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Board Type
              </label>
              <CustomSelect
                value={boardType}
                onChange={(val) => setBoardType(val)}
                options={[
                  { value: 'goal', label: 'Goal Oriented' },
                  { value: 'sprint', label: 'Sprint Timeline' },
                  { value: 'continuous', label: 'Continuous Ops' },
                ]}
              />
            </div>

            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Board Group
              </label>
              <CustomSelect
                value={boardGroupId}
                onChange={(val) => setBoardGroupId(val)}
                options={[
                  { value: '', label: 'None (Top Level)' },
                  ...groups.map((g) => ({ value: g.id, label: g.name })),
                ]}
              />
            </div>
          </div>

          {/* Objective */}
          <div>
            <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
              Objective & Outcome
            </label>
            <input
              type="text"
              value={objective}
              onChange={e => setObjective(e.target.value)}
              className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2.5 text-xs text-ink placeholder:text-ink-faint shadow-2xs focus:outline-none focus:border-brand-500"
              placeholder="What specific outcome should agents achieve..."
            />
          </div>

          {/* Target Date + Max Agents */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Target Date
              </label>
              <input
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink shadow-2xs focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1.5 block">
                Max Agents Assigned
              </label>
              <input
                type="number"
                value={maxAgents}
                onChange={e => setMaxAgents(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
                className="w-full bg-canvas border border-line rounded-xl px-3.5 py-2 text-xs text-ink shadow-2xs focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Require Approval Toggle */}
          <div className="flex items-center justify-between px-3.5 py-3 rounded-xl bg-inset border border-line">
            <div>
              <span className="text-xs font-bold text-ink block">Require Human Review for Done</span>
              <p className="text-2xs text-ink-muted mt-0.5">Tasks must be approved before finalizing</p>
            </div>
            <button
              type="button"
              onClick={() => setRequireApprovalForDone(!requireApprovalForDone)}
              className={cn(
                'relative w-9 h-5 rounded-full transition-colors shrink-0',
                requireApprovalForDone ? 'bg-brand-600' : 'bg-canvas border border-line',
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-xs transition-transform',
                  requireApprovalForDone ? 'translate-x-4.5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-line-subtle">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Creating...' : 'Create Board'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
