-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'TEXT_LONG', 'INTEGER', 'DECIMAL', 'BOOLEAN', 'DATE', 'DATE_TIME', 'URL', 'JSON');

-- CreateEnum
CREATE TYPE "CustomFieldVisibility" AS ENUM ('ALWAYS', 'IF_SET', 'HIDDEN');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "agentToAgent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Board" ADD COLUMN     "blockStatusChangesWithPendingApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "onlyLeadCanChangeStatus" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireReviewBeforeDone" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "fingerprintHash" TEXT;

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TagAssignment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskFingerprint" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskFingerprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL DEFAULT 'TEXT',
    "uiVisibility" "CustomFieldVisibility" NOT NULL DEFAULT 'ALWAYS',
    "validationRegex" TEXT,
    "defaultValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardTaskCustomField" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardTaskCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskCustomFieldValue" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceSkill" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'general',
    "risk" TEXT NOT NULL DEFAULT 'low',
    "sourceUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillPack" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sourceUrl" TEXT NOT NULL,
    "branch" TEXT NOT NULL DEFAULT 'main',
    "metadata" JSONB,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatewayInstalledSkill" (
    "id" TEXT NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatewayInstalledSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardWebhook" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "agentId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "secret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardWebhookPayload" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "headers" JSONB,
    "sourceIp" TEXT,
    "contentType" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardWebhookPayload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardOnboardingSession" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "draftGoal" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BoardOnboardingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardGroupMemory" (
    "id" TEXT NOT NULL,
    "boardGroupId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tags" JSONB,
    "isChat" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardGroupMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invitedEmail" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "allBoardsRead" BOOLEAN NOT NULL DEFAULT false,
    "allBoardsWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" TEXT,
    "acceptedByUserId" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgInviteBoardAccess" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "OrgInviteBoardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoulTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoulTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tag_organizationId_idx" ON "Tag"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_organizationId_slug_key" ON "Tag"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "TagAssignment_taskId_idx" ON "TagAssignment"("taskId");

-- CreateIndex
CREATE INDEX "TagAssignment_tagId_idx" ON "TagAssignment"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "TagAssignment_taskId_tagId_key" ON "TagAssignment"("taskId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFingerprint_taskId_key" ON "TaskFingerprint"("taskId");

-- CreateIndex
CREATE INDEX "TaskFingerprint_fingerprintHash_idx" ON "TaskFingerprint"("fingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "TaskFingerprint_boardId_fingerprintHash_key" ON "TaskFingerprint"("boardId", "fingerprintHash");

-- CreateIndex
CREATE INDEX "TaskCustomFieldDefinition_organizationId_idx" ON "TaskCustomFieldDefinition"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCustomFieldDefinition_organizationId_fieldKey_key" ON "TaskCustomFieldDefinition"("organizationId", "fieldKey");

-- CreateIndex
CREATE INDEX "BoardTaskCustomField_boardId_idx" ON "BoardTaskCustomField"("boardId");

-- CreateIndex
CREATE INDEX "BoardTaskCustomField_definitionId_idx" ON "BoardTaskCustomField"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardTaskCustomField_boardId_definitionId_key" ON "BoardTaskCustomField"("boardId", "definitionId");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_taskId_idx" ON "TaskCustomFieldValue"("taskId");

-- CreateIndex
CREATE INDEX "TaskCustomFieldValue_definitionId_idx" ON "TaskCustomFieldValue"("definitionId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskCustomFieldValue_taskId_definitionId_key" ON "TaskCustomFieldValue"("taskId", "definitionId");

-- CreateIndex
CREATE INDEX "MarketplaceSkill_organizationId_idx" ON "MarketplaceSkill"("organizationId");

-- CreateIndex
CREATE INDEX "MarketplaceSkill_category_idx" ON "MarketplaceSkill"("category");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceSkill_organizationId_name_key" ON "MarketplaceSkill"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SkillPack_organizationId_idx" ON "SkillPack"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SkillPack_organizationId_sourceUrl_key" ON "SkillPack"("organizationId", "sourceUrl");

-- CreateIndex
CREATE INDEX "GatewayInstalledSkill_gatewayId_idx" ON "GatewayInstalledSkill"("gatewayId");

-- CreateIndex
CREATE INDEX "GatewayInstalledSkill_skillId_idx" ON "GatewayInstalledSkill"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "GatewayInstalledSkill_gatewayId_skillId_key" ON "GatewayInstalledSkill"("gatewayId", "skillId");

-- CreateIndex
CREATE INDEX "BoardWebhook_boardId_idx" ON "BoardWebhook"("boardId");

-- CreateIndex
CREATE INDEX "BoardWebhook_agentId_idx" ON "BoardWebhook"("agentId");

-- CreateIndex
CREATE INDEX "BoardWebhookPayload_webhookId_idx" ON "BoardWebhookPayload"("webhookId");

-- CreateIndex
CREATE INDEX "BoardWebhookPayload_receivedAt_idx" ON "BoardWebhookPayload"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BoardOnboardingSession_sessionKey_key" ON "BoardOnboardingSession"("sessionKey");

-- CreateIndex
CREATE INDEX "BoardOnboardingSession_boardId_idx" ON "BoardOnboardingSession"("boardId");

-- CreateIndex
CREATE INDEX "BoardOnboardingSession_status_idx" ON "BoardOnboardingSession"("status");

-- CreateIndex
CREATE INDEX "BoardGroupMemory_boardGroupId_idx" ON "BoardGroupMemory"("boardGroupId");

-- CreateIndex
CREATE INDEX "BoardGroupMemory_createdAt_idx" ON "BoardGroupMemory"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_token_key" ON "OrgInvite"("token");

-- CreateIndex
CREATE INDEX "OrgInvite_organizationId_idx" ON "OrgInvite"("organizationId");

-- CreateIndex
CREATE INDEX "OrgInvite_token_idx" ON "OrgInvite"("token");

-- CreateIndex
CREATE INDEX "OrgInvite_status_idx" ON "OrgInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInvite_organizationId_invitedEmail_key" ON "OrgInvite"("organizationId", "invitedEmail");

-- CreateIndex
CREATE INDEX "OrgInviteBoardAccess_inviteId_idx" ON "OrgInviteBoardAccess"("inviteId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgInviteBoardAccess_inviteId_boardId_key" ON "OrgInviteBoardAccess"("inviteId", "boardId");

-- CreateIndex
CREATE INDEX "SoulTemplate_organizationId_idx" ON "SoulTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "SoulTemplate_category_idx" ON "SoulTemplate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SoulTemplate_organizationId_slug_key" ON "SoulTemplate"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "Task_fingerprintHash_idx" ON "Task"("fingerprintHash");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TagAssignment" ADD CONSTRAINT "TagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskFingerprint" ADD CONSTRAINT "TaskFingerprint_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomFieldDefinition" ADD CONSTRAINT "TaskCustomFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskCustomField" ADD CONSTRAINT "BoardTaskCustomField_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardTaskCustomField" ADD CONSTRAINT "BoardTaskCustomField_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "TaskCustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomFieldValue" ADD CONSTRAINT "TaskCustomFieldValue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskCustomFieldValue" ADD CONSTRAINT "TaskCustomFieldValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "TaskCustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceSkill" ADD CONSTRAINT "MarketplaceSkill_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillPack" ADD CONSTRAINT "SkillPack_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayInstalledSkill" ADD CONSTRAINT "GatewayInstalledSkill_gatewayId_fkey" FOREIGN KEY ("gatewayId") REFERENCES "Gateway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GatewayInstalledSkill" ADD CONSTRAINT "GatewayInstalledSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "MarketplaceSkill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWebhook" ADD CONSTRAINT "BoardWebhook_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWebhook" ADD CONSTRAINT "BoardWebhook_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardWebhookPayload" ADD CONSTRAINT "BoardWebhookPayload_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "BoardWebhook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardOnboardingSession" ADD CONSTRAINT "BoardOnboardingSession_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardGroupMemory" ADD CONSTRAINT "BoardGroupMemory_boardGroupId_fkey" FOREIGN KEY ("boardGroupId") REFERENCES "BoardGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInvite" ADD CONSTRAINT "OrgInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInviteBoardAccess" ADD CONSTRAINT "OrgInviteBoardAccess_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "OrgInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SoulTemplate" ADD CONSTRAINT "SoulTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
