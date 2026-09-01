import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { cn, timeAgo } from '@/lib/utils';
import type { Approval, Board, ApprovalStatus } from '@/types';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronRight,
  FileText,
  UserCheck,
  Filter,
  Check,
  ChevronDown,
  Layers,
  Sparkles,
  Bot,
  Activity,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { HourglassLoader } from '@/components/ui/HourglassLoader';
import { LiveWaveform } from '@/components/ui/LiveIcon';

// ─── Status Configuration ─────────────────────────────

const statusConfig: Record<ApprovalStatus, { color: string; bg: string; border: string; label: string; icon: typeof CheckCircle2 }> = {
  PENDING: {
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    label: 'Pending Review',
    icon: Clock,
  },
  APPROVED: {
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/25',
    label: 'Approved',
    icon: CheckCircle2,
  },
  REJECTED: {
    color: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    label: 'Rejected',
    icon: XCircle,
  },
};

interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// ─── Custom Select Dropdown ──────────────────────────

function CustomSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  icon: Icon,
}: {
  label: string;
  value: T;
  onChange: (val: T) => void;
  options: Array<{ value: T; label: string; count?: number }>;
  icon?: typeof Filter;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const selected = options.find((o) => o.value === value) ?? options[0];

  return (
    <div className="relative min-w-[150px]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'h-9 px-3 rounded-xl bg-inset border text-xs text-ink flex items-center justify-between gap-2 shadow-2xs transition-all cursor-pointer w-full',
          open ? 'border-brand-500 ring-2 ring-brand-500/10' : 'border-line hover:border-line-strong'
        )}
      >
        <div className="flex items-center gap-1.5 truncate">
          {Icon && <Icon size={12} className="text-brand-500 shrink-0" />}
          <span className="font-semibold text-ink truncate">{selected?.label}</span>
          {selected?.count !== undefined && (
            <span className="text-[10px] text-ink-muted font-mono bg-surface px-1.5 py-0.2 rounded border border-line-subtle">
              {selected.count}
            </span>
          )}
        </div>
        <ChevronDown size={13} className={cn('text-ink-muted shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 left-0 w-full min-w-[170px] rounded-xl bg-surface/95 backdrop-blur-xl border border-line shadow-xl p-1 space-y-0.5 animate-scale-in max-h-56 overflow-y-auto no-scrollbar">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
                  isSelected
                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                    : 'text-ink-muted hover:bg-hover hover:text-ink font-medium'
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <Check size={13} className="text-brand-500 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Approvals Component ────────────────────────

export function Approvals() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');
  const [boardFilter, setBoardFilter] = useState<string>('ALL');

  const fetchData = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (boardFilter !== 'ALL') params.boardId = boardFilter;

      const [approvalsData, statsData, boardsData] = await Promise.all([
        api.approvals.list(params).catch(() => []),
        api.approvals.stats().catch(() => null),
        api.boards.list().catch(() => []),
      ]);
      setApprovals(Array.isArray(approvalsData) ? approvalsData : []);
      setStats(statsData);
      setBoards(Array.isArray(boardsData) ? boardsData : []);
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, boardFilter]);

  // Real-time socket events & fallback polling interval
  useEffect(() => {
    fetchData();

    const socket = getSocket();
    const handleUpdate = () => fetchData(false);

    socket.on('approval:created', handleUpdate);
    socket.on('approval:resolved', handleUpdate);
    socket.on('approval:updated', handleUpdate);
    socket.on('run:awaiting-approval', handleUpdate);
    socket.on('gate:pending', handleUpdate);
    socket.on('gate:decided', handleUpdate);
    socket.on('activity:new', handleUpdate);

    setSocketConnected(socket.connected);
    const onConn = () => setSocketConnected(true);
    const onDis = () => setSocketConnected(false);
    socket.on('connect', onConn);
    socket.on('disconnect', onDis);

    // Auto-sync polling every 5s to guarantee fresh state
    const interval = setInterval(() => {
      fetchData(false);
    }, 5000);

    return () => {
      socket.off('approval:created', handleUpdate);
      socket.off('approval:resolved', handleUpdate);
      socket.off('approval:updated', handleUpdate);
      socket.off('run:awaiting-approval', handleUpdate);
      socket.off('gate:pending', handleUpdate);
      socket.off('gate:decided', handleUpdate);
      socket.off('activity:new', handleUpdate);
      socket.off('connect', onConn);
      socket.off('disconnect', onDis);
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    try {
      const updated = await api.approvals.approve(id);
      setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      const newStats = await api.approvals.stats().catch(() => null);
      if (newStats) setStats(newStats);
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const updated = await api.approvals.reject(id);
      setApprovals((prev) => prev.map((a) => (a.id === id ? updated : a)));
      const newStats = await api.approvals.stats().catch(() => null);
      if (newStats) setStats(newStats);
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const handleCreateTestApproval = async () => {
    try {
      setCreatingTest(true);
      let targetBoardId = boards[0]?.id;
      if (!targetBoardId) {
        const createdBoard = await api.boards.create({ name: 'Production Operations' });
        targetBoardId = createdBoard.id;
      }
      await api.approvals.create({
        boardId: targetBoardId,
        actionType: 'DEPLOY_CODE_RELEASE',
        confidence: 0.94,
        payload: {
          release: 'v1.4.2-production',
          trigger: 'Autonomous Multi-Agent CI/CD Chain',
          environment: 'production',
          automatedChecksPassed: 18,
          requiresHumanSignOff: true,
        },
      });
      await fetchData(false);
    } catch (err) {
      console.error('Failed to create test approval:', err);
    } finally {
      setCreatingTest(false);
    }
  };

  const statusOptions = [
    { value: 'ALL' as const, label: 'All Statuses', count: stats?.total },
    { value: 'PENDING' as const, label: 'Pending Review', count: stats?.pending },
    { value: 'APPROVED' as const, label: 'Approved', count: stats?.approved },
    { value: 'REJECTED' as const, label: 'Rejected', count: stats?.rejected },
  ];

  const boardOptions = [
    { value: 'ALL', label: 'All Boards' },
    ...boards.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        icon={ShieldCheck}
        title="Approvals & Audit Gate"
        description="Human-in-the-loop review pipeline and audit gate for sensitive autonomous agent executions"
        actions={
          <div className="flex items-center gap-2">
            <Badge tone={socketConnected ? 'success' : 'neutral'} dot pulse={socketConnected}>
              {socketConnected ? 'Live Real-Time' : 'Offline'}
            </Badge>
            <Button
              variant="secondary"
              size="xs"
              icon={RefreshCw}
              loading={refreshing}
              onClick={() => fetchData(true)}
              aria-label="Refresh approvals"
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="xs"
              icon={Plus}
              loading={creatingTest}
              onClick={handleCreateTestApproval}
            >
              Simulate Request
            </Button>
          </div>
        }
      />

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="rounded-2xl border border-line-subtle bg-surface p-4.5 shadow-2xs hover:border-line-strong hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-ink-muted">Total Reviews</span>
            <div className="w-8 h-8 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 flex items-center justify-center">
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-ink tracking-tight font-mono">
            {stats?.total ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Historical audit submissions</p>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-surface p-4.5 shadow-2xs hover:border-amber-500/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Pending Action</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Clock size={16} className={stats?.pending ? 'animate-pulse' : ''} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-amber-600 dark:text-amber-400">
            {stats?.pending ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Awaiting human sign-off</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-surface p-4.5 shadow-2xs hover:border-emerald-500/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Approved</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-emerald-600 dark:text-emerald-400">
            {stats?.approved ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Verified & executed</p>
        </div>

        <div className="rounded-2xl border border-rose-500/20 bg-surface p-4.5 shadow-2xs hover:border-rose-500/40 hover:shadow-xs transition-all">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Rejected</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center justify-center">
              <XCircle size={16} />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold tracking-tight font-mono text-rose-600 dark:text-rose-400">
            {stats?.rejected ?? 0}
          </div>
          <p className="text-[11px] text-ink-muted mt-1 font-medium">Blocked by reviewers</p>
        </div>
      </div>

      {/* Filter Toolbar Container */}
      <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1">
              <Filter size={12} className="text-brand-500" />
              Filter By:
            </span>

            <CustomSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
            />

            <CustomSelect
              label="Board"
              value={boardFilter}
              onChange={setBoardFilter}
              options={boardOptions}
              icon={Layers}
            />
          </div>

          {stats && stats.pending > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span>{stats.pending} pending human review{stats.pending !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      </div>

      {/* Approval List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <HourglassLoader size={48} label="Loading approval queue..." />
        </div>
      ) : approvals.length === 0 ? (
        <div className="rounded-2xl border border-line-subtle bg-surface p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-2xs mb-3">
            <CheckCircle2 size={24} />
          </div>
          <h3 className="text-sm font-bold text-ink mb-1">No Approvals Pending</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto leading-relaxed">
            {statusFilter !== 'ALL'
              ? `No ${statusFilter.toLowerCase()} requests found matching the active filter.`
              : 'All autonomous agent actions have been resolved. Approvals will appear here when agents request human sign-off.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
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

// ─── Approval Item Card ──────────────────────────────

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
  const StatusIcon = style.icon;

  const handleActionClick = (action: 'approve' | 'reject') => {
    if (confirmAction === action) {
      if (action === 'approve') onApprove(approval.id);
      else onReject(approval.id);
      setConfirmAction(null);
    } else {
      setConfirmAction(action);
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-4.5 sm:p-5 transition-all shadow-2xs',
        isPending
          ? 'border-amber-500/30 bg-surface shadow-xs'
          : 'border-line-subtle bg-surface/80 hover:border-line-strong',
      )}
      onClick={() => confirmAction && setConfirmAction(null)}
    >
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        {/* Left Content */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Top Row: Status Badge + Action Type + Timestamp */}
          <div className="flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border',
                style.bg,
                style.border,
                style.color,
              )}
            >
              <StatusIcon size={11} />
              {style.label}
            </span>

            <span className="text-xs font-mono font-bold text-ink bg-inset px-2.5 py-0.5 rounded-lg border border-line-subtle">
              {approval.actionType}
            </span>

            <span className="text-2xs font-mono font-medium text-ink-muted ml-auto shrink-0">
              {timeAgo(approval.createdAt)}
            </span>
          </div>

          {/* Context Details */}
          <div className="flex flex-wrap items-center gap-y-1.5 gap-x-4 text-xs font-medium">
            {approval.board && (
              <div className="flex items-center gap-1.5">
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

            {approval.task && (
              <div className="flex items-center gap-1.5 truncate max-w-sm">
                <span className="text-2xs font-bold text-ink-muted uppercase shrink-0">Task:</span>
                <span className="text-xs font-bold text-ink truncate">{approval.task.title}</span>
              </div>
            )}

            {approval.agent && (
              <div className="flex items-center gap-1.5">
                <span className="text-2xs font-bold text-ink-muted uppercase">Agent:</span>
                <span className="text-xs font-bold text-ink">{approval.agent.displayName}</span>
              </div>
            )}
          </div>

          {/* AI Confidence Meter */}
          {approval.confidence !== null && approval.confidence !== undefined && (
            <div className="max-w-xs space-y-1.5">
              <div className="flex items-center justify-between text-2xs font-bold">
                <span className="text-ink-muted uppercase">Model Confidence</span>
                <span className="text-ink font-mono font-bold">{Math.round(approval.confidence * 100)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-inset overflow-hidden border border-line-subtle">
                <div
                  className={cn('h-full rounded-full transition-all duration-300', {
                    'bg-emerald-500': approval.confidence >= 0.8,
                    'bg-amber-500': approval.confidence >= 0.5 && approval.confidence < 0.8,
                    'bg-rose-500': approval.confidence < 0.5,
                  })}
                  style={{ width: `${Math.round(approval.confidence * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Payload Details Accordion */}
          {approval.payload && (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPayloadExpanded(!payloadExpanded);
                }}
                className="flex items-center gap-1 text-2xs font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
              >
                <ChevronRight
                  size={12}
                  className={cn(
                    'transition-transform duration-200',
                    payloadExpanded && 'rotate-90',
                  )}
                />
                <span className="uppercase tracking-wider">Payload Inspector</span>
              </button>
              {payloadExpanded && (
                <pre className="mt-2 p-3.5 rounded-xl bg-inset border border-line text-xs text-ink font-mono overflow-x-auto max-h-48 overflow-y-auto shadow-2xs no-scrollbar">
                  {JSON.stringify(approval.payload, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Resolution Stamp */}
          {approval.resolvedAt && (
            <div className="text-[11px] text-ink-muted font-mono pt-0.5">
              Resolved {timeAgo(approval.resolvedAt)}
            </div>
          )}
        </div>

        {/* Action Buttons for Pending Items */}
        {isPending && (
          <div className="flex md:flex-col gap-2 shrink-0 self-end md:self-start pt-2 md:pt-0" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant={confirmAction === 'approve' ? 'primary' : 'secondary'}
              className={confirmAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10'}
              onClick={() => handleActionClick('approve')}
            >
              {confirmAction === 'approve' ? 'Confirm Approval' : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant={confirmAction === 'reject' ? 'primary' : 'secondary'}
              className={confirmAction === 'reject' ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10'}
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

