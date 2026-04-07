-- Phase 25: Persistent Notifications + Phase 17 Accounting connection fields

-- Add QuickBooks/Xero connection flags to Workspace (fixes accounting route crash)
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "quickbooksConnected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "xeroConnected" BOOLEAN NOT NULL DEFAULT false;

-- Create Notification table
CREATE TABLE "Notification" (
    "id"          TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "type"        TEXT NOT NULL DEFAULT 'info',
    "severity"    TEXT NOT NULL DEFAULT 'info',
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL DEFAULT '',
    "tab"         TEXT NOT NULL DEFAULT '',
    "read"        BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- Index for fast per-workspace lookups
CREATE INDEX "Notification_workspaceId_idx" ON "Notification"("workspaceId");

-- Foreign key
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
