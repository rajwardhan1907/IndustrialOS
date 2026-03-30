-- Phase 15: Multi-Currency Support
-- Adds currency field to Workspace and Invoice tables

ALTER TABLE "Workspace" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "Invoice"   ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
