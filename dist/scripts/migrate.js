import "dotenv/config";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";
import { spawnSync } from "child_process";
async function dryRunMigrations() {
    const client = await pgPool.connect();
    const applied = [];
    try {
        await client.query("BEGIN");
        // ensureMigrationsTable is internal; recreate minimal table check
        await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        const { POSTGRES_MIGRATIONS } = await import("../shared/infrastructure/database/migrations.js");
        for (const migration of POSTGRES_MIGRATIONS) {
            const existing = await client.query("SELECT id FROM schema_migrations WHERE id = $1", [migration.id]);
            if ((existing.rowCount ?? 0) > 0)
                continue;
            logger.info({ id: migration.id, desc: migration.description }, "Would apply migration (dry-run)");
            await client.query(migration.sql);
            applied.push(migration.id);
        }
        await client.query("ROLLBACK");
        return applied;
    }
    catch (err) {
        await client.query("ROLLBACK");
        throw err;
    }
    finally {
        client.release();
    }
}
async function maybeBackup() {
    logger.info("Running pre-migration backup...");
    const res = spawnSync("npx", ["tsx", "src/scripts/backup.ts"], { stdio: "inherit" });
    if (res.status !== 0) {
        throw new Error("Pre-migration backup failed");
    }
}
async function main() {
    const args = process.argv.slice(2);
    const dry = args.includes("--dry-run") || args.includes("-n");
    const backupBefore = args.includes("--backup-before") || args.includes("-b");
    if (dry) {
        logger.info("Running migrations in dry-run mode");
        const applied = await dryRunMigrations();
        if (applied.length === 0) {
            logger.info("No migrations would be applied.");
        }
        else {
            logger.info({ applied }, "Migrations that would be applied (dry-run)");
        }
        return;
    }
    if (backupBefore) {
        await maybeBackup();
    }
    const applied = await runPostgresMigrations();
    if (applied.length === 0) {
        logger.info("PostgreSQL schema is already up to date.");
    }
    else {
        logger.info({ applied }, "PostgreSQL migrations applied.");
    }
}
main()
    .catch((error) => {
    logger.error({ err: error }, "Migration failed.");
    process.exitCode = 1;
})
    .finally(async () => {
    await pgPool.end();
});
