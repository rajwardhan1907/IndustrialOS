-- Phase 12 (roadmap): Contract & SLA Tracker
CREATE TABLE IF NOT EXISTS "Contract" (
  "id"             TEXT      NOT NULL,
  "contractNumber" TEXT      NOT NULL,
  "title"          TEXT      NOT NULL,
  "customer"       TEXT      NOT NULL,
  "minOrderQty"    INTEGER   NOT NULL DEFAULT 0,
  "agreedPricing"  TEXT      NOT NULL DEFAULT '',
  "deliverySLA"    INTEGER   NOT NULL DEFAULT 7,
  "value"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "startDate"      TEXT      NOT NULL,
  "expiryDate"     TEXT      NOT NULL,
  "status"         TEXT      NOT NULL DEFAULT 'active',
  "notes"          TEXT      NOT NULL DEFAULT '',
  "workspaceId"    TEXT      NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Contract"
  ADD CONSTRAINT IF NOT EXISTS "Contract_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
