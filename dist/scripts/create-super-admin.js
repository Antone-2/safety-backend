import "dotenv/config";
import bcrypt from "bcryptjs";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
import { logger } from "../shared/utils/logger.js";
const TARGET_EMAIL = "onyangoantone1@gmail.com";
const TARGET_NAME = "Antone Onyango";
const TARGET_ROLE = "super-admin";
const TARGET_PASSWORD = "CrownPaints2026!";
async function main() {
    const migrations = await runPostgresMigrations();
    if (migrations.length > 0) {
        logger.info({ migrations }, "Migrations applied");
    }
    else {
        logger.info("Database already migrated");
    }
    const passwordHash = await bcrypt.hash(TARGET_PASSWORD, 10);
    const result = await pgPool.query(`INSERT INTO users (email, password_hash, name, role, active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       active = TRUE
     RETURNING id::text, email, name, role, active`, [TARGET_EMAIL, passwordHash, TARGET_NAME, TARGET_ROLE]);
    const user = result.rows[0];
    logger.info({ user }, "Super admin user created/updated");
}
main()
    .catch((error) => {
    logger.error({ err: error }, "Failed to create super admin");
    process.exitCode = 1;
})
    .finally(async () => {
    await pgPool.end();
});
