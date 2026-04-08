-- Phase 11: WhatsApp Order Updates
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "whatsappStages"  TEXT    NOT NULL DEFAULT 'Confirmed,Shipped,Delivered';
ALTER TABLE "Customer"  ADD COLUMN IF NOT EXISTS "whatsappPaused"  BOOLEAN NOT NULL DEFAULT false;
