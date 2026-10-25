import { create } from 'zustand';
import { api } from '../lib/api';
import type { Process, ProcessPlan, ProcessStats } from '../types';

const SCOPE_KEY = 'nexus:process-scope';

interface ProcessState {
  processes: Process[];
  stats: ProcessStats | null;
  loading: boolean;
  error: string | null;

  /**
   * The production currently being viewed. `null` means "all productions" and
   * is shared across Activity, Timeline, Topology and Comms, so switching
   * scope on one screen carries to the others.
   */
  scopeId: string | null;
  setScope: (id: string | null) => void;

  fetchProcesses: () => Promise<void>;
  fetchStats: () => Promise<void>;

  planProcess: (prompt: string, agentCount?: number, model?: string) => Promise<ProcessPlan>;
  createProcess: (data: {
    prompt: string;
    name?: string;
    agentCount?: number;
    plan?: ProcessPlan;
    githubToken?: string;
    vercelToken?: string;
    model?: string;
  }) => Promise<Process>;
  removeProcess: (id: string, deleteAgents?: boolean) => Promise<void>;
  /** Run controls — also refresh agent state, which start/pause mutates. */
  startProcess: (id: string) => Promise<void>;
  pauseProcess: (id: string) => Promise<void>;

  /** Applied from socket events. */
  upsertProcess: (p: Process) => void;
  dropProcess: (id: string) => void;
}

function readScope(): string | null {
  try {
    return localStorage.getItem(SCOPE_KEY) || null;
  } catch {
    return null;
  }
}

export const useProcessStore = create<ProcessState>((set, get) => ({
  processes: [],
  stats: null,
  loading: false,
  error: null,

  scopeId: readScope(),

  setScope: (id) => {
    try {
      if (id) localStorage.setItem(SCOPE_KEY, id);
      else localStorage.removeItem(SCOPE_KEY);
    } catch {
      /* non-fatal */
    }
    set({ scopeId: id });
  },

  fetchProcesses: async () => {
    set({ loading: true, error: null });
    try {
      const processes = await api.processes.list();
      // A stale scope (deleted production) would silently filter everything
      // to nothing — drop it instead.
      const { scopeId } = get();
      const stillExists = scopeId && processes.some((p) => p.id === scopeId);
      set({
        processes,
        loading: false,
        ...(scopeId && !stillExists ? { scopeId: null } : {}),
      });
    } catch (err) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  fetchStats: async () => {
    try {
      set({ stats: await api.processes.stats() });
    } catch {
      /* stats are decorative; never block the page on them */
    }
  },

  planProcess: (prompt, agentCount, model) => api.processes.plan(prompt, agentCount, model),

  createProcess: async (data) => {
    const created = await api.processes.create(data);
    set((s) => ({ processes: [created, ...s.processes], scopeId: created.id }));
    get().fetchStats();
    // Automatically trigger the multi-agent production chain immediately
    try {
      await api.processes.run(created.id);
    } catch {
      // Non-fatal if already running
    }
    return created;
  },

  startProcess: async (id) => {
    const updated = await api.processes.start(id);
    get().upsertProcess(updated);
    get().fetchStats();
  },

  pauseProcess: async (id) => {
    const updated = await api.processes.pause(id);
    get().upsertProcess(updated);
    get().fetchStats();
  },

  removeProcess: async (id, deleteAgents = false) => {
    await api.processes.remove(id, deleteAgents);
    set((s) => ({
      processes: s.processes.filter((p) => p.id !== id),
      scopeId: s.scopeId === id ? null : s.scopeId,
    }));
    get().fetchStats();
  },

  upsertProcess: (p) =>
    set((s) => {
      const idx = s.processes.findIndex((x) => x.id === p.id);
      if (idx === -1) return { processes: [p, ...s.processes] };
      const next = [...s.processes];
      next[idx] = { ...next[idx], ...p };
      return { processes: next };
    }),

  dropProcess: (id) =>
    set((s) => ({
      processes: s.processes.filter((p) => p.id !== id),
      scopeId: s.scopeId === id ? null : s.scopeId,
    })),
}));
