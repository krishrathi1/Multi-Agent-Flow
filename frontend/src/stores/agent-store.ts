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
    const agents = await api.agents.list();
    set({ agents, loading: false });
  },

  fetchStats: async () => {
    const stats = await api.agents.stats();
    set({ stats });
  },

  fetchAgent: async (id: string) => {
    const agent = await api.agents.get(id);
    set({ selectedAgent: agent });
  },

  updateAgent: (updated) => {
    set((state) => ({
      agents: state.agents.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      selectedAgent: state.selectedAgent?.id === updated.id ? { ...state.selectedAgent, ...updated } : state.selectedAgent,
    }));
  },
}));
