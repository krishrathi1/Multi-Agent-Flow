-- CreateEnum
CREATE TYPE "PreviewVisibility" AS ENUM ('PUBLIC', 'TOKEN', 'PRIVATE');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('GATE_PENDING', 'RUN_FAILED', 'RUN_COMPLETED', 'BUDGET_STOPPED', 'SCHEDULE_FIRED');

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "guidance" TEXT,
ADD COLUMN     "previewVisibility" "PreviewVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "shareToken" TEXT;

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "note" TEXT;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "processId" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_organizationId_readAt_idx" ON "Notification"("organizationId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Process_shareToken_key" ON "Process"("shareToken");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

