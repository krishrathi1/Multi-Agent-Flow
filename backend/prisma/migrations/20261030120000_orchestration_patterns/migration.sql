-- CreateEnum
CREATE TYPE "OrchestrationPattern" AS ENUM ('HYBRID', 'SEQUENTIAL', 'PARALLEL', 'HIERARCHICAL');

-- AlterTable
ALTER TABLE "Process" ADD COLUMN "orchestrationPattern" "OrchestrationPattern" NOT NULL DEFAULT 'HYBRID';

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN "orchestrationPattern" "OrchestrationPattern",
ADD COLUMN "orchestration" JSONB;
