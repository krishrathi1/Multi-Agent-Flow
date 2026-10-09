-- AlterTable: set column default to PRIVATE
ALTER TABLE "Process" ALTER COLUMN "previewVisibility" SET DEFAULT 'PRIVATE';

-- Make existing records PRIVATE unless explicitly configured otherwise
UPDATE "Process" SET "previewVisibility" = 'PRIVATE' WHERE "previewVisibility" = 'PUBLIC';
