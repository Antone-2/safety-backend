import "dotenv/config";
import { checkDatabase } from "../shared/infrastructure/database/postgres.client.js";
import { checkRedis } from "../shared/infrastructure/redis/redis.client.js";
import { logger } from "../shared/utils/logger.js";
import { runPostgresMigrations } from "../shared/infrastructure/database/migrations.js";

const timeoutMs = Number(process.env.STARTUP_CHECK_TIMEOUT_MS || 60000);
const intervalMs = Number(process.env.STARTUP_CHECK_INTERVAL_MS || 2000);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(name: string, check: () => Promise<{ ok: boolean }>) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await check();
      if (result.ok) {
        logger.info({ dependency: name }, "Startup dependency is ready");
        return;
      }
      lastError = "not ready";
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(intervalMs);
  }
  throw new Error(`${name} was not ready within ${timeoutMs}ms: ${lastError}`);
}

async function main() {
  if (process.env.DATABASE_URL) {
    await waitFor("postgres", checkDatabase);
    if (process.argv.includes("--migrate")) {
      const applied = await runPostgresMigrations();
      logger.info({ applied }, "Startup migrations completed");
    }
  } else if (process.env.REQUIRE_POSTGRES === "true") {
    throw new Error("DATABASE_URL is required when REQUIRE_POSTGRES=true");
  }

  if (process.env.REDIS_URL) {
    await waitFor("redis", checkRedis);
  } else if (process.env.REQUIRE_REDIS === "true") {
    throw new Error("REDIS_URL is required when REQUIRE_REDIS=true");
  }

  logger.info("Startup checks completed successfully");
}

main().catch((error) => {
  logger.error({ err: error as Error }, "Startup checks failed");
  process.exit(1);
});
