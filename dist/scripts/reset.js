import "dotenv/config";
import bcrypt from "bcryptjs";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
import { logger } from "../shared/utils/logger.js";
async function main() {
    const client = await pgPool.connect();
    try {
        logger.info("Dropping public schema and all objects...");
        await client.query("DROP SCHEMA IF EXISTS public CASCADE");
        await client.query("CREATE SCHEMA public");
        await client.query("GRANT ALL ON SCHEMA public TO postgres");
        await client.query("GRANT ALL ON SCHEMA public TO public");
        logger.info("Public schema recreated.");
    }
    finally {
        client.release();
    }
    logger.info("Running migrations...");
    const applied = await runPostgresMigrations();
    logger.info({ applied }, "Migrations applied.");
    const seedPasswordSuper = process.env.SEED_SUPER_ADMIN_PASSWORD;
    const seedPasswordEhs = process.env.SEED_EHS_MANAGER_PASSWORD;
    if (seedPasswordSuper && seedPasswordSuper.length >= 12) {
        const hash = await bcrypt.hash(seedPasswordSuper, 10);
        await pgPool.query(`INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`, ["admin@crownpaints.co.ke", hash, "Super Admin", "super-admin"]);
        logger.info("Seeded super-admin user.");
    }
    else {
        logger.warn("SEED_SUPER_ADMIN_PASSWORD not set or too short; skipping super-admin seed.");
    }
    if (seedPasswordEhs && seedPasswordEhs.length >= 12) {
        const hash = await bcrypt.hash(seedPasswordEhs, 10);
        await pgPool.query(`INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`, ["safety@crownpaints.co.ke", hash, "EHS Manager", "EHS-manager"]);
        logger.info("Seeded EHS manager user.");
    }
    else {
        logger.warn("SEED_EHS_MANAGER_PASSWORD not set or too short; skipping EHS manager seed.");
    }
    logger.info("PostgreSQL reset complete.");
}
main().catch((error) => {
    logger.error({ err: error }, "Database reset failed.");
    process.exitCode = 1;
}).finally(async () => {
    await pgPool.end();
});
