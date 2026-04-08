-- Fix: portalCode + workspaceId should be unique per workspace.
-- Rows with empty portalCode ("") are excluded from the constraint
-- because many customers don't have a portal code yet.

CREATE UNIQUE INDEX IF NOT EXISTS "Customer_portalCode_workspaceId_key"
  ON "Customer"("portalCode", "workspaceId")
  WHERE "portalCode" != '';
