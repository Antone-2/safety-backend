import "dotenv/config";
import bcrypt from "bcryptjs";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";
const EMAIL = "onyangoantone1@gmail.com";
const PASSWORD = "CrownPaints2026!";
const NAME = "Antone Onyango";
const ROLE = "super-admin";
async function main() {
    const hash = await bcrypt.hash(PASSWORD, 10);
    const result = await pgPool.query(`INSERT INTO users (email, password_hash, name, role, active, created_at, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW(), NOW())
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       updated_at = NOW()
     RETURNING id, email, name, role`, [EMAIL, hash, NAME, ROLE]);
    logger.info({ user: result.rows[0] }, "Super-admin user ensured");
}
main()
    .catch((error) => {
    logger.error({ err: error }, "Failed to seed super-admin");
    process.exitCode = 1;
})
    .finally(async () => {
    await pgPool.end();
});
