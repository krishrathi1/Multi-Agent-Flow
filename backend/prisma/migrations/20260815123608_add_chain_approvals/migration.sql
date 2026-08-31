-- CreateTable
CREATE TABLE "ChainApproval" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "processId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "stage" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChainApproval_organizationId_idx" ON "ChainApproval"("organizationId");

-- CreateIndex
CREATE INDEX "ChainApproval_processId_idx" ON "ChainApproval"("processId");

-- CreateIndex
CREATE INDEX "ChainApproval_status_idx" ON "ChainApproval"("status");

-- AddForeignKey
ALTER TABLE "ChainApproval" ADD CONSTRAINT "ChainApproval_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChainApproval" ADD CONSTRAINT "ChainApproval_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE CASCADE ON UPDATE CASCADE;
