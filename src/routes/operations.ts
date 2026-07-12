import { Router, type Response } from "express";
import {
  authenticateUser,
  type AuthRequest,
} from "../shared/middleware/auth.middleware.js";
import { requireRole } from "../middleware/auth.js";
import { operationalMonitoringService } from "../services/operational-monitoring.service.js";
import { notificationCenterService } from "../services/notification-center.service.js";
import { metricsService } from "../shared/metrics/metrics.service.js";
import { getDb } from "../lib/database.js";

const router = Router();

router.get(
  "/dashboard",
  authenticateUser,
  requireRole(["super-admin", "EHS-manager"]),
  async (_req: AuthRequest, res: Response) => {
    const [operations, notifications] = await Promise.all([
      operationalMonitoringService.dashboard(),
      notificationCenterService.dashboard(),
    ]);
    res.json({
      operations,
      notifications,
      metrics: metricsService.getSnapshot(),
    });
  },
);

router.get(
  "/health/dependencies",
  authenticateUser,
  requireRole(["super-admin", "EHS-manager"]),
  async (_req: AuthRequest, res: Response) => {
    const checks: Record<string, any> = {};
    const startedAt = Date.now();

    try {
      const { checkDatabase } =
        await import("../shared/infrastructure/database/postgres.client.js");
      checks.postgres = await checkDatabase();
    } catch (error) {
      checks.postgres = {
        name: "postgres",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const { checkRedis } =
        await import("../shared/infrastructure/redis/redis.client.js");
      checks.redis = await checkRedis();
    } catch (error) {
      checks.redis = {
        name: "redis",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    try {
      const db = await getDb();
      const result = db.exec("SELECT 1 as ok");
      checks.localDatabase = {
        name: "localDatabase",
        ok: Boolean(result.values?.length),
      };
    } catch (error) {
      checks.localDatabase = {
        name: "localDatabase",
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    checks.email = {
      name: "email",
      ok: Boolean(
        process.env.SMTP_HOST &&
        process.env.SMTP_USER &&
        process.env.SMTP_PASS &&
        process.env.SMTP_FROM,
      ),
      configured: Boolean(process.env.SMTP_HOST),
    };
    checks.errorTracking = {
      name: "sentry",
      ok: Boolean(process.env.SENTRY_DSN),
      configured: Boolean(process.env.SENTRY_DSN),
    };

    const healthy = Object.values(checks).every((check: any) => check.ok);
    res.status(healthy ? 200 : 207).json({
      status: healthy ? "ok" : "degraded",
      durationMs: Date.now() - startedAt,
      checks,
    });
  },
);

router.post(
  "/events",
  authenticateUser,
  requireRole(["super-admin", "EHS-manager"]),
  async (req: AuthRequest, res: Response) => {
    const event = await operationalMonitoringService.recordEvent({
      type: String(req.body.type || "manual"),
      source: String(req.body.source || "admin"),
      status: String(req.body.status || "info"),
      message: String(req.body.message || ""),
      metadata: req.body.metadata || {},
    });
    res.status(201).json(event);
  },
);

export default router;
