import { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Wand2,
  Workflow,
  ArrowLeft,
  Terminal,
  Github,
  Server,
  CheckCircle2,
  AlertCircle,
  Play,
  Save,
  Check,
  RefreshCw,
  Lock,
  Globe,
  Cpu,
  Layers,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { useProcessStore } from '../../stores/process-store';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { Process, ProcessPlan } from '../../types';

type InputMode = 'ai' | 'curl' | 'github';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

const AI_TEMPLATES = [
  {
    title: '🌐 End-to-End Full-Stack Web & App Builder',
    desc: 'Generates responsive React/Tailwind UI, Express API routes, PostgreSQL schema, and live deployment preview.',
    prompt: 'Build an end-to-end web application with responsive UI, Express REST endpoints, Prisma database models, and build verification.',
  },
  {
    title: '⚡ Vercel & Cloud Log Reviewer & Auto-Fixer',
    desc: 'Fetches Vercel/Cloud deployment build logs, parses stack traces, isolates exceptions, and auto-generates code patches.',
    prompt: 'Inspect Vercel, Netlify, and Docker deployment build logs, isolate root cause errors, auto-generate fix patches, and verify build.',
  },
  {
    title: '🔌 Model Context Protocol (MCP) Tool Orchestrator',
    desc: 'Connects external MCP tool servers (PostgreSQL DB, Filesystem, Memory, Custom HTTP/SSE) to execute agent tool chains.',
    prompt: 'Connect to external MCP tool servers via SSE/HTTP transports, discover remote tools, and execute multi-tool agent workflows.',
  },
  {
    title: '🛡️ Security Vulnerability & OWASP Penetration Audit',
    desc: 'Scans repository for OWASP Top 10 vulnerabilities, hardcoded secret leaks, and dependency risks.',
    prompt: 'Perform OWASP Top 10 security audit, scan for hardcoded secret leaks, analyze third-party packages, and generate security patches.',
  },
  {
    title: '🔧 Auto-Bug Resolver & Code Refactoring',
    desc: 'Parses error logs, isolates root cause, generates candidate fix diffs, and runs regression unit tests.',
    prompt: 'Analyze error stack traces, reproduce defects with unit tests, generate refactored code diffs, and verify zero regression.',
  },
  {
    title: '📄 API Specification & Documentation Generator',
    desc: 'Inspects API endpoints, produces OpenAPI/Swagger specs, Postman collections, and developer guides.',
    prompt: 'Generate OpenAPI 3.0 specs, Postman collections, SDK usage snippets, and system architecture docs from codebase routes.',
  },
];

const CURL_EXAMPLES = [
  `curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -X POST \\
  -d '{"contents":[{"parts":[{"text":"Explain multi-agent architecture"}]}]}'`,
  `curl -X POST https://api.stripe.com/v1/payment_intents \\
  -H "Authorization: Bearer $STRIPE_SECRET_KEY" \\
  -d "amount=2000" -d "currency=usd"`,
];

function parseCurlCommand(raw: string): ParsedCurl | null {
  if (!raw || !raw.trim()) return null;
  const clean = raw.replace(/\\\r?\n/g, ' ').replace(/\n/g, ' ').trim();
  
  let method = 'GET';
  if (clean.includes('-X POST') || clean.includes('--request POST') || clean.includes('-d ') || clean.includes('--data')) {
    method = 'POST';
  } else if (clean.includes('-X PUT')) method = 'PUT';
  else if (clean.includes('-X DELETE')) method = 'DELETE';
  else if (clean.includes('-X PATCH')) method = 'PATCH';

  const urlMatch = clean.match(/curl\s+(?:-[A-Za-z0-9-]+\s+(?:'[^']*'|"[^"]*"|\S+)\s+)*["']?(https?:\/\/[^\s"']+)["']?/i);
  const url = urlMatch ? urlMatch[1] : (clean.match(/https?:\/\/[^\s"']+/)?.[0] || '');

  const headers: Record<string, string> = {};
  const headerRegex = /(?:-H|--header)\s+["']([^"']+)["']/g;
  let match;
  while ((match = headerRegex.exec(clean)) !== null) {
    const parts = match[1].split(':');
    if (parts.length >= 2) {
      headers[parts[0].trim()] = parts.slice(1).join(':').trim();
    }
  }

  let body: string | undefined;
  const bodyMatch = clean.match(/(?:-d|--data|--data-raw)\s+['"]({.*?}|\[.*?\]|[^'"]+)['"]/);
  if (bodyMatch) {
    body = bodyMatch[1];
  }

  return { method, url, headers, body };
}

export function CreateProcessModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (p: Process) => void;
}) {
  const { planProcess, createProcess } = useProcessStore();

  const [step, setStep] = useState<'describe' | 'review'>('describe');
  const [mode, setMode] = useState<InputMode>('ai');
  const [prompt, setPrompt] = useState('');
  const [curlInput, setCurlInput] = useState('');
  const [parsedCurl, setParsedCurl] = useState<ParsedCurl | null>(null);
  const [curlSaved, setCurlSaved] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');

  // GitHub Repos
  const [repoList, setRepoList] = useState<Array<{ name: string; full_name: string; default_branch: string }>>([
    { name: 'Multi-Agent-Flow', full_name: 'krishrathi1/Multi-Agent-Flow', default_branch: 'main' },
  ]);
  const [repoInput, setRepoInput] = useState(() => localStorage.getItem('nexus:github_repo') || 'krishrathi1/Multi-Agent-Flow');
  const [repoBranch, setRepoBranch] = useState('main');
  const [repoGoal, setRepoGoal] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);

  // Local PC Models
  const [localModels, setLocalModels] = useState<Array<{ id: string; name: string }>>([
    { id: 'qwen2.5-coder:1.5b', name: 'qwen2.5-coder:1.5b (Local PC • Fast)' },
    { id: 'gemini-3.6-flash', name: 'Google Gemini 3.6 Flash (Cloud • Advanced)' },
    { id: 'llama3.2', name: 'Llama 3.2 (Local PC • Balanced)' },
  ]);
  const [selectedModel, setSelectedModel] = useState('qwen2.5-coder:1.5b');
  const [agentCount, setAgentCount] = useState<string>('auto');
  const [plan, setPlan] = useState<ProcessPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      const ghToken = localStorage.getItem('nexus:github_token') || undefined;
      setLoadingRepos(true);
      api.processes.githubRepos(ghToken).then((res) => {
        if (res && res.repos && res.repos.length > 0) {
          setRepoList(res.repos);
          if (!res.repos.some(r => r.full_name === repoInput)) {
            setRepoInput(res.repos[0].full_name);
            setRepoBranch(res.repos[0].default_branch || 'main');
          }
        }
      }).catch(() => {/* ignore */}).finally(() => setLoadingRepos(false));
    }
  }, [open]);

  const reset = () => {
    setStep('describe');
    setPrompt('');
    setCurlInput('');
    setParsedCurl(null);
    setCurlSaved(false);
    setRepoGoal('');
    setAgentCount('auto');
    setPlan(null);
    setError(undefined);
  };

  const close = () => {
    if (planning || creating) return;
    reset();
    onClose();
  };

  const getEffectivePrompt = () => {
    if (mode === 'ai') {
      return prompt.trim();
    }
    if (mode === 'curl') {
      let final = curlInput.trim();
      if (apiKeyInput.trim()) {
        final += `\n# Injected API Key: ${apiKeyInput.trim()}`;
      }
      return final;
    }
    if (mode === 'github') {
      return `Target GitHub Repository: ${repoInput} (branch: ${repoBranch})\nGoal: ${repoGoal.trim() || 'Review pull requests, build features, and maintain codebase'}`;
    }
    return prompt.trim();
  };

  const handlePlan = async () => {
    const effective = getEffectivePrompt();
    if (effective.length < 5) {
      setError('Please provide requirements or pick a template to build your agent fleet.');
      return;
    }

    setPlanning(true);
    setError(undefined);
    try {
      const result = await planProcess(
        effective,
        agentCount === 'auto' ? undefined : Number(agentCount),
      );
      setPlan(result);
      setStep('review');
    } catch (err) {
      setError((err as Error).message || 'Could not plan this production block.');
    } finally {
      setPlanning(false);
    }
  };

  const handleCreate = async () => {
    if (!plan) return;
    setCreating(true);
    setError(undefined);
    try {
      const effective = getEffectivePrompt();
      const created = await createProcess({ prompt: effective, plan });
      onCreated?.(created);
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not create this production.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={step === 'describe' ? 'Create Autonomous Agent Fleet' : plan?.name ?? 'Review Agent Pipeline'}
      description={
        step === 'describe'
          ? 'Tell the AI what you want to build. Local PC models and orchestrators configure the entire multi-stage agent team.'
          : plan?.summary
      }
      actions={
        step === 'describe' ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={close} disabled={planning}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Wand2}
              loading={planning}
              onClick={handlePlan}
            >
              {planning ? 'Planning Agent Fleet…' : 'Build Agent Fleet with AI'}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={() => setStep('describe')}
              disabled={creating}
            >
              Back
            </Button>
            <Button variant="primary" size="sm" icon={Bot} loading={creating} onClick={handleCreate}>
              Deploy Production ({plan?.agents.length} agents)
            </Button>
          </div>
        )
      }
    >
      {step === 'describe' ? (
        <div className="space-y-4">
          {/* Mode Selector Tabs */}
          <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-line-subtle bg-inset/50 p-1">
            <button
              type="button"
              onClick={() => setMode('ai')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all',
                mode === 'ai'
                  ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-xs border border-line-subtle'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>✨ Build with AI</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('curl')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all',
                mode === 'curl'
                  ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-xs border border-line-subtle'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Terminal size={14} />
              <span>cURL / API</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('github')}
              className={cn(
                'flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition-all',
                mode === 'github'
                  ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-xs border border-line-subtle'
                  : 'text-ink-muted hover:text-ink'
              )}
            >
              <Github size={14} />
              <span>GitHub Repo</span>
            </button>
          </div>

          {error && (
            <p role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          {/* TAB 1: BUILD WITH AI (PRIMARY) */}
          {mode === 'ai' && (
            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  What should your AI agents do?
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Review the codebase in krishrathi1/Multi-Agent-Flow, perform security audit, and generate deliverable reports..."
                  className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                />
              </div>

              {/* Quick 1-Click Templates */}
              <div>
                <span className="block text-2xs font-semibold uppercase tracking-wider text-ink-muted mb-2">
                  Or pick a 1-click template:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {AI_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.title}
                      type="button"
                      onClick={() => setPrompt(tmpl.prompt)}
                      className="rounded-xl border border-line-subtle bg-surface p-2.5 text-left hover:border-brand-500/50 hover:bg-raised transition-all shadow-2xs group"
                    >
                      <span className="block text-xs font-semibold text-ink group-hover:text-brand-600 dark:group-hover:text-brand-400">
                        {tmpl.title}
                      </span>
                      <span className="block text-2xs text-ink-muted mt-0.5 line-clamp-2">
                        {tmpl.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CURL COMMAND */}
          {mode === 'curl' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">
                  Paste cURL Command or API Endpoint
                </label>
                <textarea
                  rows={4}
                  value={curlInput}
                  onChange={(e) => setCurlInput(e.target.value)}
                  placeholder="curl https://api.example.com/v1/... -H 'Authorization: Bearer ...'"
                  className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                />
              </div>
              <div className="space-y-1">
                <span className="text-2xs font-semibold uppercase tracking-wider text-ink-muted">Examples:</span>
                {CURL_EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurlInput(ex)}
                    className="block w-full text-left truncate rounded-lg border border-line-subtle bg-surface px-2.5 py-1 text-2xs font-mono text-ink-muted hover:border-brand-500 hover:text-ink transition-colors"
                  >
                    {ex.split('\n')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: GITHUB REPO */}
          {mode === 'github' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Target GitHub Repository</label>
                <select
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {repoList.map((r) => (
                    <option key={r.full_name} value={r.full_name}>
                      📦 {r.full_name} ({r.default_branch})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1">Repository Goal</label>
                <textarea
                  rows={3}
                  value={repoGoal}
                  onChange={(e) => setRepoGoal(e.target.value)}
                  placeholder="Review code, execute security checks, and build workspace deliverables..."
                  className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}

          {/* Model Engine & Team Size Options */}
          <div className="rounded-xl border border-line-subtle bg-inset/50 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
                <Cpu size={14} className="text-brand-500" />
                Inference Model Engine
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-2xs font-semibold text-emerald-600 dark:text-emerald-400">
                0 Token Cost • Local Host
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-2xs font-medium text-ink-muted mb-1">Select Model</label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {localModels.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-muted mb-1">Fleet Team Size</label>
                <select
                  value={agentCount}
                  onChange={(e) => setAgentCount(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="auto">✨ Auto (AI decides optimal stages)</option>
                  <option value="1">1 Agent (Solo Specialist)</option>
                  <option value="2">2 Agents (Planner + Deliverables Engineer)</option>
                  <option value="3">3 Agents (Planner + Engineer + QA Reviewer)</option>
                  <option value="4">4 Agents (Full Autonomous Team)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STEP 2: REVIEW AGENT FLEET PLAN */
        <div className="space-y-4">
          <div className="rounded-xl border border-line-subtle bg-surface p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-ink">{plan?.name}</h4>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">{plan?.summary}</p>
          </div>

          <div className="space-y-3">
            <span className="block text-xs font-semibold text-ink">
              Planned Agent Stages ({plan?.agents.length} Agents)
            </span>
            {plan?.stages.map((stage) => {
              const stageAgents = plan.agents.filter((a) => a.stage === stage.stage);
              return (
                <div key={stage.stage} className="rounded-xl border border-line-subtle bg-inset/40 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/10 text-2xs font-bold text-brand-600">
                        {stage.stage}
                      </span>
                      {stage.name}
                    </span>
                    <span className="text-2xs text-ink-faint">{stage.description}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {stageAgents.map((ag) => (
                      <div key={ag.name} className="flex items-center gap-2.5 rounded-lg border border-line bg-surface p-2.5 shadow-2xs">
                        <Avatar name={ag.name} emoji={ag.avatar} size="sm" />
                        <div className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-ink truncate">{ag.name}</span>
                          <span className="block text-2xs text-brand-600 dark:text-brand-400 font-medium truncate">{ag.role}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
