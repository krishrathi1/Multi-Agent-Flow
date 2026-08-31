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
      className="flex min-h-[420px] flex-col rounded-xl border border-line-subtle bg-inset"
      aria-label={`${taskStatusLabel[status]} — ${tasks.length} tasks`}
    >
      {/* Column headers stay neutral; only the dot carries status colour, so
          five columns side by side don't turn into a rainbow. */}
      <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', tone.solid)} aria-hidden />
          <h3 className="truncate text-sm font-semibold text-ink">
            {taskStatusLabel[status]}
          </h3>
        </div>
        <Chip>{tasks.length}</Chip>
      </div>

      <Droppable droppableId={status}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              'flex-1 rounded-b-xl p-2 transition-colors duration-150',
              snapshot.isDraggingOver && 'bg-brand-500/[0.06]',
            )}
          >
            {tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} index={index} onDelete={onDelete} />
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-8 text-center">
                <Inbox size={16} strokeWidth={1.5} className="text-ink-faint" aria-hidden />
                <p className="text-xs text-ink-faint">Drop tasks here</p>
              </div>
            )}
          </div>
        )}
      </Droppable>
    </section>
  );
}
