-- Customer portal: accounts and sessions tables
CREATE TABLE "CustomerAccount" (
    "id"          TEXT NOT NULL,
    "email"       TEXT NOT NULL,
    "name"        TEXT NOT NULL DEFAULT '',
    "password"    TEXT NOT NULL DEFAULT '',
    "workspaceId" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerAccount_email_workspaceId_key"
    ON "CustomerAccount"("email", "workspaceId");

CREATE INDEX "CustomerAccount_workspaceId_idx"
    ON "CustomerAccount"("workspaceId");

ALTER TABLE "CustomerAccount"
    ADD CONSTRAINT "CustomerAccount_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CustomerSession" (
    "id"        TEXT NOT NULL,
    "token"     TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerSession_token_key"
    ON "CustomerSession"("token");

ALTER TABLE "CustomerSession"
    ADD CONSTRAINT "CustomerSession_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CustomerAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
