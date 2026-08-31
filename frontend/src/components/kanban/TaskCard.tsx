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
            'group mb-2 rounded-lg border bg-surface p-3',
            'transition-[border-color,box-shadow,background-color] duration-150',
            snapshot.isDragging
              ? // Lifted, not rotated — rotation reads as a glitch, not depth.
                'border-brand-500/45 bg-raised shadow-e3'
              : 'border-line-subtle hover:border-line-strong hover:bg-raised',
          )}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <span
              className={cn(
                'inline-flex h-5 items-center rounded-full border px-2',
                'text-2xs font-semibold uppercase tracking-[0.06em]',
                pTone.soft,
                pTone.text,
              )}
            >
              {priorityLabel[task.priority]}
            </span>

            <div className="flex items-center gap-0.5">
              <GripVertical
                size={13}
                strokeWidth={1.75}
                className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
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
                  'grid h-6 w-6 place-items-center rounded-sm text-ink-faint',
                  'opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100',
                  'hover:bg-red-500/12 hover:text-red-300 focus-visible:opacity-100',
                )}
              >
                <Trash2 size={13} strokeWidth={1.75} aria-hidden />
              </button>
            </div>
          </div>

          <h4 className="text-base font-medium leading-snug text-ink">{task.title}</h4>

          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-subtle">
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
                <span className="truncate text-xs text-ink-muted">
                  {task.agent.displayName}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-ink-faint">
                <UserRound size={12} strokeWidth={1.75} aria-hidden />
                Unassigned
              </span>
            )}
            <time
              className="shrink-0 text-2xs tabular-nums text-ink-faint"
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
