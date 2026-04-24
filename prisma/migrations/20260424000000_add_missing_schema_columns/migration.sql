-- Add columns that exist in schema.prisma but were never migrated to the database.
-- All statements use IF NOT EXISTS so this is safe to re-run on any environment.

-- ── InventoryItem: supplier link + auto-PO tracking ──────────────────────────
ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "supplierId"  TEXT,
  ADD COLUMN IF NOT EXISTS "lastPoDate"  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "autoPoCount" INTEGER NOT NULL DEFAULT 0;

-- FK from InventoryItem.supplierId → Supplier.id (nullable, SET NULL on delete)
DO $$
BEGIN
  ALTER TABLE "InventoryItem"
    ADD CONSTRAINT "InventoryItem_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Index to speed up supplier → inventory lookups
CREATE INDEX IF NOT EXISTS "InventoryItem_supplierId_idx" ON "InventoryItem"("supplierId");

-- ── Supplier: scoring + history fields ───────────────────────────────────────
ALTER TABLE "Supplier"
  ADD COLUMN IF NOT EXISTS "onTimeDeliveryPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS "qualityScore"          DOUBLE PRECISION NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "totalOrdersCount"      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastPoDate"            TEXT NOT NULL DEFAULT '';

-- ── PurchaseOrder: auto-PO metadata ──────────────────────────────────────────
ALTER TABLE "PurchaseOrder"
  ADD COLUMN IF NOT EXISTS "isAutoPo"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "triggeredByLowStock" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "lowStockSkuId"       TEXT NOT NULL DEFAULT '';

-- ── Notification: linked-entity + grouping fields ────────────────────────────
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "linkedType" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "linkedId"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "groupKey"   TEXT NOT NULL DEFAULT '';

-- Replace the simple workspaceId index with the compound index the schema expects
DROP INDEX IF EXISTS "Notification_workspaceId_idx";
CREATE INDEX IF NOT EXISTS "Notification_workspaceId_groupKey_createdAt_idx"
  ON "Notification"("workspaceId", "groupKey", "createdAt");

-- ── Customer: credit-hold + AR health fields ─────────────────────────────────
ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "onCreditHold"         BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "creditHoldReason"     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "daysSalesOutstanding" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "avgPaymentDaysLate"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "returnRate"           DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ── Invoice: payment details + order link + audit timestamp ──────────────────
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "paymentDate"   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "orderId"       TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK from Invoice.orderId → Order.id (nullable)
DO $$
BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Order: quote link + audit timestamp ──────────────────────────────────────
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "quoteId"   TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK from Order.quoteId → Quote.id (nullable)
DO $$
BEGIN
  ALTER TABLE "Order"
    ADD CONSTRAINT "Order_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "Quote"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Shipment: audit timestamp ─────────────────────────────────────────────────
ALTER TABLE "Shipment"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ── Return: refund tracking fields ───────────────────────────────────────────
ALTER TABLE "Return"
  ADD COLUMN IF NOT EXISTS "refundProcessed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "refundDate"      TEXT NOT NULL DEFAULT '';

-- ── PaymentRecord: new table (one row per payment transaction on an invoice) ─
CREATE TABLE IF NOT EXISTS "PaymentRecord" (
  "id"          TEXT NOT NULL,
  "invoiceId"   TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "type"        TEXT NOT NULL DEFAULT 'payment',
  "method"      TEXT NOT NULL DEFAULT '',
  "reference"   TEXT NOT NULL DEFAULT '',
  "notes"       TEXT NOT NULL DEFAULT '',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentRecord_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "PaymentRecord"
    ADD CONSTRAINT "PaymentRecord_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PaymentRecord_invoiceId_idx"   ON "PaymentRecord"("invoiceId");
CREATE INDEX IF NOT EXISTS "PaymentRecord_workspaceId_idx" ON "PaymentRecord"("workspaceId");

-- ── NotificationPreference: per-user alert routing (table was never created) ──
CREATE TABLE IF NOT EXISTS "NotificationPreference" (
  "id"               TEXT NOT NULL,
  "workspaceId"      TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "alertOrdersAbove" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "sendEmail"        BOOLEAN NOT NULL DEFAULT false,
  "sendSms"          BOOLEAN NOT NULL DEFAULT false,
  "useDigest"        BOOLEAN NOT NULL DEFAULT false,
  "digestTime"       TEXT NOT NULL DEFAULT '09:00',
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Unique: one preference row per user per workspace
DO $$
BEGIN
  ALTER TABLE "NotificationPreference"
    ADD CONSTRAINT "NotificationPreference_workspaceId_userId_key"
    UNIQUE ("workspaceId", "userId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
