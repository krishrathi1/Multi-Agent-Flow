import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

function safeCompare(aStr: string, bStr: string): boolean {
  const a = Buffer.from(aStr);
  const b = Buffer.from(bStr);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function generateSecret(): string {
  return randomBytes(32).toString('hex');
}

export function verifyWebhookSignature(payload: string, secret: string, signature: string): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
  return safeCompare(expected, signature);
}

export async function listWebhooks(boardId: string, organizationId: string) {
  // Verify board belongs to org
  const board = await prisma.board.findFirst({ where: { id: boardId, organizationId } });
  if (!board) throw new Error('Board not found');

  return prisma.boardWebhook.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
    include: { agent: { select: { id: true, displayName: true, avatar: true } }, _count: { select: { payloads: true } } },
  });
}

export async function createWebhook(boardId: string, organizationId: string, data: {
  description?: string;
  agentId?: string;
  enabled?: boolean;
}) {
  const board = await prisma.board.findFirst({ where: { id: boardId, organizationId } });
  if (!board) throw new Error('Board not found');

  return prisma.boardWebhook.create({
    data: {
      boardId,
      description: data.description ?? '',
      agentId: data.agentId,
      enabled: data.enabled ?? true,
      secret: generateSecret(),
    },
    include: { agent: { select: { id: true, displayName: true, avatar: true } }, _count: { select: { payloads: true } } },
  });
}

export async function updateWebhook(webhookId: string, boardId: string, data: {
  description?: string;
  agentId?: string | null;
  enabled?: boolean;
}) {
  return prisma.boardWebhook.update({
    where: { id: webhookId, boardId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.agentId !== undefined && { agentId: data.agentId }),
      ...(data.enabled !== undefined && { enabled: data.enabled }),
    },
    include: { agent: { select: { id: true, displayName: true, avatar: true } }, _count: { select: { payloads: true } } },
  });
}

export async function deleteWebhook(webhookId: string, boardId: string) {
  return prisma.boardWebhook.delete({ where: { id: webhookId, boardId } });
}

export async function handleInbound(boardId: string, webhookId: string, payload: unknown, headers: Record<string, string>, sourceIp: string, contentType: string) {
  const webhook = await prisma.boardWebhook.findFirst({
    where: { id: webhookId, boardId, enabled: true },
    include: { board: { select: { organizationId: true } } },
  });
  if (!webhook) throw new Error('Webhook not found or disabled');

  // Validate secret if configured
  const providedSecret = headers['x-webhook-secret'];
  if (webhook.secret) {
    if (!providedSecret || !safeCompare(providedSecret, webhook.secret)) {
      throw new Error('Invalid webhook secret');
    }
  }

  // Redact sensitive headers before storing in database logs
  const SENSITIVE_HEADERS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'x-webhook-secret',
    'x-api-key',
    'x-hub-signature-256',
    'x-hub-signature',
    'proxy-authorization',
    'token',
    'x-auth-token',
  ]);

  const sanitizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      sanitizedHeaders[key] = '[REDACTED]';
    } else {
      sanitizedHeaders[key] = value;
    }
  }

  const stored = await prisma.boardWebhookPayload.create({
    data: {
      webhookId,
      payload: payload as any,
      headers: sanitizedHeaders,
      sourceIp,
      contentType,
    },
  });

  logger.info({ webhookId, payloadId: stored.id, boardId, orgId: webhook.board.organizationId }, 'Webhook payload received');
  return { ...stored, organizationId: webhook.board.organizationId };
}

export async function listPayloads(
  webhookId: string,
  boardId: string,
  options?: { limit?: number; offset?: number },
) {
  // Scoped through the webhook's board: filtering on the payload's webhookId
  // alone meant a webhook id was the only thing protecting inbound request
  // bodies, which routinely carry keys and customer data.
  return prisma.boardWebhookPayload.findMany({
    where: { webhookId, webhook: { boardId } },
    orderBy: { receivedAt: 'desc' },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });
}

export async function getPayload(payloadId: string, boardId: string) {
  // findUnique by id alone was a direct object reference with no ownership
  // check at all — any authenticated user could read any payload.
  return prisma.boardWebhookPayload.findFirst({
    where: { id: payloadId, webhook: { boardId } },
  });
}
