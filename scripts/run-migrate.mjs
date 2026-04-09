/**
 * Releases any stuck Prisma advisory lock, then runs prisma migrate deploy.
 * Run with: node scripts/run-migrate.mjs
 */
import pg from "pg";
import { config } from "dotenv";
import { execSync } from "child_process";

config();

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL or DIRECT_DATABASE_URL found in .env");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log("Step 1: Connecting to database to release advisory locks...");
  await client.connect();

  // Release the Prisma advisory lock (72707369 is Prisma's lock ID)
  try {
    await client.query("SELECT pg_advisory_unlock_all()");
    console.log("All advisory locks released.\n");
  } catch (e) {
    console.log("Could not release locks (may not exist). Continuing...\n");
  }

  // Also check if the last migration is stuck in failed state
  try {
    const result = await client.query(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `);
    if (result.rows.length > 0) {
      console.log("Found stuck migrations, marking as rolled back:");
      for (const row of result.rows) {
        console.log(`  - ${row.migration_name}`);
        await client.query(`
          UPDATE "_prisma_migrations"
          SET "rolled_back_at" = NOW()
          WHERE "migration_name" = $1
            AND "finished_at" IS NULL
            AND "rolled_back_at" IS NULL
        `, [row.migration_name]);
      }
      console.log("");
    }
  } catch (e) {
    // _prisma_migrations table might not exist yet, that's fine
  }

  await client.end();
  console.log("Step 2: Running prisma migrate deploy...\n");

  try {
    execSync("npx prisma migrate deploy", { stdio: "inherit" });
    console.log("\nAll migrations applied successfully!");
  } catch (e) {
    console.error("\nMigration failed. Check the error above.");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
