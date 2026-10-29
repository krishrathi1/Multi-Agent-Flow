import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { BlackboardEntry } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

/**
 * The blackboard: one shared state per production that every agent reads
 * before it works and posts to when it is done.
 *
 * Agents never message each other directly in this mode. A designer posts the
 * colour tokens as a `contract`, the developer reads them from the board, QA
 * posts an `issue` for the developer, and the run controller sends the
 * developer back until the issue is resolved on the board. The runner is the
 * only writer to the database: agents (CLI processes in the workspace) post by
 * appending JSON lines to a file, which the runner validates and stores.
 */

export const ENTRY_KINDS = ['decision', 'contract', 'artifact', 'issue', 'question', 'answer', 'note'] as const;
export type EntryKind = (typeof ENTRY_KINDS)[number];
/** Kinds that ask someone to act; they stay open until resolved. */
const ACTIONABLE: ReadonlySet<string> = new Set(['issue', 'question']);

export const BOARD_DIR = '.blackboard';
const MAX_POSTS_PER_AGENT = 25;
const MAX_CONTENT_CHARS = 4000;
/** Characters of board shown in an agent's prompt; the full board is on disk. */
const PROMPT_BOARD_CHARS = 7000;

export interface AgentRef {
  id: string;
  displayName: string;
  processRole?: string | null;
  processStage?: number | null;
}

export interface BoardPost {
  kind: EntryKind;
  topic: string;
  content: string;
  to?: string;
  /** Ids (or id prefixes) of open entries this post resolves. */
  resolves?: string[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
const shortId = (id: string) => id.slice(0, 8);

/** Whether an entry addressed `to` someone is meant for this agent. */
export function isAddressedTo(entry: Pick<BlackboardEntry, 'toRole'>, agent: AgentRef): boolean {
  const to = entry.toRole?.trim().toLowerCase();
  if (!to || to === 'all' || to === 'everyone') return false;
  const names = [agent.displayName, agent.processRole ?? ''].map((n) => n.toLowerCase()).filter(Boolean);
  return names.some((n) => n === to || n.includes(to) || to.includes(n));
}

/** The board the agents of a production share: this run's entries plus what is still relevant from earlier runs. */
export async function readBoard(processId: string, runId?: string): Promise<BlackboardEntry[]> {
  const rows = await prisma.blackboardEntry.findMany({
    where: { processId },
    orderBy: { createdAt: 'asc' },
    take: 500,
  });
  if (!runId) return rows;
  // Earlier runs' artifacts describe files that may since have changed; their
  // decisions, contracts and open items still bind the team.
  return rows.filter((r) => r.runId === runId || r.status === 'open' || r.kind === 'decision' || r.kind === 'contract');
}

function line(e: BlackboardEntry): string {
  const to = e.toRole ? ` → ${e.toRole}` : '';
  const state = e.status === 'open' ? ' [OPEN]' : e.status === 'resolved' ? ` [resolved by ${e.resolvedBy ?? '?'}]` : '';
  return `- (${shortId(e.id)}) **${e.kind}** · ${e.topic} — by ${e.authorName}${to}${state}\n  ${e.content.replace(/\n+/g, '\n  ')}`;
}

/** The whole board as Markdown, written into the workspace for agents to read. */
export function renderBoard(entries: BlackboardEntry[]): string {
  if (entries.length === 0) return '# Blackboard\n\n(empty — you are the first to post)\n';
  const groups: Array<[string, BlackboardEntry[]]> = [
    ['Open items (need action)', entries.filter((e) => e.status === 'open')],
    ['Decisions & contracts', entries.filter((e) => e.status !== 'open' && (e.kind === 'decision' || e.kind === 'contract'))],
    ['Artifacts & notes', entries.filter((e) => e.status !== 'open' && ['artifact', 'note', 'answer'].includes(e.kind))],
    ['Resolved items', entries.filter((e) => e.status === 'resolved' && ACTIONABLE.has(e.kind))],
  ];
  return ['# Blackboard', '', ...groups.filter(([, g]) => g.length).flatMap(([title, g]) => [`## ${title}`, ...g.map(line), ''])].join('\n');
}

/**
 * The part of the board an agent's prompt carries: items addressed to it
 * first, then decisions and contracts, then everything else, within budget.
 */
export function boardForAgent(entries: BlackboardEntry[], agent: AgentRef): { text: string; forMe: BlackboardEntry[] } {
  const forMe = entries.filter((e) => e.status === 'open' && isAddressedTo(e, agent));
  const rank = (e: BlackboardEntry) =>
    forMe.includes(e) ? 0 : e.status === 'open' ? 1 : e.kind === 'decision' || e.kind === 'contract' ? 2 : e.kind === 'artifact' ? 3 : 4;
  const ordered = [...entries].sort((a, b) => rank(a) - rank(b) || b.createdAt.getTime() - a.createdAt.getTime());
  const out: string[] = [];
  let used = 0;
  let omitted = 0;
  for (const e of ordered) {
    const l = line(e);
    if (used + l.length > PROMPT_BOARD_CHARS) { omitted++; continue; }
    out.push(l);
    used += l.length;
  }
  if (omitted) out.push(`- …${omitted} more entr${omitted === 1 ? 'y' : 'ies'} in ${BOARD_DIR}/board.md`);
  return { text: out.join('\n') || '(empty — you are the first to post)', forMe };
}

/** Workspace-relative file an agent appends its posts to. */
export function postsFile(agent: AgentRef): string {
  return `${BOARD_DIR}/posts/${slug(agent.displayName)}.jsonl`;
}

/** Writes the current board for agents to read, and an empty posts file for each agent about to run. */
export async function publishBoard(workspace: string, entries: BlackboardEntry[], agents: AgentRef[]): Promise<void> {
  await fs.mkdir(path.join(workspace, BOARD_DIR, 'posts'), { recursive: true });
  await fs.writeFile(path.join(workspace, BOARD_DIR, 'board.md'), renderBoard(entries), 'utf-8');
  await fs.writeFile(path.join(workspace, BOARD_DIR, 'board.json'), JSON.stringify(entries.map(publicEntry), null, 2), 'utf-8');
  for (const a of agents) await fs.writeFile(path.join(workspace, postsFile(a)), '', 'utf-8');
}

/** Prompt section telling an agent how to use the board. */
export function boardInstructions(agent: AgentRef, boardText: string, forMe: BlackboardEntry[]): string {
  return [
    '# Shared blackboard',
    'This team shares context through a blackboard, not direct messages. It holds every decision, contract, artifact, issue and question posted so far.',
    `Full board: ${BOARD_DIR}/board.md. Relevant entries:`,
    boardText,
    forMe.length
      ? `\n## Addressed to you (${forMe.length})\nResolve these as part of your work, and say so in a post with "resolves".`
      : '',
    '\n## Posting to the board (required)',
    `When you finish, append one JSON object per line to ${postsFile(agent)}:`,
    '{"kind":"decision|contract|artifact|issue|question|answer|note","topic":"short title","content":"what later agents need to know","to":"role or agent name (optional)","resolves":["id of an open entry (optional)"]}',
    '- contract: interfaces others must follow (data shapes, component props, API routes, design tokens, file layout).',
    '- decision: a choice you made and why. artifact: what you built and where (files).',
    '- issue / question: a problem or question for another role — set "to". It stays open until someone resolves it.',
    '- When you fix an issue or answer a question addressed to you, post with "resolves":["<its id>"].',
    'Post at least one artifact entry describing what you produced, and a contract entry for anything another agent must build against.',
  ].filter(Boolean).join('\n');
}

const KIND_ALIASES: Record<string, EntryKind> = { bug: 'issue', problem: 'issue', blocker: 'issue', interface: 'contract', api: 'contract', spec: 'contract', file: 'artifact', output: 'artifact', reply: 'answer', fix: 'answer' };

function normalizePost(raw: any): BoardPost | null {
  if (!raw || typeof raw !== 'object') return null;
  const k = String(raw.kind ?? raw.type ?? '').toLowerCase().trim();
  const kind = (ENTRY_KINDS as readonly string[]).includes(k) ? (k as EntryKind) : KIND_ALIASES[k];
  const content = typeof raw.content === 'string' ? raw.content : typeof raw.body === 'string' ? raw.body : raw.content ? JSON.stringify(raw.content) : '';
  if (!kind || !content.trim()) return null;
  const topic = String(raw.topic ?? raw.title ?? content.split('\n')[0]).trim().slice(0, 140);
  const resolves = Array.isArray(raw.resolves) ? raw.resolves.map(String) : typeof raw.resolves === 'string' ? [raw.resolves] : [];
  return { kind, topic: topic || kind, content: content.trim().slice(0, MAX_CONTENT_CHARS), to: raw.to ? String(raw.to).slice(0, 80) : undefined, resolves };
}

/** JSON objects from JSONL text, or from a ```blackboard fenced block in an agent's reply. */
export function parsePosts(text: string): BoardPost[] {
  const out: BoardPost[] = [];
  const fenced = [...text.matchAll(/```(?:blackboard|jsonl?)\s*\n([\s\S]*?)```/g)].map((m) => m[1]);
  for (const chunk of [text, ...fenced]) {
    for (const l of chunk.split('\n')) {
      const s = l.trim().replace(/,$/, '');
      if (!s.startsWith('{') || !s.endsWith('}')) continue;
      try {
        const p = normalizePost(JSON.parse(s));
        if (p && !out.some((o) => o.topic === p.topic && o.content === p.content)) out.push(p);
      } catch { /* not JSON */ }
    }
    if (out.length) break; // the posts file wins over anything quoted in a reply
  }
  return out.slice(0, MAX_POSTS_PER_AGENT);
}

/**
 * Stores what an agent posted (from its posts file, else from its reply) and
 * resolves the open entries it names. An agent that posts nothing still
 * lands on the board as an artifact built from its summary, so its work
 * reaches the rest of the team either way.
 */
export async function collectPosts(params: {
  organizationId: string;
  processId: string;
  runId: string;
  workspace: string;
  agent: AgentRef;
  summary: string;
  files: string[];
  /** Who an issue or question without "to" goes to: the stage that produced the work. */
  defaultTo?: string;
}): Promise<{ posted: BlackboardEntry[]; resolved: number }> {
  const { agent } = params;
  let posts = parsePosts(await fs.readFile(path.join(params.workspace, postsFile(agent)), 'utf-8').catch(() => ''));
  if (posts.length === 0) posts = parsePosts(params.summary);
  if (!posts.some((p) => p.kind === 'artifact')) {
    const paras = params.summary.replace(/\x1b\[[0-9;]*m/g, '').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    posts.push({
      kind: 'artifact',
      topic: `${agent.displayName}: stage ${agent.processStage ?? '?'} output`,
      content: [(paras[paras.length - 1] ?? 'Completed its stage.').slice(0, 1500), params.files.length ? `Files: ${params.files.slice(0, 20).join(', ')}` : '']
        .filter(Boolean).join('\n'),
    });
  }

  const open = await prisma.blackboardEntry.findMany({ where: { processId: params.processId, status: 'open' } });
  const posted: BlackboardEntry[] = [];
  let resolved = 0;
  for (const p of posts) {
    if (ACTIONABLE.has(p.kind) && !p.to && params.defaultTo) p.to = params.defaultTo;
    const row = await prisma.blackboardEntry.create({
      data: {
        organizationId: params.organizationId,
        processId: params.processId,
        runId: params.runId,
        kind: p.kind,
        topic: p.topic,
        content: p.content,
        authorAgentId: agent.id,
        authorName: agent.displayName,
        stage: agent.processStage ?? null,
        toRole: p.to ?? null,
        status: ACTIONABLE.has(p.kind) && p.to ? 'open' : 'info',
      },
    });
    posted.push(row);
    for (const ref of p.resolves ?? []) {
      const target = open.find((o) => o.id === ref || o.id.startsWith(ref.replace(/[()]/g, '').trim()));
      if (!target || target.status !== 'open') continue;
      await prisma.blackboardEntry.update({
        where: { id: target.id },
        data: { status: 'resolved', resolvedBy: agent.displayName, resolution: `${p.topic}: ${p.content}`.slice(0, 2000), resolvedAt: new Date() },
      });
      target.status = 'resolved';
      resolved++;
    }
  }
  logger.info({ processId: params.processId, agent: agent.displayName, posted: posted.length, resolved }, 'Blackboard posts collected');
  return { posted, resolved };
}

/** Open items addressed to each of these agents. */
export function openItemsByAgent(entries: BlackboardEntry[], agents: AgentRef[]): Map<string, BlackboardEntry[]> {
  const out = new Map<string, BlackboardEntry[]>();
  for (const a of agents) {
    const mine = entries.filter((e) => e.status === 'open' && e.authorAgentId !== a.id && isAddressedTo(e, a));
    if (mine.length) out.set(a.id, mine);
  }
  return out;
}

/** A post from a person, e.g. guidance or an answer, on the same board the agents read. */
export async function postOperatorEntry(params: {
  organizationId: string;
  processId: string;
  kind: EntryKind;
  topic: string;
  content: string;
  to?: string;
  authorName?: string;
}): Promise<BlackboardEntry> {
  return prisma.blackboardEntry.create({
    data: {
      organizationId: params.organizationId,
      processId: params.processId,
      kind: params.kind,
      topic: params.topic.slice(0, 140),
      content: params.content.slice(0, MAX_CONTENT_CHARS),
      authorName: params.authorName ?? 'Operator',
      toRole: params.to ?? null,
      status: ACTIONABLE.has(params.kind) && params.to ? 'open' : 'info',
    },
  });
}

export function publicEntry(e: BlackboardEntry) {
  return {
    id: e.id, runId: e.runId, kind: e.kind, topic: e.topic, content: e.content,
    author: e.authorName, authorAgentId: e.authorAgentId, stage: e.stage, to: e.toRole,
    status: e.status, resolvedBy: e.resolvedBy, resolution: e.resolution,
    resolvedAt: e.resolvedAt, createdAt: e.createdAt,
  };
}

/** Per-run numbers for comparing blackboard and peer-to-peer runs. */
export interface MessagingStats {
  mode: 'BLACKBOARD' | 'PEER_TO_PEER';
  /** Characters of shared context each agent step received. */
  contextChars: number[];
  entriesPosted: number;
  issuesRaised: number;
  issuesResolved: number;
  reworkSteps: number;
  /** Agent-to-agent deliveries (P2P) or board reads (blackboard). */
  deliveries: number;
}

export function emptyStats(mode: MessagingStats['mode']): MessagingStats {
  return { mode, contextChars: [], entriesPosted: 0, issuesRaised: 0, issuesResolved: 0, reworkSteps: 0, deliveries: 0 };
}
