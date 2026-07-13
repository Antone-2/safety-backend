import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { logger } from "../shared/utils/logger.js";

const HOUR_MS = 60 * 60 * 1000;

export async function runDatabaseMaintenance(): Promise<{
  expiredOtps: number;
  expiredSessions: number;
  oldRateLimits: number;
}> {
  const [otps, sessions, rateLimits] = await Promise.all([
    pgPool.query("DELETE FROM auth_otp_challenges WHERE expires_at < NOW()"),
    pgPool.query(
      "DELETE FROM auth_sessions WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'",
    ),
    pgPool.query(
      "DELETE FROM auth_rate_limits WHERE last_seen_at < NOW() - INTERVAL '7 days'",
    ),
  ]);
  return {
    expiredOtps: otps.rowCount ?? 0,
    expiredSessions: sessions.rowCount ?? 0,
    oldRateLimits: rateLimits.rowCount ?? 0,
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
