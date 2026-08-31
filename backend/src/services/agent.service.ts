import { prisma } from '../lib/prisma.js';
import type { AgentStatus } from '@prisma/client';
import { getGatewayClient } from '../openclaw/client.js';
import { ensureDefaultGateway } from './gateway.service.js';
import { logger } from '../lib/logger.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';

// Map Nexus LLM provider names to OpenClaw model identifiers.
// These must match models in the gateway's agents.defaults.models allowlist.
const PROVIDER_MODEL_MAP: Record<string, string> = {
  anthropic: 'anthropic/claude-sonnet-4-5-20250929',
  openai: 'openai/gpt-4o',
  google: 'google/gemini-2.0-flash',
};

async function resolveGatewayModel(organizationId: string): Promise<string | undefined> {
  const provider = await prisma.llmProvider.findFirst({
    where: { organizationId },
    select: { provider: true },
    orderBy: { createdAt: 'desc' },
  });
  return provider ? PROVIDER_MODEL_MAP[provider.provider] : undefined;
}

const tracer = trace.getTracer('nexus-agent');

export async function getAllAgents(organizationId: string) {
  return prisma.agent.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { activities: true, tasks: true } },
    },
  });
}

export async function getAgentById(id: string, organizationId: string) {
  return prisma.agent.findFirst({
    where: { id, organizationId },
    include: {
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
      tasks: {
        orderBy: { updatedAt: 'desc' },
      },
      agentSkills: {
        include: { skill: true },
        orderBy: { createdAt: 'asc' },
      },
      integrations: {
        orderBy: { createdAt: 'asc' },
      },
      _count: { select: { activities: true, tasks: true } },
    },
  });
}

export async function getAgentByName(organizationId: string, name: string) {
  return prisma.agent.findUnique({ where: { organizationId_name: { organizationId, name } } });
}

export async function updateAgentStatus(id: string, organizationId: string, status: AgentStatus, currentTask?: string) {
  return prisma.agent.update({
    where: { id, organizationId },
    data: { status, currentTask, updatedAt: new Date() },
  });
}

export async function recordHeartbeat(id: string, organizationId: string) {
  return prisma.agent.update({
    where: { id, organizationId },
    data: { lastHeartbeat: new Date(), status: 'ONLINE' },
  });
}

export async function getAgentStats(organizationId: string) {
  const [total, online, idle, offline, error] = await Promise.all([
    prisma.agent.count({ where: { organizationId } }),
    prisma.agent.count({ where: { organizationId, status: 'ONLINE' } }),
    prisma.agent.count({ where: { organizationId, status: 'IDLE' } }),
    prisma.agent.count({ where: { organizationId, status: 'OFFLINE' } }),
    prisma.agent.count({ where: { organizationId, status: 'ERROR' } }),
  ]);
  const recentActivities = await prisma.activity.count({
    where: { organizationId, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  const activeTasks = await prisma.task.count({
    where: { organizationId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'REVIEW'] } },
  });
  return { total, online, idle, offline, error, recentActivities, activeTasks };
}

export async function createAgent(organizationId: string, data: {
  name: string;
  displayName: string;
  description: string;
  workspace?: string;
  avatar?: string;
  heartbeatInterval?: number;
  heartbeatConfig?: Record<string, unknown>;
  identityProfile?: Record<string, unknown>;
  identityTemplate?: string;
  soulMd?: string;
  soulTemplateId?: string;
  enabled?: boolean;
  gatewayId?: string;
}) {
  // Get org slug for gateway agent naming
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
  const gatewayAgentName = org ? `${org.slug}--${data.name}` : data.name;

  // Auto-provision gateway if none specified
  let resolvedGatewayId = data.gatewayId;
  if (!resolvedGatewayId) {
    const defaultId = await ensureDefaultGateway(organizationId);
    if (defaultId) resolvedGatewayId = defaultId;
  }

  // Create in DB first
  const agent = await prisma.agent.create({
    data: {
      organizationId,
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      workspace: data.workspace ?? '',
      avatar: data.avatar ?? null,
      heartbeatInterval: data.heartbeatInterval ?? 30,
      heartbeatConfig: data.heartbeatConfig as any ?? undefined,
      identityProfile: data.identityProfile as any ?? undefined,
      identityTemplate: data.identityTemplate ?? null,
      soulMd: data.soulMd ?? null,
      soulTemplateId: data.soulTemplateId ?? null,
      enabled: data.enabled ?? true,
      gatewayId: resolvedGatewayId ?? null,
    },
    include: {
      _count: { select: { activities: true, tasks: true } },
    },
  });

  // If gateway is available, create real OpenClaw agent
  if (resolvedGatewayId) {
    try {
      const client = getGatewayClient(resolvedGatewayId);
      if (client && client.isConnected()) {
        const result = await client.rpc('agents.create', {
          name: gatewayAgentName,
          workspace: data.workspace || `~/.openclaw/agents/${gatewayAgentName}`,
          emoji: data.avatar || undefined,
        }) as { agentId: string };

        // Update DB with gateway agent ID and set status to IDLE (connected)
        await prisma.agent.update({
          where: { id: agent.id },
          data: { gatewayAgentId: result.agentId, status: 'IDLE' },
        });
        (agent as any).gatewayAgentId = result.agentId;
        (agent as any).status = 'IDLE';

        // Set model based on org's LLM provider so the gateway uses the right LLM
        const gatewayModel = await resolveGatewayModel(organizationId);
        if (gatewayModel) {
          await client.rpc('agents.update', {
            agentId: result.agentId,
            model: gatewayModel,
          });
          logger.info({ gatewayAgentId: result.agentId, model: gatewayModel }, 'Set gateway agent model');
        }

        // Set SOUL.md if provided
        if (data.soulMd) {
          await client.rpc('agents.files.set', {
            agentId: result.agentId,
            name: 'SOUL.md',
            content: data.soulMd,
          });
        }

        // Set IDENTITY.md if provided
        if (data.identityTemplate) {
          await client.rpc('agents.files.set', {
            agentId: result.agentId,
            name: 'IDENTITY.md',
            content: data.identityTemplate,
          });
        }

        logger.info({ gatewayAgentId: result.agentId, agent: agent.name }, 'Created gateway agent');
      }
    } catch (err) {
      logger.warn({ agent: agent.name, err }, 'Failed to create gateway agent');
      // Agent is still created in DB, can sync later
    }
  }

  return agent;
}

export async function deleteAgent(id: string, organizationId: string) {
  // Get agent to check for gateway connection
  const agent = await prisma.agent.findFirst({ where: { id, organizationId } });
  if (!agent) throw new Error('Agent not found');

  // Delete from gateway if connected
  if (agent.gatewayId && agent.gatewayAgentId) {
    try {
      const client = getGatewayClient(agent.gatewayId);
      if (client && client.isConnected()) {
        await client.rpc('agents.delete', { agentId: agent.gatewayAgentId });
        logger.info({ gatewayAgentId: agent.gatewayAgentId }, 'Deleted gateway agent');
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to delete gateway agent');
    }
  }

  return prisma.agent.delete({ where: { id, organizationId } });
}

/**
 * Sync agents that have a gatewayId but no gatewayAgentId (failed to provision initially).
 * Called when a gateway (re)connects.
 */
export async function syncPendingAgents(gatewayId: string) {
  const pending = await prisma.agent.findMany({
    where: { gatewayId, gatewayAgentId: null },
    include: { organization: { select: { slug: true } } },
  });

  if (pending.length === 0) return;

  const client = getGatewayClient(gatewayId);
  if (!client || !client.isConnected()) return;

  for (const agent of pending) {
    try {
      const gatewayAgentName = agent.organization?.slug
        ? `${agent.organization.slug}--${agent.name}`
        : agent.name;

      const result = await client.rpc('agents.create', {
        name: gatewayAgentName,
        workspace: agent.workspace || `~/.openclaw/agents/${gatewayAgentName}`,
        emoji: agent.avatar || undefined,
      }) as { agentId: string };

      await prisma.agent.update({
        where: { id: agent.id },
        data: { gatewayAgentId: result.agentId, status: 'IDLE' },
      });

      // Set model based on org's LLM provider
      const gatewayModel = await resolveGatewayModel(agent.organizationId);
      if (gatewayModel) {
        await client.rpc('agents.update', {
          agentId: result.agentId,
          model: gatewayModel,
        });
      }

      // Set SOUL.md if present
      if (agent.soulMd) {
        await client.rpc('agents.files.set', {
          agentId: result.agentId,
          name: 'SOUL.md',
          content: agent.soulMd,
        });
      }

      // Set IDENTITY.md if present
      if (agent.identityTemplate) {
        await client.rpc('agents.files.set', {
          agentId: result.agentId,
          name: 'IDENTITY.md',
          content: agent.identityTemplate,
        });
      }

      logger.info({ agent: agent.name, gatewayAgentId: result.agentId }, 'Synced pending agent to gateway');
    } catch (err) {
      logger.warn({ agent: agent.name, err }, 'Failed to sync pending agent');
    }
  }
}

export async function updateAgent(id: string, organizationId: string, data: {
  name?: string;
  displayName?: string;
  description?: string;
  workspace?: string;
  avatar?: string;
  heartbeatInterval?: number;
  heartbeatConfig?: Record<string, unknown>;
  identityProfile?: Record<string, unknown>;
  identityTemplate?: string;
  soulMd?: string;
  soulTemplateId?: string;
  enabled?: boolean;
  currentTask?: string;
  gatewayId?: string;
  agentToAgent?: boolean;
}) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.displayName !== undefined) updateData.displayName = data.displayName;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.workspace !== undefined) updateData.workspace = data.workspace;
  if (data.avatar !== undefined) updateData.avatar = data.avatar;
  if (data.heartbeatInterval !== undefined) updateData.heartbeatInterval = data.heartbeatInterval;
  if (data.heartbeatConfig !== undefined) updateData.heartbeatConfig = data.heartbeatConfig;
  if (data.identityProfile !== undefined) updateData.identityProfile = data.identityProfile;
  if (data.identityTemplate !== undefined) updateData.identityTemplate = data.identityTemplate;
  if (data.soulMd !== undefined) updateData.soulMd = data.soulMd;
  if (data.soulTemplateId !== undefined) updateData.soulTemplateId = data.soulTemplateId;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.currentTask !== undefined) updateData.currentTask = data.currentTask;
  if (data.gatewayId !== undefined) updateData.gatewayId = data.gatewayId;
  if (data.agentToAgent !== undefined) updateData.agentToAgent = data.agentToAgent;

  const agent = await prisma.agent.update({
    where: { id, organizationId },
    data: updateData as any,
    include: {
      _count: { select: { activities: true, tasks: true } },
    },
  });

  // Sync changes to gateway if connected
  if (agent.gatewayId && agent.gatewayAgentId) {
    try {
      const client = getGatewayClient(agent.gatewayId);
      if (client && client.isConnected()) {
        // Update agent in gateway
        if (data.name || data.workspace || data.avatar) {
          await client.rpc('agents.update', {
            agentId: agent.gatewayAgentId,
            ...(data.name && { name: data.name }),
            ...(data.workspace && { workspace: data.workspace }),
            ...(data.avatar && { avatar: data.avatar }),
          });
        }
        // Update SOUL.md if changed
        if (data.soulMd !== undefined) {
          await client.rpc('agents.files.set', {
            agentId: agent.gatewayAgentId,
            name: 'SOUL.md',
            content: data.soulMd || '',
          });
        }
        // Update IDENTITY.md if changed
        if (data.identityTemplate !== undefined) {
          await client.rpc('agents.files.set', {
            agentId: agent.gatewayAgentId,
            name: 'IDENTITY.md',
            content: data.identityTemplate || '',
          });
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to sync gateway agent');
    }
  }

  return agent;
}
