-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('NONE', 'EVERY_STAGE', 'FINAL_STAGE');

-- AlterEnum
ALTER TYPE "RunState" ADD VALUE 'AWAITING_APPROVAL';

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN     "awaitingStage" INTEGER;
