-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('DRAFT', 'PLANNING', 'ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "processId" TEXT;

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "processId" TEXT,
ADD COLUMN     "processRole" TEXT,
ADD COLUMN     "processStage" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "processId" TEXT,
ADD COLUMN     "processStage" INTEGER;

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "summary" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "plan" JSONB,
    "plannedBy" TEXT,
    "agentCount" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,
    "icon" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_organizationId_idx" ON "Process"("organizationId");

-- CreateIndex
CREATE INDEX "Process_status_idx" ON "Process"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Process_organizationId_name_key" ON "Process"("organizationId", "name");

-- CreateIndex
CREATE INDEX "Activity_processId_idx" ON "Activity"("processId");

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
