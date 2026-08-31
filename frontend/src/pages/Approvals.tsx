import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { api } from '@/lib/api';
import { cn, timeAgo } from '@/lib/utils';
import type { Approval, Board, ApprovalStatus } from '@/types';
import { ShieldCheck, CheckCircle2, XCircle, Clock, AlertTriangle, ChevronRight, FileText, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// ─── Status Styling ──────────────────────────────────

const statusConfig: Record<ApprovalStatus, { color: string; bg: string; border: string; label: string }> = {
  PENDING: { color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-500/15', border: 'border-amber-500/30', label: 'Pending' },
  APPROVED: { color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', label: 'Approved' },
  REJECTED: { color: 'text-rose-700 dark:text-rose-300', bg: 'bg-rose-500/15', border: 'border-rose-500/30', label: 'Rejected' },
};

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// ─── Main Component ──────────────────────────────────

export function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');
  const [boardFilter, setBoardFilter] = useState<string>('ALL');

  const fetchData = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (boardFilter !== 'ALL') params.boardId = boardFilter;

      const [approvalsData, statsData, boardsData] = await Promise.all([
        api.approvals.list(params),
        api.approvals.stats(),
        api.boards.list(),
      ]);
      setApprovals(approvalsData);
      setStats(statsData);
      setBoards(boardsData);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, boardFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    try {
      const updated = await api.approvals.approve(id);
      setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      const newStats = await api.approvals.stats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await api.approvals.reject(id);
      setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      const newStats = await api.approvals.stats();
      setStats(newStats);
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Header title="Approvals" subtitle="Review and approve autonomous agent action requests" />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="Approvals" subtitle="Review and approve autonomous agent action requests" />

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total Reviews" count={stats.total} color="text-ink" bg="bg-surface" border="border-line" />
          <StatCard
            label="Pending Action"
            count={stats.pending}
            color="text-amber-700 dark:text-amber-300"
            bg="bg-amber-500/10"
            border="border-amber-500/30"
            pulse={stats.pending > 0}
          />
          <StatCard label="Approved" count={stats.approved} color="text-emerald-700 dark:text-emerald-300" bg="bg-emerald-500/10" border="border-emerald-500/30" />
          <StatCard label="Rejected" count={stats.rejected} color="text-rose-700 dark:text-rose-300" bg="bg-rose-500/10" border="border-rose-500/30" />
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-line rounded-2xl p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">Filters:</span>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'ALL')}
            className="text-xs font-semibold bg-canvas border border-line text-ink rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 shadow-2xs"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Board filter */}
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            className="text-xs font-semibold bg-canvas border border-line text-ink rounded-xl px-3 py-1.5 focus:outline-none focus:border-brand-500 shadow-2xs"
          >
            <option value="ALL">All Boards</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>
        </div>

        {/* Pending count badge */}
        {stats && stats.pending > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>
              {stats.pending} pending human review{stats.pending !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      {/* Approval List */}
      {approvals.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-base font-bold text-ink">No Pending Approvals</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
            {statusFilter !== 'ALL'
              ? `No ${statusFilter.toLowerCase()} approvals found matching the selected filters.`
              : 'There are no approvals to review right now. Approvals will appear here when agents request human review before sensitive actions.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────

function StatCard({
  label,
  count,
  color,
  bg,
  border,
  pulse,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
  border: string;
  pulse?: boolean;
}) {
  return (
    <div className={cn('rounded-2xl border p-4 shadow-2xs flex flex-col justify-between space-y-2', bg, border)}>
      <div className="flex items-center gap-2">
        {pulse && <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
        <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted">{label}</span>
      </div>
      <span className={cn('text-2xl font-bold font-mono', color)}>{count}</span>
    </div>
  );
}

// ─── Approval Card ───────────────────────────────────

function ApprovalCard({
  approval,
  onApprove,
  onReject,
}: {
  approval: Approval;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const [payloadExpanded, setPayloadExpanded] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'approve' | 'reject' | null>(null);

  const style = statusConfig[approval.status];
  const isPending = approval.status === 'PENDING';

  const handleActionClick = (action: 'approve' | 'reject') => {
    if (confirmAction === action) {
      if (action === 'approve') onApprove(approval.id);
      else onReject(approval.id);
      setConfirmAction(null);
    } else {
      setConfirmAction(action);
    }
  };

  const handleCardClick = () => {
    if (confirmAction) setConfirmAction(null);
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-5 transition-all shadow-2xs',
        isPending ? 'border-line-strong bg-surface' : 'border-line bg-surface/70',
      )}
      onClick={handleCardClick}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Top row: status badge + action type + timestamp */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                'px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                style.bg,
                style.border,
                style.color,
              )}
            >
              {style.label}
            </span>

            <span className="text-xs font-mono font-bold text-ink bg-inset px-2.5 py-0.5 rounded-md border border-line-subtle">
              {approval.actionType}
            </span>

            <span className="text-2xs font-medium text-ink-muted ml-auto shrink-0">{timeAgo(approval.createdAt)}</span>
          </div>

          {/* Board link */}
          {approval.board && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-2xs font-bold text-ink-muted uppercase">Board:</span>
              <Link
                to={`/boards/${approval.boardId}`}
                className="font-bold text-brand-600 dark:text-brand-400 hover:underline transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {approval.board.name}
              </Link>
            </div>
          )}

          {/* Task title */}
          {approval.task && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-2xs font-bold text-ink-muted uppercase">Task:</span>
              <span className="text-xs font-bold text-ink truncate">{approval.task.title}</span>
            </div>
          )}

          {/* Agent info */}
          {approval.agent && (
            <div className="flex items-center gap-2">
              <span className="text-2xs font-bold text-ink-muted uppercase">Agent:</span>
              {approval.agent.avatar ? (
                <img
                  src={approval.agent.avatar}
                  alt={approval.agent.displayName}
                  className="w-5 h-5 rounded-full border border-line"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                  <span className="text-[10px] text-brand-700 dark:text-brand-300 font-bold">
                    {approval.agent.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs font-semibold text-ink">{approval.agent.displayName}</span>
            </div>
          )}

          {/* Confidence score */}
          {approval.confidence !== null && approval.confidence !== undefined && (
            <div className="max-w-xs space-y-1">
              <div className="flex items-center justify-between text-2xs font-bold">
                <span className="text-ink-muted uppercase">AI Confidence</span>
                <span className="text-ink font-mono">{Math.round(approval.confidence * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-inset overflow-hidden border border-line-subtle">
                <div
                  className={cn('h-full rounded-full transition-all', {
                    'bg-emerald-500': approval.confidence >= 0.8,
                    'bg-amber-500': approval.confidence >= 0.5 && approval.confidence < 0.8,
                    'bg-rose-500': approval.confidence < 0.5,
                  })}
                  style={{ width: `${Math.round(approval.confidence * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Payload preview */}
          {approval.payload && (
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPayloadExpanded(!payloadExpanded);
                }}
                className="flex items-center gap-1 text-2xs font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    'transition-transform',
                    payloadExpanded && 'rotate-90',
                  )}
                />
                <span className="uppercase tracking-wider">Payload Details</span>
              </button>
              {payloadExpanded && (
                <pre className="mt-2 p-3.5 rounded-xl bg-canvas border border-line text-xs text-ink font-mono overflow-x-auto max-h-48 overflow-y-auto shadow-2xs">
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Resolved timestamp */}
          {approval.resolvedAt && (
            <div className="text-2xs text-ink-muted font-medium pt-1">
              Resolved {timeAgo(approval.resolvedAt)}
            </div>
          )}
        </div>

        {/* Right: Action buttons for pending items */}
        {isPending && (
          <div className="flex md:flex-col gap-2 shrink-0 self-end md:self-start" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={confirmAction === 'approve' ? 'primary' : 'secondary'}
              className={confirmAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'text-emerald-700 dark:text-emerald-300 border-emerald-500/30'}
              onClick={() => handleActionClick('approve')}
            >
              {confirmAction === 'approve' ? 'Confirm Approval' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant={confirmAction === 'reject' ? 'primary' : 'secondary'}
              className={confirmAction === 'reject' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'text-rose-700 dark:text-rose-300 border-rose-500/30'}
              onClick={() => handleActionClick('reject')}
            >
              {confirmAction === 'reject' ? 'Confirm Reject' : 'Reject'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
