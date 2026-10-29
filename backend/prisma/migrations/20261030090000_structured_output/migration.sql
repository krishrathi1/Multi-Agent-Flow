-- AlterTable
ALTER TABLE "ProcessRunStep" ADD COLUMN "output" JSONB;

-- AlterTable
ALTER TABLE "ProcessRun" ADD COLUMN "output" JSONB;
