import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isConnectionTimeoutLike(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  // pg-pool + pg often surface timeouts with these phrases.
  return (
    /timeout/i.test(message) &&
    /(connection terminated|terminat(ed)?|connect|client|pool)/i.test(message)
  );
}

async function queryWithRetry<T>(
  query: () => Promise<T>,
  opts: { retries: number; baseDelayMs: number },
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await query();
    } catch (err) {
      lastErr = err;
      const shouldRetry = isConnectionTimeoutLike(err);
      const isLast = attempt === opts.retries;
      if (!shouldRetry || isLast) throw err;
      const delay = opts.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  throw lastErr;
}

export async function runDatabaseMaintenance(): Promise<{
  expiredOtps: number;
  expiredSessions: number;
  oldRateLimits: number;
}> {
  // Run sequentially to reduce concurrent load on the pool during background work.
  const otps = await queryWithRetry(
    () =>
      pgPool.query("DELETE FROM auth_otp_challenges WHERE expires_at < NOW()"),
    { retries: 2, baseDelayMs: 500 },
  );

  const sessions = await queryWithRetry(
    () =>
      pgPool.query(
        "DELETE FROM auth_sessions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'",
      ),
    { retries: 2, baseDelayMs: 500 },
  );

  const rateLimits = await queryWithRetry(
    () =>
      pgPool.query(
        "DELETE FROM auth_rate_limits WHERE last_seen_at < NOW() - INTERVAL '7 days'",
      ),
    { retries: 2, baseDelayMs: 500 },
  );

  return {
    expiredOtps: (otps as any).rowCount ?? 0,
    expiredSessions: (sessions as any).rowCount ?? 0,
    oldRateLimits: (rateLimits as any).rowCount ?? 0,
  };
}


export function startDatabaseMaintenanceScheduler(): void {
  if (!process.env.DATABASE_URL) return;
  const execute = () =>
    runDatabaseMaintenance()
      .then((result) => logger.info(result, "Database maintenance completed"))
      .catch((error) =>
        logger.warn({ err: error as Error }, "Database maintenance failed"),
      );
  setTimeout(execute, 30_000);
  const timer = setInterval(execute, HOUR_MS);
  timer.unref();
}
