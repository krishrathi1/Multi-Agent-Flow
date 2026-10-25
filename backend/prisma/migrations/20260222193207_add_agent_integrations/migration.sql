-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('TELEGRAM', 'SLACK', 'GOOGLE_CHAT');

-- CreateTable
CREATE TABLE "AgentIntegration" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "channel" "ChannelType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "botToken" TEXT,
    "appToken" TEXT,
    "serviceAccount" JSONB,
    "webhookUrl" TEXT,
    "dmPolicy" TEXT NOT NULL DEFAULT 'open',
    "groupPolicy" TEXT NOT NULL DEFAULT 'open',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "lastError" TEXT,
    "lastConnectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentIntegration_agentId_idx" ON "AgentIntegration"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentIntegration_agentId_channel_key" ON "AgentIntegration"("agentId", "channel");

-- AddForeignKey
ALTER TABLE "AgentIntegration" ADD CONSTRAINT "AgentIntegration_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
