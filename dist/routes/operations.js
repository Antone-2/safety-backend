import { Router } from "express";
import { authenticateUser, } from "../shared/middleware/auth.middleware.js";
import { requireRole } from "../middleware/auth.js";
import { operationalMonitoringService } from "../services/operational-monitoring.service.js";
import { notificationCenterService } from "../services/notification-center.service.js";
import { metricsService } from "../shared/metrics/metrics.service.js";
import { runMonthlyLeaderboard } from "../services/leaderboard.service.js";
const router = Router();
router.get("/dashboard", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const [operations, notifications] = await Promise.all([
        operationalMonitoringService.dashboard(),
        notificationCenterService.dashboard(),
    ]);
    res.json({
        operations,
        notifications,
        metrics: metricsService.getSnapshot(),
    });
});
router.get("/health/dependencies", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const checks = {};
    const startedAt = Date.now();
    try {
        const { checkDatabase } = await import("../shared/infrastructure/database/postgres.client.js");
        checks.postgres = await checkDatabase();
    }
    catch (error) {
        checks.postgres = {
            name: "postgres",
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
    try {
        const { checkRedis } = await import("../shared/infrastructure/redis/redis.client.js");
        checks.redis = await checkRedis();
    }
    catch (error) {
        checks.redis = {
            name: "redis",
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
    checks.email = {
        name: "email",
        ok: Boolean((process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL) ||
            (process.env.SMTP_HOST &&
                process.env.SMTP_USER &&
                process.env.SMTP_PASS &&
                process.env.SMTP_FROM)),
        configured: Boolean(process.env.BREVO_API_KEY || process.env.SMTP_HOST),
    };
    checks.errorTracking = {
        name: "sentry",
        ok: Boolean(process.env.SENTRY_DSN),
        configured: Boolean(process.env.SENTRY_DSN),
    };
    const healthy = Object.values(checks).every((check) => check.ok);
    res.status(healthy ? 200 : 207).json({
        status: healthy ? "ok" : "degraded",
        durationMs: Date.now() - startedAt,
        checks,
    });
});
router.post("/events", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    const event = await operationalMonitoringService.recordEvent({
        type: String(req.body.type || "manual"),
        source: String(req.body.source || "admin"),
        status: String(req.body.status || "info"),
        message: String(req.body.message || ""),
        metadata: req.body.metadata || {},
    });
    res.status(201).json(event);
});
router.post("/jobs/monthly-leaderboard", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const result = await runMonthlyLeaderboard();
    res.json({ ok: true, ...result });
});
export default router;
