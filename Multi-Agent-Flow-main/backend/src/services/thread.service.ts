import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
const tracer = trace.getTracer('nexus-thread');

const agentSelectFields = {
  id: true,
  name: true,
  displayName: true,
  avatar: true,
  status: true,
  processId: true,
  processRole: true,
  processStage: true,
} as const;

export async function getAllThreads(organizationId: string, processId?: string) {
  return prisma.thread.findMany({
    where: {
      organizationId,
      ...(processId
        ? { messages: { some: { sender: { processId } } } }
        : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: agentSelectFields },
          receiver: { select: agentSelectFields },
        },
      },
    },
  });
}

export async function getThreadById(id: string, organizationId: string) {
  return prisma.thread.findFirst({
    where: { id, organizationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: agentSelectFields },
          receiver: { select: agentSelectFields },
        },
      },
    },
  });
}

export async function getCommGraph(organizationId: string, processId?: string) {
  /* Include every agent, not just those that have already messaged.
     A freshly created production has no traffic yet, and showing an empty
     canvas made it look like the chain didn't exist. Isolated agents render
     as unconnected nodes, which is the truth: they exist but haven't talked. */
  const agents = await prisma.agent.findMany({
    where: {
      organizationId,
      ...(processId ? { processId } : {}),
    },
    select: agentSelectFields,
    orderBy: [{ processStage: 'asc' }, { displayName: 'asc' }],
  });

  // Aggregate messages between each pair of agents
  const messages = await prisma.message.groupBy({
    by: ['senderId', 'receiverId'],
    where: {
      thread: { organizationId },
    },
    _count: { id: true },
    _max: { createdAt: true },
  });

  // Build edges: combine both directions (A->B and B->A) into one edge
  const edgeMap = new Map<string, { source: string; target: string; messageCount: number; lastMessage: string }>();

  for (const msg of messages) {
    // Create a canonical key so A->B and B->A merge into one edge
    const [first, second] = [msg.senderId, msg.receiverId].sort();
    const key = `${first}::${second}`;

    const existing = edgeMap.get(key);
    if (existing) {
      existing.messageCount += msg._count.id;
      // Keep the most recent timestamp
      const existingDate = new Date(existing.lastMessage);
      const newDate = msg._max.createdAt!;
      if (newDate > existingDate) {
        existing.lastMessage = newDate.toISOString();
      }
    } else {
      edgeMap.set(key, {
        source: first,
        target: second,
        messageCount: msg._count.id,
        lastMessage: msg._max.createdAt!.toISOString(),
      });
    }
  }
  // Mother Core: Central Intelligence connected to all agents
  const motherNode = {
    id: 'mother-core',
    name: 'mother-core',
    displayName: 'Mother Chat (Primary Core)',
    avatar: '🧠',
    status: 'ONLINE',
    processId: processId || null,
    processRole: 'Central Intelligence & Supervisor (One-Way Command)',
    processStage: 0,
  };

  const allNodes = [motherNode, ...agents];

  // Add supervisory links from Mother Chat to sub-agents (agents cannot speak back to Mother Chat)
  for (const agent of agents) {
    const key = `mother-core::${agent.id}`;
    if (!edgeMap.has(key)) {
      edgeMap.set(key, {
        source: 'mother-core',
        target: agent.id,
        messageCount: 1,
        lastMessage: new Date().toISOString(),
      });
    }
  }

  // Drop edges whose endpoints aren't in the returned node set
  const nodeIds = new Set(allNodes.map((a) => a.id));
  const edges = Array.from(edgeMap.values()).filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
  );

  return { nodes: allNodes, edges };
}
