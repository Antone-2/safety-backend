import "dotenv/config";
import bcrypt from "bcryptjs";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";
import { logger } from "../shared/utils/logger.js";

const DEFAULT_USERS = [
  {
    email: "admin@crownpaints.co.ke",
    name: "Super Admin",
    role: "super-admin",
    passwordEnv: "SEED_SUPER_ADMIN_PASSWORD",
  },
  {
    email: "safety@crownpaints.co.ke",
    name: "EHS Manager",
    role: "EHS-manager",
    passwordEnv: "SEED_EHS_MANAGER_PASSWORD",
  },
] as const;

function getSeedPassword(envName: string): string {
  const value = process.env[envName];
  if (!value || value.length < 12) {
    throw new Error(`${envName} must be set to at least 12 characters before running db:seed`);
  }
  return value;
}

async function main() {
  await runPostgresMigrations();

  for (const user of DEFAULT_USERS) {
    const passwordHash = await bcrypt.hash(getSeedPassword(user.passwordEnv), 10);
    await pgPool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING`,
      [user.email, passwordHash, user.name, user.role],
    );
  }

  logger.info({ users: DEFAULT_USERS.map((user) => user.email) }, "Default users ensured.");
}

main()
  .catch((error) => {
    logger.error({ err: error as Error }, "Seed failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pgPool.end();
  });
