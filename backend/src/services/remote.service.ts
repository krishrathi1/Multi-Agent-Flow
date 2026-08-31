import { prisma } from '../lib/prisma.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../lib/logger.js';
import { calculateTokenCost } from './llm-provider.service.js';
import type { ActivityType } from '@prisma/client';
const tracer = trace.getTracer('nexus-remote');

// Throttle map: agentId -> last activity creation time
const remoteHeartbeatThrottle = new Map<string, number>();
const REMOTE_HEARTBEAT_ACTIVITY_INTERVAL_MS = 5 * 60 * 1000; // Only log activity every 5 min

export async function remoteHeartbeat(organizationId: string, data: {
  agentName: string;
  message?: string;
  status?: string;
}) {
  return tracer.startActiveSpan('remote.heartbeat', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('agent.name', data.agentName);
      // Find or create agent
      let agent = await prisma.agent.findUnique({
        where: { organizationId_name: { organizationId, name: data.agentName } },
      });

      if (!agent) {
        agent = await prisma.agent.create({
          data: {
            organizationId,
            name: data.agentName,
            displayName: data.agentName,
            description: 'Remote agent',
            heartbeatInterval: 5,
          },
        });
        logger.info({ agentName: data.agentName, orgId: organizationId }, 'Remote agent auto-created');
      }

      // Update agent status
      await prisma.agent.update({
        where: { id: agent.id },
        data: { lastHeartbeat: new Date(), status: 'ONLINE' },
      });

      // Throttle activity creation: only write to DB every 5 minutes per agent
      const now = Date.now();
      const lastActivity = remoteHeartbeatThrottle.get(agent.id);
      let activity = null;
      if (!lastActivity || now - lastActivity >= REMOTE_HEARTBEAT_ACTIVITY_INTERVAL_MS) {
        remoteHeartbeatThrottle.set(agent.id, now);
        activity = await prisma.activity.create({
          data: {
            organizationId,
            agentId: agent.id,
            type: 'HEARTBEAT',
            message: data.message || `Heartbeat from ${agent.displayName}`,
          },
          include: { agent: { select: { name: true, displayName: true, avatar: true } } },
        });
      }

      return { agent, activity };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function remoteActivity(organizationId: string, data: {
  agentName: string;
  type: ActivityType;
  message: string;
  metadata?: Record<string, unknown>;
}) {
  const agent = await prisma.agent.findUnique({
    where: { organizationId_name: { organizationId, name: data.agentName } },
  });
  if (!agent) throw new Error(`Agent '${data.agentName}' not found`);

  const activity = await prisma.activity.create({
    data: {
      organizationId,
      agentId: agent.id,
      type: data.type,
      message: data.message,
      metadata: data.metadata as any,
    },
    include: { agent: { select: { name: true, displayName: true, avatar: true } } },
  });

  return activity;
}

export async function remoteMetrics(organizationId: string, data: {
  agentName: string;
  responseTimeMs: number;
  success: boolean;
  errorMessage?: string;
  toolName?: string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}) {
  return tracer.startActiveSpan('remote.metrics', async (span) => {
    try {
      span.setAttribute('org.id', organizationId);
      span.setAttribute('agent.name', data.agentName);
      span.setAttribute('metrics.responseTimeMs', data.responseTimeMs);
      span.setAttribute('metrics.success', data.success);
      const agent = await prisma.agent.findUnique({
        where: { organizationId_name: { organizationId, name: data.agentName } },
      });
      if (!agent) throw new Error(`Agent '${data.agentName}' not found`);

      const metric = await prisma.metricSnapshot.create({
        data: {
          organizationId,
          agentId: agent.id,
          responseTimeMs: data.responseTimeMs,
          success: data.success,
          errorMessage: data.errorMessage,
          toolName: data.toolName,
        },
      });

      // If token data provided, also create token usage
      let tokenUsage = null;
      if (data.inputTokens !== undefined && data.outputTokens !== undefined) {
        const totalTokens = data.inputTokens + data.outputTokens;
        tokenUsage = await prisma.tokenUsage.create({
          data: {
            organizationId,
            agentId: agent.id,
            inputTokens: data.inputTokens,
            outputTokens: data.outputTokens,
            totalTokens,
            model: data.model || 'unknown',
            cost: calculateTokenCost(data.model || 'unknown', data.inputTokens, data.outputTokens),
          },
        });
      }

      logger.info({ agentName: data.agentName, responseTimeMs: data.responseTimeMs, success: data.success }, 'Remote metrics recorded');
      return { metric, tokenUsage };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}
