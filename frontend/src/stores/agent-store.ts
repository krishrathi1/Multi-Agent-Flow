import { create } from 'zustand';
import type { Agent, AgentStats } from '../types';
import { api } from '../lib/api';

interface AgentStore {
  agents: Agent[];
  stats: AgentStats | null;
  selectedAgent: Agent | null;
  loading: boolean;
  fetchAgents: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchAgent: (id: string) => Promise<void>;
  updateAgent: (agent: Partial<Agent> & { id: string }) => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  agents: [],
  stats: null,
  selectedAgent: null,
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await api.agents.list();
      set({ agents, loading: false });
    } catch (err) {
      console.error('Failed to fetch agents:', err);
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await api.agents.stats();
      set({ stats });
    } catch (err) {
      console.error('Failed to fetch agent stats:', err);
      const agents = get().agents;
      set({
        stats: {
          total: agents.length,
          online: agents.filter((a) => a.status === 'ONLINE').length,
          idle: agents.filter((a) => a.status === 'IDLE').length,
          offline: agents.filter((a) => a.status === 'OFFLINE').length,
          error: agents.filter((a) => a.status === 'ERROR').length,
          recentActivities: 0,
          activeTasks: 0,
        },
      });
    }
  },

  fetchAgent: async (id: string) => {
    try {
      const agent = await api.agents.get(id);
      set({ selectedAgent: agent });
    } catch (err) {
      console.error('Failed to fetch agent details:', err);
    }
  },

  updateAgent: (updated) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      selectedAgent: state.selectedAgent?.id === updated.id ? { ...state.selectedAgent, ...updated } : state.selectedAgent,
    }));
  },
}));
