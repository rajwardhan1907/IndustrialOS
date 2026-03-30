-- Phase 12: Pricing Rules Engine
CREATE TABLE "PricingRule" (
  "id"           TEXT      NOT NULL,
  "name"         TEXT      NOT NULL,
  "type"         TEXT      NOT NULL,
  "minQty"       INTEGER   NOT NULL DEFAULT 0,
  "customerName" TEXT      NOT NULL DEFAULT '',
  "discountPct"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "active"       BOOLEAN   NOT NULL DEFAULT true,
  "workspaceId"  TEXT      NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PricingRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "PricingRule"
  ADD CONSTRAINT "PricingRule_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
