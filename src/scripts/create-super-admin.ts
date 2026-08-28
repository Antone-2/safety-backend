import "dotenv/config";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
import { logger } from "../shared/utils/logger.js";

const TARGET_EMAIL = "onyangoantone1@gmail.com";
const TARGET_NAME = "Antone Onyango";
const TARGET_ROLE = "super-admin";

async function main() {
  const migrations = await runPostgresMigrations();
  if (migrations.length > 0) {
    logger.info({ migrations }, "Migrations applied");
  } else {
    logger.info("Database already migrated");
  }

  // The application uses OTP/MFA authentication. Keep an unguessable value in
  // the legacy non-null password column without creating a usable password.
  const passwordHash = await bcrypt.hash(randomBytes(48).toString("base64url"), 12);

  const result = await pgPool.query(
    `INSERT INTO users (email, password_hash, name, role, active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       active = TRUE
     RETURNING id::text, email, name, role, active`,
    [TARGET_EMAIL, passwordHash, TARGET_NAME, TARGET_ROLE],
  );

  const user = result.rows[0];
  await pgPool.query(
    `DELETE FROM auth_rate_limits
     WHERE scope = 'email' AND identifier = $1 AND action = 'otp.request'`,
    [TARGET_EMAIL],
  );
  logger.info({ user }, "Super admin user created/updated");
  console.log(
    JSON.stringify({
      email: user.email,
      role: user.role,
      active: user.active,
      authentication: "otp-mfa-only",
      otpThrottleCleared: true,
    }),
  );
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Failed to create super admin");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
