-- Phase 6 migration: fix Order table columns + add all missing tables
-- Safe to run on top of the existing init migration.

-- ── Fix the Order table ───────────────────────────────────────────────────────
-- The old Order table had (title, status, priority) — the app needs different columns.
-- We drop the old constraints/columns and add the correct ones.

ALTER TABLE "Order" DROP COLUMN IF EXISTS "title";
ALTER TABLE "Order" DROP COLUMN IF EXISTS "updatedAt";
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customer"  TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "sku"       TEXT NOT NULL DEFAULT '';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "items"     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "value"     DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "stage"     TEXT NOT NULL DEFAULT 'Placed';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "source"    TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "notes"     TEXT NOT NULL DEFAULT '';
-- "priority" and "workspaceId" and "createdAt" already exist, keep them.

-- ── Fix User.name nullable ────────────────────────────────────────────────────
-- Old schema had name as nullable (TEXT), new schema wants NOT NULL.
-- Update any NULLs first, then set NOT NULL.
UPDATE "User" SET "name" = 'Unknown' WHERE "name" IS NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "name" SET DEFAULT '';

-- ── Invoice ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Invoice" (
    "id"            TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customer"      TEXT NOT NULL,
    "items"         JSONB NOT NULL DEFAULT '[]',
    "subtotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax"           DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountPaid"    DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms"  TEXT NOT NULL DEFAULT 'Net 30',
    "issueDate"     TEXT NOT NULL,
    "dueDate"       TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'unpaid',
    "notes"         TEXT NOT NULL DEFAULT '',
    "workspaceId"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- ── Customer ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Customer" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "phone"       TEXT NOT NULL DEFAULT '',
    "country"     TEXT NOT NULL DEFAULT '',
    "industry"    TEXT NOT NULL DEFAULT '',
    "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balanceDue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"      TEXT NOT NULL DEFAULT 'active',
    "portalCode"  TEXT NOT NULL DEFAULT '',
    "notes"       TEXT NOT NULL DEFAULT '',
    "orders"      JSONB NOT NULL DEFAULT '[]',
    "workspaceId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- ── Quote ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Quote" (
    "id"           TEXT NOT NULL,
    "quoteNumber"  TEXT NOT NULL,
    "customer"     TEXT NOT NULL,
    "items"        JSONB NOT NULL DEFAULT '[]',
    "subtotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmt"  DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validUntil"   TEXT NOT NULL,
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "notes"        TEXT NOT NULL DEFAULT '',
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "prompt"       TEXT NOT NULL DEFAULT '',
    "workspaceId"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- ── InventoryItem ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "InventoryItem" (
    "id"           TEXT NOT NULL,
    "sku"          TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "category"     TEXT NOT NULL,
    "stockLevel"   INTEGER NOT NULL DEFAULT 0,
    "reorderPoint" INTEGER NOT NULL DEFAULT 0,
    "reorderQty"   INTEGER NOT NULL DEFAULT 0,
    "unitCost"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "warehouse"    TEXT NOT NULL DEFAULT '',
    "zone"         TEXT NOT NULL DEFAULT 'A',
    "binLocation"  TEXT NOT NULL DEFAULT '',
    "lastSynced"   TEXT NOT NULL,
    "supplier"     TEXT NOT NULL DEFAULT '',
    "workspaceId"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- ── Supplier ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Supplier" (
    "id"           TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "contactName"  TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "phone"        TEXT NOT NULL DEFAULT '',
    "country"      TEXT NOT NULL DEFAULT '',
    "category"     TEXT NOT NULL DEFAULT 'other',
    "status"       TEXT NOT NULL DEFAULT 'active',
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "leadTimeDays" INTEGER NOT NULL DEFAULT 14,
    "rating"       INTEGER NOT NULL DEFAULT 3,
    "notes"        TEXT NOT NULL DEFAULT '',
    "workspaceId"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- ── PurchaseOrder ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id"           TEXT NOT NULL,
    "poNumber"     TEXT NOT NULL,
    "supplierId"   TEXT NOT NULL,
    "supplierName" TEXT NOT NULL,
    "items"        JSONB NOT NULL DEFAULT '[]',
    "subtotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total"        DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"       TEXT NOT NULL DEFAULT 'draft',
    "paymentTerms" TEXT NOT NULL DEFAULT 'Net 30',
    "expectedDate" TEXT NOT NULL,
    "notes"        TEXT NOT NULL DEFAULT '',
    "workspaceId"  TEXT NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- ── Shipment ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Shipment" (
    "id"             TEXT NOT NULL,
    "shipmentNumber" TEXT NOT NULL,
    "orderId"        TEXT NOT NULL DEFAULT '',
    "customer"       TEXT NOT NULL,
    "carrier"        TEXT NOT NULL DEFAULT 'Other',
    "trackingNumber" TEXT NOT NULL DEFAULT '',
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "origin"         TEXT NOT NULL DEFAULT '',
    "destination"    TEXT NOT NULL DEFAULT '',
    "weight"         TEXT NOT NULL DEFAULT '',
    "dimensions"     TEXT NOT NULL DEFAULT '',
    "estimatedDate"  TEXT NOT NULL DEFAULT '',
    "deliveredDate"  TEXT NOT NULL DEFAULT '',
    "events"         JSONB NOT NULL DEFAULT '[]',
    "notes"          TEXT NOT NULL DEFAULT '',
    "workspaceId"    TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- ── Foreign keys for new tables ───────────────────────────────────────────────
ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Customer"
    ADD CONSTRAINT "Customer_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Quote"
    ADD CONSTRAINT "Quote_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryItem"
    ADD CONSTRAINT "InventoryItem_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Supplier"
    ADD CONSTRAINT "Supplier_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder"
    ADD CONSTRAINT "PurchaseOrder_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Shipment"
    ADD CONSTRAINT "Shipment_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;