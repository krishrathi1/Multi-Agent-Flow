import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Database,
  FileSearch,
  Globe,
  LineChart,
  Package,
  Play,
  RefreshCw,
  Search,
  Wrench,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { api } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import type { McpToolInfo, Process, ToolCall, ToolsView } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Tabs } from '../ui/Tabs';
import { Input, Select } from '../ui/Input';
import { useToast } from '../ui/Toast';

const TOOL_ICON: Record<string, LucideIcon> = {
  web_search: Search,
  fetch_url: Globe,
  package_info: Package,
  calculate: Calculator,
  forecast: LineChart,
  parse_file: FileSearch,
  project_lookup: Database,
};

const SERVER_INFO: Record<string, { label: string; hint: string }> = {
  research: { label: 'research', hint: 'External web APIs: search, page reading, npm registry.' },
  analytics: { label: 'analytics', hint: 'Calculator, forecasting, file parsing and the production database.' },
};

/** Example arguments so "Try" works with one click. */
const EXAMPLES: Record<string, Record<string, string>> = {
  web_search: { query: 'vite react typescript localStorage best practices' },
  fetch_url: { url: 'https://react.dev/learn' },
  package_info: { name: 'react' },
  calculate: { expression: '(1200 * 1.18) / 12' },
  forecast: { values: '120, 135, 128, 150, 162, 171', horizon: '3' },
  parse_file: { path: 'package.json' },
  project_lookup: { lookup: 'summary' },
};

type Field = { name: string; type: string; description?: string; enum?: string[]; required: boolean };

const fieldsOf = (tool: McpToolInfo): Field[] =>
  Object.entries(tool.inputSchema.properties ?? {}).map(([name, p]) => ({
    name,
    type: p.type === 'array' ? `array:${p.items?.type ?? 'string'}` : p.type ?? 'string',
    description: p.description,
    enum: p.enum,
    required: tool.inputSchema.required?.includes(name) ?? false,
  }));

/** Form text back to the tool's argument types; empty optional fields are left out. */
function toArgs(fields: Field[], values: Record<string, string>): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = (values[f.name] ?? '').trim();
    if (!raw) continue;
    if (f.type === 'number' || f.type === 'integer') args[f.name] = Number(raw);
    else if (f.type.startsWith('array:')) {
      const parts = raw.split(/[,\s]+/).filter(Boolean);
      args[f.name] = f.type === 'array:number' ? parts.map(Number) : parts;
    } else args[f.name] = raw;
  }
  return args;
}

const prettyOutput = (text: string) => {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
};

function ToolCard({ server, tool, processId, onRan }: { server: string; tool: McpToolInfo; processId: string; onRan: () => void }) {
  const toast = useToast();
  const fields = useMemo(() => fieldsOf(tool), [tool]);
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(EXAMPLES[tool.name] ?? {});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; durationMs: number } | null>(null);
  const Icon = TOOL_ICON[tool.name] ?? Wrench;

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      setResult(await api.processes.callTool(processId, server, tool.name, toArgs(fields, values)));
      onRan();
    } catch (err) {
      toast.error('Tool call failed', (err as Error).message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <li className="rounded-lg border border-line-subtle bg-surface p-3 shadow-2xs">
      <div className="flex items-start gap-2.5">
        <Icon size={16} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold text-ink">{tool.title ?? tool.name}</span>
            <code className="rounded bg-inset px-1.5 py-0.5 text-2xs text-ink-subtle">{server}_{tool.name}</code>
          </div>
          <p className="mt-0.5 text-xs text-ink-subtle">{tool.description}</p>
        </div>
        <Button variant="secondary" size="xs" icon={Play} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Try
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-line-subtle pt-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((f) =>
              f.enum ? (
                <Select
                  key={f.name}
                  label={`${f.name}${f.required ? '' : ' (optional)'}`}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  options={[...(f.required ? [] : [{ value: '', label: '—' }]), ...f.enum.map((v) => ({ value: v, label: v }))]}
                />
              ) : (
                <Input
                  key={f.name}
                  label={`${f.name}${f.required ? '' : ' (optional)'}`}
                  type={f.type === 'number' || f.type === 'integer' ? 'number' : 'text'}
                  value={values[f.name] ?? ''}
                  onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
                  placeholder={f.type.startsWith('array:') ? 'Comma-separated values' : f.description}
                />
              ),
            )}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" size="sm" icon={Play} loading={running} onClick={run}>
              Run over MCP
            </Button>
          </div>
          {result && (
            <div>
              <p className="mb-1 flex items-center gap-1.5 text-2xs text-ink-faint">
                {result.ok ? <CheckCircle2 size={12} className="text-emerald-600" aria-hidden /> : <XCircle size={12} className="text-red-600" aria-hidden />}
                {result.ok ? 'Result' : 'Error'} · {result.durationMs} ms
              </p>
              <pre className="max-h-64 overflow-auto rounded-md bg-inset p-2.5 text-2xs leading-relaxed text-ink-muted">{prettyOutput(result.text)}</pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function CallRow({ call }: { call: ToolCall }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICON[call.tool] ?? Wrench;
  return (
    <li className="rounded-lg border border-line-subtle bg-surface p-3 shadow-2xs">
      <button type="button" className="flex w-full items-start gap-2.5 text-left" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
        <Icon size={15} className="mt-0.5 shrink-0 text-ink-faint" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-xs font-semibold text-ink">{call.server}.{call.tool}</span>
            {call.ok ? <Badge tone="success" size="sm">ok</Badge> : <Badge tone="danger" size="sm">failed</Badge>}
            <span className="text-xs text-ink-subtle">by {call.caller}</span>
          </span>
          <span className="mt-0.5 block truncate font-mono text-2xs text-ink-faint">{JSON.stringify(call.input)}</span>
        </span>
        <span className="shrink-0 text-right text-2xs text-ink-faint">
          {call.durationMs} ms
          <br />
          {new Date(call.createdAt).toLocaleTimeString()}
        </span>
      </button>
      {expanded && (
        <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-inset p-2.5 text-2xs leading-relaxed text-ink-muted">{prettyOutput(call.output)}</pre>
      )}
    </li>
  );
}

/**
 * The production's MCP tools: the two built-in tool servers its agents use
 * (listed over MCP, each tool runnable from here), and a live log of every
 * call agents, Mother Chat and operators made.
 */
export function ToolsModal({ process, open, onClose }: { process: Process; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [view, setView] = useState<ToolsView | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'tools' | 'calls'>('tools');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setView(await api.processes.tools(process.id));
    } catch (err) {
      toast.error('Could not load the tools', (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [process.id, toast]);

  useEffect(() => {
    if (!open) return;
    load();
    const socket = getSocket();
    const onCall = (p: { processId?: string; call?: ToolCall }) => {
      if (p?.processId !== process.id || !p.call) return;
      setView((v) => (v && !v.calls.some((c) => c.id === p.call!.id) ? { ...v, calls: [p.call!, ...v.calls] } : v));
    };
    socket.on('tools:called', onCall);
    return () => { socket.off('tools:called', onCall); };
  }, [open, load, process.id]);

  const calls = view?.calls ?? [];
  const toolCount = view?.servers.reduce((n, s) => n + s.tools.length, 0) ?? 0;
  const callers = useMemo(() => {
    const agents = calls.filter((c) => c.caller !== 'Mother Chat' && !c.caller.endsWith('(operator)') && c.caller !== 'Operator').length;
    const mother = calls.filter((c) => c.caller === 'Mother Chat').length;
    return { agents, mother, operators: calls.length - agents - mother, failed: calls.filter((c) => !c.ok).length };
  }, [calls]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      icon={Wrench}
      title={`Tools (MCP) — ${process.name}`}
      description="External tools this production's agents call through the Model Context Protocol."
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4">
          {[
            { label: 'Tool servers', value: view?.servers.length ?? 0, sub: `${toolCount} tools` },
            { label: 'Calls by agents', value: callers.agents, sub: 'during runs' },
            { label: 'Calls by Mother Chat', value: callers.mother, sub: 'answering questions' },
            { label: 'Calls from here', value: callers.operators, sub: callers.failed ? `${callers.failed} failed in total` : 'all succeeded' },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-line bg-inset p-3">
              <p className="text-2xs uppercase tracking-wide text-ink-faint">{s.label}</p>
              <p className="mt-0.5 font-mono text-lg font-semibold text-ink">{s.value}</p>
              <p className="text-2xs text-ink-subtle">{s.sub}</p>
            </div>
          ))}
        </div>

        {view && !view.enabled && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            MCP tools are turned off on this server (MCP_TOOLS_DISABLED), so agents run without them.
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <Tabs
            items={[
              { value: 'tools', label: 'Tool servers', icon: Wrench, count: toolCount },
              { value: 'calls', label: 'Calls', icon: CheckCircle2, count: calls.length },
            ]}
            value={tab}
            onChange={setTab}
            aria-label="Tool sections"
          />
          <Button variant="ghost" size="xs" iconOnly icon={RefreshCw} loading={loading} onClick={load} aria-label="Refresh tools" />
        </div>

        {tab === 'tools' && (
          <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-1">
            <p className="text-xs text-ink-subtle">
              Every agent that runs on OpenCode gets both servers in its session, and Mother Chat calls them when a question needs a fact,
              a number or a forecast. Calls are tied to the run and agent that made them.
            </p>
            {(view?.servers ?? []).map((s) => (
              <section key={s.server}>
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="font-mono text-sm font-semibold text-ink">{SERVER_INFO[s.server]?.label ?? s.server}</h3>
                  <span className="text-2xs text-ink-faint">{SERVER_INFO[s.server]?.hint}</span>
                </div>
                <ul className="space-y-2">
                  {s.tools.map((t) => <ToolCard key={t.name} server={s.server} tool={t} processId={process.id} onRan={load} />)}
                </ul>
              </section>
            ))}
          </div>
        )}

        {tab === 'calls' && (
          calls.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-ink-subtle">
              No tool calls yet. Run the production, ask Mother Chat something like "forecast the next run's duration", or try a tool.
            </p>
          ) : (
            <ul className="max-h-[56vh] space-y-2 overflow-y-auto pr-1">
              {calls.map((c) => <CallRow key={c.id} call={c} />)}
            </ul>
          )
        )}
      </div>
    </Modal>
  );
}
