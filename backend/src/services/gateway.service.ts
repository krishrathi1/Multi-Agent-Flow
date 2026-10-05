import { prisma } from '../lib/prisma.js';
import { connectGateway, disconnectGateway, getGatewayClient } from '../openclaw/client.js';
import { validateExternalUrl } from '../lib/url-validator.js';
import { encryptField, decryptField } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { syncPendingAgents } from './agent.service.js';
import type { GatewayStatus } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';

const tracer = trace.getTracer('nexus-gateway');

// Socket.io instance for forwarding gateway events to UI
let socketIO: SocketIOServer | null = null;
export function setSocketIO(io: SocketIOServer) { socketIO = io; }

export async function getAllGateways(organizationId: string) {
  return prisma.gateway.findMany({
    where: { organizationId },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { agents: true } },
    },
  });
}

export async function getGatewayById(id: string, organizationId: string) {
  return prisma.gateway.findFirst({
    where: { id, organizationId },
    include: {
      _count: { select: { agents: true } },
    },
  });
}

export async function createGateway(organizationId: string, data: {
  name: string;
  url: string;
  token: string;
  workspaceRoot?: string;
}) {
  return tracer.startActiveSpan('gateway.create', async (span) => {
    try {
      span.setAttribute('gateway.name', data.name);
      span.setAttribute('gateway.url', data.url);
      span.setAttribute('org.id', organizationId);

  // SSRF protection: validate the gateway URL
  const allowPrivate = process.env.ALLOW_PRIVATE_URLS === 'true' || process.env.ALLOW_LOCAL_URLS === 'true';
  validateExternalUrl(data.url, 'Gateway URL', allowPrivate);

  // Encrypt token before storing
  const encryptedToken = encryptField(data.token);

  const gateway = await prisma.gateway.create({
    data: {
      organizationId,
      name: data.name,
      url: data.url,
      token: encryptedToken,
      workspaceRoot: data.workspaceRoot ?? '',
    },
    include: {
      _count: { select: { agents: true } },
    },
  });

  span.setAttribute('gateway.id', gateway.id);

  // Try to connect immediately (use plaintext token for connection)
  try {
    await connectGateway(gateway.id, data.url, data.token);
    await prisma.gateway.update({
      where: { id: gateway.id },
      data: { status: 'ONLINE', lastCheckedAt: new Date() },
    });
    gateway.status = 'ONLINE' as GatewayStatus;
    subscribeGatewayEvents(gateway.id, organizationId);
    span.setAttribute('gateway.status', 'ONLINE');
  } catch {
    await prisma.gateway.update({
      where: { id: gateway.id },
      data: { status: 'OFFLINE', lastCheckedAt: new Date() },
    });
    gateway.status = 'OFFLINE' as GatewayStatus;
    span.setAttribute('gateway.status', 'OFFLINE');
  }

  logger.info({ gatewayId: gateway.id, name: data.name, status: gateway.status }, 'Gateway created');
  return gateway;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function updateGateway(id: string, organizationId: string, data: {
  name?: string;
  url?: string;
  token?: string;
  workspaceRoot?: string;
}) {
  // SSRF protection: validate the gateway URL if being updated
  const allowPrivate = process.env.ALLOW_PRIVATE_URLS === 'true' || process.env.ALLOW_LOCAL_URLS === 'true';
  if (data.url) validateExternalUrl(data.url, 'Gateway URL', allowPrivate);

  const gateway = await prisma.gateway.update({
    where: { id, organizationId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.token !== undefined && { token: encryptField(data.token) }),
      ...(data.workspaceRoot !== undefined && { workspaceRoot: data.workspaceRoot }),
    },
    include: {
      _count: { select: { agents: true } },
    },
  });

  // Reconnect if URL or token changed
  if (data.url || data.token) {
    try {
      await connectGateway(id, gateway.url, decryptField(gateway.token));
      await prisma.gateway.update({
        where: { id },
        data: { status: 'ONLINE', lastCheckedAt: new Date() },
      });
    } catch {
      await prisma.gateway.update({
        where: { id },
        data: { status: 'OFFLINE', lastCheckedAt: new Date() },
      });
    }
  }

  return gateway;
}

export async function deleteGateway(id: string, organizationId: string) {
  disconnectGateway(id);
  return prisma.gateway.delete({ where: { id, organizationId } });
}

export async function checkGatewayHealth(id: string, organizationId: string) {
  return tracer.startActiveSpan('gateway.healthCheck', async (span) => {
    try {
      span.setAttribute('gateway.id', id);

  const gateway = await prisma.gateway.findFirst({ where: { id, organizationId } });
  if (!gateway) throw new Error('Gateway not found');

  let client = getGatewayClient(id);
  if (!client || !client.isConnected()) {
    try {
      client = await connectGateway(id, gateway.url, decryptField(gateway.token));
    } catch {
      await prisma.gateway.update({ where: { id }, data: { status: 'OFFLINE', lastCheckedAt: new Date() } });
      span.setAttribute('gateway.status', 'OFFLINE');
      return { status: 'OFFLINE', connected: false };
    }
  }

  try {
    const health = await client.rpc('health', { probe: true });
    await prisma.gateway.update({ where: { id }, data: { status: 'ONLINE', lastCheckedAt: new Date() } });
    span.setAttribute('gateway.status', 'ONLINE');
    return { status: 'ONLINE', connected: true, details: health };
  } catch {
    await prisma.gateway.update({ where: { id }, data: { status: 'OFFLINE', lastCheckedAt: new Date() } });
    span.setAttribute('gateway.status', 'OFFLINE');
    return { status: 'OFFLINE', connected: false };
  }
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      span.recordException(err as Error);
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function getGatewayModels(id: string, organizationId: string) {
  const gateway = await prisma.gateway.findFirst({ where: { id, organizationId } });
  if (!gateway) throw new Error('Gateway not found');

  const client = getGatewayClient(id);
  if (!client || !client.isConnected()) {
    throw new Error('Gateway not connected');
  }

  const result = await client.rpc('models.list', {}) as { models: Array<{ id: string; name: string; provider: string; contextWindow?: number; reasoning?: boolean }> };
  return result.models;
}

export async function getGatewaySessions(id: string, organizationId: string) {
  const gateway = await prisma.gateway.findFirst({ where: { id, organizationId } });
  if (!gateway) throw new Error('Gateway not found');

  const client = getGatewayClient(id);
  if (!client || !client.isConnected()) {
    throw new Error('Gateway not connected');
  }

  const result = await client.rpc('sessions.list', {});
  return result;
}

// Subscribe to gateway events and forward to Socket.io for real-time monitoring
function subscribeGatewayEvents(gatewayId: string, organizationId: string) {
  const client = getGatewayClient(gatewayId);
  if (!client) return;

  client.onEvent((event, payload) => {
    if (!socketIO) return;
    const room = `org:${organizationId}`;

    // Forward relevant agent events to the UI
    switch (event) {
      case 'agent.activity':
      case 'agent.message':
      case 'agent.status':
      case 'session.start':
      case 'session.end':
      case 'session.message':
        socketIO.to(room).emit(`gateway:${event}`, {
          gatewayId,
          event,
          payload,
          timestamp: new Date().toISOString(),
        });
        break;
    }
  });
}

/**
 * Auto-provision a default gateway for an organization using platform operator env vars.
 * Idempotent: returns existing gateway ID if org already has one.
 * Returns null if env vars are not configured.
 */
export async function ensureDefaultGateway(organizationId: string): Promise<string | null> {
  const defaultUrl = process.env.DEFAULT_GATEWAY_URL;
  const defaultToken = process.env.DEFAULT_GATEWAY_TOKEN;

  // If env vars not configured, cannot auto-provision
  if (!defaultUrl || !defaultToken) return null;

  // If org already has any gateway, return the first one
  const existing = await prisma.gateway.findFirst({
    where: { organizationId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing.id;

  // Create the default gateway (skip SSRF validation — URL is from operator env vars,
  // not user input, and operators commonly use internal/Docker network addresses)
  const defaultWorkspace = process.env.DEFAULT_GATEWAY_WORKSPACE || '';
  const encryptedToken = encryptField(defaultToken);

  try {
    const gateway = await prisma.gateway.create({
      data: {
        organizationId,
        name: 'Default Gateway',
        url: defaultUrl,
        token: encryptedToken,
        workspaceRoot: defaultWorkspace,
      },
    });

    // Try to connect immediately
    try {
      await connectGateway(gateway.id, defaultUrl, defaultToken);
      await prisma.gateway.update({
        where: { id: gateway.id },
        data: { status: 'ONLINE', lastCheckedAt: new Date() },
      });
      subscribeGatewayEvents(gateway.id, organizationId);
      await syncPendingAgents(gateway.id);
    } catch {
      await prisma.gateway.update({
        where: { id: gateway.id },
        data: { status: 'OFFLINE', lastCheckedAt: new Date() },
      });
    }

    logger.info({ orgId: organizationId, gatewayId: gateway.id }, 'Auto-provisioned default gateway');
    return gateway.id;
  } catch (err) {
    // Unique constraint violation (race condition) — find and return existing
    const fallback = await prisma.gateway.findFirst({
      where: { organizationId, name: 'Default Gateway' },
      select: { id: true },
    });
    if (fallback) return fallback.id;
    logger.warn({ orgId: organizationId, err }, 'Failed to auto-provision default gateway');
    return null;
  }
}

// Connect all gateways on startup
export async function connectAllGateways() {
  const gateways = await prisma.gateway.findMany();
  for (const gw of gateways) {
    try {
      await connectGateway(gw.id, gw.url, decryptField(gw.token));
      await prisma.gateway.update({
        where: { id: gw.id },
        data: { status: 'ONLINE', lastCheckedAt: new Date() },
      });
      subscribeGatewayEvents(gw.id, gw.organizationId);
      logger.info({ gateway: gw.name, url: gw.url }, 'Gateway connected');
      // Sync any agents that were created while gateway was offline
      await syncPendingAgents(gw.id);
    } catch (err) {
      await prisma.gateway.update({
        where: { id: gw.id },
        data: { status: 'OFFLINE', lastCheckedAt: new Date() },
      });
      logger.warn({ gateway: gw.name, err }, 'Failed to connect gateway');
    }
  }
}
