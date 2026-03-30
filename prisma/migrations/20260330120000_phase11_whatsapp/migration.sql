-- Phase 11: WhatsApp Order Updates
ALTER TABLE "Workspace" ADD COLUMN "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN "whatsappStages"  TEXT    NOT NULL DEFAULT 'Confirmed,Shipped,Delivered';
ALTER TABLE "Customer"  ADD COLUMN "whatsappPaused"  BOOLEAN NOT NULL DEFAULT false;
