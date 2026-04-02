// app/api/admin/run-migration/route.ts
// ONE-TIME USE — run this once to create the Ticket and TicketComment tables,
// then this file will be deleted from the repo automatically.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Check if tables already exist
    const ticketExists = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Ticket'
      ) as exists
    `;

    if (ticketExists[0]?.exists) {
      return NextResponse.json({ ok: true, message: "Tables already exist — nothing to do." });
    }

    // Create Ticket table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "Ticket" (
        "id" TEXT NOT NULL,
        "ticketNumber" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL DEFAULT '',
        "type" TEXT NOT NULL DEFAULT 'issue',
        "priority" TEXT NOT NULL DEFAULT 'medium',
        "status" TEXT NOT NULL DEFAULT 'open',
        "assignedTo" TEXT NOT NULL DEFAULT '',
        "assignedName" TEXT NOT NULL DEFAULT '',
        "raisedBy" TEXT NOT NULL DEFAULT '',
        "raisedName" TEXT NOT NULL DEFAULT '',
        "linkedType" TEXT NOT NULL DEFAULT '',
        "linkedId" TEXT NOT NULL DEFAULT '',
        "linkedLabel" TEXT NOT NULL DEFAULT '',
        "workspaceId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
      )
    `);

    // Create TicketComment table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE "TicketComment" (
        "id" TEXT NOT NULL,
        "ticketId" TEXT NOT NULL,
        "authorId" TEXT NOT NULL DEFAULT '',
        "authorName" TEXT NOT NULL DEFAULT '',
        "body" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "TicketComment_pkey" PRIMARY KEY ("id")
      )
    `);

    // Add foreign keys
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Ticket"
        ADD CONSTRAINT "Ticket_workspaceId_fkey"
        FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "TicketComment"
        ADD CONSTRAINT "TicketComment_ticketId_fkey"
        FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
    `);

    // Record migration in _prisma_migrations so Prisma knows it's applied
    await prisma.$executeRawUnsafe(`
      INSERT INTO "_prisma_migrations"
        ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
      VALUES
        (gen_random_uuid()::text, 'manual', NOW(), '20260402000000_add_tickets', NULL, NULL, NOW(), 1)
      ON CONFLICT DO NOTHING
    `);

    return NextResponse.json({
      ok: true,
      message: "✅ Ticket and TicketComment tables created successfully!",
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
