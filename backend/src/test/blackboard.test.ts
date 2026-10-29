import { describe, it, expect } from 'vitest';
import type { BlackboardEntry } from '@prisma/client';
import { parsePosts, boardForAgent, isAddressedTo, openItemsByAgent, renderBoard, boardInstructions, postsFile } from '../services/blackboard.service.js';

const entry = (over: Partial<BlackboardEntry>): BlackboardEntry => ({
  id: 'e0000000-0000-0000-0000-000000000000',
  organizationId: 'o', processId: 'p', runId: 'r',
  kind: 'note', topic: 't', content: 'c',
  authorAgentId: 'a1', authorName: 'Designer', stage: 1,
  toRole: null, status: 'info', resolvedBy: null, resolution: null, resolvedAt: null,
  createdAt: new Date('2026-10-29T10:00:00Z'),
  ...over,
});

const dev = { id: 'a2', displayName: 'Frontend Developer', processRole: 'Implementation Lead', processStage: 2 };
const qa = { id: 'a3', displayName: 'QA Reviewer', processRole: 'Quality', processStage: 3 };

describe('blackboard posts', () => {
  it('reads one JSON object per line and skips anything else', () => {
    const posts = parsePosts([
      '{"kind":"contract","topic":"Task shape","content":"{ id, title, done }"}',
      'not json',
      '{"kind":"issue","topic":"Delete broken","content":"Delete button does nothing","to":"Frontend Developer"}',
      '{"kind":"nonsense","content":"x"}',
    ].join('\n'));
    expect(posts.map((p) => [p.kind, p.topic, p.to])).toEqual([
      ['contract', 'Task shape', undefined],
      ['issue', 'Delete broken', 'Frontend Developer'],
    ]);
  });

  it('accepts common synonyms and posts quoted in a reply', () => {
    const posts = parsePosts('Done.\n```blackboard\n{"type":"bug","title":"Crash","body":"Null summary","resolves":"e0000000"}\n```');
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ kind: 'issue', topic: 'Crash', content: 'Null summary', resolves: ['e0000000'] });
  });
});

describe('blackboard routing', () => {
  it('matches an entry to the agent by name or role, not when addressed to everyone', () => {
    expect(isAddressedTo(entry({ toRole: 'frontend developer' }), dev)).toBe(true);
    expect(isAddressedTo(entry({ toRole: 'Implementation Lead' }), dev)).toBe(true);
    expect(isAddressedTo(entry({ toRole: 'all' }), dev)).toBe(false);
    expect(isAddressedTo(entry({ toRole: 'QA Reviewer' }), dev)).toBe(false);
  });

  it('owes an agent only open items others addressed to it', () => {
    const board = [
      entry({ id: 'i1', kind: 'issue', status: 'open', toRole: 'Frontend Developer', authorAgentId: qa.id, authorName: 'QA Reviewer' }),
      entry({ id: 'i2', kind: 'issue', status: 'resolved', toRole: 'Frontend Developer', authorAgentId: qa.id }),
      entry({ id: 'i3', kind: 'question', status: 'open', toRole: 'Frontend Developer', authorAgentId: dev.id }),
    ];
    const owed = openItemsByAgent(board, [dev, qa]);
    expect(owed.get(dev.id)?.map((e) => e.id)).toEqual(['i1']);
    expect(owed.has(qa.id)).toBe(false);
  });

  it("puts what is addressed to the agent first in its view of the board", () => {
    const board = [
      entry({ id: 'n1', kind: 'artifact', topic: 'Design tokens file' }),
      entry({ id: 'c1', kind: 'contract', topic: 'Colour tokens' }),
      entry({ id: 'i1', kind: 'issue', topic: 'Contrast too low', status: 'open', toRole: 'Frontend Developer', authorAgentId: qa.id, authorName: 'QA Reviewer' }),
    ];
    const { text, forMe } = boardForAgent(board, dev);
    expect(forMe.map((e) => e.id)).toEqual(['i1']);
    expect(text.indexOf('Contrast too low')).toBeLessThan(text.indexOf('Colour tokens'));
    expect(text.indexOf('Colour tokens')).toBeLessThan(text.indexOf('Design tokens file'));
  });
});

describe('blackboard rendering', () => {
  it('groups the board and tells the agent where to post', () => {
    const md = renderBoard([
      entry({ kind: 'decision', topic: 'Use localStorage' }),
      entry({ kind: 'issue', topic: 'Broken filter', status: 'open', toRole: 'Frontend Developer' }),
    ]);
    expect(md.indexOf('## Open items')).toBeLessThan(md.indexOf('## Decisions & contracts'));
    expect(md).toContain('[OPEN]');
    const ins = boardInstructions(dev, 'x', []);
    expect(ins).toContain(postsFile(dev));
    expect(postsFile(dev)).toBe('.blackboard/posts/frontend-developer.jsonl');
  });
});
