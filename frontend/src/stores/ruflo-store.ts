import { create } from 'zustand';
import { api } from '../lib/api';

export interface SwarmAgentMember {
  id: string;
  name: string;
  role: string;
  status: string;
  capabilities: string[];
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    avgExecutionTimeMs: number;
    successRate: number;
  };
}

export interface SwarmMeshConnection {
  fromAgentId: string;
  toAgentId: string;
  latencyMs: number;
  weight: number;
  active: boolean;
}

export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star' | 'hybrid' | 'adaptive';
export type ConsensusProtocol = 'majority' | 'raft' | 'byzantine' | 'gossip';

export interface SwarmInstance {
  id: string;
  name: string;
  description: string;
  topology: SwarmTopology;
  consensusProtocol: ConsensusProtocol;
  leaderId?: string;
  members: SwarmAgentMember[];
  connections: SwarmMeshConnection[];
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConsensusProposal {
  id: string;
  swarmId: string;
  topic: string;
  payload: any;
  requiredQuorum: number;
  votes: Array<{
    agentId: string;
    agentName: string;
    vote: 'approve' | 'reject' | 'abstain';
    confidence: number;
    reasoning: string;
  }>;
  consensusReached: boolean;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface MemoryRecord {
  id: string;
  namespace: string;
  tier: 'working' | 'episodic' | 'semantic';
  content: string;
  vector: number[];
  tags: string[];
  accessCount: number;
  confidence: number;
  createdAt: string;
}

export interface GoalActionNode {
  id: string;
  name: string;
  description: string;
  agentRole: string;
  preconditions: Record<string, any>;
  effects: Record<string, any>;
  cost: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  executionTimeMs?: number;
  output?: any;
  error?: string;
  childrenIds?: string[];
}

export interface GoalPlan {
  id: string;
  title: string;
  rawGoal: string;
  initialState: Record<string, any>;
  targetState: Record<string, any>;
  nodes: GoalActionNode[];
  estimatedTotalCost: number;
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'replanning';
  currentStepIndex: number;
  progressPercent: number;
  createdAt: string;
}

export interface FederationPeer {
  id: string;
  name: string;
  endpoint: string;
  publicKey: string;
  trustLevel: 'untrusted' | 'probationary' | 'trusted' | 'verified' | 'quarantined';
  trustScore: number;
  metrics: {
    successCount: number;
    failureCount: number;
    uptimePercentage: number;
    threatIncidentCount: number;
    integrityChecksPassed: number;
  };
  piiPolicy: 'BLOCK' | 'REDACT' | 'HASH' | 'PASS';
  status: 'online' | 'offline' | 'degraded';
}

export interface NeuralPattern {
  id: string;
  patternType: string;
  name: string;
  description: string;
  triggerCondition: string;
  recommendedAction: string;
  confidence: number;
  occurrenceCount: number;
  improvementGainPercent: number;
  lastUsedAt: string;
}

export interface MetaHarnessAudit {
  id: string;
  timestamp: string;
  readinessScore: number;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  summary: string;
  categoryScores: {
    swarmArchitecture: number;
    memoryReliability: number;
    securityPosture: number;
    toolSafety: number;
    observabilityCoverage: number;
  };
  toolRisks: Array<{
    toolName: string;
    category: string;
    riskLevel: string;
    description: string;
    sandboxed: boolean;
    requiresApproval: boolean;
    recommendation: string;
  }>;
  complianceChecks: {
    soc2Compliant: boolean;
    hipaaReady: boolean;
    gdprPiiSanitized: boolean;
  };
}

export interface LoopWorker {
  id: string;
  name: string;
  type: string;
  intervalSeconds: number;
  status: 'running' | 'idle' | 'paused' | 'error';
  lastRunAt?: string;
  nextRunAt?: string;
  runsCompleted: number;
  lastOutcome?: string;
  enabled: boolean;
}

export interface RufloPersona {
  id: string;
  name: string;
  category: string;
  roleTitle: string;
  avatarIcon: string;
  description: string;
  systemSoul: string;
  tools: string[];
  capabilities: string[];
  recommendedModel: string;
}

interface RufloState {
  // Swarms
  swarms: SwarmInstance[];
  activeSwarm: SwarmInstance | null;
  proposals: ConsensusProposal[];
  isLoadingSwarms: boolean;

  // Vector Memory
  memoryNamespaces: Array<{ namespace: string; count: number; tiers: Record<string, number> }>;
  memoryRecords: MemoryRecord[];
  searchResults: Array<{ record: MemoryRecord; similarity: number; rank: number }>;
  isLoadingMemory: boolean;

  // Goals
  goals: GoalPlan[];
  activeGoal: GoalPlan | null;
  isLoadingGoals: boolean;

  // Federation
  peers: FederationPeer[];
  nodeInfo: any;
  federationAudit: any[];
  isLoadingFederation: boolean;

  // Neural Learning
  neuralPatterns: NeuralPattern[];
  learningStats: any;
  trajectories: any[];

  // MetaHarness
  metaAudit: MetaHarnessAudit | null;
  isLoadingAudit: boolean;

  // Loop Workers
  workers: LoopWorker[];

  // Personas
  personas: RufloPersona[];

  // Actions
  fetchSwarms: () => Promise<void>;
  updateTopology: (swarmId: string, topology: string) => Promise<void>;
  scaleSwarm: (swarmId: string, count: number) => Promise<void>;
  triggerConsensus: (swarmId: string, topic: string, payload?: any, protocol?: string) => Promise<ConsensusProposal>;
  
  fetchMemoryNamespaces: () => Promise<void>;
  searchMemory: (query: string, namespace?: string, tier?: string) => Promise<void>;
  storeMemory: (data: any) => Promise<void>;

  fetchGoals: () => Promise<void>;
  createGoalPlan: (goal: string, context?: string) => Promise<GoalPlan>;
  executeGoalStep: (id: string, stepIndex?: number) => Promise<void>;
  executeAllGoalSteps: (id: string) => Promise<void>;

  fetchFederation: () => Promise<void>;
  sendFederatedMessage: (recipientNodeId: string, messageType: string, payload: any) => Promise<any>;

  fetchLearning: () => Promise<void>;
  fetchMetaHarnessAudit: () => Promise<void>;
  fetchWorkers: () => Promise<void>;
  triggerWorker: (id: string) => Promise<void>;
  toggleWorker: (id: string, enabled: boolean) => Promise<void>;
  fetchPersonas: () => Promise<void>;
  deployPersona: (personaId: string, customName?: string) => Promise<any>;
}

export const useRufloStore = create<RufloState>((set, get) => ({
  swarms: [],
  activeSwarm: null,
  proposals: [],
  isLoadingSwarms: false,

  memoryNamespaces: [],
  memoryRecords: [],
  searchResults: [],
  isLoadingMemory: false,

  goals: [],
  activeGoal: null,
  isLoadingGoals: false,

  peers: [],
  nodeInfo: null,
  federationAudit: [],
  isLoadingFederation: false,

  neuralPatterns: [],
  learningStats: null,
  trajectories: [],

  metaAudit: null,
  isLoadingAudit: false,

  workers: [],
  personas: [],

  fetchSwarms: async () => {
    set({ isLoadingSwarms: true });
    try {
      const res = await api.ruflo.listSwarms();
      set({ swarms: res.swarms, activeSwarm: res.swarms[0] || null });
    } finally {
      set({ isLoadingSwarms: false });
    }
  },

  updateTopology: async (swarmId, topology) => {
    const res = await api.ruflo.updateTopology(swarmId, topology);
    set((state) => ({
      swarms: state.swarms.map((s) => (s.id === swarmId ? res.swarm : s)),
      activeSwarm: state.activeSwarm?.id === swarmId ? res.swarm : state.activeSwarm,
    }));
  },

  scaleSwarm: async (swarmId, count) => {
    const res = await api.ruflo.scaleSwarm(swarmId, count);
    set((state) => ({
      swarms: state.swarms.map((s) => (s.id === swarmId ? res.swarm : s)),
      activeSwarm: state.activeSwarm?.id === swarmId ? res.swarm : state.activeSwarm,
    }));
  },

  triggerConsensus: async (swarmId, topic, payload, protocol) => {
    const res = await api.ruflo.triggerConsensus(swarmId, { topic, payload, protocol });
    set((state) => ({
      proposals: [res.proposal, ...state.proposals],
    }));
    return res.proposal;
  },

  fetchMemoryNamespaces: async () => {
    set({ isLoadingMemory: true });
    try {
      const res = await api.ruflo.listMemoryNamespaces();
      const recs = await api.ruflo.listMemoryRecords({ limit: 50 });
      set({ memoryNamespaces: res.namespaces, memoryRecords: recs.records });
    } finally {
      set({ isLoadingMemory: false });
    }
  },

  searchMemory: async (query, namespace, tier) => {
    set({ isLoadingMemory: true });
    try {
      const res = await api.ruflo.searchMemory({ query, namespace, tier });
      set({ searchResults: res.results });
    } finally {
      set({ isLoadingMemory: false });
    }
  },

  storeMemory: async (data) => {
    await api.ruflo.storeMemory(data);
    await get().fetchMemoryNamespaces();
  },

  fetchGoals: async () => {
    set({ isLoadingGoals: true });
    try {
      const res = await api.ruflo.listGoals();
      set({ goals: res.plans, activeGoal: res.plans[0] || null });
    } finally {
      set({ isLoadingGoals: false });
    }
  },

  createGoalPlan: async (goal, context) => {
    set({ isLoadingGoals: true });
    try {
      const res = await api.ruflo.createGoalPlan({ goal, context });
      set((state) => ({
        goals: [res.plan, ...state.goals],
        activeGoal: res.plan,
      }));
      return res.plan;
    } finally {
      set({ isLoadingGoals: false });
    }
  },

  executeGoalStep: async (id, stepIndex) => {
    const res = await api.ruflo.executeGoalStep(id, stepIndex);
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? res.plan : g)),
      activeGoal: state.activeGoal?.id === id ? res.plan : state.activeGoal,
    }));
  },

  executeAllGoalSteps: async (id) => {
    const res = await api.ruflo.executeAllGoalSteps(id);
    set((state) => ({
      goals: state.goals.map((g) => (g.id === id ? res.plan : g)),
      activeGoal: state.activeGoal?.id === id ? res.plan : state.activeGoal,
    }));
  },

  fetchFederation: async () => {
    set({ isLoadingFederation: true });
    try {
      const res = await api.ruflo.listPeers();
      const audit = await api.ruflo.listFederationAudit(30);
      set({ peers: res.peers, nodeInfo: res.nodeInfo, federationAudit: audit.logs });
    } finally {
      set({ isLoadingFederation: false });
    }
  },

  sendFederatedMessage: async (recipientNodeId, messageType, payload) => {
    const res = await api.ruflo.sendFederatedMessage({ recipientNodeId, messageType, payload });
    set((state) => ({
      federationAudit: [res.message, ...state.federationAudit],
    }));
    return res.message;
  },

  fetchLearning: async () => {
    const patRes = await api.ruflo.listNeuralPatterns();
    const trajRes = await api.ruflo.listTrajectories(20);
    set({
      neuralPatterns: patRes.patterns,
      learningStats: patRes.stats,
      trajectories: trajRes.trajectories,
    });
  },

  fetchMetaHarnessAudit: async () => {
    set({ isLoadingAudit: true });
    try {
      const res = await api.ruflo.getMetaHarnessAudit();
      set({ metaAudit: res.audit });
    } finally {
      set({ isLoadingAudit: false });
    }
  },

  fetchWorkers: async () => {
    const res = await api.ruflo.listWorkers();
    set({ workers: res.workers });
  },

  triggerWorker: async (id) => {
    const res = await api.ruflo.triggerWorker(id);
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? res.worker : w)),
    }));
  },

  toggleWorker: async (id, enabled) => {
    const res = await api.ruflo.toggleWorker(id, enabled);
    set((state) => ({
      workers: state.workers.map((w) => (w.id === id ? res.worker : w)),
    }));
  },

  fetchPersonas: async () => {
    const res = await api.ruflo.listPersonas();
    set({ personas: res.personas });
  },

  deployPersona: async (personaId, customName) => {
    const res = await api.ruflo.deployPersona({ personaId, customName });
    return res.agent;
  },
}));
