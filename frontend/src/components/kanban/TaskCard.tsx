import { Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, UserRound } from 'lucide-react';
import type { Task } from '../../types';
import { timeAgo, cn } from '../../lib/utils';
import { priorityTone, priorityLabel, tones } from '../../lib/design';
import { Avatar } from '../ui/Avatar';

export function TaskCard({
  task,
  index,
  onDelete,
}: {
  task: Task;
  index: number;
  onDelete: (id: string) => void;
}) {
  const pTone = tones[priorityTone[task.priority]];

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            'group mb-2.5 rounded-2xl border bg-surface p-3.5 shadow-2xs',
            'transition-all duration-150',
            snapshot.isDragging
              ? 'border-brand-500 bg-raised shadow-lg ring-2 ring-brand-500/20'
              : 'border-line-subtle hover:border-line-strong hover:bg-hover/30',
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-lg border px-2 py-0.5',
                'text-[10px] font-bold uppercase tracking-wider',
                pTone.soft,
                pTone.text,
              )}
            >
              {priorityLabel[task.priority]}
            </span>

            <div className="flex items-center gap-1">
              <GripVertical
                size={13}
                className="text-ink-muted opacity-40 group-hover:opacity-100 transition-opacity"
                aria-hidden
              />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                }}
                aria-label={`Delete task: ${task.title}`}
                className={cn(
                  'grid h-6 w-6 place-items-center rounded-lg text-ink-muted',
                  'hover:bg-rose-500/10 hover:text-rose-500 transition-colors cursor-pointer',
                )}
              >
                <Trash2 size={13} aria-hidden />
              </button>
            </div>
          </div>

          <h4 className="text-xs sm:text-[13px] font-bold leading-snug text-ink">{task.title}</h4>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-2xs leading-relaxed text-ink-muted font-medium">
              {task.description}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line-subtle pt-2.5">
            {task.agent ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Avatar
                  name={task.agent.displayName}
                  emoji={task.agent.avatar}
                  size="xs"
                />
                <span className="truncate text-[11px] font-semibold text-ink-muted">
                  {task.agent.displayName}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[11px] text-ink-faint font-mono">
                <UserRound size={11} aria-hidden />
                Unassigned
              </span>
            )}
            <time
              className="shrink-0 text-2xs font-mono text-ink-faint"
              dateTime={task.updatedAt}
            >
              {timeAgo(task.updatedAt)}
            </time>
          </div>
        </div>
      )}
    </Draggable>
  );
}
