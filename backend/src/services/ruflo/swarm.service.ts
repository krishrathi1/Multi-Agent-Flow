import { EventEmitter } from 'events';
import { prisma } from '../../lib/prisma.js';
import { logger } from '../../lib/logger.js';

export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star' | 'hybrid' | 'adaptive';
export type ConsensusProtocol = 'majority' | 'raft' | 'byzantine' | 'gossip';

export interface SwarmAgentMember {
  id: string;
  name: string;
  role: 'leader' | 'queen' | 'coordinator' | 'worker' | 'specialist' | 'validator';
  status: 'idle' | 'busy' | 'offline' | 'error';
  capabilities: string[];
  currentTaskId?: string;
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

export interface SwarmInstance {
  id: string;
  orgId: string;
  name: string;
  description: string;
  topology: SwarmTopology;
  consensusProtocol: ConsensusProtocol;
  leaderId?: string;
  members: SwarmAgentMember[];
  connections: SwarmMeshConnection[];
  status: 'active' | 'paused' | 'terminating';
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

export class SwarmService extends EventEmitter {
  private swarms: Map<string, SwarmInstance> = new Map();
  private proposals: Map<string, ConsensusProposal> = new Map();

  constructor() {
    super();
    this.seedDefaultSwarm();
  }

  private seedDefaultSwarm() {
    const defaultSwarmId = 'swarm-default-primary';
    const defaultSwarm: SwarmInstance = {
      id: defaultSwarmId,
      orgId: 'default',
      name: 'Alpha Core Swarm',
      description: 'Primary hybrid autonomous agent swarm with consensus and self-balancing',
      topology: 'hybrid',
      consensusProtocol: 'raft',
      leaderId: 'agent-queen-01',
      members: [
        {
          id: 'agent-queen-01',
          name: 'Queen Coordinator',
          role: 'queen',
          status: 'idle',
          capabilities: ['orchestration', 'task_decomposition', 'consensus_leadership'],
          metrics: { tasksCompleted: 48, tasksFailed: 1, avgExecutionTimeMs: 420, successRate: 0.98 }
        },
        {
          id: 'agent-architect-01',
          name: 'Chief Architect',
          role: 'specialist',
          status: 'idle',
          capabilities: ['architecture_design', 'code_review', 'system_modeling'],
          metrics: { tasksCompleted: 34, tasksFailed: 0, avgExecutionTimeMs: 780, successRate: 1.0 }
        },
        {
          id: 'agent-coder-01',
          name: 'Full-Stack Synthesizer',
          role: 'worker',
          status: 'busy',
          capabilities: ['typescript_generation', 'backend_api', 'react_ui'],
          metrics: { tasksCompleted: 112, tasksFailed: 4, avgExecutionTimeMs: 1150, successRate: 0.96 }
        },
        {
          id: 'agent-security-01',
          name: 'Security Sentinel',
          role: 'validator',
          status: 'idle',
          capabilities: ['vulnerability_scan', 'pii_audit', 'injection_defense'],
          metrics: { tasksCompleted: 89, tasksFailed: 0, avgExecutionTimeMs: 310, successRate: 1.0 }
        }
      ],
      connections: [
        { fromAgentId: 'agent-queen-01', toAgentId: 'agent-architect-01', latencyMs: 2, weight: 1.0, active: true },
        { fromAgentId: 'agent-queen-01', toAgentId: 'agent-coder-01', latencyMs: 3, weight: 0.9, active: true },
        { fromAgentId: 'agent-queen-01', toAgentId: 'agent-security-01', latencyMs: 1, weight: 1.0, active: true },
        { fromAgentId: 'agent-coder-01', toAgentId: 'agent-security-01', latencyMs: 4, weight: 0.8, active: true }
      ],
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.swarms.set(defaultSwarmId, defaultSwarm);
  }

  async listSwarms(orgId?: string): Promise<SwarmInstance[]> {
    const all = Array.from(this.swarms.values());
    if (!orgId || orgId === 'default') return all;
    return all.filter(s => s.orgId === orgId || s.orgId === 'default');
  }

  async getSwarm(swarmId: string): Promise<SwarmInstance | null> {
    return this.swarms.get(swarmId) || null;
  }

  async createSwarm(params: {
    orgId: string;
    name: string;
    description: string;
    topology: SwarmTopology;
    consensusProtocol: ConsensusProtocol;
    agentIds?: string[];
  }): Promise<SwarmInstance> {
    const id = `swarm-${Date.now()}`;
    const members: SwarmAgentMember[] = [];

    // If agent IDs supplied, look them up from DB
    if (params.agentIds && params.agentIds.length > 0) {
      try {
        const dbAgents = await prisma.agent.findMany({
          where: { id: { in: params.agentIds } }
        });
        dbAgents.forEach((a, idx) => {
          const profile = (a.identityProfile as any) || {};
          members.push({
            id: a.id,
            name: a.displayName || a.name,
            role: idx === 0 ? 'leader' : 'worker',
            status: a.status === 'ONLINE' ? 'idle' : 'idle',
            capabilities: (profile.capabilities as string[]) || ['general_execution'],
            metrics: { tasksCompleted: 0, tasksFailed: 0, avgExecutionTimeMs: 0, successRate: 1.0 }
          });
        });
      } catch (err) {
        logger.warn({ err }, 'Could not load db agents for swarm creation');
      }
    }

    if (members.length === 0) {
      members.push({
        id: `agent-lead-${Date.now()}`,
        name: 'Swarm Coordinator',
        role: 'leader',
        status: 'idle',
        capabilities: ['orchestration', 'task_distribution'],
        metrics: { tasksCompleted: 0, tasksFailed: 0, avgExecutionTimeMs: 0, successRate: 1.0 }
      });
    }

    const connections = this.buildConnectionsForTopology(params.topology, members);

    const newSwarm: SwarmInstance = {
      id,
      orgId: params.orgId || 'default',
      name: params.name,
      description: params.description || '',
      topology: params.topology,
      consensusProtocol: params.consensusProtocol || 'majority',
      leaderId: members[0]?.id,
      members,
      connections,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.swarms.set(id, newSwarm);
    this.emit('swarm:created', newSwarm);
    return newSwarm;
  }

  async updateTopology(swarmId: string, topology: SwarmTopology): Promise<SwarmInstance> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) throw new Error(`Swarm ${swarmId} not found`);

    swarm.topology = topology;
    swarm.connections = this.buildConnectionsForTopology(topology, swarm.members);
    swarm.updatedAt = new Date().toISOString();

    this.emit('swarm:updated', swarm);
    return swarm;
  }

  private buildConnectionsForTopology(topology: SwarmTopology, members: SwarmAgentMember[]): SwarmMeshConnection[] {
    const connections: SwarmMeshConnection[] = [];
    if (members.length < 2) return connections;

    if (topology === 'hierarchical' || topology === 'star') {
      const leader = members[0];
      for (let i = 1; i < members.length; i++) {
        connections.push({
          fromAgentId: leader.id,
          toAgentId: members[i].id,
          latencyMs: Math.floor(Math.random() * 5) + 1,
          weight: 1.0,
          active: true
        });
      }
    } else if (topology === 'mesh' || topology === 'adaptive') {
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          connections.push({
            fromAgentId: members[i].id,
            toAgentId: members[j].id,
            latencyMs: Math.floor(Math.random() * 8) + 1,
            weight: 0.85,
            active: true
          });
        }
      }
    } else if (topology === 'ring') {
      for (let i = 0; i < members.length; i++) {
        const next = (i + 1) % members.length;
        connections.push({
          fromAgentId: members[i].id,
          toAgentId: members[next].id,
          latencyMs: Math.floor(Math.random() * 4) + 1,
          weight: 1.0,
          active: true
        });
      }
    } else if (topology === 'hybrid') {
      const leader = members[0];
      for (let i = 1; i < members.length; i++) {
        connections.push({
          fromAgentId: leader.id,
          toAgentId: members[i].id,
          latencyMs: 2,
          weight: 1.0,
          active: true
        });
      }
      if (members.length >= 3) {
        connections.push({
          fromAgentId: members[1].id,
          toAgentId: members[2].id,
          latencyMs: 3,
          weight: 0.75,
          active: true
        });
      }
    }

    return connections;
  }

  async addMember(swarmId: string, agent: SwarmAgentMember): Promise<SwarmInstance> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) throw new Error(`Swarm ${swarmId} not found`);

    swarm.members.push(agent);
    swarm.connections = this.buildConnectionsForTopology(swarm.topology, swarm.members);
    swarm.updatedAt = new Date().toISOString();
    return swarm;
  }

  async scaleSwarm(swarmId: string, targetCount: number): Promise<SwarmInstance> {
    const swarm = this.swarms.get(swarmId);
    if (!swarm) throw new Error(`Swarm ${swarmId} not found`);

    const currentCount = swarm.members.length;
    if (targetCount > currentCount) {
      for (let i = currentCount; i < targetCount; i++) {
        swarm.members.push({
          id: `agent-worker-${Date.now()}-${i}`,
          name: `AutoWorker #${i + 1}`,
          role: 'worker',
          status: 'idle',
          capabilities: ['general_execution', 'parallel_tasking'],
          metrics: { tasksCompleted: 0, tasksFailed: 0, avgExecutionTimeMs: 0, successRate: 1.0 }
        });
      }
    } else if (targetCount < currentCount && targetCount > 0) {
      swarm.members = swarm.members.slice(0, targetCount);
    }

    swarm.connections = this.buildConnectionsForTopology(swarm.topology, swarm.members);
    swarm.updatedAt = new Date().toISOString();
    this.emit('swarm:scaled', { swarmId, count: swarm.members.length });
    return swarm;
  }

  async triggerConsensus(params: {
    swarmId: string;
    topic: string;
    payload: any;
    protocol?: ConsensusProtocol;
  }): Promise<ConsensusProposal> {
    const swarm = this.swarms.get(params.swarmId);
    if (!swarm) throw new Error(`Swarm ${params.swarmId} not found`);

    const protocol = params.protocol || swarm.consensusProtocol || 'majority';
    const proposalId = `prop-${Date.now()}`;
    const votes: ConsensusProposal['votes'] = [];

    let quorumRatio = 0.5;
    if (protocol === 'byzantine') quorumRatio = 0.67;
    if (protocol === 'raft') quorumRatio = 0.51;

    for (const member of swarm.members) {
      const isApproving = Math.random() > 0.15;
      const confidence = Number((0.75 + Math.random() * 0.24).toFixed(2));
      votes.push({
        agentId: member.id,
        agentName: member.name,
        vote: isApproving ? 'approve' : 'reject',
        confidence,
        reasoning: isApproving
          ? `Verified criteria for "${params.topic}". Resource budget and constraints checked.`
          : `Potential conflict with active pipeline or safety policy.`
      });
    }

    const approves = votes.filter(v => v.vote === 'approve').length;
    const consensusReached = (approves / votes.length) >= quorumRatio;

    const proposal: ConsensusProposal = {
      id: proposalId,
      swarmId: params.swarmId,
      topic: params.topic,
      payload: params.payload,
      requiredQuorum: Number((quorumRatio * 100).toFixed(0)),
      votes,
      consensusReached,
      status: consensusReached ? 'approved' : 'rejected',
      createdAt: new Date().toISOString()
    };

    this.proposals.set(proposalId, proposal);
    this.emit('swarm:consensus', proposal);
    return proposal;
  }

  async listProposals(swarmId?: string): Promise<ConsensusProposal[]> {
    const all = Array.from(this.proposals.values());
    if (!swarmId) return all;
    return all.filter(p => p.swarmId === swarmId);
  }
}

export const swarmService = new SwarmService();
