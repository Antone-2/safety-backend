import express from "express";
import cors from "cors";
import "dotenv/config";

import { loadEnv } from "./config/index.js";
import { initFirebase } from "./lib/firebase.js";
import { connectRedis } from "./shared/infrastructure/redis/redis.client.js";
import { runPostgresMigrations } from "./shared/infrastructure/database/migrations.js";
import { correlationIdMiddleware } from "./shared/middleware/correlation-id.middleware.js";
import { rateLimitMiddleware } from "./shared/middleware/rate-limit.middleware.js";
import { csrfProtectionMiddleware } from "./shared/middleware/csrf.middleware.js";
import { requestIdMiddleware } from "./shared/middleware/request-id.middleware.js";
import { securityHeadersMiddleware } from "./shared/middleware/security.middleware.js";
import { metricsMiddleware } from "./shared/middleware/metrics.middleware.js";
import { errorHandler } from "./shared/middleware/error-handler.middleware.js";
import { metricsService } from "./shared/metrics/metrics.service.js";
import { logger } from "./shared/utils/logger.js";
import * as Sentry from "@sentry/node";

import { createAuthRouter } from "./modules/auth/auth.module.js";
import { createUsersRouter } from "./modules/users/users.module.js";
import { createIncidentsRouter } from "./modules/incidents/incidents.controller.js";
import { createPermitsRouter } from "./modules/permits/permits.module.js";
import { createCapaRouter } from "./modules/capa/capa.module.js";
import {
  createSdsRouter,
  createFireRouter,
  createInvestigationsRouter,
  createTrainingRouter,
  createPpeRouter,
  createEquipmentRouter,
  createContractorsRouter,
  createComplianceRouter,
  createEnvironmentalRouter,
  createHealthRouter,
  createHeightWorkRouter,
  createScaffoldRouter,
  createGovernanceRouter,
  createAnalyticsRouter,
  createReportsRouter,
  createNotificationsRouter,
  createDocumentsRouter,
  createSettingsRouter,
  createAiRouter,
} from "./modules/index.js";

import googleFormsRouter, {
  setGoogleSheetsPostgresAvailability,
  startGoogleSheetsScheduler,
} from "./routes/google-forms.js";
import referenceRouter from "./routes/reference.js";
import operationsRouter from "./routes/operations.js";
import securityRouter from "./routes/security.js";

// The frontend calls `/api/...` while the backend historically used `/api/v1/...`.
// Mount every router under both prefixes so both clients keep working.
const API_PREFIXES = ["/api", "/api/v1"];

// Ensure frontend can still hit dashboard endpoints when Postgres is unreachable.
// In degraded mode, legacy sqlite/sql.js /reports routes are the fallback.
// (We mount legacy routes *before* Postgres-backed module routes.)

function mountAll(prefixes: string[], path: string, router: express.Router) {
  for (const prefix of prefixes) {
    app.use(`${prefix}${path}`, router);
  }
}

const env = loadEnv();

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1.0,
  });
}

function isAllowedOrigin(origin: string | undefined) {
  if (!origin) return true;
  const configuredOrigins = (env.FRONTEND_URL || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configuredOrigins.includes(origin)) return true;
  if (env.NODE_ENV === "production") return false;
  return /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(
    origin,
  );
}

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(correlationIdMiddleware);
app.use(requestIdMiddleware);
app.use(securityHeadersMiddleware);
app.use(metricsMiddleware);
app.use(rateLimitMiddleware);
app.use(csrfProtectionMiddleware);

app.get("/health", async (_req, res) => {
  try {
    const { checkDatabase } =
      await import("./shared/infrastructure/database/postgres.client.js");
    const { checkRedis } =
      await import("./shared/infrastructure/redis/redis.client.js");
    const [dbCheck, redisCheck] = await Promise.all([
      checkDatabase(),
      checkRedis(),
    ]);
    const healthy = dbCheck.ok && redisCheck.ok;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "ok" : "degraded",
      checks: { database: dbCheck, redis: redisCheck },
      metrics: metricsService.getSnapshot(),
    });
  } catch (error) {
    res.status(503).json({
      status: "degraded",
      error: "Health check failed",
      metrics: metricsService.getSnapshot(),
    });
  }
});

app.get("/metrics", (_req, res) => {
  res.json(metricsService.getSnapshot());
});

app.get("/ready", async (_req, res) => {
  try {
    const { checkDatabase } =
      await import("./shared/infrastructure/database/postgres.client.js");
    const dbCheck = env.DATABASE_URL ? await checkDatabase() : { ok: true };
    res.status(dbCheck.ok ? 200 : 503).json({
      status: dbCheck.ok ? "ready" : "not-ready",
      databaseRequired: Boolean(env.DATABASE_URL),
    });
  } catch (error) {
    res.status(503).json({ status: "not-ready" });
  }
});

mountAll(API_PREFIXES, "/auth", createAuthRouter());
mountAll(API_PREFIXES, "/users", createUsersRouter());

// Prefer Postgres-backed module routes when available.
import reportsLegacyRouter from "./routes/reports.js";

mountAll(API_PREFIXES, "/reports", createReportsRouter());

// Keep the legacy sqlite/sql.js router available for any unmatched /reports requests
// in environments where the Postgres-backed routes are not reachable.
mountAll(API_PREFIXES, "/reports", reportsLegacyRouter);

mountAll(API_PREFIXES, "/google-forms", googleFormsRouter);
mountAll(API_PREFIXES, "/reference", referenceRouter);

mountAll(API_PREFIXES, "/incidents", createIncidentsRouter());
mountAll(API_PREFIXES, "/permits", createPermitsRouter());
mountAll(API_PREFIXES, "/capa", createCapaRouter());
mountAll(API_PREFIXES, "/investigations", createInvestigationsRouter());
mountAll(API_PREFIXES, "/training", createTrainingRouter());
mountAll(API_PREFIXES, "/ppe", createPpeRouter());
mountAll(API_PREFIXES, "/equipment", createEquipmentRouter());
mountAll(API_PREFIXES, "/contractors", createContractorsRouter());
mountAll(API_PREFIXES, "/compliance", createComplianceRouter());
mountAll(API_PREFIXES, "/environmental", createEnvironmentalRouter());
mountAll(API_PREFIXES, "/health", createHealthRouter());
mountAll(API_PREFIXES, "/sds", createSdsRouter());
mountAll(API_PREFIXES, "/fire", createFireRouter());
mountAll(API_PREFIXES, "/heightwork", createHeightWorkRouter());
mountAll(API_PREFIXES, "/scaffolding", createScaffoldRouter());
mountAll(API_PREFIXES, "/governance", createGovernanceRouter());
mountAll(API_PREFIXES, "/analytics", createAnalyticsRouter());
mountAll(API_PREFIXES, "/operations", operationsRouter);
mountAll(API_PREFIXES, "/security", securityRouter);

mountAll(API_PREFIXES, "/notifications", createNotificationsRouter());

mountAll(API_PREFIXES, "/documents", createDocumentsRouter());
mountAll(API_PREFIXES, "/settings", createSettingsRouter());
mountAll(API_PREFIXES, "/ai", createAiRouter());

if (env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

function startServer() {
  const PORT = env.PORT;
  const server = app.listen(PORT, () => {
    logger.info(`EHS Backend running on http://localhost:${PORT}`);
    console.log(`EHS Backend running on http://localhost:${PORT}`);
  });

  function gracefulShutdown(signal: string) {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    console.log(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      console.log("HTTP server closed.");
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown due to timeout.");
      console.error("Forced shutdown due to timeout.");
      process.exit(1);
    }, 10000);
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

async function bootstrap() {
  // Allow the backend to start even if Redis is unavailable.
  // Redis is used for background/queue features; the API can run in degraded mode.
  try {
    let postgresAvailable = true;

    try {
      await connectRedis();
    } catch (redisError) {
      logger.warn(
        { err: redisError as Error },
        "Redis unavailable; starting server in degraded mode.",
      );
    }

    if (!env.DATABASE_URL) {
      postgresAvailable = false;
      logger.warn(
        "PostgreSQL not configured; set DATABASE_URL to enable database-backed features.",
      );
    } else {
      try {
        await runPostgresMigrations();
      } catch (pgError) {
        postgresAvailable = false;
        logger.warn(
          { err: pgError as Error },
          "PostgreSQL unavailable; starting server in degraded mode.",
        );
      }
    }
    setGoogleSheetsPostgresAvailability(postgresAvailable);
    initFirebase();
    startServer();
    startGoogleSheetsScheduler();
  } catch (error) {
    logger.error({ err: error as Error }, "Bootstrap failed:");
    console.error("Bootstrap failed:", error);
    process.exit(1);
  }
}

bootstrap();
