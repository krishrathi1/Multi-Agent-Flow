-- AlterTable
ALTER TABLE "OrgMember" ADD COLUMN     "allBoardsRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allBoardsWrite" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "OrgMemberBoardAccess" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "canRead" BOOLEAN NOT NULL DEFAULT true,
    "canWrite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrgMemberBoardAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgMemberBoardAccess_memberId_idx" ON "OrgMemberBoardAccess"("memberId");

-- CreateIndex
CREATE INDEX "OrgMemberBoardAccess_boardId_idx" ON "OrgMemberBoardAccess"("boardId");

-- CreateIndex
CREATE UNIQUE INDEX "OrgMemberBoardAccess_memberId_boardId_key" ON "OrgMemberBoardAccess"("memberId", "boardId");

-- CreateIndex
CREATE INDEX "OrgInviteBoardAccess_boardId_idx" ON "OrgInviteBoardAccess"("boardId");

-- AddForeignKey
ALTER TABLE "OrgMemberBoardAccess" ADD CONSTRAINT "OrgMemberBoardAccess_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "OrgMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgMemberBoardAccess" ADD CONSTRAINT "OrgMemberBoardAccess_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgInviteBoardAccess" ADD CONSTRAINT "OrgInviteBoardAccess_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;
