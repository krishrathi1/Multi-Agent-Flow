-- AlterTable
ALTER TABLE "Approval" ADD COLUMN     "rubricScores" JSONB;

-- CreateTable
CREATE TABLE "ApprovalTaskLink" (
    "id" TEXT NOT NULL,
    "approvalId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalTaskLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApprovalTaskLink_approvalId_idx" ON "ApprovalTaskLink"("approvalId");

-- CreateIndex
CREATE INDEX "ApprovalTaskLink_taskId_idx" ON "ApprovalTaskLink"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalTaskLink_approvalId_taskId_key" ON "ApprovalTaskLink"("approvalId", "taskId");

-- AddForeignKey
ALTER TABLE "ApprovalTaskLink" ADD CONSTRAINT "ApprovalTaskLink_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "Approval"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalTaskLink" ADD CONSTRAINT "ApprovalTaskLink_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
