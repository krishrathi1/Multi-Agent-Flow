import { useState, useEffect, useMemo, useRef } from 'react';
import { config } from '../../config';
import {
  Sparkles,
  Bot,
  Wand2,
  Loader2,
  Workflow,
  ArrowLeft,
  ArrowRight,
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
  Plus,
  Trash2,
  ExternalLink,
  Shield,
  Code2,
  FolderGit2,
  Zap,
  Key,
  Radio,
  Sliders,
  Send,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge, Chip } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import { CustomSelect } from '../ui/CustomSelect';
import { useProcessStore } from '../../stores/process-store';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';
import type { Process, ProcessPlan, SoulTemplate } from '../../types';

export type WizardStep = 'prompt' | 'curl' | 'github' | 'review';

interface ParsedCurl {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface AdditionalApiEndpoint {
  id: string;
  name: string;
  curlInput: string;
  method: string;
  url: string;
  authHeader: string;
  body: string;
  testStatus: 'idle' | 'testing' | 'success' | 'failed';
  testMessage: string;
  saved: boolean;
}

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

  // Wizard Step State: 1 = prompt, 2 = curl, 3 = github, 4 = review
  const [step, setStep] = useState<WizardStep>('prompt');
  const [prompt, setPrompt] = useState('');
  const [promptMode, setPromptMode] = useState<'chat' | 'prompt'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    timestamp: string;
    suggestedPrompt?: string;
  }>>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! What application, tool, or autonomous agent workflow do you want to build? Chat with me here to brainstorm and structure your requirements, or switch to the Prompt Editor to write your prompt directly.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isChatSending, setIsChatSending] = useState(false);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (promptMode === 'chat') {
      chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, promptMode]);

  // cURL & API State
  const [curlInput, setCurlInput] = useState('');
  const [parsedCurl, setParsedCurl] = useState<ParsedCurl | null>(null);
  const [curlSaved, setCurlSaved] = useState(false);
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiUrl, setApiUrl] = useState('');
  const [apiAuthHeader, setApiAuthHeader] = useState('');
  const [apiBody, setApiBody] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [apiSaved, setApiSaved] = useState(false);

  // GitHub Repos State
  const [repoMode, setRepoMode] = useState<'existing' | 'new'>('existing');
  const [repoList, setRepoList] = useState<Array<{ name: string; full_name: string; default_branch: string }>>([]);
  const [repoInput, setRepoInput] = useState(() => localStorage.getItem('nexus:github_repo') || config.defaultGithubRepo);
  const [repoBranch, setRepoBranch] = useState(config.defaultGithubBranch);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoVisibility, setNewRepoVisibility] = useState<'public' | 'private'>('public');
  const [newRepoBranch, setNewRepoBranch] = useState(config.defaultGithubBranch);
  const [newRepoDescription, setNewRepoDescription] = useState('');
  const [initReadme, setInitReadme] = useState(true);
  const [repoGoal, setRepoGoal] = useState('');
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [creatingRepo, setCreatingRepo] = useState(false);
  const [createdRepoResult, setCreatedRepoResult] = useState<{ full_name: string; html_url: string } | null>(null);

  // Integration connection state from server API
  const [isGithubConnected, setIsGithubConnected] = useState(false);
  const [isVercelConnected, setIsVercelConnected] = useState(false);
  const [vercelAutoDeploy, setVercelAutoDeploy] = useState(false);

  const [isExpandingPrompt, setIsExpandingPrompt] = useState(false);

  // Dynamic API Endpoints list (Add More API feature)
  const [apiEndpoints, setApiEndpoints] = useState<AdditionalApiEndpoint[]>([]);

  // Available models from Settings and Local hardware
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string; source?: string }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>(() => localStorage.getItem('nexus:process_model') || 'auto');
  const [agentCount, setAgentCount] = useState<string>('auto');
  const [plan, setPlan] = useState<ProcessPlan | null>(null);
  const [planning, setPlanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string>();
  const [soulTemplates, setSoulTemplates] = useState<SoulTemplate[]>([]);
  const [editingAgentSoul, setEditingAgentSoul] = useState<{ agentName: string; soulMd: string; templateId?: string } | null>(null);

  useEffect(() => {
    api.llmProviders.availableModels()
      .then((res) => {
        if (res?.models?.length) setAvailableModels(res.models);
      })
      .catch(() => {});
    api.soulTemplates.list().then(setSoulTemplates).catch(() => {});
  }, []);

  const handleAssignSoul = (agentName: string, templateId: string) => {
    if (!plan) return;
    const tmpl = soulTemplates.find((t) => t.id === templateId);
    setPlan({
      ...plan,
      agents: plan.agents.map((ag) => {
        if (ag.name === agentName) {
          return {
            ...ag,
            soulTemplateId: templateId || null,
            soulTemplateName: tmpl ? tmpl.name : 'Custom Soul',
            soulMd: tmpl ? tmpl.content : ag.soulMd,
          };
        }
        return ag;
      }),
    });
  };

  const modelOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; badge?: string }> = [
      { value: 'auto', label: '✨ Auto (Default Configured Engine)', badge: 'Recommended' },
    ];

    const providerLabels: Record<string, string> = {
      google: 'Google Gemini',
      opencode: 'OpenCode',
      anthropic: 'Anthropic Claude',
      openai: 'OpenAI',
      local: 'Local PC',
      nvidia: 'NVIDIA',
    };

    for (const m of availableModels) {
      const pKey = m.provider?.toLowerCase() || '';
      const provName = providerLabels[pKey] || (m.source === 'opencode' ? 'OpenCode' : (m.provider?.toUpperCase() || 'Model'));
      const badge = m.source === 'opencode' ? 'OpenCode' : (providerLabels[pKey]?.split(' ')[0] || m.provider);
      options.push({
        value: m.id,
        label: `${provName} • ${m.name}`,
        badge,
      });
    }

    // Also include local models from config if not present
    for (const lm of config.localLlmModels) {
      if (!options.some((o) => o.value === lm.id || o.value === `local/${lm.id}`)) {
        options.push({
          value: lm.id,
          label: `Local PC • ${lm.name}`,
          badge: 'Local',
        });
      }
    }

    return options;
  }, [availableModels]);

  const engineBadge = useMemo(() => {
    if (!selectedModel || selectedModel === 'auto') return 'Auto Routing • Settings Default';
    if (selectedModel.includes('gemini') || selectedModel.startsWith('google')) return 'Google Gemini Engine';
    if (selectedModel.includes('opencode') || availableModels.find((m) => m.id === selectedModel)?.source === 'opencode') return 'OpenCode CLI Engine';
    if (selectedModel.includes('claude') || selectedModel.startsWith('anthropic')) return 'Anthropic Claude Engine';
    if (selectedModel.includes('openai') || selectedModel.startsWith('openai')) return 'OpenAI Engine';
    if (selectedModel.includes('local') || selectedModel.includes('qwen') || selectedModel.includes('llama')) return 'Local PC Hardware';
    return 'Custom Model Engine';
  }, [selectedModel, availableModels]);

  // Edit with AI in Step 4 Review
  const [showAiEdit, setShowAiEdit] = useState(false);
  const [aiEditPrompt, setAiEditPrompt] = useState('');
  const [isAiEditing, setIsAiEditing] = useState(false);
  const [aiEditSuccess, setAiEditSuccess] = useState(false);

  const handleApplyAiEdit = async (customText?: string) => {
    const text = (customText || aiEditPrompt).trim();
    if (!text) return;
    setIsAiEditing(true);
    setError(undefined);
    try {
      const effective = getEffectivePrompt();
      const customizationPrompt = `Initial Fleet Requirements:\n${effective}\n\nCurrent Planned Pipeline:\nName: ${plan?.name}\nSummary: ${plan?.summary}\nCurrent Stages: ${plan?.stages.map(s => `${s.stage}. ${s.name}`).join(', ')}\n\nUSER CUSTOMIZATION REQUEST (APPLY THESE EXACT CHANGES):\n${text}\n\nRe-plan the optimal multi-stage autonomous agent fleet incorporating the requested changes.`;
      const updatedPlan = await planProcess(
        customizationPrompt,
        agentCount === 'auto' ? undefined : Number(agentCount)
      );
      setPlan(updatedPlan);
      setAiEditPrompt('');
      setAiEditSuccess(true);
      setTimeout(() => setAiEditSuccess(false), 4000);
    } catch (err) {
      setError((err as Error).message || 'Failed to customize agent fleet with AI.');
    } finally {
      setIsAiEditing(false);
    }
  };

  // Auto-parse cURL when curlInput changes or on parse action
  const handleParseAndSaveCurl = (rawOverride?: string) => {
    const raw = rawOverride !== undefined ? rawOverride : curlInput;
    if (!raw.trim()) return;
    const parsed = parseCurlCommand(raw);
    if (parsed) {
      setParsedCurl(parsed);
      setApiMethod(parsed.method);
      setApiUrl(parsed.url);
      const auth = Object.entries(parsed.headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1] || '';
      setApiAuthHeader(auth);
      setApiBody(parsed.body || '');
      setCurlSaved(true);
      setTimeout(() => setCurlSaved(false), 3000);
    }
  };

  const handleTestApi = async () => {
    const targetUrl = apiUrl || parsedCurl?.url;
    if (!targetUrl) {
      setTestStatus('failed');
      setTestMessage('Please provide a valid API endpoint URL first.');
      return;
    }
    try {
      new URL(targetUrl);
    } catch {
      setTestStatus('failed');
      setTestMessage('Invalid URL format. Please check your endpoint.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('Testing API connectivity & headers…');
    try {
      const authHeader = apiAuthHeader.trim();
      const headers = authHeader
        ? { [authHeader.includes(':') ? authHeader.split(':', 1)[0].trim() : 'Authorization']: authHeader.includes(':') ? authHeader.split(':').slice(1).join(':').trim() : authHeader }
        : {};
      const result = await api.processes.testApi({
        url: targetUrl,
        method: apiMethod,
        headers,
        body: apiBody || undefined,
      });
      setTestStatus(result.ok ? 'success' : 'failed');
      setTestMessage(`${result.ok ? '✓' : '✗'} ${result.status || 'Connection failed'} ${result.statusText} • ${result.latencyMs}ms`);
    } catch (err) {
      setTestStatus('failed');
      setTestMessage((err as Error).message || 'API test failed.');
    }
  };

  const handleSaveParsedApi = () => {
    setApiSaved(true);
    setTimeout(() => setApiSaved(false), 3000);
  };


  const handleExpandPromptWithAI = async () => {
    if (isExpandingPrompt) return;
    setIsExpandingPrompt(true);
    try {
      const effectiveModel = selectedModel && selectedModel !== 'auto'
        ? selectedModel
        : (localStorage.getItem('nexus:process_model') || localStorage.getItem('nexus:default_model') || undefined);

      const res = await api.processes.expandPrompt({
        prompt: prompt.trim(),
        model: effectiveModel,
      });
      if (res?.expandedPrompt) {
        setPrompt(res.expandedPrompt);
      }
    } catch (err) {
      console.error('Failed to expand prompt with AI:', err);
    } finally {
      setIsExpandingPrompt(false);
    }
  };

  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || isChatSending) return;

    const userMsg = {
      id: String(Date.now()),
      sender: 'user' as const,
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatSending(true);

    try {
      const effectiveModel =
        selectedModel && selectedModel !== 'auto'
          ? selectedModel
          : (localStorage.getItem('nexus:process_model') || localStorage.getItem('nexus:default_model') || undefined);

      // Attempt to chat with Mother AI for systems architecture
      const res = await api.chat.sendToMother(
        `[User is in Process Creation Wizard] The user wants to design an autonomous multi-agent workflow. User message: "${text}". Please provide clear architectural guidance, suggest technical deliverables, and formulate a production-grade prompt.`,
        undefined,
        effectiveModel
      );

      const replyText =
        res?.result || res?.summary || (res as any)?.text || 'I have analyzed your objective and prepared the workflow specification.';

      // Automatically keep prompt up-to-date if empty
      if (!prompt.trim()) {
        setPrompt(text);
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant' as const,
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedPrompt: text,
        },
      ]);
    } catch (err: any) {
      console.error('Chat error:', err);
      try {
        const res = await api.processes.expandPrompt({
          prompt: text,
          model: selectedModel && selectedModel !== 'auto' ? selectedModel : undefined,
        });
        if (res?.expandedPrompt) {
          setPrompt(res.expandedPrompt);
          setChatMessages((prev) => [
            ...prev,
            {
              id: String(Date.now() + 1),
              sender: 'assistant' as const,
              text: `Here is the structured multi-agent specification based on your objective:\n\n${res.expandedPrompt}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              suggestedPrompt: res.expandedPrompt,
            },
          ]);
          return;
        }
      } catch {}

      if (!prompt.trim()) setPrompt(text);
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant' as const,
          text: `Objective received. Your prompt has been set in the editor.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggestedPrompt: text,
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  const handleAddApiEndpoint = () => {
    setApiEndpoints((prev) => [
      ...prev,
      {
        id: String(Date.now() + Math.random()),
        name: `API #${prev.length + 2}`,
        curlInput: '',
        method: 'GET',
        url: '',
        authHeader: '',
        body: '',
        testStatus: 'idle',
        testMessage: '',
        saved: false,
      },
    ]);
  };

  const handleUpdateApiEndpoint = <K extends keyof AdditionalApiEndpoint>(
    id: string,
    field: K,
    value: AdditionalApiEndpoint[K]
  ) => {
    setApiEndpoints((prev) => prev.map((ep) => (ep.id === id ? { ...ep, [field]: value } : ep)));
  };

  const handleRemoveApiEndpoint = (id: string) => {
    setApiEndpoints((prev) => prev.filter((ep) => ep.id !== id));
  };

  const handleParseCurlForEndpoint = (id: string, raw: string) => {
    if (!raw.trim()) return;
    const parsed = parseCurlCommand(raw);
    if (parsed) {
      const auth = Object.entries(parsed.headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1] || '';
      setApiEndpoints((prev) =>
        prev.map((ep) =>
          ep.id === id
            ? {
                ...ep,
                curlInput: raw,
                method: parsed.method,
                url: parsed.url,
                authHeader: auth,
                body: parsed.body || '',
                saved: true,
              }
            : ep
        )
      );
      setTimeout(() => {
        setApiEndpoints((prev) =>
          prev.map((ep) => (ep.id === id ? { ...ep, saved: false } : ep))
        );
      }, 3000);
    }
  };

  const handleTestApiForEndpoint = async (id: string) => {
    const ep = apiEndpoints.find((e) => e.id === id);
    if (!ep || !ep.url.trim()) {
      handleUpdateApiEndpoint(id, 'testStatus', 'failed');
      handleUpdateApiEndpoint(id, 'testMessage', 'Please provide a valid endpoint URL first.');
      return;
    }
    try {
      new URL(ep.url.trim());
    } catch {
      handleUpdateApiEndpoint(id, 'testStatus', 'failed');
      handleUpdateApiEndpoint(id, 'testMessage', 'Invalid URL format.');
      return;
    }

    handleUpdateApiEndpoint(id, 'testStatus', 'testing');
    handleUpdateApiEndpoint(id, 'testMessage', 'Testing connectivity…');
    try {
      const authHeader = ep.authHeader.trim();
      const headers = authHeader
        ? { [authHeader.includes(':') ? authHeader.split(':', 1)[0].trim() : 'Authorization']: authHeader.includes(':') ? authHeader.split(':').slice(1).join(':').trim() : authHeader }
        : {};
      const result = await api.processes.testApi({
        url: ep.url.trim(),
        method: ep.method,
        headers,
        body: ep.body || undefined,
      });
      handleUpdateApiEndpoint(id, 'testStatus', result.ok ? 'success' : 'failed');
      handleUpdateApiEndpoint(id, 'testMessage', `${result.ok ? '✓' : '✗'} ${result.status || 'Failed'} • ${result.latencyMs}ms`);
    } catch (err) {
      handleUpdateApiEndpoint(id, 'testStatus', 'failed');
      handleUpdateApiEndpoint(id, 'testMessage', (err as Error).message || 'API test failed.');
    }
  };

  const handleSaveApiForEndpoint = (id: string) => {
    handleUpdateApiEndpoint(id, 'saved', true);
    setTimeout(() => {
      handleUpdateApiEndpoint(id, 'saved', false);
    }, 3000);
  };

  useEffect(() => {
    if (open) {
      api.organizations.getIntegrations().then((integrations) => {
        setIsGithubConnected(integrations.githubConnected);
        setIsVercelConnected(integrations.vercelConnected);
        setVercelAutoDeploy(integrations.vercelConnected);
      }).catch(() => {});

      setLoadingRepos(true);
      api.processes.githubRepos().then((res) => {
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
    setStep('prompt');
    setPrompt('');
    setCurlInput('');
    setParsedCurl(null);
    setCurlSaved(false);
    setApiUrl('');
    setApiAuthHeader('');
    setApiBody('');
    setTestStatus('idle');
    setTestMessage('');
    setApiSaved(false);
    setApiEndpoints([]);
    setRepoMode('existing');
    setNewRepoName('');
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
    let final = `Fleet Primary Goal & Requirements:\n${prompt.trim() || 'Review codebase, build modular full-stack components, and deploy deliverables.'}\n\n`;

    const hasPrimaryApi = Boolean(curlInput.trim() || apiUrl.trim());
    const hasAdditionalApis = apiEndpoints.some((e) => Boolean(e.url.trim() || e.curlInput.trim()));

    if (hasPrimaryApi || hasAdditionalApis) {
      final += `Connected API Endpoints & cURL Specifications:\n`;
      if (hasPrimaryApi) {
        final += `[API #1: Primary Service / Model Endpoint]\n`;
        if (curlInput.trim()) final += `  cURL Command: ${curlInput.trim()}\n`;
        if (apiUrl.trim()) final += `  Endpoint: ${apiMethod} ${apiUrl.trim()}\n`;
        if (apiAuthHeader.trim()) final += `  Auth Header: ${apiAuthHeader.trim()}\n`;
        if (apiBody.trim()) final += `  Request Body: ${apiBody.trim()}\n`;
      }
      apiEndpoints.forEach((ep, idx) => {
        if (ep.url.trim() || ep.curlInput.trim()) {
          final += `[API #${idx + 2}: ${ep.name || 'Additional Service'}]\n`;
          if (ep.curlInput.trim()) final += `  cURL Command: ${ep.curlInput.trim()}\n`;
          if (ep.url.trim()) final += `  Endpoint: ${ep.method} ${ep.url.trim()}\n`;
          if (ep.authHeader.trim()) final += `  Auth Header: ${ep.authHeader.trim()}\n`;
          if (ep.body.trim()) final += `  Request Body: ${ep.body.trim()}\n`;
        }
      });
      final += '\n';
    }

    let repoSection = '';
    if (repoMode === 'new' && newRepoName.trim()) {
      repoSection = `Action: Create New GitHub Repository\nName: ${newRepoName.trim()}\nVisibility: ${newRepoVisibility}\nBranch: ${newRepoBranch}\nDescription: ${newRepoDescription.trim() || 'Multi-agent autonomous application'}\nInit README: ${initReadme}`;
    } else {
      repoSection = `Target GitHub Repository: ${repoInput} (branch: ${repoBranch})`;
    }

    const vercelSection = vercelAutoDeploy
      ? `Vercel Deployment: Enabled (Auto-deployment via linked Settings account — agents will auto-detect framework, run build verification, and deploy live preview)`
      : `Vercel Deployment: Disabled (Local / Git repository only)`;

    final += `${repoSection}\n\n${vercelSection}`;

    if (repoGoal.trim()) {
      final += `\n\nDeployment Specific Goal:\n${repoGoal.trim()}`;
    }

    return final.trim();
  };

  const handleNextFromPrompt = () => {
    if (prompt.trim().length < 5) {
      setError('Please describe what your AI agents should do or select a 1-click template.');
      return;
    }
    setError(undefined);
    setStep('curl');
  };

  const handleNextFromCurl = () => {
    setError(undefined);
    setStep('github');
  };

  const handleCreateRepoOnGitHub = async () => {
    if (!newRepoName.trim()) {
      setError('Please enter a repository name first.');
      return;
    }
    if (!isGithubConnected) {
      setError('GitHub connection not found. Please connect your GitHub account in Settings > Integrations.');
      return;
    }
    setCreatingRepo(true);
    setError(undefined);
    try {
      const res = await api.processes.githubCreateRepo({
        name: newRepoName.trim(),
        description: newRepoDescription.trim() || undefined,
        isPrivate: newRepoVisibility === 'private',
        autoInit: initReadme,
      });
      if (res.success && res.repo) {
        setCreatedRepoResult({ full_name: res.repo.full_name, html_url: res.repo.html_url });
        setRepoInput(res.repo.full_name);
        setRepoBranch(res.repo.default_branch || 'main');
        setRepoList((prev) => [
          {
            name: res.repo!.name,
            full_name: res.repo!.full_name,
            default_branch: res.repo!.default_branch || 'main',
            description: res.repo!.description,
            private: res.repo!.private,
          },
          ...prev.filter((r) => r.full_name !== res.repo!.full_name),
        ]);
      } else {
        setError(res.error || 'Failed to create repository on GitHub.');
      }
    } catch (err: any) {
      setError(err.message || 'Error communicating with GitHub API.');
    } finally {
      setCreatingRepo(false);
    }
  };

  const handlePlan = async () => {
    const effective = getEffectivePrompt();
    if (effective.length < 5) {
      setError('Please provide requirements to build your agent fleet.');
      return;
    }

    setPlanning(true);
    setError(undefined);
    try {
      const result = await planProcess(
        effective,
        agentCount === 'auto' ? undefined : Number(agentCount),
        selectedModel === 'auto' ? undefined : selectedModel,
      );
      const enrichedAgents = (result.agents || []).map((ag) => {
        if (ag.soulTemplateId) return ag;
        const text = `${ag.displayName} ${ag.role || ''} ${ag.description || ''}`.toLowerCase();
        const matched = soulTemplates.find((s) => {
          const sName = s.name.toLowerCase();
          if (sName.includes('engineer') && (text.includes('engineer') || text.includes('developer') || text.includes('code'))) return true;
          if (sName.includes('devops') && (text.includes('devops') || text.includes('infra') || text.includes('deploy'))) return true;
          if (sName.includes('reviewer') && (text.includes('review') || text.includes('audit') || text.includes('qa'))) return true;
          if (sName.includes('manager') && (text.includes('plan') || text.includes('manager') || text.includes('lead'))) return true;
          if (sName.includes('data') && (text.includes('data') || text.includes('sql') || text.includes('metric'))) return true;
          if (sName.includes('security') && (text.includes('security') || text.includes('auth'))) return true;
          return false;
        }) || soulTemplates[0];

        return {
          ...ag,
          soulTemplateId: matched?.id || null,
          soulTemplateName: matched?.name || null,
          soulMd: (matched && (!ag.soulMd || ag.soulMd.length < 50)) ? matched.content : ag.soulMd,
        };
      });
      setPlan({ ...result, agents: enrichedAgents });
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
      // If user chose to create a new GitHub repo, create it on GitHub if not already created
      if (repoMode === 'new' && newRepoName.trim() && !createdRepoResult && isGithubConnected) {
        try {
          const res = await api.processes.githubCreateRepo({
            name: newRepoName.trim(),
            description: newRepoDescription.trim() || undefined,
            isPrivate: newRepoVisibility === 'private',
            autoInit: initReadme,
          });
          if (res.success && res.repo) {
            setCreatedRepoResult({ full_name: res.repo.full_name, html_url: res.repo.html_url });
            setRepoInput(res.repo.full_name);
          }
        } catch {
          // Non-blocking for process launch
        }
      }

      const effective = getEffectivePrompt();
      const created = await createProcess({
        prompt: effective,
        plan,
        model: selectedModel === 'auto' ? undefined : selectedModel,
      });
      onCreated?.(created);
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message || 'Could not create this production.');
    } finally {
      setCreating(false);
    }
  };

  const stepTitles: Record<WizardStep, { title: string; desc: string }> = {
    prompt: {
      title: '1. Describe Agent Fleet Goal',
      desc: 'Tell the AI what you want to build. Local PC models configure the entire multi-stage agent fleet.',
    },
    curl: {
      title: '2. API Integrations & cURL (Optional)',
      desc: 'Paste cURL commands, test endpoint connectivity, and save API configurations for your agents.',
    },
    github: {
      title: '3. GitHub Repository & Vercel Deployment',
      desc: 'Select or create a GitHub repository and configure Vercel live cloud deployment & auto-fixing.',
    },
    review: {
      title: plan?.name ?? '4. Review & Deploy Agent Fleet',
      desc: plan?.summary ?? 'Review planned autonomous agent stages, responsibilities, and deliverable targets.',
    },
  };

  const stepsList: Array<{ id: WizardStep; label: string; number: number; icon: any }> = [
    { id: 'prompt', label: '1. Prompt', number: 1, icon: Sparkles },
    { id: 'curl',   label: '2. cURL / API', number: 2, icon: Terminal },
    { id: 'github', label: '3. GitHub + Vercel', number: 3, icon: Github },
    { id: 'review', label: '4. Review', number: 4, icon: Bot },
  ];

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      title={stepTitles[step].title}
      description={stepTitles[step].desc}
      actions={
        <div className="flex items-center justify-between w-full">
          {/* Step indicator pills */}
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {stepsList.map((s, idx) => {
              const isCurrent = step === s.id;
              const isPassed = (
                (s.id === 'prompt') ||
                (s.id === 'curl' && (step === 'curl' || step === 'github' || step === 'review')) ||
                (s.id === 'github' && (step === 'github' || step === 'review')) ||
                (s.id === 'review' && step === 'review')
              );
              return (
                <div key={s.id} className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (s.id === 'review' && !plan) return;
                      setStep(s.id);
                    }}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap',
                      isCurrent
                        ? 'bg-brand-500 text-white shadow-xs'
                        : isPassed
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20'
                        : 'bg-inset text-ink-muted opacity-60'
                    )}
                  >
                    <span>{s.number}</span>
                    <span className="hidden sm:inline">{s.label.split('. ')[1]}</span>
                  </button>
                  {idx < stepsList.length - 1 && (
                    <span className="text-ink-faint text-[10px]">→</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Action buttons per step */}
          <div className="flex items-center gap-2">
            {step === 'prompt' && (
              <>
                <Button variant="secondary" size="sm" onClick={close}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  onClick={handleNextFromPrompt}
                >
                  Next: cURL / API
                </Button>
              </>
            )}

            {step === 'curl' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeft}
                  onClick={() => setStep('prompt')}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={ArrowRight}
                  onClick={handleNextFromCurl}
                >
                  Next: GitHub + Vercel
                </Button>
              </>
            )}

            {step === 'github' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeft}
                  onClick={() => setStep('curl')}
                  disabled={planning}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={planning ? Wand2 : Wand2}
                  loading={planning}
                  onClick={handlePlan}
                >
                  {planning ? 'Planning Agent Fleet…' : 'Plan & Review Fleet with AI'}
                </Button>
              </>
            )}

            {step === 'review' && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ArrowLeft}
                  onClick={() => setStep('github')}
                  disabled={creating}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Bot}
                  loading={creating}
                  onClick={handleCreate}
                >
                  Deploy Production ({plan?.agents.length} agents)
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {error && (
          <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2 text-xs text-red-700 dark:text-red-300 font-medium">
            {error}
          </p>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: PROMPT & INFERENCE ENGINE (BUILD WITH AI)                         */}
        {/* ========================================================================= */}
        {step === 'prompt' && (
          <div className="space-y-4">
            {/* ========================================================= */}
            {/* CHAT & PROMPT STUDIO (REPLACES TEMPLATES)                 */}
            {/* ========================================================= */}
            <div className="space-y-3">
              {/* Header with Mode Toggle & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-inset p-1 rounded-xl border border-line shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPromptMode('chat')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                      promptMode === 'chat'
                        ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                        : 'text-ink-muted hover:text-ink hover:bg-hover'
                    )}
                  >
                    <Bot size={13} className="text-amber-500" />
                    <span>Chat & Brainstorm</span>
                    {chatMessages.length > 1 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPromptMode('prompt')}
                    className={cn(
                      'px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer',
                      promptMode === 'prompt'
                        ? 'bg-surface text-brand-600 dark:text-brand-400 shadow-2xs border border-line-subtle'
                        : 'text-ink-muted hover:text-ink hover:bg-hover'
                    )}
                  >
                    <Code2 size={13} />
                    <span>Prompt Editor</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {prompt.trim() ? (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <Check size={11} className="stroke-[2.5]" />
                      <span className="hidden sm:inline">Active Prompt:</span>
                      <span>{prompt.length} chars</span>
                    </div>
                  ) : (
                    <span className="text-[10px] text-ink-muted italic hidden sm:inline">
                      Write or chat to set prompt
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Mode View */}
              {promptMode === 'chat' ? (
                <div className="rounded-2xl border border-line bg-surface overflow-hidden shadow-2xs flex flex-col">
                  {/* Chat Messages Stream */}
                  <div className="p-4 space-y-3 max-h-72 min-h-48 overflow-y-auto bg-inset/30">
                    {chatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={cn(
                          'flex gap-2.5 items-start',
                          msg.sender === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {msg.sender === 'assistant' && (
                          <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                            <Bot size={13} className="text-brand-600 dark:text-brand-400" />
                          </div>
                        )}
                        <div
                          className={cn(
                            'rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed max-w-[85%] shadow-2xs space-y-2',
                            msg.sender === 'user'
                              ? 'bg-brand-500 text-white font-medium rounded-tr-xs'
                              : 'bg-surface border border-line text-ink rounded-tl-xs'
                          )}
                        >
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                          {msg.suggestedPrompt && (
                            <div className="pt-2 border-t border-line-subtle flex items-center justify-between gap-2">
                              <span className="text-[10px] text-ink-muted truncate">
                                {prompt === msg.suggestedPrompt ? '✓ Applied as production prompt' : 'Ready to use as prompt'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setPrompt(msg.suggestedPrompt!)}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer shrink-0"
                              >
                                <Check size={11} />
                                <span>{prompt === msg.suggestedPrompt ? 'Applied' : 'Use as Prompt'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {isChatSending && (
                      <div className="flex gap-2.5 items-start justify-start">
                        <div className="w-6 h-6 rounded-lg bg-brand-500/15 border border-brand-500/30 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot size={13} className="text-brand-600 dark:text-brand-400" />
                        </div>
                        <div className="rounded-2xl rounded-tl-xs px-3.5 py-2.5 bg-surface border border-line text-xs text-ink-muted shadow-2xs flex items-center gap-2">
                          <Loader2 size={13} className="animate-spin text-brand-500" />
                          <span>AI Architect is designing your workflow requirements…</span>
                        </div>
                      </div>
                    )}
                    <div ref={chatMessagesEndRef} />
                  </div>

                  {/* Chat Input Bar */}
                  <div className="p-3 border-t border-line bg-surface">
                    <div className="flex items-end gap-2">
                      <textarea
                        rows={2}
                        value={chatInput}
                        onChange={(e) => {
                          setChatInput(e.target.value);
                          if (!prompt.trim() || chatMessages.length <= 1) {
                            setPrompt(e.target.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendChatMessage();
                          }
                        }}
                        placeholder="Type your prompt or chat with AI to design the workflow... (Enter to send, Shift+Enter for new line)"
                        className="flex-1 bg-inset border border-line rounded-xl px-3.5 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-brand-500 focus:outline-none resize-none leading-relaxed shadow-2xs"
                      />
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        icon={Send}
                        loading={isChatSending}
                        disabled={!chatInput.trim()}
                        onClick={handleSendChatMessage}
                        className="shrink-0 h-10 px-4"
                      >
                        Send
                      </Button>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-[10px] text-ink-muted px-1">
                      <span>Chat with AI to refine requirements, or type prompt directly</span>
                      {prompt.trim() && (
                        <button
                          type="button"
                          onClick={() => setPromptMode('prompt')}
                          className="text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                        >
                          Open Prompt Editor ({prompt.length} chars) →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* Direct Prompt Editor Mode */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-ink flex items-center gap-1.5">
                      <Sparkles size={13} className="text-amber-500" />
                      Production Prompt & Objective
                    </label>
                    <button
                      type="button"
                      onClick={handleExpandPromptWithAI}
                      disabled={isExpandingPrompt || !prompt.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1 text-2xs font-semibold text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20 active:scale-[0.98] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                      title="Enhance objective using configured AI model"
                    >
                      {isExpandingPrompt ? (
                        <Loader2 size={12} className="animate-spin text-brand-600 dark:text-brand-400 shrink-0" />
                      ) : (
                        <Sparkles size={12} className="text-amber-500 shrink-0" />
                      )}
                      <span>{isExpandingPrompt ? 'Enhancing with AI…' : 'Expand Prompt with AI'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={8}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe what you want your autonomous team of agents to build, analyze, or automate in detail... e.g.:&#10;&#10;Review the repository, build responsive UI components, connect Express API routes with Prisma models, and generate live deployment deliverables."
                    className="w-full rounded-2xl border border-line bg-surface p-4 text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed font-sans min-h-[180px]"
                  />
                  <div className="flex items-center justify-between text-2xs text-ink-muted px-1">
                    <span>
                      {prompt.trim() ? prompt.trim().split(/\s+/).filter(Boolean).length : 0} words · {prompt.length} characters
                    </span>
                    <div className="flex items-center gap-3">
                      {prompt.trim() && (
                        <button
                          type="button"
                          onClick={() => setPrompt('')}
                          className="text-rose-500 hover:underline cursor-pointer"
                        >
                          Clear prompt
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPromptMode('chat')}
                        className="text-brand-600 dark:text-brand-400 font-semibold hover:underline cursor-pointer"
                      >
                        ← Back to Chat & Brainstorm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Model Engine & Team Size Options */}
            <div className="rounded-2xl border border-line-subtle bg-inset/50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <Cpu size={14} className="text-brand-500" />
                  Inference Model Engine
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  {engineBadge}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-medium text-ink-muted mb-1">
                    Select Inference Model (Gemini, OpenCode, Cloud, Local)
                  </label>
                  <CustomSelect
                    value={selectedModel}
                    onChange={(val) => {
                      setSelectedModel(val);
                      localStorage.setItem('nexus:process_model', val);
                    }}
                    upward
                    options={modelOptions}
                  />
                  <p className="mt-1 text-[10px] text-ink-muted">
                    * Available from Settings (Google Gemini, OpenCode CLI, Anthropic, OpenAI, or Local PC hardware).
                  </p>
                </div>

                <div>
                  <label className="block text-2xs font-medium text-ink-muted mb-1">Fleet Team Size</label>
                  <CustomSelect
                    value={agentCount}
                    onChange={(val) => setAgentCount(val)}
                    upward
                    options={[
                      { value: 'auto', label: '✨ Auto (AI decides optimal stages)' },
                      { value: '1', label: '1 Agent (Solo Specialist)' },
                      { value: '2', label: '2 Agents (Planner + Deliverables Engineer)' },
                      { value: '3', label: '3 Agents (Planner + Engineer + QA Reviewer)' },
                      { value: '4', label: '4 Agents (Full Autonomous Team)' },
                    ]}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: CURL COMMAND & API INTEGRATIONS                                    */}
        {/* ========================================================================= */}
        {step === 'curl' && (
          <div className="space-y-4">
            {/* Header bar with Add API button */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <span className="text-xs font-bold text-ink block">API Integrations & cURL Endpoints</span>
                <span className="text-2xs text-ink-muted block">
                  Add one or multiple custom APIs & cURL commands for your autonomous agent fleet.
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddApiEndpoint}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20 active:scale-[0.98] transition-all cursor-pointer shadow-2xs"
              >
                <Plus size={13} />
                <span>+ Add Another API</span>
              </button>
            </div>

            {/* ── API #1: PRIMARY ENDPOINT ── */}
            <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-2xs space-y-3.5">
              <div className="flex items-center justify-between border-b border-line-subtle pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-brand-500/15 text-brand-600 dark:text-brand-400 font-mono text-2xs font-bold shrink-0">
                    API #1 (Primary)
                  </span>
                  <span className="text-xs font-bold text-ink">Primary API / Model Endpoint</span>
                </div>

                <div className="flex items-center gap-2">
                  {testStatus !== 'idle' && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold',
                        testStatus === 'testing' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
                        testStatus === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
                        testStatus === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
                      )}
                    >
                      {testStatus === 'testing' && <RefreshCw size={10} className="animate-spin" />}
                      {testStatus === 'success' && <CheckCircle2 size={10} />}
                      {testStatus === 'failed' && <AlertCircle size={10} />}
                      {testMessage}
                    </span>
                  )}
                </div>
              </div>

              {/* cURL input area */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-2xs font-bold text-ink flex items-center gap-1.5">
                    <Terminal size={12} className="text-brand-500" />
                    Paste Raw cURL Command
                  </label>
                  <button
                    type="button"
                    onClick={() => handleParseAndSaveCurl()}
                    disabled={!curlInput.trim()}
                    className={cn(
                      'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-2xs font-bold transition-all cursor-pointer',
                      curlSaved
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                        : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20'
                    )}
                  >
                    {curlSaved ? <Check size={11} /> : <Save size={11} />}
                    <span>{curlSaved ? '✓ cURL Parsed & Saved' : 'Save & Parse cURL'}</span>
                  </button>
                </div>

                <textarea
                  rows={2.5}
                  value={curlInput}
                  onChange={(e) => {
                    setCurlInput(e.target.value);
                    handleParseAndSaveCurl(e.target.value);
                  }}
                  placeholder="curl -X POST https://api.example.com/v1/chat \
  -H 'Authorization: Bearer sk-...' \
  -H 'Content-Type: application/json' \
  -d '{&quot;model&quot;: &quot;gpt-4o&quot;, &quot;prompt&quot;: &quot;build agent&quot;}'"
                  className="w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                />
              </div>

              {/* Extracted Details */}
              <div className="rounded-xl border border-line-subtle bg-inset/30 p-3 space-y-2.5">
                <div className="flex items-center gap-1.5 text-2xs font-bold text-ink">
                  <Zap size={12} className="text-brand-500" />
                  <span>Extracted API Endpoint & Connection</span>
                </div>

                <div className="flex gap-2">
                  <div className="w-28 shrink-0">
                    <CustomSelect
                      value={apiMethod}
                      onChange={(val) => setApiMethod(val)}
                      options={[
                        { value: 'GET', label: 'GET' },
                        { value: 'POST', label: 'POST' },
                        { value: 'PUT', label: 'PUT' },
                        { value: 'PATCH', label: 'PATCH' },
                        { value: 'DELETE', label: 'DELETE' },
                      ]}
                    />
                  </div>
                  <input
                    type="text"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://api.example.com/v1/endpoint"
                    className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-ink-muted">
                    <Key size={12} />
                  </span>
                  <input
                    type="text"
                    value={apiAuthHeader}
                    onChange={(e) => setApiAuthHeader(e.target.value)}
                    placeholder="Authorization: Bearer sk-... or API Key"
                    className="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>

                {apiMethod !== 'GET' && (
                  <div>
                    <label className="block text-[10px] font-semibold text-ink-muted mb-1 uppercase tracking-wider">
                      Request Payload (JSON Body)
                    </label>
                    <textarea
                      rows={2}
                      value={apiBody}
                      onChange={(e) => setApiBody(e.target.value)}
                      placeholder='{"key": "value"}'
                      className="w-full rounded-xl border border-line bg-inset/40 p-2.5 font-mono text-2xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleTestApi}
                    disabled={testStatus === 'testing' || !apiUrl.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-hover hover:border-brand-500 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <Send size={12} className={testStatus === 'testing' ? 'animate-pulse text-brand-500' : 'text-brand-500'} />
                    <span>{testStatus === 'testing' ? 'Testing Connection…' : 'Test Connection'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveParsedApi}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                      apiSaved
                        ? 'bg-emerald-500 text-white shadow-xs'
                        : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20'
                    )}
                  >
                    {apiSaved ? <Check size={12} /> : <Save size={12} />}
                    <span>{apiSaved ? '✓ API Saved' : 'Save API Configuration'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ── ADDITIONAL CONFIGURED APIS ── */}
            {apiEndpoints.map((ep, idx) => (
              <div key={ep.id} className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-2xs space-y-3.5 animate-scale-in">
                <div className="flex items-center justify-between border-b border-line-subtle pb-2.5">
                  <div className="flex items-center gap-2 flex-1 mr-2">
                    <span className="inline-flex items-center justify-center h-5 px-1.5 rounded-md bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono text-2xs font-bold shrink-0">
                      API #{idx + 2}
                    </span>
                    <input
                      type="text"
                      value={ep.name}
                      onChange={(e) => handleUpdateApiEndpoint(ep.id, 'name', e.target.value)}
                      placeholder="API Name (e.g. Payment Gateway, Vector DB, Search API)"
                      className="text-xs font-bold text-ink bg-transparent border-b border-dashed border-line hover:border-brand-500 focus:border-brand-500 focus:outline-none px-1 py-0.5 flex-1 max-w-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {ep.testStatus !== 'idle' && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold',
                          ep.testStatus === 'testing' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25',
                          ep.testStatus === 'success' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25',
                          ep.testStatus === 'failed' && 'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/25'
                        )}
                      >
                        {ep.testStatus === 'testing' && <RefreshCw size={10} className="animate-spin" />}
                        {ep.testStatus === 'success' && <CheckCircle2 size={10} />}
                        {ep.testStatus === 'failed' && <AlertCircle size={10} />}
                        {ep.testMessage}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveApiEndpoint(ep.id)}
                      className="p-1 rounded-lg text-ink-muted hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Remove this API"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Raw cURL Input for this API */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-2xs font-bold text-ink flex items-center gap-1.5">
                      <Terminal size={11} className="text-brand-500" />
                      Paste cURL Command (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => handleParseCurlForEndpoint(ep.id, ep.curlInput)}
                      disabled={!ep.curlInput.trim()}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold transition-all cursor-pointer',
                        ep.saved
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20'
                      )}
                    >
                      {ep.saved ? <Check size={10} /> : <Save size={10} />}
                      <span>{ep.saved ? '✓ Parsed' : 'Save & Parse cURL'}</span>
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={ep.curlInput}
                    onChange={(e) => {
                      handleUpdateApiEndpoint(ep.id, 'curlInput', e.target.value);
                      handleParseCurlForEndpoint(ep.id, e.target.value);
                    }}
                    placeholder={`curl -X POST https://api.service.com/v1/endpoint \\\n  -H 'Authorization: Bearer sk-...'`}
                    className="w-full rounded-xl border border-line bg-surface p-2.5 font-mono text-2xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                  />
                </div>

                {/* Extracted Fields */}
                <div className="rounded-xl border border-line-subtle bg-inset/30 p-3 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-2xs font-bold text-ink">
                    <Zap size={12} className="text-brand-500" />
                    <span>Endpoint & Connection Details</span>
                  </div>

                  <div className="flex gap-2">
                    <div className="w-28 shrink-0">
                      <CustomSelect
                        value={ep.method}
                        onChange={(val) => handleUpdateApiEndpoint(ep.id, 'method', val)}
                        options={[
                          { value: 'GET', label: 'GET' },
                          { value: 'POST', label: 'POST' },
                          { value: 'PUT', label: 'PUT' },
                          { value: 'PATCH', label: 'PATCH' },
                          { value: 'DELETE', label: 'DELETE' },
                        ]}
                      />
                    </div>
                    <input
                      type="text"
                      value={ep.url}
                      onChange={(e) => handleUpdateApiEndpoint(ep.id, 'url', e.target.value)}
                      placeholder="https://api.service.com/v1/endpoint"
                      className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  <div className="relative flex-1">
                    <span className="absolute left-3 top-2.5 text-ink-muted">
                      <Key size={12} />
                    </span>
                    <input
                      type="text"
                      value={ep.authHeader}
                      onChange={(e) => handleUpdateApiEndpoint(ep.id, 'authHeader', e.target.value)}
                      placeholder="Authorization: Bearer sk-... or API Key"
                      className="w-full rounded-xl border border-line bg-surface pl-8 pr-3 py-2 font-mono text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>

                  {ep.method !== 'GET' && (
                    <div>
                      <label className="block text-[10px] font-semibold text-ink-muted mb-1 uppercase tracking-wider">
                        Request Payload (JSON Body)
                      </label>
                      <textarea
                        rows={2}
                        value={ep.body}
                        onChange={(e) => handleUpdateApiEndpoint(ep.id, 'body', e.target.value)}
                        placeholder='{"key": "value"}'
                        className="w-full rounded-xl border border-line bg-inset/40 p-2.5 font-mono text-2xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
                      />
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleTestApiForEndpoint(ep.id)}
                      disabled={ep.testStatus === 'testing' || !ep.url.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-surface border border-line px-3 py-1.5 text-xs font-bold text-ink hover:bg-hover hover:border-brand-500 transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      <Send size={12} className={ep.testStatus === 'testing' ? 'animate-pulse text-brand-500' : 'text-brand-500'} />
                      <span>{ep.testStatus === 'testing' ? 'Testing…' : 'Test Connection'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSaveApiForEndpoint(ep.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer',
                        ep.saved
                          ? 'bg-emerald-500 text-white shadow-xs'
                          : 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/25 hover:bg-brand-500/20'
                      )}
                    >
                      {ep.saved ? <Check size={12} /> : <Save size={12} />}
                      <span>{ep.saved ? '✓ Saved' : 'Save Configuration'}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Prominent "+ Add Another API" card button */}
            <button
              type="button"
              onClick={handleAddApiEndpoint}
              className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-brand-500/35 hover:border-brand-500 bg-brand-500/5 hover:bg-brand-500/10 py-3.5 text-xs font-bold text-brand-600 dark:text-brand-400 transition-all cursor-pointer shadow-2xs group"
            >
              <div className="w-5 h-5 rounded-full bg-brand-500/15 group-hover:bg-brand-500/25 flex items-center justify-center transition-all">
                <Plus size={13} />
              </div>
              <span>+ Add Another API / cURL Connection ({apiEndpoints.length + 1} Configured)</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: GITHUB REPO & VERCEL DEPLOYMENT                                    */}
        {/* ========================================================================= */}
        {step === 'github' && (
          <div className="space-y-4">
            {/* GitHub Repository Mode: Existing vs Create New */}
            <div className="rounded-2xl border border-line-subtle bg-surface p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-line-subtle pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Github size={13} />
                  </div>
                  <span className="text-xs font-bold text-ink">GitHub Repository Source</span>
                </div>

                {/* Mode switcher: Existing vs New */}
                <div className="flex rounded-lg bg-inset p-0.5 border border-line-subtle text-2xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setRepoMode('existing')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all cursor-pointer',
                      repoMode === 'existing'
                        ? 'bg-surface text-ink font-bold shadow-xs border border-line-subtle'
                        : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    Existing Repo
                  </button>
                  <button
                    type="button"
                    onClick={() => setRepoMode('new')}
                    className={cn(
                      'px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer',
                      repoMode === 'new'
                        ? 'bg-surface text-purple-600 dark:text-purple-400 font-bold shadow-xs border border-line-subtle'
                        : 'text-ink-muted hover:text-ink'
                    )}
                  >
                    <Plus size={10} />
                    <span>Create New Repo</span>
                  </button>
                </div>
              </div>

              {repoMode === 'existing' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-2">
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Select Target Repository</label>
                    <CustomSelect
                      value={repoInput}
                      onChange={(val) => {
                        setRepoInput(val);
                        const found = repoList.find((r) => r.full_name === val);
                        if (found) setRepoBranch(found.default_branch || 'main');
                      }}
                      options={repoList.map((r) => ({
                        value: r.full_name,
                        label: r.full_name,
                        badge: r.default_branch,
                      }))}
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-medium text-ink-muted mb-1">Target Branch</label>
                    <input
                      type="text"
                      value={repoBranch}
                      onChange={(e) => setRepoBranch(e.target.value)}
                      placeholder="main"
                      className="w-full rounded-xl border border-line bg-surface p-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
              ) : (
                /* Create New Repository Form */
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="block text-2xs font-medium text-ink-muted mb-1">New Repository Name</label>
                      <div className="flex items-center">
                        <span className="px-2.5 py-2 rounded-l-xl bg-inset border border-r-0 border-line text-2xs font-mono text-ink-muted">
                          {config.defaultGithubOwner || 'GitHub account'} /
                        </span>
                        <input
                          type="text"
                          value={newRepoName}
                          onChange={(e) => setNewRepoName(e.target.value)}
                          placeholder="nexus-autonomous-app"
                          className="flex-1 rounded-r-xl border border-line bg-surface p-2 font-mono text-xs text-ink focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-2xs font-medium text-ink-muted mb-1">Visibility</label>
                      <div className="flex rounded-xl bg-inset p-1 border border-line text-2xs font-semibold">
                        <button
                          type="button"
                          onClick={() => setNewRepoVisibility('public')}
                          className={cn(
                            'flex-1 py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 cursor-pointer',
                            newRepoVisibility === 'public'
                              ? 'bg-surface text-ink font-bold shadow-xs'
                              : 'text-ink-muted'
                          )}
                        >
                          <Globe size={11} />
                          Public
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewRepoVisibility('private')}
                          className={cn(
                            'flex-1 py-1 rounded-lg text-center transition-all flex items-center justify-center gap-1 cursor-pointer',
                            newRepoVisibility === 'private'
                              ? 'bg-surface text-ink font-bold shadow-xs'
                              : 'text-ink-muted'
                          )}
                        >
                          <Lock size={11} />
                          Private
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={newRepoDescription}
                        onChange={(e) => setNewRepoDescription(e.target.value)}
                        placeholder="Repository description (optional)..."
                        className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-1">
                      <input
                        type="checkbox"
                        id="initReadme"
                        checked={initReadme}
                        onChange={(e) => setInitReadme(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-line text-brand-600 focus:ring-brand-500 cursor-pointer"
                      />
                      <label htmlFor="initReadme" className="text-2xs font-medium text-ink-muted cursor-pointer">
                        Init README & .gitignore
                      </label>
                    </div>
                  </div>

                  {/* Create on GitHub Action Bar */}
                  <div className="flex items-center justify-between gap-3 pt-1 border-t border-line-subtle">
                    {createdRepoResult ? (
                      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                        <Check size={14} />
                        <span>Created: {createdRepoResult.full_name}</span>
                        <a
                          href={createdRepoResult.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5 ml-1"
                        >
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ) : (
                      <span className="text-2xs text-ink-muted">
                        Repo will be initialized on your connected GitHub account.
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={handleCreateRepoOnGitHub}
                      disabled={creatingRepo || !newRepoName.trim() || !!createdRepoResult}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer',
                        createdRepoResult
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                          : 'bg-brand-600 text-white shadow-xs hover:bg-brand-700 disabled:opacity-50'
                      )}
                    >
                      {creatingRepo ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : createdRepoResult ? (
                        <Check size={13} />
                      ) : (
                        <Zap size={13} />
                      )}
                      <span>
                        {creatingRepo
                          ? 'Creating Repo…'
                          : createdRepoResult
                          ? 'Created on GitHub'
                          : 'Create on GitHub'}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Vercel Auto-Deployment Check / Uncheck Card */}
            <div
              onClick={() => {
                if (isVercelConnected) {
                  setVercelAutoDeploy(!vercelAutoDeploy);
                }
              }}
              className={cn(
                'rounded-2xl border p-4 shadow-2xs transition-all flex items-start justify-between gap-3',
                !isVercelConnected
                  ? 'border-rose-500/30 bg-rose-500/5 cursor-not-allowed'
                  : vercelAutoDeploy
                  ? 'border-emerald-500/30 bg-surface ring-1 ring-emerald-500/15 cursor-pointer'
                  : 'border-line-subtle bg-inset/40 hover:bg-surface cursor-pointer'
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
                    !isVercelConnected
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                      : vercelAutoDeploy
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                      : 'bg-inset text-ink-muted border border-line-subtle'
                  )}
                >
                  <Globe size={16} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-ink">Auto-Deploy to Vercel</span>
                    {!isVercelConnected ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400 border border-rose-500/25">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        Not Connected in Settings
                      </span>
                    ) : vercelAutoDeploy ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Connected & Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-inset px-2 py-0.5 text-[10px] font-medium text-ink-muted border border-line-subtle">
                        Disabled (Local / Git Only)
                      </span>
                    )}
                  </div>
                  <p className="text-2xs text-ink-muted leading-relaxed">
                    {!isVercelConnected
                      ? 'Vercel is not connected. Add your Vercel Token in Settings > Integrations to enable automatic cloud deployments.'
                      : 'Connected via Settings credentials. Autonomous agents will automatically detect framework, configure cloud build, and deploy live.'}
                  </p>
                </div>
              </div>

              <input
                type="checkbox"
                disabled={!isVercelConnected}
                checked={isVercelConnected && vercelAutoDeploy}
                onChange={(e) => {
                  if (isVercelConnected) {
                    setVercelAutoDeploy(e.target.checked);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'h-4 w-4 rounded border-line mt-1',
                  !isVercelConnected
                    ? 'opacity-40 cursor-not-allowed'
                    : 'text-emerald-600 focus:ring-emerald-500 cursor-pointer'
                )}
              />
            </div>

            {/* Repository & Deployment Prompt Goal */}
            <div>
              <label className="block text-xs font-semibold text-ink mb-1">
                Fleet Instructions for Repository & Deployment
              </label>
              <textarea
                rows={2.5}
                value={repoGoal}
                onChange={(e) => setRepoGoal(e.target.value)}
                placeholder="Review codebase, create production deliverables, execute Vercel build verification, and auto-resolve any deployment issues..."
                className="w-full rounded-xl border border-line bg-surface p-3 text-xs text-ink placeholder:text-ink-faint shadow-inner focus:outline-none focus:ring-1 focus:ring-brand-500 leading-relaxed"
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: REVIEW & DEPLOY PLANNED AGENT FLEET                               */}
        {/* ========================================================================= */}
        {step === 'review' && (
          <div className="space-y-4">
            {/* Plan Summary Header & Edit with AI Button */}
            <div className="rounded-2xl border border-line-subtle bg-surface p-4 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
                      <Bot size={14} />
                    </span>
                    <h4 className="text-sm font-bold text-ink">{plan?.name}</h4>
                  </div>
                  <p className="text-xs text-ink-muted leading-relaxed">{plan?.summary}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAiEdit(!showAiEdit)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0 cursor-pointer',
                    showAiEdit
                      ? 'bg-purple-500 text-white shadow-xs'
                      : 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25 hover:bg-purple-500/20'
                  )}
                >
                  <Sparkles size={13} className={isAiEditing ? 'animate-spin' : ''} />
                  <span>{showAiEdit ? 'Close AI Editor' : '✨ Edit with AI'}</span>
                </button>
              </div>

              {/* AI Edit / Customization Prompt Panel */}
              {showAiEdit && (
                <div className="rounded-xl border border-purple-500/25 bg-purple-500/5 p-3.5 space-y-2.5 animate-scale-in">
                  <div className="flex items-center justify-between">
                    <label className="block text-2xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Wand2 size={12} />
                      Prompt AI to Customize Agent Fleet:
                    </label>
                    {aiEditSuccess && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <Check size={10} />
                        Fleet Updated by AI!
                      </span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiEditPrompt}
                      onChange={(e) => setAiEditPrompt(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleApplyAiEdit();
                      }}
                      placeholder='e.g. "Add a QA Security Pentester in stage 2", "Make the team leaner with only 3 agents", "Focus on React 19"'
                      className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-purple-500"
                    />
                    <button
                      type="button"
                      onClick={() => handleApplyAiEdit()}
                      disabled={isAiEditing || !aiEditPrompt.trim()}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                    >
                      {isAiEditing ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                      <span>{isAiEditing ? 'Customizing…' : 'Apply AI Edit'}</span>
                    </button>
                  </div>

                  {/* 1-Click Quick Customization Suggestions */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Quick Suggestions:</span>
                    {[
                      { label: '🛡️ Add Security Specialist', prompt: 'Add a dedicated OWASP Security & Secret Auditing specialist agent to the pipeline.' },
                      { label: '⚡ Leaner Team (3 Agents)', prompt: 'Make the fleet leaner with a total of 3 highly focused specialist agents.' },
                      { label: '🧪 Add Regression QA Agent', prompt: 'Add an automated QA reviewer and regression test specialist before deployment.' },
                      { label: '📝 Add Docs Writer', prompt: 'Add a technical documentation and OpenAPI specification writer agent.' },
                    ].map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => {
                          setAiEditPrompt(chip.prompt);
                          handleApplyAiEdit(chip.prompt);
                        }}
                        disabled={isAiEditing}
                        className="rounded-lg border border-purple-500/20 bg-surface/80 px-2 py-0.5 text-[10px] font-medium text-ink-muted hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Planned Stages */}
            <div className="space-y-3">
              <span className="block text-xs font-bold uppercase tracking-wider text-ink">
                Planned Agent Stages ({plan?.agents.length} Autonomous Agents)
              </span>
              {plan?.stages.map((stage) => {
                const stageAgents = plan.agents.filter((a) => a.stage === stage.stage);
                return (
                  <div key={stage.stage} className="rounded-2xl border border-line-subtle bg-inset/40 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-ink flex items-center gap-1.5">
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500/10 text-2xs font-bold text-brand-600">
                          {stage.stage}
                        </span>
                        {stage.name}
                      </span>
                      <span className="text-2xs text-ink-faint">{stage.description}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {stageAgents.map((ag) => (
                        <div key={ag.name} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={ag.name} emoji={ag.avatar} size="sm" />
                            <div className="min-w-0 flex-1">
                              <span className="block text-xs font-bold text-ink truncate">{ag.name}</span>
                              <span className="block text-2xs text-brand-600 dark:text-brand-400 font-semibold truncate">{ag.role}</span>
                            </div>
                          </div>

                          {/* Soul Library Integration */}
                          <div className="flex items-center gap-2 pt-1.5 border-t border-line-subtle">
                            <span className="text-[10px] font-bold text-ink-muted shrink-0 flex items-center gap-1">
                              <Sparkles size={11} className="text-brand-500" />
                              Soul:
                            </span>
                            <select
                              value={ag.soulTemplateId || ''}
                              onChange={(e) => handleAssignSoul(ag.name, e.target.value)}
                              className="text-[11px] font-medium bg-inset border border-line rounded-lg px-2 py-1 text-ink flex-1 truncate outline-none focus:border-brand-500 cursor-pointer"
                            >
                              <option value="">Custom Soul Prompt</option>
                              {soulTemplates.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name} ({st.category})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => setEditingAgentSoul({ agentName: ag.name, soulMd: ag.soulMd, templateId: ag.soulTemplateId || undefined })}
                              className="text-[10px] text-brand-600 dark:text-brand-400 hover:underline font-semibold shrink-0 cursor-pointer"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            {/* Connected APIs Summary Card in Review Step */}
            {(curlInput.trim() || apiUrl.trim() || apiEndpoints.length > 0) && (
              <div className="rounded-2xl border border-line-subtle bg-surface p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-2xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <Zap size={12} className="text-brand-500" />
                    Configured API Integrations ({Boolean(curlInput.trim() || apiUrl.trim()) ? 1 + apiEndpoints.length : apiEndpoints.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep('curl')}
                    className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                  >
                    Edit APIs
                  </button>
                </div>
                <div className="space-y-1.5">
                  {(curlInput.trim() || apiUrl.trim()) && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-inset/40 border border-line-subtle text-xs">
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400 shrink-0">
                          {apiMethod}
                        </span>
                        <span className="font-semibold text-ink shrink-0">API #1 (Primary)</span>
                        <span className="font-mono text-2xs text-ink-muted truncate">{apiUrl || 'cURL Configured'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                        ✓ Ready
                      </span>
                    </div>
                  )}
                  {apiEndpoints.map((ep, idx) => (
                    <div key={ep.id} className="flex items-center justify-between p-2 rounded-xl bg-inset/40 border border-line-subtle text-xs">
                      <div className="flex items-center gap-2 truncate flex-1 mr-2">
                        <span className="font-mono text-2xs font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                          {ep.method}
                        </span>
                        <span className="font-semibold text-ink shrink-0">{ep.name || `API #${idx + 2}`}</span>
                        <span className="font-mono text-2xs text-ink-muted truncate">{ep.url || 'cURL Configured'}</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 shrink-0">
                        ✓ Ready
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            </div>
          </div>
        )}
      </div>

      {editingAgentSoul && (
        <Modal
          open={true}
          onClose={() => setEditingAgentSoul(null)}
          title={`Customize SOUL: ${editingAgentSoul.agentName}`}
        >
          <div className="space-y-3">
            <p className="text-xs text-ink-muted">
              Define the personality, role responsibilities, and constraints from the Soul Library.
            </p>
            <textarea
              value={editingAgentSoul.soulMd}
              onChange={(e) => setEditingAgentSoul({ ...editingAgentSoul, soulMd: e.target.value })}
              rows={12}
              className="w-full p-3 font-mono text-xs rounded-xl bg-inset border border-line text-ink resize-y focus:outline-none focus:border-brand-500"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditingAgentSoul(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (plan) {
                    setPlan({
                      ...plan,
                      agents: plan.agents.map((a) =>
                        a.name === editingAgentSoul.agentName
                          ? { ...a, soulMd: editingAgentSoul.soulMd }
                          : a
                      ),
                    });
                  }
                  setEditingAgentSoul(null);
                }}
              >
                Save Soul Instructions
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
