-- Phase 16 migration: Purchase Approval Workflows
-- Adds approvalStatus + approvalThreshold to PurchaseOrder
-- Adds poApprovalThreshold to Workspace (configurable per workspace in Settings)

-- ── PurchaseOrder: add approval fields ───────────────────────────────────────
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "approvalStatus"  TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS "approvedBy"      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "approvedAt"      TEXT NOT NULL DEFAULT '';

-- approvalStatus values:
--   not_required  → PO value is below the workspace threshold
--   pending       → PO value is above threshold, waiting for admin to approve
--   approved      → admin approved, can now be sent to supplier
--   rejected      → admin rejected, PO is blocked

-- ── Workspace: add per-workspace approval threshold ───────────────────────────
-- Default 0 means approval is OFF (no POs require approval)
ALTER TABLE "Workspace"
  ADD COLUMN IF NOT EXISTS "poApprovalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0;
