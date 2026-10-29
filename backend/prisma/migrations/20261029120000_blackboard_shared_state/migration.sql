-- CreateEnum
CREATE TYPE "MessagingMode" AS ENUM ('BLACKBOARD', 'PEER_TO_PEER');

-- AlterTable
ALTER TABLE "Process" ADD COLUMN "messagingMode" "MessagingMode" NOT NULL DEFAULT 'BLACKBOARD';

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN "messagingMode" "MessagingMode",
ADD COLUMN "messaging" JSONB;

-- CreateTable
CREATE TABLE "BlackboardEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "runId" TEXT,
    "kind" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorAgentId" TEXT,
    "authorName" TEXT NOT NULL,
    "stage" INTEGER,
    "toRole" TEXT,
    "status" TEXT NOT NULL DEFAULT 'info',
    "resolvedBy" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlackboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlackboardEntry_processId_createdAt_idx" ON "BlackboardEntry"("processId", "createdAt");

-- CreateIndex
CREATE INDEX "BlackboardEntry_runId_idx" ON "BlackboardEntry"("runId");

-- CreateIndex
CREATE INDEX "BlackboardEntry_organizationId_idx" ON "BlackboardEntry"("organizationId");

-- AddForeignKey
ALTER TABLE "BlackboardEntry" ADD CONSTRAINT "BlackboardEntry_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlackboardEntry" ADD CONSTRAINT "BlackboardEntry_runId_fkey" FOREIGN KEY ("runId") REFERENCES "ProcessRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
