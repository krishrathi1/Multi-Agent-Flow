import { Droppable } from '@hello-pangea/dnd';
import { Inbox } from 'lucide-react';
import type { Task, TaskStatus } from '../../types';
import { TaskCard } from './TaskCard';
import { cn } from '../../lib/utils';
import { taskStatusTone, taskStatusLabel, tones } from '../../lib/design';
import { Chip } from '../ui/Badge';

export function Column({
  status,
  tasks,
  onDelete,
}: {
  status: TaskStatus;
  tasks: Task[];
  onDelete: (id: string) => void;
}) {
  const tone = tones[taskStatusTone[status] ?? 'neutral'];

  return (
    <section
      className="flex min-h-[220px] sm:min-h-[420px] flex-col rounded-3xl border border-line-subtle bg-surface sm:bg-inset/50 shadow-2xs"
      aria-label={`${taskStatusLabel[status]} — ${tasks.length} tasks`}
    >
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3.5 py-3 bg-surface/80 rounded-t-3xl">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.solid)} aria-hidden />
          <h3 className="truncate text-xs sm:text-sm font-bold text-ink">
            {taskStatusLabel[status]}
          </h3>
        </div>
        <span className="text-2xs font-mono font-bold text-ink-muted bg-inset px-2 py-0.5 rounded-full border border-line-subtle">
          {tasks.length}
        </span>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 rounded-b-3xl p-2.5 sm:p-3 transition-colors duration-150 overflow-y-auto no-scrollbar',
              'max-h-[560px] sm:max-h-[600px]',
              snapshot.isDraggingOver && 'bg-brand-500/5',
            )}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} onDelete={onDelete} />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-subtle px-3 py-6 text-center">
                <Inbox size={18} className="text-ink-faint opacity-40" aria-hidden />
                <p className="text-2xs text-ink-muted font-medium">No tasks in {taskStatusLabel[status]}</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
}
