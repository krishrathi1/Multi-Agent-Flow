import { useEffect, useMemo, useState } from 'react';
import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { KanbanSquare, Plus } from 'lucide-react';
import { Column } from '../components/kanban/Column';
import { AddTaskModal } from '../components/kanban/AddTaskModal';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/States';
import { useTaskStore } from '../stores/task-store';
import type { TaskStatus } from '../types';

const columns: TaskStatus[] = ['BACKLOG', 'ASSIGNED', 'IN_PROGRESS', 'REVIEW', 'DONE'];

export function KanbanBoard() {
  const { tasks, loading, fetchTasks, moveTask, addTask, deleteTask } = useTaskStore();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchTasks();
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

      {loading && tasks.length === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {columns.map((c) => (
            <Skeleton key={c} className="h-[420px] rounded-xl" />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          {/* Columns wrap on smaller screens rather than forcing a page-level
              horizontal scroll. */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {columns.map((status) => (
              <Column
                key={status}
                status={status}
                tasks={grouped[status] ?? []}
                onDelete={deleteTask}
              />
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
