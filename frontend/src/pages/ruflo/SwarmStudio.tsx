import React, { useEffect, useState } from 'react';
import {
  Network,
  Users,
  Vote,
  Sliders,
  Plus,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Cpu,
  Layers
} from 'lucide-react';
import { useRufloStore, SwarmTopology, ConsensusProtocol } from '../../stores/ruflo-store';

export function SwarmStudio() {
  const {
    swarms,
    activeSwarm,
    proposals,
    isLoadingSwarms,
    fetchSwarms,
    updateTopology,
    scaleSwarm,
    triggerConsensus,
  } = useRufloStore();

  const [topic, setTopic] = useState('');
  const [protocol, setProtocol] = useState<ConsensusProtocol>('raft');
  const [scalingCount, setScalingCount] = useState<number>(4);
  const [isVoting, setIsVoting] = useState(false);

  useEffect(() => {
    fetchSwarms();
  }, [fetchSwarms]);

  useEffect(() => {
    if (activeSwarm) {
      setScalingCount(activeSwarm.members.length);
      setProtocol(activeSwarm.consensusProtocol);
    }
  }, [activeSwarm]);

  const handleTopologyChange = async (newTopology: SwarmTopology) => {
    if (!activeSwarm) return;
    await updateTopology(activeSwarm.id, newTopology);
  };

  const handleScaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSwarm) return;
    await scaleSwarm(activeSwarm.id, scalingCount);
  };

  const handleConsensusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSwarm || !topic.trim()) return;
    setIsVoting(true);
    try {
      await triggerConsensus(activeSwarm.id, topic, { triggeredAt: new Date().toISOString() }, protocol);
      setTopic('');
    } finally {
      setIsVoting(false);
    }
  };

  const topologies: Array<{ id: SwarmTopology; name: string; desc: string }> = [
    { id: 'hybrid', name: 'Hybrid Mesh-Hierarchy', desc: 'Queen leader with peer-to-peer specialist cross-links' },
    { id: 'hierarchical', name: 'Strict Hierarchy', desc: 'Queen orchestrates down to specialized workers' },
    { id: 'mesh', name: 'Full Peer Mesh', desc: 'All agents communicate symmetrically with equal voting power' },
    { id: 'ring', name: 'Ring Pipeline', desc: 'Sequential token passing for staged code review workflows' },
    { id: 'star', name: 'Star Hub', desc: 'Central hub broker dispatches to isolated specialized nodes' },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-nexus-900/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-nexus-500/20 shadow-lg">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-nexus-500/20 text-nexus-400 border border-nexus-500/30">
              <Network className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo Swarm Studio</h1>
              <p className="text-sm text-gray-400">
                Multi-topology swarm coordination, real-time consensus ballots, and dynamic load balancing.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSwarms()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingSwarms ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {activeSwarm ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Swarm Visualization & Topology */}
          <div className="lg:col-span-2 space-y-6">
            {/* Topology Selector Card */}
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Layers className="w-5 h-5 text-nexus-400" />
                  Active Topology: <span className="capitalize text-nexus-400">{activeSwarm.topology}</span>
                </h2>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Status: {activeSwarm.status}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {topologies.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTopologyChange(t.id)}
                    className={`p-3.5 rounded-xl border text-left transition ${
                      activeSwarm.topology === t.id
                        ? 'bg-nexus-500/15 border-nexus-500/40 text-white shadow-md shadow-nexus-500/5'
                        : 'bg-surface-800/60 border-surface-700 text-gray-400 hover:text-gray-200 hover:bg-surface-800'
                    }`}
                  >
                    <p className="font-semibold text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Member Fleet Grid */}
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-nexus-400" />
                  Swarm Members ({activeSwarm.members.length})
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {activeSwarm.members.map((member) => (
                  <div
                    key={member.id}
                    className="p-4 rounded-xl bg-surface-800/80 border border-surface-700/80 hover:border-nexus-500/30 transition space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-nexus-500/20 border border-nexus-500/30 flex items-center justify-center text-nexus-300 font-bold text-xs">
                          {member.role === 'queen' ? '👑' : '🤖'}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{member.name}</p>
                          <span className="text-xs text-gray-400 capitalize">{member.role}</span>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase font-medium">
                        {member.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {member.capabilities.map((cap) => (
                        <span key={cap} className="text-[10px] px-2 py-0.5 rounded bg-surface-900 text-gray-400 border border-surface-700">
                          {cap}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-700/50 text-center">
                      <div>
                        <p className="text-[10px] text-gray-500">Tasks</p>
                        <p className="text-xs font-semibold text-gray-200">{member.metrics.tasksCompleted}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Success</p>
                        <p className="text-xs font-semibold text-emerald-400">{Math.round(member.metrics.successRate * 100)}%</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500">Avg Latency</p>
                        <p className="text-xs font-semibold text-nexus-400">{member.metrics.avgExecutionTimeMs}ms</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Mesh Connections Table */}
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-3">
              <h3 className="text-md font-semibold text-white flex items-center gap-2">
                <Cpu className="w-4 h-4 text-nexus-400" />
                Active Mesh Interconnects ({activeSwarm.connections.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-500 border-b border-surface-800">
                    <tr>
                      <th className="pb-2">From Node</th>
                      <th className="pb-2">To Node</th>
                      <th className="pb-2">Channel Latency</th>
                      <th className="pb-2">Weight</th>
                      <th className="pb-2">State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-800/60 text-gray-300">
                    {activeSwarm.connections.map((conn, idx) => (
                      <tr key={idx} className="hover:bg-surface-800/40">
                        <td className="py-2.5 font-mono text-nexus-400">{conn.fromAgentId}</td>
                        <td className="py-2.5 font-mono text-nexus-400">{conn.toAgentId}</td>
                        <td className="py-2.5">{conn.latencyMs}ms</td>
                        <td className="py-2.5">{conn.weight}</td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Synchronized
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Dynamic Scaling & Consensus Console */}
          <div className="space-y-6">
            {/* Dynamic Scaling Controls */}
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <h3 className="text-md font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-nexus-400" />
                Dynamic Swarm Scaling
              </h3>
              <form onSubmit={handleScaleSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Target Agent Count</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={scalingCount}
                    onChange={(e) => setScalingCount(Number(e.target.value))}
                    className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-nexus-500"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-nexus-600 hover:bg-nexus-500 text-white font-medium py-2 rounded-xl text-sm transition shadow-lg shadow-nexus-600/20"
                >
                  Apply Scaling Delta
                </button>
              </form>
            </div>

            {/* Consensus Ballot Console */}
            <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-md font-semibold text-white flex items-center gap-2">
                  <Vote className="w-4 h-4 text-nexus-400" />
                  Consensus Engine
                </h3>
                <select
                  value={protocol}
                  onChange={(e) => setProtocol(e.target.value as ConsensusProtocol)}
                  className="bg-surface-800 border border-surface-700 rounded-lg text-xs px-2 py-1 text-gray-300 focus:outline-none"
                >
                  <option value="majority">Majority</option>
                  <option value="raft">Raft Protocol</option>
                  <option value="byzantine">Byzantine BFT (2/3)</option>
                  <option value="gossip">Gossip Protocol</option>
                </select>
              </div>

              <form onSubmit={handleConsensusSubmit} className="space-y-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Decision Proposal Topic</label>
                  <input
                    type="text"
                    placeholder="e.g. Approve database schema migration v2"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:border-nexus-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isVoting || !topic.trim()}
                  className="w-full bg-gradient-to-r from-nexus-600 to-indigo-600 hover:from-nexus-500 hover:to-indigo-500 disabled:opacity-50 text-white font-medium py-2 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-nexus-600/20"
                >
                  {isVoting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Vote className="w-4 h-4" />}
                  Trigger Swarm Ballot
                </button>
              </form>

              {/* Proposals Stream */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold text-gray-400">Recent Ballots</p>
                {proposals.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No consensus votes recorded yet.</p>
                ) : (
                  proposals.map((p) => (
                    <div key={p.id} className="p-3.5 rounded-xl bg-surface-800/90 border border-surface-700 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{p.topic}</span>
                        {p.consensusReached ? (
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-400 font-medium">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-[11px]">
                        Quorum: {p.requiredQuorum}% required · {p.votes.filter((v) => v.vote === 'approve').length}/{p.votes.length} votes approved
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center bg-surface-900 border border-surface-800 rounded-2xl">
          <p className="text-gray-400">Loading Swarm Coordinator...</p>
        </div>
      )}
    </div>
  );
}
