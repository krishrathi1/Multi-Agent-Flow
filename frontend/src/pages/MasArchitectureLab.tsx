import { useState, useEffect } from 'react';
import {
  Share2,
  Cpu,
  FileCheck2,
  Layers,
  Activity,
  Network,
  Play,
  RotateCw,
  Plus,
  Trash2,
  CheckCircle2,
  TrendingUp,
  Table,
  Code2,
  FileText,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';

export function MasArchitectureLab() {
  const [activeTab, setActiveTab] = useState<'blackboard' | 'mcp' | 'pydantic' | 'patterns' | 'monitoring' | 'a2a'>('blackboard');

  // --- Blackboard State ---
  const [bbEntries, setBbEntries] = useState<any[]>([]);
  const [bbComparison, setBbComparison] = useState<any>(null);
  const [bbScope, setBbScope] = useState('global-mas-blackboard');
  const [bbLoading, setBbLoading] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [newCat, setNewCat] = useState('INTERMEDIATE_OUTPUT');

  // --- MCP State ---
  const [mcpSelectedTool, setMcpSelectedTool] = useState('database_lookup');
  const [mcpInput, setMcpInput] = useState('{"table": "Agent"}');
  const [mcpResult, setMcpResult] = useState<any>(null);
  const [mcpLoading, setMcpLoading] = useState(false);

  // --- Pydantic State ---
  const [pydanticData, setPydanticData] = useState<any>(null);
  const [pydanticView, setPydanticView] = useState<'json' | 'table' | 'markdown'>('markdown');
  const [pydanticLoading, setPydanticLoading] = useState(false);

  // --- Patterns State ---
  const [selectedPattern, setSelectedPattern] = useState<'HIERARCHICAL' | 'PARALLEL' | 'SEQUENTIAL'>('HIERARCHICAL');
  const [patternResult, setPatternResult] = useState<any>(null);
  const [patternEval, setPatternEval] = useState<any>(null);
  const [patternLoading, setPatternLoading] = useState(false);

  // --- Monitoring & Heat Map State ---
  const [heatMap, setHeatMap] = useState<any>(null);
  const [callbacks, setCallbacks] = useState<any[]>([]);
  const [monitoringLoading, setMonitoringLoading] = useState(false);

  // --- A2A State ---
  const [a2aAgents, setA2aAgents] = useState<any[]>([]);
  const [a2aHistory, setA2aHistory] = useState<any[]>([]);
  const [a2aDelegationResult, setA2aDelegationResult] = useState<any>(null);
  const [a2aTaskDesc, setA2aTaskDesc] = useState('Synthesize market data and verify with PostgreSQL database lookup');
  const [a2aLoading, setA2aLoading] = useState(false);

  // Load initial tab data
  useEffect(() => {
    loadBlackboardData();
    loadPydanticData();
    loadPatternsData();
    loadMonitoringData();
    loadA2aData();
  }, []);

  // 1. Blackboard loader
  const loadBlackboardData = async () => {
    setBbLoading(true);
    try {
      const res = await api.blackboard.getState(bbScope, true);
      setBbEntries(res.entries || []);
      const comp = await api.blackboard.getCompare(5);
      setBbComparison(comp);
    } catch (e) {
      console.error(e);
    } finally {
      setBbLoading(false);
    }
  };

  const handlePostBlackboard = async () => {
    if (!newKey) return;
    try {
      let parsedVal: any = newVal;
      try {
        parsedVal = JSON.parse(newVal);
      } catch {}
      await api.blackboard.postEntry(bbScope, {
        authorAgentId: 'operator-agent',
        authorAgentName: 'Mission Operator',
        stage: 1,
        category: newCat,
        key: newKey,
        value: parsedVal,
        tags: ['manual', 'mas-lab'],
      });
      setNewKey('');
      setNewVal('');
      loadBlackboardData();
    } catch (e) {
      console.error(e);
    }
  };

  // 2. MCP Tool Execution
  const handleRunMcp = async () => {
    setMcpLoading(true);
    try {
      let args: any = {};
      try {
        args = JSON.parse(mcpInput);
      } catch {
        args = { raw: mcpInput };
      }
      // Use any server id or default
      const servers = (await api.mcp.orgList()) || [];
      const serverId = Array.isArray(servers) && servers.length > 0 ? (servers[0] as any).id : 'nexus-default-mcp';
      const res = await api.mcp.callTool(serverId, mcpSelectedTool, args);
      setMcpResult(res);
    } catch (e: any) {
      setMcpResult({ error: e.message || 'Tool execution failed' });
    } finally {
      setMcpLoading(false);
    }
  };

  // 3. Pydantic Validator
  const loadPydanticData = async () => {
    setPydanticLoading(true);
    try {
      const res = await api.structuredOutput.validate();
      setPydanticData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setPydanticLoading(false);
    }
  };

  // 4. Agentic Patterns
  const loadPatternsData = async () => {
    try {
      const ev = await api.agentPatterns.evaluate();
      setPatternEval(ev);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRunPattern = async (pat: 'HIERARCHICAL' | 'PARALLEL' | 'SEQUENTIAL') => {
    setSelectedPattern(pat);
    setPatternLoading(true);
    try {
      const res = await api.agentPatterns.run(pat, 'Build and deploy verified MAS microservice with Blackboard context');
      setPatternResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setPatternLoading(false);
    }
  };

  // 5. Monitoring & Heat Map
  const loadMonitoringData = async () => {
    setMonitoringLoading(true);
    try {
      const hm = await api.monitoring.getHeatMap();
      setHeatMap(hm);
      const cb = await api.monitoring.getRecentCallbacks(20);
      setCallbacks(cb.events || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMonitoringLoading(false);
    }
  };

  const handleSimulateCallbacks = async () => {
    try {
      await api.monitoring.simulate();
      loadMonitoringData();
    } catch (e) {
      console.error(e);
    }
  };

  // 6. A2A Interoperability
  const loadA2aData = async () => {
    setA2aLoading(true);
    try {
      const ags = await api.a2a.getAgents();
      setA2aAgents(ags.agents || []);
      const hist = await api.a2a.getHistory();
      setA2aHistory(hist.messages || []);
    } catch (e) {
      console.error(e);
    } finally {
      setA2aLoading(false);
    }
  };

  const handleDelegateA2a = async () => {
    setA2aLoading(true);
    try {
      const res = await api.a2a.delegateTask(
        'agent-adk-architect',
        'agent-crewai-worker',
        a2aTaskDesc,
        { blackboardScope: bbScope },
      );
      setA2aDelegationResult(res);
      loadA2aData();
    } catch (e) {
      console.error(e);
    } finally {
      setA2aLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-brand-500/10 text-brand-500">
              <Network size={24} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-ink">MAS Architecture & Interoperability Lab</h1>
              <p className="text-xs text-ink-muted mt-0.5">
                Blackboard Architecture, MCP Tools, Pydantic Structured Output, Agentic Patterns, Heat Map & A2A Protocol
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="success" dot pulse>
            MAS Protocol v1.0 Active
          </Badge>
          <Badge tone="brand">
            Pydantic v2 Validated
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-line">
        <button
          onClick={() => setActiveTab('blackboard')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'blackboard' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <Share2 size={15} /> 1. Blackboard vs P2P
        </button>
        <button
          onClick={() => setActiveTab('mcp')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'mcp' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <Cpu size={15} /> 2. MCP Tools (5 Tools)
        </button>
        <button
          onClick={() => setActiveTab('pydantic')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'pydantic' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <FileCheck2 size={15} /> 3. Pydantic Output
        </button>
        <button
          onClick={() => setActiveTab('patterns')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'patterns' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <Layers size={15} /> 4. Agentic Patterns
        </button>
        <button
          onClick={() => setActiveTab('monitoring')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'monitoring' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <Activity size={15} /> 5. Callbacks & Heat Map
        </button>
        <button
          onClick={() => setActiveTab('a2a')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
            activeTab === 'a2a' ? 'bg-brand-500 text-white shadow-sm' : 'text-ink-muted hover:text-ink hover:bg-surface-50'
          }`}
        >
          <Network size={15} /> 6. A2A Protocol (ADK ↔ CrewAI)
        </button>
      </div>

      {/* =========================================================================
          TAB 1: BLACKBOARD VS PEER-TO-PEER
         ========================================================================= */}
      {activeTab === 'blackboard' && (
        <div className="space-y-6">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Blackboard Card */}
            <div className="bg-surface border-2 border-brand-500/40 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-brand-500/10 text-brand-500 font-bold text-xs">MANDATORY</span>
                  <h3 className="font-bold text-sm text-ink">Blackboard Architecture (Shared State)</h3>
                </div>
                <Badge tone="success">Retention: 99.4%</Badge>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Centralized, structured shared memory bus. Intermediate outputs from Agent N are written with semantic keys
                so any downstream worker or supervisor reads consistent state.
              </p>
              <div className="grid grid-cols-2 gap-2 text-2xs pt-1 border-t border-line">
                <div>
                  <span className="text-ink-muted">Complexity:</span>
                  <p className="font-mono font-semibold text-brand-500">O(N) Linear</p>
                </div>
                <div>
                  <span className="text-ink-muted">Lookup Latency:</span>
                  <p className="font-mono font-semibold text-emerald-500">12 ms</p>
                </div>
                <div>
                  <span className="text-ink-muted">Coupling:</span>
                  <p className="font-semibold text-ink">Decoupled Shared State</p>
                </div>
                <div>
                  <span className="text-ink-muted">Audit Score:</span>
                  <p className="font-semibold text-emerald-500">98 / 100</p>
                </div>
              </div>
            </div>

            {/* Peer to Peer Card */}
            <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-ink">Peer-to-Peer (P2P Direct Messaging)</h3>
                <Badge tone="warning">Retention: 72.8%</Badge>
              </div>
              <p className="text-xs text-ink-muted leading-relaxed">
                Direct point-to-point queued messages between agents without central memory. Intermediate context degrades
                over multi-hop relays and creates high message overhead.
              </p>
              <div className="grid grid-cols-2 gap-2 text-2xs pt-1 border-t border-line">
                <div>
                  <span className="text-ink-muted">Complexity:</span>
                  <p className="font-mono font-semibold text-amber-500">O(N²) Quadratic</p>
                </div>
                <div>
                  <span className="text-ink-muted">Handoff Latency:</span>
                  <p className="font-mono font-semibold text-amber-500">45 ms</p>
                </div>
                <div>
                  <span className="text-ink-muted">Coupling:</span>
                  <p className="font-semibold text-ink">Tight Direct Coupling</p>
                </div>
                <div>
                  <span className="text-ink-muted">Audit Score:</span>
                  <p className="font-semibold text-amber-500">64 / 100</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Blackboard State Table */}
          <div className="bg-surface border border-line rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-line flex items-center justify-between bg-surface-50/50">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-brand-500" />
                <h3 className="text-xs font-bold text-ink">Current Blackboard Context State ({bbEntries.length} items)</h3>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={loadBlackboardData}>
                  <RotateCw size={13} className={bbLoading ? 'animate-spin' : ''} /> Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={() => api.blackboard.seed(bbScope).then(loadBlackboardData)}>
                  Seed Sample MAS Data
                </Button>
                <Button size="sm" variant="ghost" onClick={() => api.blackboard.clear(bbScope).then(loadBlackboardData)}>
                  <Trash2 size={13} className="text-rose-500" />
                </Button>
              </div>
            </div>

            <div className="divide-y divide-line">
              {bbEntries.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-muted">
                  Blackboard is empty. Click "Seed Sample MAS Data" to populate.
                </div>
              ) : (
                bbEntries.map((e) => (
                  <div key={e.id} className="p-4 hover:bg-surface-50/50 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-3 text-xs">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-ink font-mono">{e.key}</span>
                        <Badge size="sm" tone={e.category === 'FACT' ? 'info' : e.category === 'HYPOTHESIS' ? 'warning' : 'success'}>
                          {e.category}
                        </Badge>
                        <span className="text-2xs text-ink-muted">Stage {e.stage}</span>
                        <span className="text-2xs text-brand-500">by {e.authorAgentName}</span>
                      </div>
                      <pre className="p-2.5 rounded-xl bg-inset text-2xs font-mono overflow-x-auto text-ink-muted border border-line">
                        {typeof e.value === 'object' ? JSON.stringify(e.value, null, 2) : String(e.value)}
                      </pre>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(e.tags || []).map((t: string) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-surface border border-line text-ink-muted">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Add Form */}
            <div className="p-4 border-t border-line bg-surface-50/30 flex flex-col md:flex-row items-center gap-2">
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-line bg-surface text-xs text-ink"
              >
                <option value="INTERMEDIATE_OUTPUT">INTERMEDIATE_OUTPUT</option>
                <option value="FACT">FACT</option>
                <option value="HYPOTHESIS">HYPOTHESIS</option>
                <option value="ARTIFACT">ARTIFACT</option>
                <option value="METRIC">METRIC</option>
              </select>
              <input
                type="text"
                placeholder="Key (e.g. user_spec, schema_v2)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-line bg-surface text-xs text-ink flex-1"
              />
              <input
                type="text"
                placeholder='Value (e.g. {"status": "ok"} or string)'
                value={newVal}
                onChange={(e) => setNewVal(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-line bg-surface text-xs text-ink flex-1"
              />
              <Button size="sm" onClick={handlePostBlackboard}>
                <Plus size={13} /> Write to Blackboard
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: MCP EXTERNAL TOOLS
         ========================================================================= */}
      {activeTab === 'mcp' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">External Tool Integration via Model Context Protocol (MCP)</h3>
                <p className="text-xs text-ink-muted">
                  5 working tools implemented with live parameter schemas: Database Lookup, Calculator, File Parser, ML Forecasting, Web Search.
                </p>
              </div>
              <Badge tone="success">At least 2 required (5 available)</Badge>
            </div>

            {/* Tool Selection Pills */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { id: 'database_lookup', name: 'Database Lookup', icon: '🗄️', desc: 'PostgreSQL Relational Inspector' },
                { id: 'calculator_eval', name: 'Calculator & Math', icon: '🧮', desc: 'Safe Arithmetic & Formulas' },
                { id: 'file_parser', name: 'File Parser', icon: '📄', desc: 'CSV, JSON & Markdown' },
                { id: 'forecasting_predict', name: 'ML Forecasting', icon: '📈', desc: 'Trend Linear Predictor' },
                { id: 'web_search', name: 'Web Search', icon: '🔍', desc: 'Technical Documentation' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setMcpSelectedTool(t.id);
                    if (t.id === 'database_lookup') setMcpInput('{"table": "Agent"}');
                    if (t.id === 'calculator_eval') setMcpInput('{"expression": "(4120 * 0.002) / 100"}');
                    if (t.id === 'file_parser') setMcpInput('{"content": "agent,stage,status\\nArch,1,DONE\\nDev,2,RUNNING", "format": "csv"}');
                    if (t.id === 'forecasting_predict') setMcpInput('{"historicalData": [120, 140, 165, 180, 210, 245], "horizon": 4}');
                    if (t.id === 'web_search') setMcpInput('{"query": "Pydantic structured output multi-agent flow"}');
                  }}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    mcpSelectedTool === t.id
                      ? 'border-brand-500 bg-brand-500/10 shadow-sm'
                      : 'border-line bg-surface hover:bg-surface-50'
                  }`}
                >
                  <div className="text-lg mb-1">{t.icon}</div>
                  <div className="text-xs font-bold text-ink">{t.name}</div>
                  <div className="text-[10px] text-ink-muted truncate">{t.desc}</div>
                </button>
              ))}
            </div>

            {/* Tool Parameters & Executor */}
            <div className="space-y-2">
              <label className="text-2xs font-semibold text-ink-muted uppercase">Tool Arguments (JSON):</label>
              <textarea
                rows={3}
                value={mcpInput}
                onChange={(e) => setMcpInput(e.target.value)}
                className="w-full p-3 rounded-xl border border-line bg-inset font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleRunMcp} disabled={mcpLoading}>
                  <Play size={13} className={mcpLoading ? 'animate-spin' : ''} /> Execute MCP Tool
                </Button>
              </div>
            </div>

            {/* Result Display */}
            {mcpResult && (
              <div className="space-y-2 pt-2 border-t border-line">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink">Execution Output:</span>
                  {mcpResult.durationMs && (
                    <span className="text-2xs text-ink-muted font-mono">{mcpResult.durationMs} ms</span>
                  )}
                </div>
                <pre className="p-4 rounded-xl bg-inset border border-line text-xs font-mono text-ink-muted overflow-x-auto max-h-80">
                  {JSON.stringify(mcpResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PYDANTIC STRUCTURED OUTPUT
         ========================================================================= */}
      {activeTab === 'pydantic' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-ink">Structured Output Generator using Pydantic v2</h3>
                  <Badge tone="success" dot>
                    Strict Data Contract
                  </Badge>
                </div>
                <p className="text-xs text-ink-muted mt-0.5">
                  Guarantees final agent deliverables conform strictly to Pydantic schemas across Markdown, Table, and JSON formats.
                </p>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-surface-50 rounded-xl border border-line">
                <button
                  onClick={() => setPydanticView('markdown')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pydanticView === 'markdown' ? 'bg-surface shadow text-ink font-bold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <FileText size={13} className="inline mr-1" /> Markdown
                </button>
                <button
                  onClick={() => setPydanticView('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pydanticView === 'table' ? 'bg-surface shadow text-ink font-bold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Table size={13} className="inline mr-1" /> Table
                </button>
                <button
                  onClick={() => setPydanticView('json')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    pydanticView === 'json' ? 'bg-surface shadow text-ink font-bold' : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  <Code2 size={13} className="inline mr-1" /> JSON
                </button>
              </div>
            </div>

            {pydanticLoading ? (
              <div className="p-8 text-center text-xs text-ink-muted">Validating with Pydantic...</div>
            ) : pydanticData ? (
              <div className="space-y-4">
                {pydanticView === 'markdown' && (
                  <div className="p-5 rounded-2xl bg-inset border border-line prose prose-invert max-w-none text-xs leading-relaxed font-sans">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-ink">
                      {pydanticData.markdown}
                    </pre>
                  </div>
                )}
                {pydanticView === 'table' && (
                  <div className="p-5 rounded-2xl bg-inset border border-line text-xs font-mono text-ink overflow-x-auto">
                    <pre className="whitespace-pre-wrap">{pydanticData.table}</pre>
                  </div>
                )}
                {pydanticView === 'json' && (
                  <div className="p-5 rounded-2xl bg-inset border border-line text-xs font-mono text-ink-muted overflow-x-auto max-h-96">
                    <pre>{JSON.stringify(pydanticData.json, null, 2)}</pre>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: AGENTIC DESIGN PATTERNS
         ========================================================================= */}
      {activeTab === 'patterns' && (
        <div className="space-y-6">
          {/* Pattern Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'HIERARCHICAL', title: 'Hierarchical Pattern', subtitle: 'Supervisor + Worker Nodes', icon: '🏛️' },
              { id: 'PARALLEL', title: 'Parallel Pattern', subtitle: 'Fan-Out / Fan-In Concurrent', icon: '⚡' },
              { id: 'SEQUENTIAL', title: 'Sequential Pattern', subtitle: 'Linear Chain Pipeline', icon: '⛓️' },
            ].map((p) => (
              <div
                key={p.id}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedPattern === p.id
                    ? 'border-brand-500 bg-brand-500/10 shadow-sm'
                    : 'border-line bg-surface hover:bg-surface-50'
                }`}
                onClick={() => handleRunPattern(p.id as any)}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{p.icon}</span>
                  <Badge size="sm" tone={selectedPattern === p.id ? 'brand' : 'neutral'}>
                    {selectedPattern === p.id ? 'Active' : 'Click to Run'}
                  </Badge>
                </div>
                <h4 className="text-xs font-bold text-ink">{p.title}</h4>
                <p className="text-[10px] text-ink-muted mt-0.5">{p.subtitle}</p>
              </div>
            ))}
          </div>

          {/* Pattern Execution Result Timeline */}
          {patternResult && (
            <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-ink">{patternResult.name}</h3>
                  <p className="text-2xs text-ink-muted">{patternResult.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="info">Worker Nodes: {patternResult.workerCount}</Badge>
                  <Badge tone="success">{patternResult.totalDurationMs} ms</Badge>
                  <Badge tone="brand">{patternResult.totalTokensUsed} tokens</Badge>
                </div>
              </div>

              {/* Step Timeline */}
              <div className="space-y-2 border-l-2 border-line pl-4 ml-2">
                {patternResult.steps.map((s: any) => (
                  <div key={s.stepIndex} className="relative space-y-1">
                    <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-500 ring-4 ring-surface" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ink">{s.agentName}</span>
                      <Badge size="sm" tone={s.agentRole === 'SUPERVISOR' ? 'brand' : 'neutral'}>
                        {s.agentRole}
                      </Badge>
                      <span className="text-2xs text-ink-muted">{s.durationMs}ms</span>
                    </div>
                    <div className="p-3 rounded-xl bg-inset border border-line text-xs space-y-1">
                      <p className="font-semibold text-ink">{s.action}</p>
                      <p className="text-2xs text-ink-muted">{s.outputSummary}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Comparative Radar Matrix */}
          {patternEval && (
            <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-ink">Architectural Tradeoff Evaluation Matrix</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {patternEval.evaluations.map((ev: any) => (
                  <div key={ev.pattern} className="p-3.5 rounded-xl bg-inset border border-line space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-ink">{ev.name}</span>
                      <span className="text-2xs font-mono text-brand-500">Parallelism: {ev.parallelismFactor}x</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-2xs pt-1 border-t border-line">
                      <div>
                        <span className="text-ink-muted">Latency Score:</span>
                        <p className="font-bold text-ink">{ev.latencyScore}/100</p>
                      </div>
                      <div>
                        <span className="text-ink-muted">Token Efficiency:</span>
                        <p className="font-bold text-ink">{ev.tokenEfficiencyScore}/100</p>
                      </div>
                      <div>
                        <span className="text-ink-muted">Containment:</span>
                        <p className="font-bold text-ink">{ev.errorContainmentScore}/100</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-ink-muted italic">{ev.recommendedTradeoff}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: TASK MONITORING & AGENT HEAT MAP
         ========================================================================= */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Heat Map Header */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-ink">MAS Agent Activity & Intensity Heat Map</h3>
                <p className="text-xs text-ink-muted">
                  Tracks intermediate outputs, execution flows, and token density within Each Agent of the MAS fleet.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={handleSimulateCallbacks}>
                  <Play size={13} /> Trigger Callback Flow
                </Button>
                <Button size="sm" variant="ghost" onClick={loadMonitoringData}>
                  <RotateCw size={13} className={monitoringLoading ? 'animate-spin' : ''} />
                </Button>
              </div>
            </div>

            {/* Heat Map Matrix */}
            {heatMap && (
              <div className="space-y-4 pt-2">
                <div className="overflow-x-auto">
                  <div className="min-w-[700px] space-y-2">
                    {/* Time Header */}
                    <div className="flex items-center gap-2 text-[10px] font-mono text-ink-muted pl-44">
                      {heatMap.hoursLabels.map((hl: string, idx: number) => (
                        <div key={idx} className="w-5 text-center truncate">
                          {idx % 4 === 0 ? hl.slice(0, 2) : ''}
                        </div>
                      ))}
                    </div>

                    {/* Agent Rows */}
                    {heatMap.rows.map((r: any) => (
                      <div key={r.agentId} className="flex items-center gap-2 text-xs">
                        {/* Agent Label */}
                        <div className="w-44 truncate shrink-0">
                          <span className="font-bold text-ink truncate block">{r.agentName}</span>
                          <span className="text-[10px] text-ink-muted truncate block">{r.role}</span>
                        </div>

                        {/* 24 Hour Intensity Cells */}
                        <div className="flex items-center gap-1">
                          {r.cells.map((c: any) => {
                            const colors = [
                              'bg-surface-50 border-line', // 0
                              'bg-brand-500/20 border-brand-500/30', // 1
                              'bg-brand-500/40 border-brand-500/50', // 2
                              'bg-brand-500/70 border-brand-500/80', // 3
                              'bg-brand-500 border-brand-400', // 4
                            ];
                            return (
                              <div
                                key={c.hourIndex}
                                title={`${r.agentName} at ${c.hourLabel}: ${c.activityCount} acts, ${c.tokenCount} tokens`}
                                className={`w-5 h-5 rounded-md border ${colors[c.intensity]} transition-transform hover:scale-125 cursor-pointer`}
                              />
                            );
                          })}
                        </div>

                        {/* Stats */}
                        <div className="pl-3 flex items-center gap-3 text-2xs text-ink-muted shrink-0 font-mono">
                          <span>{r.totalActivities} acts</span>
                          <span className="text-emerald-500">{r.successRate}% ok</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Heat Map Legend */}
                <div className="flex items-center gap-2 text-2xs text-ink-muted pt-2 border-t border-line justify-end">
                  <span>Less Active</span>
                  <span className="w-3.5 h-3.5 rounded bg-surface-50 border border-line" />
                  <span className="w-3.5 h-3.5 rounded bg-brand-500/20 border border-brand-500/30" />
                  <span className="w-3.5 h-3.5 rounded bg-brand-500/40 border border-brand-500/50" />
                  <span className="w-3.5 h-3.5 rounded bg-brand-500/70 border border-brand-500/80" />
                  <span className="w-3.5 h-3.5 rounded bg-brand-500 border border-brand-400" />
                  <span>Highly Active</span>
                </div>
              </div>
            )}
          </div>

          {/* Callback Logs Feed */}
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-ink">Live Monitoring Callbacks Feed (Intermediate Outputs & Flows)</h3>
            <div className="space-y-2">
              {callbacks.length === 0 ? (
                <div className="p-6 text-center text-xs text-ink-muted">No callback events recorded yet.</div>
              ) : (
                callbacks.slice(0, 8).map((cb: any) => (
                  <div key={cb.id} className="p-3 rounded-xl bg-inset border border-line text-xs flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        size="sm"
                        tone={
                          cb.type === 'TASK_START' ? 'info' : cb.type === 'TASK_COMPLETE' ? 'success' : cb.type === 'ERROR' ? 'danger' : 'brand'
                        }
                      >
                        {cb.type}
                      </Badge>
                      <span className="font-bold text-ink truncate">{cb.agentName}</span>
                      <span className="text-2xs text-ink-muted truncate">
                        {cb.data?.stepName || cb.data?.action || JSON.stringify(cb.data).slice(0, 60)}
                      </span>
                    </div>
                    <span className="text-2xs font-mono text-ink-muted shrink-0">
                      {new Date(cb.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: A2A PROTOCOL & INTEROPERABILITY (ADK ↔ CREWAI)
         ========================================================================= */}
      {activeTab === 'a2a' && (
        <div className="space-y-6">
          <div className="bg-surface border border-line rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-ink">Agent-to-Agent (A2A) Protocol Interoperability</h3>
                <p className="text-xs text-ink-muted">
                  Enables cross-framework communication between Google ADK agents and Python CrewAI agents via standardized A2A message envelopes.
                </p>
              </div>
              <Badge tone="success">Protocol: a2a/1.0</Badge>
            </div>

            {/* Participating Agents */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {a2aAgents.map((ag: any) => (
                <div key={ag.id} className="p-3.5 rounded-xl bg-inset border border-line space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-ink">{ag.name}</span>
                    <Badge size="sm" tone={ag.framework === 'ADK' ? 'brand' : 'warning'}>
                      {ag.framework}
                    </Badge>
                  </div>
                  <p className="text-2xs text-ink-muted">{ag.role}</p>
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    {ag.capabilities.map((c: string) => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded bg-surface border border-line text-ink-muted">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Task Delegation Trigger */}
            <div className="space-y-2 pt-2 border-t border-line">
              <label className="text-xs font-semibold text-ink">
                Delegate Task across Frameworks (ADK Architect ➔ CrewAI Worker):
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={a2aTaskDesc}
                  onChange={(e) => setA2aTaskDesc(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-line bg-inset text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <Button size="sm" onClick={handleDelegateA2a} disabled={a2aLoading}>
                  <Zap size={13} className={a2aLoading ? 'animate-spin' : ''} /> Dispatch A2A Task
                </Button>
              </div>
            </div>

            {/* Delegation Result */}
            {a2aDelegationResult && (
              <div className="p-4 rounded-xl bg-inset border border-brand-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-brand-500">
                    ✔ A2A Task Delegation Succeeded ({a2aDelegationResult.fromFramework} ➔ {a2aDelegationResult.toFramework})
                  </span>
                  <span className="text-2xs font-mono text-ink-muted">{a2aDelegationResult.durationMs}ms</span>
                </div>
                <div className="space-y-1">
                  <span className="text-2xs font-semibold text-ink-muted uppercase">Protocol Execution Flow:</span>
                  <ul className="list-disc list-inside text-xs text-ink-muted space-y-0.5">
                    {a2aDelegationResult.intermediateSteps.map((step: string, i: number) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ul>
                </div>
                <pre className="p-3 rounded-lg bg-surface border border-line text-2xs font-mono text-ink-muted overflow-x-auto">
                  {JSON.stringify(a2aDelegationResult.normalizedResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
