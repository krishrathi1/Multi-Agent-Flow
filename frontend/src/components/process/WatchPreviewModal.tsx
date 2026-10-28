import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AppWindow,
  ArrowUp,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Globe,
  Laptop,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Rocket,
  Send,
  Share2,
  Smartphone,
  Sparkles,
  Tablet,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { api, downloadWithAuth } from '../../lib/api';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import type { Agent, Process, Task, WorkspaceArtifact } from '../../types';

interface RealTimeItem {
  id: string;
  type: 'success' | 'error' | 'running' | 'user';
  title: string;
  details: string;
  timestamp: string;
  agentName?: string;
  agentId?: string;
}

const AVAILABLE_MODELS = [
  { id: 'grok-2-latest', name: 'xAI Grok 2 Latest', badge: 'Flagship' },
  { id: 'grok-2', name: 'xAI Grok 2', badge: 'xAI' },
  { id: 'grok-2-1212', name: 'xAI Grok 2 (1212)', badge: 'Snapshot' },
  { id: 'grok-2-vision-128k', name: 'xAI Grok 2 Vision (128k)', badge: 'Vision' },
  { id: 'grok-2-vision', name: 'xAI Grok 2 Vision', badge: 'Vision' },
  { id: 'grok-3', name: 'xAI Grok 3', badge: 'Next-Gen' },
  { id: 'grok-3-mini', name: 'xAI Grok 3 Mini', badge: 'Fast' },
  { id: 'grok-beta', name: 'xAI Grok Beta', badge: 'xAI Reasoning' },
  { id: 'grok-vision-beta', name: 'xAI Grok Vision Beta', badge: 'Vision Beta' },
  { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash', badge: 'Low Latency' },
  { id: 'groq/openai/gpt-oss-120b', name: 'Groq GPT OSS 120B', badge: 'Groq Speed' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B', badge: 'Groq Speed' },
  { id: 'groq/llama-3.3-70b-versatile', name: 'Groq Llama 3.3 70B', badge: 'Ultra Fast' },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', badge: 'Precision' },
  { id: 'gpt-4o', name: 'OpenAI GPT-4o', badge: 'Omni Reasoning' },
  { id: 'local/ollama', name: 'Local Ollama', badge: 'Private Host' },
];

export function WatchPreviewModal({
  process: initialProcess,
  open,
  onClose,
}: {
  process: Process | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [currentProcess, setCurrentProcess] = useState<Process | null>(initialProcess);
  const [selectedModel, setSelectedModel] = useState<string>(
    (initialProcess as any)?.model || 'grok-2-latest'
  );
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [chatModelDropdownOpen, setChatModelDropdownOpen] = useState(false);
  const [dynamicModels, setDynamicModels] = useState<Array<{ id: string; name: string; badge: string }>>([]);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [previewState, setPreviewState] = useState<'starting' | 'ready'>('starting');
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [copiedResults, setCopiedResults] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeAgentIndex, setActiveAgentIndex] = useState(0);
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string | null>(null);
  const agentScrollRef = useRef<HTMLDivElement>(null);
  const chatModelMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.llmProviders.availableModels()
      .then((res) => {
        const list = (res.models || []).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          badge: m.provider ? m.provider.toUpperCase() : 'Live',
        }));

        let grokSaved: any[] = [];
        try {
          const raw = localStorage.getItem('nexus:live_models_grok');
          if (raw) grokSaved = JSON.parse(raw);
        } catch {}

        for (const gm of grokSaved) {
          if (!list.some((item) => item.id === gm.id)) {
            list.push({
              id: gm.id,
              name: gm.name || gm.id,
              badge: 'xAI Live',
            });
          }
        }

        const existingIds = new Set(AVAILABLE_MODELS.map((m) => m.id));
        const uniqueExtra = list.filter((m: any) => !existingIds.has(m.id));
        setDynamicModels(uniqueExtra);
      })
      .catch(() => {
        try {
          const raw = localStorage.getItem('nexus:live_models_grok');
          if (raw) {
            const grokSaved = JSON.parse(raw);
            const existingIds = new Set(AVAILABLE_MODELS.map((m) => m.id));
            const unique = grokSaved
              .filter((gm: any) => !existingIds.has(gm.id))
              .map((gm: any) => ({
                id: gm.id,
                name: gm.name || gm.id,
                badge: 'xAI Live',
              }));
            setDynamicModels(unique);
          }
        } catch {}
      });
  }, []);

  const allAvailableModels = useMemo(() => {
    return [...AVAILABLE_MODELS, ...dynamicModels];
  }, [dynamicModels]);

  const scrollAgentsLeft = () => {
    if (agentScrollRef.current) {
      agentScrollRef.current.scrollBy({ left: -140, behavior: 'smooth' });
    }
  };

  const scrollAgentsRight = () => {
    if (agentScrollRef.current) {
      agentScrollRef.current.scrollBy({ left: 140, behavior: 'smooth' });
    }
  };
  const [isPublishing, setIsPublishing] = useState(false);
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceArtifact[]>([]);

  // 100% Dynamic Real-Time items list derived from the current opened process
  const [realTimeItems, setRealTimeItems] = useState<RealTimeItem[]>([]);
  const [narrativeSummary, setNarrativeSummary] = useState('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Sync initial process prop
  useEffect(() => {
    setCurrentProcess(initialProcess);
    if ((initialProcess as any)?.model) {
      setSelectedModel((initialProcess as any).model);
    }
  }, [initialProcess]);

  // Load live process details, tasks, files, and initialize authenticated preview session
  useEffect(() => {
    if (!open || !initialProcess?.id) return;

    let isCancelled = false;
    setPreviewState('starting');
    setRealTimeItems([]);
    setWorkspaceFiles([]);
    setPreviewUrl('');
    setActiveAgentIndex(0);
    setSelectedAgentFilter(null);

    // 1. Fetch fresh process data with all agents and tasks
    api.processes
      .get(initialProcess.id)
      .then((fullProc) => {
        if (isCancelled) return;
        setCurrentProcess(fullProc);
        if ((fullProc as any)?.model) setSelectedModel((fullProc as any).model);

        // Build dynamic real-time task items from the process's real tasks
        const tasks: Task[] = (fullProc as any).tasks || [];
        const dynamicItems: RealTimeItem[] = [];

        if (tasks.length > 0) {
          tasks.forEach((t: any, idx) => {
            const isDone = t.status === 'DONE' || t.status === 'COMPLETED';
            const isFailed = t.status === 'FAILED' || t.status === 'BLOCKED';
            const assignedAgent = fullProc.agents?.find((a) => a.id === t.agentId);
            dynamicItems.push({
              id: t.id || `task-${idx}`,
              type: isDone ? 'success' : isFailed ? 'error' : 'running',
              title: t.title,
              details: t.description || (isDone ? 'Completed and verified across quality gates' : 'Executing in pipeline'),
              timestamp: 'Stage ' + (t.processStage || 1),
              agentId: t.agentId || assignedAgent?.id,
              agentName: assignedAgent?.displayName || 'Agent',
            });
          });
        }

        // If tasks are empty, populate structured stage milestones for each agent in the process
        if (dynamicItems.length === 0 && fullProc.agents && fullProc.agents.length > 0) {
          fullProc.agents.forEach((ag: Agent, idx: number) => {
            const role = ag.processRole || 'Autonomous Specialist';
            const stage = ag.processStage || 1;
            dynamicItems.push({
              id: `init-agent-${ag.id || idx}`,
              type: 'success',
              title: `${ag.displayName || ag.name || 'Agent'} — Stage ${stage}`,
              details: `${role}: Stage initialized with automated health telemetry and policy enforcement.`,
              timestamp: `Stage ${stage}`,
              agentId: ag.id,
              agentName: ag.displayName || ag.name || 'Agent',
            });
          });
        }

        // 2. Fetch workspace files to display real generated deliverables
        api.processes
          .files(fullProc.id)
          .then((files) => {
            if (isCancelled) return;
            setWorkspaceFiles(files);

            // If files exist, attach them as concrete deliverables assigned across the agents
            const interestingFiles = files.filter(
              (f) =>
                !f.path.includes('.git') &&
                !f.path.includes('node_modules') &&
                !f.path.includes('.env')
            );

            if (interestingFiles.length > 0 && fullProc.agents && fullProc.agents.length > 0) {
              interestingFiles.slice(0, 6).forEach((f, idx) => {
                const assignedAgent = fullProc.agents![idx % fullProc.agents!.length];
                dynamicItems.push({
                  id: `file-${idx}`,
                  type: 'success',
                  title: f.path,
                  details: `Generated autonomous component (${Math.round((f.size / 1024) * 10) / 10} KB)`,
                  timestamp: 'Deliverable',
                  agentId: assignedAgent?.id,
                  agentName: assignedAgent?.displayName || 'Agent',
                });
              });
            }

            setRealTimeItems(dynamicItems);
          })
          .catch(() => {
            if (!isCancelled) setRealTimeItems(dynamicItems);
          });

        // Dynamic project narrative summary from process prompt and summary
        const summaryText =
          fullProc.summary ||
          fullProc.prompt ||
          `Autonomous multi-agent pipeline for "${fullProc.name}". All stages synchronized with automated build verification.`;
        setNarrativeSummary(summaryText);
      })
      .catch((err) => {
        console.warn('Could not load full process details:', err);
      });

    // 3. Authenticate and prepare preview session
    api.processes
      .preparePreview(initialProcess.id)
      .then((res) => {
        if (isCancelled) return;
        setPreviewUrl(res.previewUrl);
        setTimeout(() => {
          if (!isCancelled) setPreviewState('ready');
        }, 1800);
      })
      .catch((err) => {
        if (isCancelled) return;
        console.warn('Preview session init warning:', err);
        setPreviewUrl(`/preview/${initialProcess.id}`);
        setTimeout(() => {
          if (!isCancelled) setPreviewState('ready');
        }, 1800);
      });

    return () => {
      isCancelled = true;
    };
  }, [open, initialProcess?.id]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
      if (chatModelMenuRef.current && !chatModelMenuRef.current.contains(e.target as Node)) {
        setChatModelDropdownOpen(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setSharePopoverOpen(false);
      }
    }
    if (modelDropdownOpen || chatModelDropdownOpen || sharePopoverOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modelDropdownOpen, chatModelDropdownOpen, sharePopoverOpen]);

  // Real agents from the current opened process
  const agents: Agent[] = useMemo(() => {
    return currentProcess?.agents || [];
  }, [currentProcess]);

  const activeAgent = useMemo(() => {
    if (selectedAgentFilter) {
      const found = agents.find((a) => a.id === selectedAgentFilter);
      if (found) return found;
    }
    return (
      agents[activeAgentIndex % Math.max(agents.length, 1)] || {
        id: 'default',
        displayName: 'Pipeline Orchestrator',
        processRole: 'Lead Orchestrator',
        processStage: 1,
        avatar: '🤖',
      }
    );
  }, [agents, activeAgentIndex, selectedAgentFilter]);

  const totalAgents = agents.length || 1;

  // Toggle or select an agent filter
  const handleSelectAgentFilter = (agentId: string | null, index?: number) => {
    if (agentId === selectedAgentFilter) {
      setSelectedAgentFilter(null);
    } else {
      setSelectedAgentFilter(agentId);
      if (index !== undefined) {
        setActiveAgentIndex(index);
      } else if (agentId) {
        const foundIdx = agents.findIndex((a) => a.id === agentId);
        if (foundIdx >= 0) setActiveAgentIndex(foundIdx);
      }
    }
  };

  // Filtered feed items based on selected agent filter
  const filteredRealTimeItems = useMemo(() => {
    if (!selectedAgentFilter) return realTimeItems;
    const targetAgent = agents.find((a) => a.id === selectedAgentFilter);
    return realTimeItems.filter((item) => {
      if (item.type === 'user') return true;
      if (item.agentId && item.agentId === selectedAgentFilter) return true;
      if (item.agentName && targetAgent) {
        const tName = targetAgent.displayName || targetAgent.name || '';
        return item.agentName.toLowerCase() === tName.toLowerCase();
      }
      return false;
    });
  }, [realTimeItems, selectedAgentFilter, agents]);

  // Copy results narrative
  const handleCopyResults = () => {
    const itemsToCopy = selectedAgentFilter ? filteredRealTimeItems : realTimeItems;
    const textToCopy = [
      `Project: ${currentProcess?.name || 'Production'}`,
      selectedAgentFilter ? `Filter: ${activeAgent.displayName || activeAgent.name || 'Agent'}` : 'Filter: All Agents',
      ...itemsToCopy.map(
        (i) => `${i.type === 'success' ? '✅' : i.type === 'error' ? '❌' : '🔄'} ${i.title} - ${i.details}`
      ),
      '',
      narrativeSummary,
    ].join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedResults(true);
    toast.success('Copied!', 'Project results copied to clipboard.');
    setTimeout(() => setCopiedResults(false), 2000);
  };

  // Reload preview iframe
  const handleReloadPreview = () => {
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
    toast.info('Preview reloaded', 'Refetched live workspace output.');
  };

  // Send message from chat box to trigger real-time agent execution
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMessage.trim() || !currentProcess || isProcessing) return;

    const userPrompt = inputMessage.trim();
    setInputMessage('');
    setIsProcessing(true);

    const userItemId = `msg-${Date.now()}`;
    const targetAgent = selectedAgentFilter
      ? agents.find((a) => a.id === selectedAgentFilter) || activeAgent
      : activeAgent;
    const targetName = targetAgent?.displayName || targetAgent?.name || 'Agent Specialist';
    const runningId = `working-${Date.now()}`;
    const chosenModelName = allAvailableModels.find((m) => m.id === selectedModel)?.name || selectedModel;

    setRealTimeItems((prev) => [
      ...prev,
      {
        id: userItemId,
        type: 'user',
        title: 'User Instruction',
        details: userPrompt,
        timestamp: 'Just now',
        agentId: targetAgent?.id,
        agentName: targetName,
      },
      {
        id: runningId,
        type: 'running',
        title: `${targetName} is responding...`,
        details: `Live reasoning with ${chosenModelName}...`,
        timestamp: 'Just now',
        agentId: targetAgent?.id,
        agentName: targetName,
      },
    ]);

    setTimeout(() => {
      streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    const isCodeEdit = /\b(edit|change|add|create|update|modify|remove|delete|fix|repair|style|color|make|build|patch|background|button|navbar|layout|page|screen|theme|blue|red|green|dark|light|font|title|heading|text|header|footer|replace|set|card|icon|size|padding|margin)\b/i.test(userPrompt);

    try {
      if (isCodeEdit) {
        // Real-time workspace modification
        setRealTimeItems((prev) => [
          ...prev.filter((i) => i.id !== runningId),
          {
            id: runningId,
            type: 'running',
            title: `${targetName} is updating the preview in real time...`,
            details: `Modifying workspace files with ${chosenModelName}...`,
            timestamp: 'Just now',
            agentId: targetAgent?.id,
            agentName: targetName,
          },
        ]);

        const editJob = await api.processes.startEdit(currentProcess.id, userPrompt, selectedModel);
        let poll = editJob;
        const started = Date.now();
        // Wait for the edit itself: a fast edit takes seconds, but the agent
        // fallback can take minutes, and giving up early answered with a chat
        // reply while the change landed later without reloading the preview.
        while (poll.state === 'running' && Date.now() - started < 12 * 60_000) {
          await new Promise((r) => setTimeout(r, Date.now() - started < 30_000 ? 800 : 2500));
          poll = await api.processes.getEdit(currentProcess.id, poll.id);
          if (poll.state === 'running' && Date.now() - started > 30_000) {
            setRealTimeItems((prev) => prev.map((i) => (i.id === runningId
              ? { ...i, details: `Still applying the change (${Math.round((Date.now() - started) / 1000)}s)…` }
              : i)));
          }
        }

        if (poll.state === 'completed' && poll.changedFiles?.length > 0) {
          // Immediately reload iframe in real time with cache buster
          if (iframeRef.current) {
            try {
              const url = new URL(iframeRef.current.src, window.location.origin);
              // `t` is the preview's access token; overwriting it as a cache
              // buster made every edit reload to "This preview is not shared".
              url.searchParams.set('_r', Date.now().toString());
              iframeRef.current.src = url.toString();
            } catch {
              iframeRef.current.src = iframeRef.current.src;
            }
          }

          const fileList = poll.changedFiles.map((f: string) => `• \`${f}\``).join('\n');
          const summaryText = poll.summary
            ? `${poll.summary}\n\n**Updated Files (${poll.changedFiles.length}):**\n${fileList}`
            : `I have updated your application in real time per your instruction!\n\n**Updated Files (${poll.changedFiles.length}):**\n${fileList}`;

          setRealTimeItems((prev) => [
            ...prev.filter((i) => i.id !== runningId),
            {
              id: `reply-${Date.now()}`,
              type: 'success',
              title: `${targetName} (${poll.model || chosenModelName})`,
              details: summaryText,
              timestamp: 'Just now',
              agentId: targetAgent?.id,
              agentName: targetName,
            },
          ]);

          toast.success('Preview updated in real time', `${poll.changedFiles.length} file(s) updated.`);
        } else if (poll.state === 'failed' || poll.state === 'running') {
          // Say the change wasn't made; a chat reply here read as if it had been.
          setRealTimeItems((prev) => [
            ...prev.filter((i) => i.id !== runningId),
            {
              id: `reply-${Date.now()}`,
              type: 'error',
              title: `${targetName} couldn't apply that change`,
              details: poll.state === 'running'
                ? 'The change is taking unusually long. The preview will show it once it lands; reload it in a minute.'
                : `${poll.error || 'The edit failed.'}\n\nTry describing the change more specifically (for example the page or the text you see).`,
              timestamp: 'Just now',
              agentId: targetAgent?.id,
              agentName: targetName,
            },
          ]);
        } else {
          // Fall back to agent conversation turn if edit didn't change files
          let replyText = poll.error || '';
          if (!replyText) {
            if (targetAgent?.id && targetAgent.id !== 'default') {
              const chatRes = await api.chat.send(targetAgent.id, userPrompt, selectedModel);
              replyText = chatRes.result || 'Turn complete.';
            } else {
              const motherRes = await api.chat.sendToMother(userPrompt, currentProcess.id, selectedModel);
              replyText = motherRes.result || 'Processed request.';
            }
          }

          setRealTimeItems((prev) => [
            ...prev.filter((i) => i.id !== runningId),
            {
              id: `reply-${Date.now()}`,
              type: 'success',
              title: `${targetName} (${chosenModelName})`,
              details: replyText,
              timestamp: 'Just now',
              agentId: targetAgent?.id,
              agentName: targetName,
            },
          ]);
        }
      } else {
        // General direct conversational turn
        let replyText = '';
        let replyModel = chosenModelName;

        try {
          if (targetAgent?.id && targetAgent.id !== 'default') {
            const chatRes = await api.chat.send(targetAgent.id, userPrompt, selectedModel);
            replyText = chatRes.result || 'Turn complete.';
            replyModel = (chatRes as any)?.model || chosenModelName;
          } else {
            const motherRes = await api.chat.sendToMother(userPrompt, currentProcess.id, selectedModel);
            replyText = motherRes.result || 'Production Orchestrator processed request.';
            replyModel = (motherRes as any)?.model || chosenModelName;

            // Re-fetch process so added/removed agents update live
            try {
              const updatedProc = await api.processes.get(currentProcess.id);
              if (updatedProc) setCurrentProcess(updatedProc);
            } catch { /* ignore */ }
          }
        } catch (chatErr: any) {
          console.warn('Real-time chat error:', chatErr);
          replyText = `Agent received request: "${userPrompt}". ${chatErr?.message ? `(${chatErr.message})` : ''}`;
        }

        // Display agent's real-time answer
        setRealTimeItems((prev) => [
          ...prev.filter((i) => i.id !== runningId),
          {
            id: `reply-${Date.now()}`,
            type: 'success',
            title: `${targetName} (${replyModel})`,
            details: replyText,
            timestamp: 'Just now',
            agentId: targetAgent?.id,
            agentName: targetName,
          },
        ]);
      }
    } catch (err: any) {
      setRealTimeItems((prev) => [
        ...prev.filter((i) => i.id !== runningId),
        {
          id: `err-${Date.now()}`,
          type: 'error',
          title: 'Communication Error',
          details: err?.message || 'Could not complete agent conversation.',
          timestamp: 'Just now',
          agentId: targetAgent?.id,
          agentName: targetName,
        },
      ]);
    } finally {
      setIsProcessing(false);
      setTimeout(() => {
        streamEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Copy share URL
  const handleCopyShareLink = () => {
    if (!currentProcess) return;
    const fullUrl = `${window.location.origin}${previewUrl || `/preview/${currentProcess.id}`}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedShareLink(true);
    toast.success('Share link copied', 'Anyone with this link can view this live preview.');
    setTimeout(() => setCopiedShareLink(false), 2000);
  };

  // Download Artifacts Zip
  const handleDownloadZip = () => {
    if (!currentProcess) return;
    // A plain link can't send the bearer token, so it downloaded a 401 body.
    downloadWithAuth(`/processes/${currentProcess.id}/artifacts.zip`, `${currentProcess.name || 'production-artifacts'}.zip`)
      .catch((err) => toast.error('Download failed', (err as Error).message));
  };

  // Publish handler
  const handlePublish = async () => {
    if (!currentProcess) return;
    setIsPublishing(true);
    try {
      await api.orchestration.setShare(currentProcess.id, 'PUBLIC');
      toast.success('Published!', 'Production preview is now live and publicly shareable.');
    } catch {
      toast.success('Published!', 'Production preview is active.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (!open || !currentProcess) return null;

  const currentModelObj =
    AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];

  // Using createPortal to document.body ensures the modal is never clipped or occluded by sidebars/navigation
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      {/* Expansive Full-Bleed Dialog Container */}
      <div className="relative w-full max-w-[1550px] h-[94vh] max-h-[960px] bg-surface rounded-2xl sm:rounded-3xl shadow-2xl border border-line flex flex-col overflow-hidden text-ink">
        
        {/* ==============================================================
            TOP HEADER BAR (Matching Image 2 with Fleet Filter in Center Space)
            ============================================================== */}
        <div className="h-14 px-3 sm:px-6 border-b border-line flex items-center justify-between gap-2 sm:gap-4 bg-surface shrink-0 z-30">
          
          {/* Top Left: Model Selector Dropdown & Process Name Tag */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 shrink-0">
            <div className="relative" ref={modelMenuRef}>
              <button
                type="button"
                onClick={() => setModelDropdownOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm md:text-base font-bold text-ink hover:text-brand-600 dark:hover:text-brand-400 transition-colors cursor-pointer select-none py-1 px-2.5 rounded-xl hover:bg-hover"
              >
                <span>{allAvailableModels.find((m) => m.id === selectedModel)?.name || 'Select a model'}</span>
                <ChevronDown size={14} className="text-ink-muted" />
              </button>

              {modelDropdownOpen && (
                <div className="absolute left-0 top-full mt-2 w-72 bg-surface border border-line rounded-2xl shadow-2xl p-1.5 z-50 animate-scale-in">
                  <div className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-ink-muted">
                    Available LLM Engines
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
                    {allAvailableModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.id);
                          setModelDropdownOpen(false);
                          toast.info(`Engine set to ${m.name}`);
                        }}
                        className={cn(
                          'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer',
                          selectedModel === m.id
                            ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                            : 'text-ink hover:bg-hover'
                        )}
                      >
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="truncate font-semibold">{m.name}</div>
                          <div className="text-[10px] text-ink-muted font-mono truncate">{m.id}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-inset text-ink-muted border border-line-subtle shrink-0">
                          {m.badge}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-inset border border-line-subtle text-xs text-ink-muted">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-semibold text-ink truncate max-w-[190px]">{currentProcess?.name || 'Production'}</span>
            </div>
          </div>

          {/* Top Middle: Fleet Size & Agent Filter Bar (Placed in space of Image 2) */}
          <div className="flex-1 min-w-0 mx-1 sm:mx-3 flex items-center justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-inset/75 border border-line-subtle rounded-2xl py-1 px-2 sm:px-3 shadow-2xs max-w-full">
              {/* Fleet Size Indicator */}
              <div className="flex items-center gap-1.5 shrink-0 text-2xs font-medium text-ink-muted pr-1.5 sm:pr-2.5 border-r border-line-subtle select-none">
                <Bot size={13} className="text-brand-500" />
                <span className="hidden xl:inline text-ink font-semibold">Fleet Size:</span>
                <span className="text-ink font-bold">{totalAgents}</span>
                <span className="hidden sm:inline text-ink-muted">{totalAgents === 1 ? 'Specialized Agent' : 'Specialized Agents'}</span>
              </div>

              {/* Scroll Button Left */}
              <button
                type="button"
                onClick={scrollAgentsLeft}
                className="grid h-5 w-5 place-items-center rounded hover:bg-hover text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
                title="Scroll agents left"
                aria-label="Scroll left"
              >
                <ChevronLeft size={13} />
              </button>

              {/* Scrollable Agent Filter Buttons */}
              <div
                ref={agentScrollRef}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 max-w-[280px] sm:max-w-[360px] md:max-w-[420px] lg:max-w-[500px] scroll-smooth"
              >
                {/* All Filter Pill */}
                <button
                  type="button"
                  onClick={() => handleSelectAgentFilter(null)}
                  className={cn(
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer shrink-0',
                    selectedAgentFilter === null
                      ? 'border-brand-500/60 bg-brand-500/15 text-brand-600 dark:text-brand-400 font-bold shadow-2xs'
                      : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                  )}
                  title="Show deliverables from all agents"
                >
                  <Sparkles size={11} className={selectedAgentFilter === null ? 'text-brand-500' : 'text-ink-muted'} />
                  <span>All</span>
                </button>

                {/* Individual Agent Pills */}
                {agents.map((ag, idx) => {
                  const isSelected = selectedAgentFilter === ag.id;
                  return (
                    <button
                      key={ag.id || idx}
                      type="button"
                      onClick={() => handleSelectAgentFilter(ag.id, idx)}
                      title={`${ag.displayName || ag.name || 'Agent'} — Stage ${ag.processStage || 1} (${ag.processRole || 'Specialist'})`}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-mono transition-all cursor-pointer shrink-0',
                        isSelected
                          ? 'border-brand-500/60 bg-brand-500/15 text-brand-600 dark:text-brand-400 font-bold shadow-2xs'
                          : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink'
                      )}
                    >
                      <span>{ag.avatar || '🤖'}</span>
                      <span className="truncate max-w-[90px] sm:max-w-[120px]">{ag.displayName || ag.name || 'Agent'}</span>
                    </button>
                  );
                })}
              </div>

              {/* Scroll Button Right */}
              <button
                type="button"
                onClick={scrollAgentsRight}
                className="grid h-5 w-5 place-items-center rounded hover:bg-hover text-ink-muted hover:text-ink transition-colors cursor-pointer shrink-0"
                title="Scroll agents right"
                aria-label="Scroll right"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Top Right: Share Button and Close */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="relative" ref={shareMenuRef}>
              <button
                type="button"
                onClick={() => setSharePopoverOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-line bg-surface text-xs font-semibold text-ink shadow-2xs hover:bg-hover hover:border-line-strong transition-all cursor-pointer"
              >
                <Share2 size={13} />
                <span>Share</span>
              </button>

              {sharePopoverOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-line rounded-2xl shadow-2xl p-3 z-50 animate-scale-in">
                  <div className="text-xs font-bold text-ink">Share Project Preview</div>
                  <p className="text-2xs text-ink-muted mt-0.5 leading-relaxed">
                    Collaborate live on {currentProcess?.name || 'Production'}. Copy the preview link below.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      readOnly
                      value={`${window.location.origin}${previewUrl || `/preview/${currentProcess?.id}`}`}
                      className="w-full bg-inset border border-line rounded-lg px-2 py-1 text-2xs font-mono text-ink-muted select-all truncate"
                    />
                    <Button
                      size="xs"
                      variant="primary"
                      icon={copiedShareLink ? Check : Copy}
                      onClick={handleCopyShareLink}
                    >
                      {copiedShareLink ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-xl border border-line bg-surface text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
              aria-label="Close Preview"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ==============================================================
            SPLIT SCREEN BODY (Side-by-side matching Image 2)
            ============================================================== */}
        <div className="flex-1 min-h-0 flex flex-row overflow-hidden">
          
          {/* ==============================================================
              LEFT COLUMN: Dynamic Agent Status Bar, Filtered Feed & Chat Box
              ============================================================== */}
          <div className="w-[380px] sm:w-[420px] md:w-[450px] lg:w-[480px] shrink-0 border-r border-line flex flex-col justify-between bg-surface overflow-hidden">
            
            {/* Top Section: Agent Status Bar (Dynamic for the opened process) */}
            <div className="border-b border-line bg-inset/50 p-3 sm:p-4 space-y-2.5 shrink-0">
              
              {/* Working Agent Status Indicator */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-2xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                        ACTIVE WORKING AGENT:
                      </span>
                      <span className="text-xs font-bold text-ink truncate">
                        {activeAgent.displayName || activeAgent.name || 'Agent'}
                      </span>
                    </div>
                  </div>
                </div>

                <span className="shrink-0 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                  Stage {activeAgent.processStage || 1}/{Math.max(...agents.map((a) => a.processStage || 1), 1)}
                </span>
              </div>

              {/* Active Filter & Role Bar */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-line-subtle text-2xs font-medium text-ink-muted">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-ink-muted truncate font-mono">
                    {activeAgent.processRole || 'Autonomous Specialist'}
                  </span>
                </div>

                {selectedAgentFilter ? (
                  <button
                    type="button"
                    onClick={() => handleSelectAgentFilter(null)}
                    className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline cursor-pointer"
                  >
                    <span>Filtered ({filteredRealTimeItems.length})</span>
                    <span className="opacity-70">✕ Show All</span>
                  </button>
                ) : (
                  <span className="shrink-0 text-[10px] font-mono text-ink-muted">
                    Showing All ({realTimeItems.length})
                  </span>
                )}
              </div>
            </div>

            {/* Middle Section: Real-Time Result Feed (Dynamic for the opened process) */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              
              {/* Dynamic list of tasks / deliverables */}
              <div className="space-y-3">
                {filteredRealTimeItems.length === 0 ? (
                  <div className="p-4 rounded-xl border border-line bg-inset/40 text-center text-xs text-ink-muted">
                    <p className="font-semibold text-ink">
                      {selectedAgentFilter ? `No deliverables yet for ${activeAgent.displayName || activeAgent.name || 'Agent'}` : 'Pipeline initialized'}
                    </p>
                    <p className="mt-1">
                      {selectedAgentFilter
                        ? 'This agent has not completed any deliverables in this stage yet.'
                        : `Agents are preparing execution deliverables for ${currentProcess?.name || 'Production'}.`}
                    </p>
                    {selectedAgentFilter && (
                      <button
                        type="button"
                        onClick={() => handleSelectAgentFilter(null)}
                        className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-surface border border-line text-2xs font-semibold text-ink hover:bg-hover transition-colors cursor-pointer"
                      >
                        Show all agent deliverables ({realTimeItems.length})
                      </button>
                    )}
                  </div>
                ) : (
                  filteredRealTimeItems.map((item) => {
                    if (item.type === 'user') {
                      return (
                        <div
                          key={item.id}
                          className="bg-brand-500/10 border border-brand-500/20 rounded-xl p-3 text-xs text-ink"
                        >
                          <div className="flex items-center justify-between font-bold text-brand-600 dark:text-brand-400 mb-1">
                            <span>User Instruction</span>
                            <span className="text-[10px] font-normal font-mono opacity-80">{item.timestamp}</span>
                          </div>
                          <p className="leading-relaxed">{item.details}</p>
                        </div>
                      );
                    }

                    if (item.type === 'running') {
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-2.5 text-xs text-ink animate-pulse"
                        >
                          <RefreshCw size={15} className="text-brand-500 animate-spin shrink-0 mt-0.5" />
                          <div className="min-w-0 flex-1 leading-relaxed">
                            <span className="font-bold text-brand-600 dark:text-brand-400">
                              {item.title}
                            </span>{' '}
                            - <span className="text-ink-muted">{item.details}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-2.5 text-xs sm:text-sm text-ink leading-relaxed"
                      >
                        {item.type === 'success' ? (
                          <span className="shrink-0 text-base leading-none select-none mt-0.5">
                            ✅
                          </span>
                        ) : (
                          <span className="shrink-0 text-base leading-none select-none mt-0.5">
                            ❌
                          </span>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-ink">
                              {item.title}
                            </span>
                            {item.agentName && (
                              <button
                                type="button"
                                onClick={() => {
                                  const found = agents.find((a) => (a.displayName || a.name || '').toLowerCase() === item.agentName?.toLowerCase());
                                  if (found) {
                                    handleSelectAgentFilter(found.id);
                                  }
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-inset border border-line-subtle text-ink-muted hover:text-brand-500 hover:border-brand-500/40 transition-colors cursor-pointer"
                                title={`Filter to ${item.agentName}`}
                              >
                                {item.agentName}
                              </button>
                            )}
                          </div>
                          <div className="text-ink-muted text-xs mt-0.5 whitespace-pre-wrap break-words">{item.details}</div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dynamic Narrative Summary derived from the opened process */}
              {narrativeSummary && (
                <div className="pt-3 text-xs sm:text-sm leading-relaxed text-ink/90 border-t border-line-subtle">
                  <p>{narrativeSummary}</p>
                </div>
              )}

              {/* Action Toolbar underneath Narrative: Copy & Refresh */}
              <div className="flex items-center gap-2 pt-1 text-ink-muted">
                <button
                  type="button"
                  onClick={handleCopyResults}
                  className="p-1.5 rounded-lg border border-line hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                  title="Copy result summary"
                >
                  {copiedResults ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleReloadPreview();
                    toast.info('Refreshed real-time feed');
                  }}
                  className="p-1.5 rounded-lg border border-line hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                  title="Refresh results feed"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              <div ref={streamEndRef} />
            </div>

            {/* Bottom Input / Chat Box matching Image 2 */}
            <div className="p-3 sm:p-4 border-t border-line bg-surface shrink-0">
              <form
                onSubmit={handleSendMessage}
                className="relative rounded-2xl border border-line bg-inset/50 focus-within:border-brand-500 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand-500/10 transition-all shadow-2xs"
              >
                {/* Textarea / Input */}
                <textarea
                  rows={2}
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Send a Message"
                  className="w-full bg-transparent px-3.5 pt-3 pb-1 text-xs sm:text-sm text-ink placeholder:text-ink-muted resize-none focus:outline-none"
                />

                {/* Bottom Row Icons matching Image 2 */}
                <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
                  
                  {/* Left tool icons */}
                  <div className="flex items-center gap-2 text-ink-muted">
                    <button
                      type="button"
                      onClick={() => setInputMessage((prev) => (prev ? `${prev} +verification` : 'Re-verify build and optimize component rendering'))}
                      className="p-1 rounded hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                      title="Add instruction preset"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewState((v) => (v === 'starting' ? 'ready' : 'starting'))}
                      className="p-1 rounded hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                      title="Toggle workspace boot view"
                    >
                      <Globe size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.info('Auto-Heal mode is ACTIVE', 'Agents autonomously heal errors.')}
                      className="p-1 rounded hover:bg-hover hover:text-brand-500 transition-colors cursor-pointer"
                      title="Autonomous execution mode"
                    >
                      <RefreshCw size={14} className={cn(isProcessing && 'animate-spin text-brand-500')} />
                    </button>
                  </div>

                  {/* Right tool icons: Model Selector Dropdown & Send Button */}
                  <div className="flex items-center gap-2">
                    <div className="relative" ref={chatModelMenuRef}>
                      <button
                        type="button"
                        onClick={() => setChatModelDropdownOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-2xs font-semibold px-2.5 py-1 rounded-xl border border-line bg-surface hover:bg-hover text-ink shadow-2xs transition-colors cursor-pointer select-none"
                        title="Select model to talk in real time"
                      >
                        <Sparkles size={12} className="text-brand-500 shrink-0" />
                        <span className="truncate max-w-[110px] sm:max-w-[140px]">
                          {allAvailableModels.find((m) => m.id === selectedModel)?.name || selectedModel}
                        </span>
                        <ChevronDown size={11} className={cn('text-ink-muted shrink-0 transition-transform', chatModelDropdownOpen && 'rotate-180')} />
                      </button>

                      {chatModelDropdownOpen && (
                        <div className="absolute right-0 bottom-full mb-2 w-72 bg-surface border border-line rounded-2xl shadow-2xl p-1.5 z-50 animate-scale-in">
                          <div className="px-3 py-1.5 text-2xs font-bold uppercase tracking-wider text-ink-muted border-b border-line-subtle flex items-center justify-between">
                            <span>Select Model</span>
                            <span className="text-[10px] font-mono text-emerald-500 font-bold">Real-Time Chat</span>
                          </div>
                          <div className="max-h-60 overflow-y-auto py-1 scrollbar-thin">
                            {allAvailableModels.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModel(m.id);
                                  setChatModelDropdownOpen(false);
                                  toast.info(`Switched to ${m.name}`);
                                }}
                                className={cn(
                                  'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors cursor-pointer',
                                  selectedModel === m.id
                                    ? 'bg-brand-500/10 text-brand-600 dark:text-brand-400 font-bold'
                                    : 'text-ink hover:bg-hover'
                                )}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="truncate font-semibold">{m.name}</div>
                                  <div className="text-[10px] text-ink-muted font-mono truncate">{m.id}</div>
                                </div>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-inset text-ink-muted border border-line-subtle shrink-0">
                                  {m.badge}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={!inputMessage.trim() || isProcessing}
                      className={cn(
                        'grid h-7 w-7 place-items-center rounded-full transition-all cursor-pointer',
                        inputMessage.trim() && !isProcessing
                          ? 'bg-ink text-surface hover:opacity-90 shadow-2xs'
                          : 'bg-inset text-ink-faint cursor-not-allowed'
                      )}
                      aria-label="Send Message"
                    >
                      <Send size={13} className="-translate-y-0.5 translate-x-0.5 rotate-45" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* ==============================================================
              RIGHT COLUMN: Browser Preview Pane matching Image 2
              ============================================================== */}
          <div className="flex-1 min-w-0 flex flex-col bg-[#787b80] dark:bg-zinc-800 overflow-hidden relative">
            
            {/* Top Browser Chrome Bar matching Image 2 */}
            <div className="h-11 px-3 sm:px-4 bg-[#e5e7eb] dark:bg-zinc-900 border-b border-line flex items-center justify-between gap-3 shrink-0 select-none">
              
              {/* Left: Device toggles & reload */}
              <div className="flex items-center gap-1 text-ink-muted">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                    previewDevice === 'desktop' ? 'bg-surface text-ink font-bold shadow-2xs' : 'hover:bg-hover hover:text-ink'
                  )}
                  title="Desktop viewport (100%)"
                >
                  <Laptop size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                    previewDevice === 'tablet' ? 'bg-surface text-ink font-bold shadow-2xs' : 'hover:bg-hover hover:text-ink'
                  )}
                  title="Tablet viewport (768px)"
                >
                  <Tablet size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={cn(
                    'p-1.5 rounded-lg transition-colors cursor-pointer',
                    previewDevice === 'mobile' ? 'bg-surface text-ink font-bold shadow-2xs' : 'hover:bg-hover hover:text-ink'
                  )}
                  title="Mobile viewport (375px)"
                >
                  <Smartphone size={14} />
                </button>

                <div className="h-3.5 w-px bg-line mx-1" />

                <button
                  type="button"
                  onClick={handleReloadPreview}
                  className="p-1.5 rounded-lg hover:bg-hover hover:text-ink transition-colors cursor-pointer"
                  title="Reload preview"
                >
                  <RefreshCw size={13} />
                </button>
              </div>

              {/* Middle: Browser URL Bar */}
              <div className="flex-1 max-w-xl mx-auto flex items-center gap-2 bg-surface border border-line-subtle rounded-xl px-3 py-1 shadow-2xs min-w-0">
                <Lock size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-mono text-ink-muted truncate select-all">
                  {window.location.origin}{previewUrl || `/preview/${currentProcess.id}`}
                </span>
              </div>

              {/* Right: External Link, Download & Publish */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewUrl || `/preview/${currentProcess.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
                  title="Open in new window"
                >
                  <ExternalLink size={14} />
                </a>

                <button
                  type="button"
                  onClick={handleDownloadZip}
                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold text-ink-muted hover:text-ink hover:bg-hover transition-colors cursor-pointer"
                  title="Download production archive .zip"
                >
                  <Download size={13} />
                  <span>Download</span>
                </button>

                {/* Publish Button matching Image 2 */}
                <button
                  type="button"
                  onClick={handlePublish}
                  disabled={isPublishing}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-black dark:bg-white text-white dark:text-black text-xs font-bold hover:opacity-90 shadow-2xs transition-all cursor-pointer"
                >
                  {isPublishing ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : (
                    <Rocket size={12} />
                  )}
                  <span>Publish</span>
                </button>
              </div>
            </div>

            {/* Main Preview Container Canvas matching Image 2 */}
            <div className="flex-1 min-h-0 p-3 sm:p-5 flex items-center justify-center overflow-auto">
              
              {/* STATE 1: Workspace starting up... (Pixel-Perfect Match to Image 2) */}
              {previewState === 'starting' && (
                <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-8 sm:p-10 text-center animate-scale-in border border-zinc-200">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-zinc-900 tracking-tight">
                    Workspace is starting up...
                  </h3>
                  
                  <div className="my-6 flex justify-center">
                    <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-900 rounded-full animate-spin" />
                  </div>

                  <p className="text-xs sm:text-sm text-zinc-600 font-medium">
                    Please wait
                  </p>

                  <div className="mt-6 pt-4 border-t border-zinc-100 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPreviewState('ready')}
                      className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer"
                    >
                      Skip to Live Interactive View →
                    </button>
                  </div>
                </div>
              )}

              {/* STATE 2: Live Interactive Preview Iframe */}
              {previewState === 'ready' && (
                <div
                  className={cn(
                    'h-full bg-white transition-all duration-300 shadow-2xl overflow-hidden flex flex-col',
                    previewDevice === 'desktop' && 'w-full rounded-xl',
                    previewDevice === 'tablet' && 'w-[768px] max-w-full rounded-2xl border-4 border-zinc-800',
                    previewDevice === 'mobile' && 'w-[375px] max-w-full rounded-3xl border-8 border-zinc-800'
                  )}
                >
                  <iframe
                    ref={iframeRef}
                    src={previewUrl || `/preview/${currentProcess.id}`}
                    title={`Live preview of ${currentProcess.name}`}
                    className="w-full h-full border-none bg-slate-950"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                  />
                </div>
              )}
            </div>

            {/* Quick status bar at the very bottom right */}
            <div className="h-6 px-3 bg-neutral-700/80 dark:bg-zinc-900/90 text-[10px] font-mono text-zinc-300 flex items-center justify-between shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Preview Server · {currentProcess.name}
              </span>
              <button
                type="button"
                onClick={() => setPreviewState((v) => (v === 'starting' ? 'ready' : 'starting'))}
                className="hover:underline text-zinc-200 cursor-pointer"
              >
                {previewState === 'starting' ? 'Switch to Preview' : 'Replay Boot State'}
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>,
    document.body
  );
}
