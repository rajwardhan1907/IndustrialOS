-- Phase 23: EDI Support — EdiPartner and EdiTransaction tables

CREATE TABLE "EdiPartner" (
    "id"             TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "standard"       TEXT NOT NULL DEFAULT 'X12',
    "isaQualifier"   TEXT NOT NULL DEFAULT '01',
    "isaId"          TEXT NOT NULL DEFAULT '',
    "partnerQual"    TEXT NOT NULL DEFAULT '01',
    "partnerId"      TEXT NOT NULL DEFAULT '',
    "unbSenderId"    TEXT NOT NULL DEFAULT '',
    "unbReceiverId"  TEXT NOT NULL DEFAULT '',
    "txSets"         TEXT NOT NULL DEFAULT '850,855,856,810',
    "active"         BOOLEAN NOT NULL DEFAULT true,
    "notes"          TEXT NOT NULL DEFAULT '',
    "workspaceId"    TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdiPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EdiTransaction" (
    "id"            TEXT NOT NULL,
    "direction"     TEXT NOT NULL,
    "standard"      TEXT NOT NULL DEFAULT 'X12',
    "txSet"         TEXT NOT NULL,
    "controlNumber" TEXT NOT NULL DEFAULT '',
    "partnerId"     TEXT NOT NULL,
    "status"        TEXT NOT NULL DEFAULT 'received',
    "rawPayload"    TEXT NOT NULL,
    "parsedJson"    JSONB,
    "errorMsg"      TEXT NOT NULL DEFAULT '',
    "workspaceId"   TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdiTransaction_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "EdiPartner"     ADD CONSTRAINT "EdiPartner_workspaceId_fkey"     FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EdiTransaction" ADD CONSTRAINT "EdiTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EdiTransaction" ADD CONSTRAINT "EdiTransaction_partnerId_fkey"   FOREIGN KEY ("partnerId")   REFERENCES "EdiPartner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Indexes for fast lookups
CREATE INDEX "EdiPartner_workspaceId_idx"     ON "EdiPartner"("workspaceId");
CREATE INDEX "EdiTransaction_workspaceId_idx" ON "EdiTransaction"("workspaceId");
CREATE INDEX "EdiTransaction_partnerId_idx"   ON "EdiTransaction"("partnerId");
CREATE INDEX "EdiTransaction_direction_idx"   ON "EdiTransaction"("direction");
