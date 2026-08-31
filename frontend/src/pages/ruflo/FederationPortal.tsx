import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Globe,
  Lock,
  Send,
  RefreshCw,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Key
} from 'lucide-react';
import { useRufloStore } from '../../stores/ruflo-store';

export function FederationPortal() {
  const {
    peers,
    nodeInfo,
    federationAudit,
    isLoadingFederation,
    fetchFederation,
    sendFederatedMessage,
  } = useRufloStore();

  const [recipient, setRecipient] = useState('');
  const [msgType, setMsgType] = useState('task-request');
  const [msgPayload, setMsgPayload] = useState('{"task": "Run zero-trust security audit on remote cluster"}');
  const [isSending, setIsSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchFederation();
  }, [fetchFederation]);

  useEffect(() => {
    if (peers.length > 0 && !recipient) {
      setRecipient(peers[0].id);
    }
  }, [peers, recipient]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipient || !msgPayload.trim()) return;
    setIsSending(true);
    try {
      let parsed = {};
      try {
        parsed = JSON.parse(msgPayload);
      } catch {
        parsed = { text: msgPayload };
      }
      await sendFederatedMessage(recipient, msgType, parsed);
      setStatusMsg('Federated message signed with Ed25519 and dispatched with zero PII leakage.');
      setTimeout(() => setStatusMsg(null), 4000);
    } catch (err: any) {
      setStatusMsg(`Error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-emerald-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo Zero-Trust Agent Federation</h1>
            <p className="text-sm text-gray-400">
              Cross-cluster agent communication with Ed25519 identity keys, 14-pattern PII scrubbing, and dynamic trust scoring.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchFederation()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-800 hover:bg-surface-700 text-gray-300 text-sm border border-surface-700 transition"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingFederation ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {statusMsg}
        </div>
      )}

      {/* Node Identity Card */}
      {nodeInfo && (
        <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-5 backdrop-blur flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Local Node Identity</p>
              <p className="text-sm font-mono text-white font-semibold">{nodeInfo.nodeId}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-gray-400">
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              {nodeInfo.publicKey.slice(0, 32)}...
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {nodeInfo.onlinePeers} of {nodeInfo.totalPeers} Peers Online
            </span>
          </div>
        </div>
      )}

      {/* Peer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {peers.map((peer) => (
          <div
            key={peer.id}
            className="p-5 rounded-2xl bg-surface-900/80 border border-surface-800 hover:border-emerald-500/30 transition space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{peer.name}</p>
                <p className="text-xs font-mono text-gray-500">{peer.endpoint}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${
                  peer.trustLevel === 'verified'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : peer.trustLevel === 'trusted'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                }`}
              >
                {peer.trustLevel}
              </span>
            </div>

            {/* Trust Score Metric */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Behavioral Trust Score</span>
                <span className="font-mono font-bold text-emerald-400">{(peer.trustScore * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-surface-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all"
                  style={{ width: `${peer.trustScore * 100}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-surface-800 text-center text-xs">
              <div>
                <p className="text-[10px] text-gray-500">Uptime</p>
                <p className="font-semibold text-gray-200">{peer.metrics.uptimePercentage}%</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">Success</p>
                <p className="font-semibold text-emerald-400">{peer.metrics.successCount}</p>
              </div>
              <div>
                <p className="text-[10px] text-gray-500">PII Policy</p>
                <p className="font-mono text-[10px] text-amber-400">{peer.piiPolicy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Federated Task Dispatch */}
        <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
          <h3 className="text-md font-semibold text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-emerald-400" />
            Dispatch Federated Workload
          </h3>
          <form onSubmit={handleSendMessage} className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Target Federation Node</label>
              <select
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              >
                {peers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.endpoint})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Message Protocol Type</label>
              <select
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
              >
                <option value="task-request">task-request</option>
                <option value="consensus-vote">consensus-vote</option>
                <option value="telemetry">telemetry</option>
                <option value="health-ping">health-ping</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">JSON Payload (PII auto-sanitized)</label>
              <textarea
                rows={4}
                value={msgPayload}
                onChange={(e) => setMsgPayload(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-xl px-3 py-2 text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSending}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
            >
              {isSending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Sign with Ed25519 & Send
            </button>
          </form>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-surface-900/80 border border-surface-800 rounded-2xl p-6 backdrop-blur space-y-4">
          <h3 className="text-md font-semibold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Federation Security & PII Audit Stream
          </h3>
          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {federationAudit.length === 0 ? (
              <p className="text-xs text-gray-500 italic">No federated transmissions logged yet.</p>
            ) : (
              federationAudit.map((log) => (
                <div key={log.id} className="p-3.5 rounded-xl bg-surface-800/80 border border-surface-700/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-emerald-400">{log.messageType}</span>
                    <span className="text-gray-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-gray-300 font-mono text-[11px] truncate">
                    To: {log.recipientNodeId} · Sig: {log.signature.slice(0, 14)}...
                  </p>
                  {log.sanitized && (
                    <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px]">
                      {log.scrubbedFieldsCount} PII fields sanitized
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
