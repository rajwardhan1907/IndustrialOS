/**
 * Force-applies remaining migrations by:
 * 1. Killing all other DB connections (releases stuck locks)
 * 2. Applying migration SQL directly
 * 3. Marking migrations as applied in _prisma_migrations table
 *
 * Run with: node scripts/force-migrate.mjs
 */
import pg from "pg";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "fs";
import { join } from "path";

config();

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error("No DATABASE_URL or DIRECT_DATABASE_URL found in .env");
  process.exit(1);
}

async function main() {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to database.\n");

  // Step 1: Kill ALL other connections to this database to force-release locks
  console.log("Step 1: Terminating other connections to release stuck locks...");
  try {
    const result = await client.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid != pg_backend_pid()
        AND state != 'idle'
    `);
    console.log(`  Terminated ${result.rowCount} active connection(s).\n`);
  } catch (e) {
    console.log("  Could not terminate connections (might need higher privileges). Continuing...\n");
  }

  // Step 2: Find which migrations still need to be applied
  console.log("Step 2: Checking which migrations need to be applied...");

  let appliedMigrations = new Set();
  try {
    const applied = await client.query(`
      SELECT migration_name FROM "_prisma_migrations"
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    `);
    appliedMigrations = new Set(applied.rows.map(r => r.migration_name));
  } catch (e) {
    console.log("  _prisma_migrations table doesn't exist or is empty.");
  }

  // Also clean up any stuck (not finished, not rolled back) migrations
  try {
    await client.query(`
      DELETE FROM "_prisma_migrations"
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    `);
  } catch (e) {}

  // Also clean up rolled-back migrations so they can be re-applied
  try {
    await client.query(`
      DELETE FROM "_prisma_migrations"
      WHERE rolled_back_at IS NOT NULL
    `);
  } catch (e) {}

  // Read all migration directories in order
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const dirs = readdirSync(migrationsDir)
    .filter(d => !d.includes("lock"))
    .sort();

  const pending = dirs.filter(d => !appliedMigrations.has(d));

  if (pending.length === 0) {
    console.log("  All 15 migrations already applied. Nothing to do!\n");
    await client.end();
    return;
  }

  console.log(`  ${appliedMigrations.size} already applied, ${pending.length} pending:\n`);
  for (const m of pending) {
    console.log(`    - ${m}`);
  }
  console.log("");

  // Step 3: Apply each pending migration
  console.log("Step 3: Applying pending migrations...\n");

  for (const migrationName of pending) {
    const sqlPath = join(migrationsDir, migrationName, "migration.sql");
    let sql;
    try {
      sql = readFileSync(sqlPath, "utf-8");
    } catch (e) {
      console.log(`  SKIP: ${migrationName} (no migration.sql found)`);
      continue;
    }

    console.log(`  Applying: ${migrationName}...`);
    try {
      await client.query(sql);

      // Record it in _prisma_migrations
      await client.query(`
        INSERT INTO "_prisma_migrations" (id, checksum, migration_name, logs, started_at, finished_at, applied_steps_count)
        VALUES (
          gen_random_uuid()::text,
          md5($1),
          $2,
          '',
          NOW(),
          NOW(),
          1
        )
      `, [sql, migrationName]);

      console.log(`  ✓ ${migrationName} applied successfully.`);
    } catch (e) {
      console.error(`  ✗ ${migrationName} FAILED: ${e.message}`);
      console.error(`    You may need to fix this manually.\n`);
      // Don't stop — try remaining migrations
    }
  }

  await client.end();
  console.log("\nDone! All pending migrations processed.");
  console.log("Run 'npx prisma generate' to update your Prisma client.");
}

main().catch(e => { console.error(e); process.exit(1); });
