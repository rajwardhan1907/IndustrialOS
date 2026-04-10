-- Portal Returns: default return address and instructions shown to customers after approval
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "returnAddress"      TEXT NOT NULL DEFAULT '';
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "returnInstructions" TEXT NOT NULL DEFAULT '';
