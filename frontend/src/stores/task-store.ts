import { create } from 'zustand';
import type { Task, TaskStatus } from '../types';
import { api } from '../lib/api';

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  fetchTasks: () => Promise<void>;
  addTask: (data: { title: string; description?: string; priority?: string; agentId?: string }) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  moveTask: (id: string, status: TaskStatus) => Promise<void>;
  setTask: (task: Task) => void;
  removeTask: (id: string) => void;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async () => {
    set({ loading: true });
    const tasks = await api.tasks.list();
    set({ tasks, loading: false });
  },

  addTask: async (data) => {
    const task = await api.tasks.create(data);
    set((state) => ({ tasks: [...state.tasks, task] }));
  },

  updateTask: async (id, data) => {
    const task = await api.tasks.update(id, data);
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  deleteTask: async (id) => {
    await api.tasks.delete(id);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },

  moveTask: async (id, status) => {
    const task = await api.tasks.update(id, { status });
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? task : t)) }));
  },

  setTask: (task) => {
    set((state) => {
      const exists = state.tasks.find((t) => t.id === task.id);
      if (exists) return { tasks: state.tasks.map((t) => (t.id === task.id ? task : t)) };
      return { tasks: [...state.tasks, task] };
    });
  },

  removeTask: (id) => {
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
  },
}));
