import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanSquare, Plus } from 'lucide-react';
import { Column } from '../components/kanban/Column';
import { AddTaskModal } from '../components/kanban/AddTaskModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/States';
import { useTaskStore } from '../stores/task-store';
import { cn } from '../lib/utils';
import { taskStatusLabel, taskStatusTone, tones } from '../lib/design';
import type { TaskStatus } from '../types';

const columns: TaskStatus[] = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function KanbanBoard() {
  const { tasks, loading, fetchTasks, moveTask, addTask, deleteTask } = useTaskStore();
  const [showModal, setShowModal] = useState(false);
  const [activeMobileColumn, setActiveMobileColumn] = useState<TaskStatus | 'ALL'>('ALL');

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(() => {
      fetchTasks();
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchTasks]);

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const newStatus = result.destination.droppableId as TaskStatus;
    if (newStatus === result.source.droppableId) return;
    moveTask(result.draggableId, newStatus);
  };

  // Bucket once per task change instead of filtering the array five times.
  const grouped = useMemo(() => {
    const map = Object.fromEntries(columns.map((c) => [c, [] as typeof tasks])) as Record<
      TaskStatus,
      typeof tasks
    >;
    for (const task of tasks) map[task.status]?.push(task);
    return map;
  }, [tasks]);

  return (
    <>
      <PageHeader
        icon={KanbanSquare}
        title="Task Board"
        description="Drag tasks between columns to update their status."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
            New Task
          </Button>
        }
      />

      {/* Mobile Column Quick Filter Pills */}
      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:hidden">
        <button
          type="button"
          onClick={() => setActiveMobileColumn('ALL')}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all shadow-2xs cursor-pointer',
            activeMobileColumn === 'ALL'
              ? 'bg-brand-600 text-white'
              : 'border border-line bg-surface text-ink-muted hover:text-ink'
          )}
        >
          All ({tasks.length})
        </button>
        {columns.map((status) => {
          const count = grouped[status]?.length ?? 0;
          const isSelected = activeMobileColumn === status;
          const tone = tones[taskStatusTone[status] ?? 'neutral'];
          return (
            <button
              key={status}
              type="button"
              onClick={() => setActiveMobileColumn(status)}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all shadow-2xs cursor-pointer',
                isSelected
                  ? 'bg-brand-600 text-white'
                  : 'border border-line bg-surface text-ink-muted hover:text-ink'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : tone.solid)} />
              <span>{taskStatusLabel[status]}</span>
              <span className={cn('text-[10px] opacity-80', isSelected ? 'text-white' : 'text-ink-faint')}>({count})</span>
            </button>
          );
        })}
      </div>

      {loading && tasks.length === 0 ? (
        <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory">
          {columns.map((c) => (
            <Skeleton key={c} className="w-[82vw] sm:w-auto shrink-0 snap-center h-[440px] rounded-xl" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* On Mobile: Horizontal snap scroll or single column tab view. On Desktop: Responsive multi-column grid */}
          <div
            className={cn(
              'sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5',
              activeMobileColumn === 'ALL'
                ? 'flex overflow-x-auto snap-x snap-mandatory pb-3 no-scrollbar'
                : 'flex flex-col'
            )}
          >
            {columns
              .filter((status) => activeMobileColumn === 'ALL' || activeMobileColumn === status)
              .map((status) => (
                <div
                  key={status}
                  className={cn(
                    activeMobileColumn === 'ALL'
                      ? 'w-[82vw] max-w-[340px] sm:max-w-none sm:w-auto shrink-0 snap-center'
                      : 'w-full'
                  )}
                >
                  <Column
                    status={status}
                    tasks={grouped[status] ?? []}
                    onDelete={deleteTask}
                  />
                </div>
              ))}
          </div>
        </DragDropContext>
      )}

      {showModal && (
        <AddTaskModal onClose={() => setShowModal(false)} onSubmit={addTask} />
      )}
    </>
  );
}
