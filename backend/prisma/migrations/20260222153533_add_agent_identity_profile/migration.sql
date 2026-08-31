-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "heartbeatConfig" JSONB,
ADD COLUMN     "identityProfile" JSONB,
ADD COLUMN     "identityTemplate" TEXT;
