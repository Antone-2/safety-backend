import "dotenv/config";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";
const EMAIL = "onyangoantone1@gmail.com";
async function main() {
    const result = await pgPool.query(`UPDATE users SET role = 'super-admin', updated_at = NOW()
     WHERE email = $1
     RETURNING id, email, name, role`, [EMAIL]);
    if (result.rows.length === 0) {
        logger.warn({ email: EMAIL }, "User not found");
    }
    else {
        logger.info({ user: result.rows[0] }, "User role updated to super-admin");
    }
}
main()
    .catch((error) => {
    logger.error({ err: error }, "Failed to update user role");
    process.exitCode = 1;
})
    .finally(async () => {
    await pgPool.end();
});
