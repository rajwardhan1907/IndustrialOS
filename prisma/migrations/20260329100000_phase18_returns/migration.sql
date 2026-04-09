-- Phase 18: Returns & RMA
-- Creates the Return table for tracking customer return requests.

CREATE TABLE IF NOT EXISTS "Return" (
  "id"           TEXT NOT NULL,
  "rmaNumber"    TEXT NOT NULL,
  "orderId"      TEXT NOT NULL DEFAULT '',
  "customer"     TEXT NOT NULL,
  "sku"          TEXT NOT NULL,
  "qty"          INTEGER NOT NULL DEFAULT 1,
  "reason"       TEXT NOT NULL DEFAULT 'other',
  "description"  TEXT NOT NULL DEFAULT '',
  "status"       TEXT NOT NULL DEFAULT 'requested',
  "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundMethod" TEXT NOT NULL DEFAULT 'original',
  "notes"        TEXT NOT NULL DEFAULT '',
  "workspaceId"  TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "Return"
    ADD CONSTRAINT "Return_workspaceId_fkey"
    FOREIGN KEY ("workspaceId")
    REFERENCES "Workspace"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
