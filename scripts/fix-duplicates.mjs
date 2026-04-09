/**
 * Fix duplicate portalCodes that block the unique index migration.
 * Run with: node scripts/fix-duplicates.mjs
 *
 * Requires DIRECT_DATABASE_URL in your .env file.
 */
import pg from "pg";
import { config } from "dotenv";

config(); // load .env

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL or DIRECT_DATABASE_URL found in .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  await client.connect();
  console.log("Connected to database.\n");

  // Step 1: Find all duplicate portalCodes
  const dupes = await client.query(`
    SELECT "portalCode", "workspaceId", COUNT(*) as cnt
    FROM "Customer"
    WHERE "portalCode" != ''
    GROUP BY "portalCode", "workspaceId"
    HAVING COUNT(*) > 1
  `);

  if (dupes.rows.length === 0) {
    console.log("No duplicate portalCodes found. You're good!");
  } else {
    console.log(`Found ${dupes.rows.length} duplicate portalCode(s):\n`);

    for (const dupe of dupes.rows) {
      console.log(`  portalCode="${dupe.portalCode}" workspace="${dupe.workspaceId}" (${dupe.cnt} rows)`);

      // Get all customers with this duplicate
      const customers = await client.query(`
        SELECT id, name, email, "portalCode", "createdAt"
        FROM "Customer"
        WHERE "portalCode" = $1 AND "workspaceId" = $2
        ORDER BY "createdAt" ASC
      `, [dupe.portalCode, dupe.workspaceId]);

      // Keep the first one (oldest), clear portalCode on the rest
      const [keep, ...extras] = customers.rows;
      console.log(`    Keeping: ${keep.name} (${keep.id})`);

      for (const extra of extras) {
        const newCode = `${dupe.portalCode}-${extra.id.slice(-4)}`;
        await client.query(`
          UPDATE "Customer" SET "portalCode" = $1 WHERE id = $2
        `, [newCode, extra.id]);
        console.log(`    Renamed: ${extra.name} (${extra.id}) → portalCode="${newCode}"`);
      }
    }
    console.log("\nAll duplicates resolved.");
  }

  // Step 2: Resolve the failed migration
  console.log("\nMarking failed migration as rolled-back...");
  try {
    await client.query(`
      UPDATE "_prisma_migrations"
      SET "rolled_back_at" = NOW(), "finished_at" = NULL
      WHERE "migration_name" = '20260408000001_portal_code_unique'
        AND "rolled_back_at" IS NULL
        AND "finished_at" IS NULL
    `);
    console.log("Done. Migration marked as rolled-back.");
  } catch (e) {
    console.log("Migration was already resolved or not in failed state. That's fine.");
  }

  await client.end();
  console.log("\nNow run: npx prisma migrate deploy");
}

main().catch(e => { console.error(e); process.exit(1); });
