-- Phase 15: Multi-Currency Support
-- Adds currency field to Workspace and Invoice tables
-- Uses IF NOT EXISTS so it is safe to re-run after a partial failure

ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Invoice"   ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
