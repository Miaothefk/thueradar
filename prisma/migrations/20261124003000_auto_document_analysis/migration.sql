ALTER TABLE "Document"
ADD COLUMN "changeSummary" TEXT,
ADD COLUMN "highlights" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "replacedDocumentNumber" TEXT,
ADD COLUMN "replacementDocumentNumber" TEXT,
ADD COLUMN "analysisMethod" TEXT,
ADD COLUMN "analysisCheckedAt" TIMESTAMP(3);
