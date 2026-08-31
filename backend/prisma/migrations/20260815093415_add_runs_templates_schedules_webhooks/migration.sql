-- CreateEnum
CREATE TYPE "RunState" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RunTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'WEBHOOK', 'RETRY');

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "budgetUsd" DOUBLE PRECISION,
ADD COLUMN     "maxTokens" INTEGER;

-- CreateTable
CREATE TABLE "ProcessRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "state" "RunState" NOT NULL DEFAULT 'QUEUED',
    "trigger" "RunTrigger" NOT NULL DEFAULT 'MANUAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "currentStage" INTEGER,
    "totalStages" INTEGER,

    CONSTRAINT "ProcessRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessRunStep" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "state" "RunState" NOT NULL DEFAULT 'QUEUED',
    "summary" TEXT,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "files" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessRunStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "category" TEXT,
    "plan" JSONB NOT NULL,
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessSchedule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "cron" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessWebhook" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT[] DEFAULT ARRAY['run.completed', 'run.failed']::TEXT[],
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "lastFiredAt" TIMESTAMP(3),
    "lastStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcessRun_organizationId_idx" ON "ProcessRun"("organizationId");

-- CreateIndex
CREATE INDEX "ProcessRun_processId_idx" ON "ProcessRun"("processId");

-- CreateIndex
CREATE INDEX "ProcessRun_state_idx" ON "ProcessRun"("state");

-- CreateIndex
CREATE INDEX "ProcessRun_startedAt_idx" ON "ProcessRun"("startedAt");

-- CreateIndex
CREATE INDEX "ProcessRunStep_runId_idx" ON "ProcessRunStep"("runId");

-- CreateIndex
CREATE INDEX "ProcessRunStep_agentId_idx" ON "ProcessRunStep"("agentId");

-- CreateIndex
CREATE INDEX "ProcessTemplate_organizationId_idx" ON "ProcessTemplate"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessTemplate_organizationId_name_key" ON "ProcessTemplate"("organizationId", "name");

-- CreateIndex
CREATE INDEX "ProcessSchedule_organizationId_idx" ON "ProcessSchedule"("organizationId");

-- CreateIndex
CREATE INDEX "ProcessSchedule_processId_idx" ON "ProcessSchedule"("processId");

-- CreateIndex
CREATE INDEX "ProcessSchedule_enabled_idx" ON "ProcessSchedule"("enabled");

-- CreateIndex
CREATE INDEX "ProcessWebhook_organizationId_idx" ON "ProcessWebhook"("organizationId");

-- CreateIndex
CREATE INDEX "ProcessWebhook_processId_idx" ON "ProcessWebhook"("processId");

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRun" ADD CONSTRAINT "ProcessRun_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessRunStep" ADD CONSTRAINT "ProcessRunStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProcessRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessTemplate" ADD CONSTRAINT "ProcessTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessSchedule" ADD CONSTRAINT "ProcessSchedule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessSchedule" ADD CONSTRAINT "ProcessSchedule_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessWebhook" ADD CONSTRAINT "ProcessWebhook_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessWebhook" ADD CONSTRAINT "ProcessWebhook_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
