CREATE TYPE "LegalStatus" AS ENUM ('IN_FORCE', 'EXPIRED', 'REPEALED', 'SUPERSEDED', 'UNKNOWN');

ALTER TABLE "Document"
ADD COLUMN "legalStatus" "LegalStatus" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "validityCheckedAt" TIMESTAMP(3),
ADD COLUMN "validityEvidenceUrl" TEXT,
ADD COLUMN "validityMethod" TEXT;

CREATE INDEX "Document_legalStatus_effectiveAt_idx" ON "Document"("legalStatus", "effectiveAt");
