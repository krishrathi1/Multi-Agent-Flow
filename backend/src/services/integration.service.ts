import { PrismaClient, ChannelType } from '@prisma/client';

const prisma = new PrismaClient();

// Mask sensitive tokens: show first 4 + last 4 chars
function maskToken(token: string | null | undefined): string | null {
  if (!token) return null;
  if (token.length <= 10) return '****';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

// Strip credentials from response
function maskIntegration(integration: Record<string, unknown>) {
  return {
    ...integration,
    botToken: maskToken(integration.botToken as string),
    appToken: maskToken(integration.appToken as string),
    serviceAccount: integration.serviceAccount ? { masked: true } : null,
  };
}

export async function listIntegrations(agentId: string, organizationId: string) {
  // Verify agent belongs to org
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  const integrations = await prisma.agentIntegration.findMany({
    where: { agentId },
    orderBy: { createdAt: 'asc' },
  });

  return integrations.map((i) => maskIntegration(i as unknown as Record<string, unknown>));
}

export async function getIntegration(agentId: string, channel: ChannelType, organizationId: string) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  const integration = await prisma.agentIntegration.findUnique({
    where: { agentId_channel: { agentId, channel } },
  });
  if (!integration) throw new Error('Integration not found');

  return maskIntegration(integration as unknown as Record<string, unknown>);
}

export async function upsertIntegration(
  agentId: string,
  channel: ChannelType,
  organizationId: string,
  data: {
    botToken?: string | null;
    appToken?: string | null;
    serviceAccount?: Record<string, unknown> | null;
    webhookUrl?: string | null;
    dmPolicy?: string;
    groupPolicy?: string;
    enabled?: boolean;
  },
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  // If masked token sent back, don't overwrite
  const existing = await prisma.agentIntegration.findUnique({
    where: { agentId_channel: { agentId, channel } },
  });

  const updateData: Record<string, unknown> = {};
  if (data.dmPolicy !== undefined) updateData.dmPolicy = data.dmPolicy;
  if (data.groupPolicy !== undefined) updateData.groupPolicy = data.groupPolicy;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl;

  // Only update tokens if they're real values (not masked)
  if (data.botToken !== undefined && data.botToken !== null && !data.botToken.includes('...')) {
    updateData.botToken = data.botToken;
  }
  if (data.appToken !== undefined && data.appToken !== null && !data.appToken.includes('...')) {
    updateData.appToken = data.appToken;
  }
  if (data.serviceAccount !== undefined && !(data.serviceAccount as Record<string, unknown>)?.masked) {
    updateData.serviceAccount = data.serviceAccount as any;
  }

  const integration = await prisma.agentIntegration.upsert({
    where: { agentId_channel: { agentId, channel } },
    create: {
      agentId,
      channel,
      botToken: data.botToken || null,
      appToken: data.appToken || null,
      serviceAccount: data.serviceAccount as any || undefined,
      webhookUrl: data.webhookUrl || null,
      dmPolicy: data.dmPolicy || 'open',
      groupPolicy: data.groupPolicy || 'open',
      enabled: data.enabled ?? true,
    },
    update: updateData,
  });

  return maskIntegration(integration as unknown as Record<string, unknown>);
}

export async function toggleIntegration(
  agentId: string,
  channel: ChannelType,
  organizationId: string,
  enabled: boolean,
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  const integration = await prisma.agentIntegration.update({
    where: { agentId_channel: { agentId, channel } },
    data: { enabled },
  });

  return maskIntegration(integration as unknown as Record<string, unknown>);
}

export async function deleteIntegration(
  agentId: string,
  channel: ChannelType,
  organizationId: string,
) {
  const agent = await prisma.agent.findFirst({
    where: { id: agentId, organizationId },
  });
  if (!agent) throw new Error('Agent not found');

  await prisma.agentIntegration.delete({
    where: { agentId_channel: { agentId, channel } },
  });
}
