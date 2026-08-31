import React, { useEffect, useState } from 'react';
import {
  Users,
  Sparkles,
  Plus,
  CheckCircle2,
  Layers,
  Shield,
  Code2,
  BrainCircuit,
  Network,
  Workflow,
  TrendingUp,
  Cpu
} from 'lucide-react';
import { useRufloStore, RufloPersona } from '../../stores/ruflo-store';

export function RufloPersonasCatalog() {
  const { personas, fetchPersonas, deployPersona } = useRufloStore();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployedMsg, setDeployedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  const categories = [
    { id: 'all', label: 'All Personas' },
    { id: 'core', label: 'Core & Orchestration' },
    { id: 'architecture', label: 'Architecture & SPARC' },
    { id: 'security', label: 'Security & AIDefence' },
    { id: 'testing', label: 'Testing & Verification' },
    { id: 'intelligence', label: 'Vector Memory & Learning' },
    { id: 'specialist', label: 'Specialist & Trading' },
  ];

  const filteredPersonas =
    selectedCategory === 'all'
      ? personas
      : personas.filter((p) => p.category === selectedCategory);

  const handleDeploy = async (persona: RufloPersona) => {
    setDeployingId(persona.id);
    try {
      await deployPersona(persona.id);
      setDeployedMsg(`Successfully deployed ${persona.name} into your Nexus Agent Fleet!`);
      setTimeout(() => setDeployedMsg(null), 4000);
    } catch (err: any) {
      setDeployedMsg(`Deployment error: ${err.message}`);
    } finally {
      setDeployingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-950/40 via-surface-900 to-nexus-950 p-6 rounded-2xl border border-indigo-500/20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Ruflo Specialized Persona Catalog</h1>
            <p className="text-sm text-gray-400">
              Deploy battle-tested Ruflo specialized personas (Queen Coordinator, SPARC Lead, Security Sentinel, etc.) with 1-click.
            </p>
          </div>
        </div>
      </div>

      {deployedMsg && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {deployedMsg}
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'bg-surface-800 text-gray-400 hover:text-gray-200 hover:bg-surface-700'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Personas Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPersonas.map((persona) => (
          <div
            key={persona.id}
            className="p-6 rounded-2xl bg-surface-900/80 border border-surface-800 hover:border-indigo-500/40 transition space-y-4 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                  {persona.avatarIcon === 'Crown' ? '👑' : persona.avatarIcon === 'Code2' ? '💻' : persona.avatarIcon === 'ShieldAlert' ? '🛡️' : '🤖'}
                </div>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-surface-800 text-gray-400 border border-surface-700 uppercase font-semibold">
                  {persona.category}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white">{persona.name}</h3>
                <p className="text-xs text-indigo-400 font-medium">{persona.roleTitle}</p>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{persona.description}</p>

              {/* System Soul Preview */}
              <div className="p-2.5 rounded-xl bg-surface-800/80 border border-surface-700/60 text-[11px] text-gray-400 italic">
                "{persona.systemSoul.slice(0, 100)}..."
              </div>

              {/* Capabilities & Tools */}
              <div className="space-y-1.5 pt-2">
                <p className="text-[10px] text-gray-500 font-semibold uppercase">Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {persona.capabilities.map((cap) => (
                    <span
                      key={cap}
                      className="text-[10px] px-2 py-0.5 rounded bg-surface-800 text-gray-300 border border-surface-700"
                    >
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Deploy Button */}
            <div className="pt-4 border-t border-surface-800">
              <button
                onClick={() => handleDeploy(persona)}
                disabled={deployingId === persona.id}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <Plus className="w-3.5 h-3.5" />
                {deployingId === persona.id ? 'Deploying to Fleet...' : 'Deploy to Nexus Fleet'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
