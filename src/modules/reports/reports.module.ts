import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { CreateReportSchema, StatusSchema } from "../../lib/types.js";
import { writeAuditLog } from "../../shared/audit/audit.service.js";
import {
  authenticateUser,
  requirePermission,
  type AuthRequest,
} from "../../shared/middleware/auth.middleware.js";
import { cacheService } from "../../shared/infrastructure/redis/cache.service.js";
import { metricsService } from "../../shared/metrics/metrics.service.js";
import { reportsService } from "./reports.service.js";
import { isUrlAllowedForFetch, safeFetch } from "../../shared/infrastructure/storage/ssrf.protection.js";
import {
  acknowledgeCorrectiveActionSupervisorFollowUp,
  addCorrectiveActionSupervisorComment,
  CORRECTIVE_ACTION_EVENT_TYPES,
  CORRECTIVE_ACTION_ITEM_STATUSES,
  createCorrectiveActionRequest,
  getCorrectiveActionRequestByToken,
  listCorrectiveActionRequestsByReport,
  resendCorrectiveActionNotifications,
  sendCorrectiveActionAcknowledgementReminder,
  sendCorrectiveActionReminders,
  startCorrectiveActionReminderScheduler,
  submitCorrectiveActionRequest,
  updateCorrectiveActionRequestReview,
} from "../../services/corrective-action-request.service.js";
import { auditReportTimestamps } from "./report-timestamp-audit.service.js";
import {
  buildReportsCacheKey,
  invalidateReportsCache,
  REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
  REPORTS_DETAIL_CACHE_TTL_SECONDS,
  REPORTS_LIST_CACHE_TTL_SECONDS,
  setCachedJsonHeaders,
} from "./reports.cache.js";
import { getMonthlyEhsReport } from "./monthly-ehs-report.service.js";

const BulkReportStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(100),
  status: StatusSchema,
});

const CorrectiveActionRequestCreateSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  assignedByEmail: z.string().email().optional(),
  assignedByName: z.string().optional(),
  copiedRecipientEmails: z.array(z.string().email()).optional().default([]),
  assigneeNote: z.string().max(2000).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).default("Medium"),
  dueDate: z.string().optional(),
});

const CorrectiveActionRequestSubmitSchema = z.object({
  unsafeEventType: z.enum(CORRECTIVE_ACTION_EVENT_TYPES),
  description: z.string().min(1).max(5000),
  immediateActionTaken: z.string().min(1).max(5000),
  completedTasks: z.string().min(1).max(5000),
  rootCauseAnalysis: z.string().min(1).max(5000),
  actionPlanDueDate: z.string().optional(),
  actionPlanItems: z
    .array(
      z.object({
        action: z.string().min(1).max(500),
        byWho: z.string().min(1).max(200),
        byWhoEmail: z.string().email().optional(),
        byWhen: z.string().min(1),
        status: z.enum(CORRECTIVE_ACTION_ITEM_STATUSES),
      }),
    )
    .min(1)
    .max(50),
});

const CorrectiveActionRequestReviewSchema = z.object({
  actionPlanDueDate: z.string().nullable().optional(),
  actionPlanItems: z
    .array(
      z.object({
        action: z.string().min(1).max(500),
        byWho: z.string().min(1).max(200),
        byWhoEmail: z.string().email().optional(),
        byWhen: z.string().min(1),
        status: z.enum(CORRECTIVE_ACTION_ITEM_STATUSES),
      }),
    )
    .min(1)
    .max(50),
});

const CorrectiveActionRequestCommentSchema = z.object({
  text: z.string().min(1).max(5000),
});

const CorrectiveActionAcknowledgementSchema = z.object({
  note: z.string().max(5000).optional(),
});

type SseClient = {
  id: string;
  res: Response;
  heartbeat?: NodeJS.Timeout;
};

const sseClients = new Map<string, SseClient>();

const PLACEHOLDER_IMAGE = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"><rect width="200" height="150" fill="#f1f5f9"/><text x="100" y="75" text-anchor="middle" dy=".3em" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8">Photo unavailable</text></svg>`;

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return `https://placehold.co/${size}x${size}/1e293b/ffffff?text=${encodeURIComponent(shortId)}`;
}

function queryString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function readReportFilters(req: Request) {
  return {
    status: queryString(req.query.status),
    severity: queryString(req.query.severity),
    location: queryString(req.query.location),
    days: queryString(req.query.days),
    search: queryString(req.query.search),
    category: queryString(req.query.category),
    dateFrom: queryString(req.query.dateFrom),
    dateTo: queryString(req.query.dateTo),
  };
}

function readPagination(req: Request) {
  return {
    page: Number(String(req.query.page)) || 1,
    limit: Number(String(req.query.limit)) || 50,
  };
}

export function dedupeDashboardReports<T extends { id?: string; updatedAt?: string; createdAt?: string; date?: string }>(
  rows: T[],
) {
  const byId = new Map<string, T>();

  const toTime = (value?: string) => {
    if (!value) return Number.NEGATIVE_INFINITY;
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
  };

  const getRecency = (row: T) =>
    Math.max(toTime(row.updatedAt), toTime(row.createdAt), toTime(row.date));

  for (const row of rows) {
    const id = String(row.id ?? "").trim();
    if (!id) continue;
    const existing = byId.get(id);
    if (!existing || getRecency(row) >= getRecency(existing)) {
      byId.set(id, row);
    }
  }

  return Array.from(byId.values());
}

type DashboardInsightReport = {
  date?: string;
  severity?: string;
  status?: string;
  resolutionDays?: number;
  slaHours?: number;
};

function parseInsightTime(value?: string) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function countInRange(
  reports: DashboardInsightReport[],
  fromInclusive: Date,
  toExclusive: Date,
) {
  const from = fromInclusive.getTime();
  const to = toExclusive.getTime();
  return reports.filter((report) => {
    const time = parseInsightTime(report.date);
    return time !== null && time >= from && time < to;
  }).length;
}

function buildDashboardInsights(reports: DashboardInsightReport[]) {
  const now = new Date();
  const rolling30Start = new Date(now);
  rolling30Start.setUTCDate(rolling30Start.getUTCDate() - 30);
  const previous30Start = new Date(now);
  previous30Start.setUTCDate(previous30Start.getUTCDate() - 60);
  const rolling12Start = new Date(now);
  rolling12Start.setUTCFullYear(rolling12Start.getUTCFullYear() - 1);
  const previous12Start = new Date(now);
  previous12Start.setUTCFullYear(previous12Start.getUTCFullYear() - 2);

  const lastHighOrCritical = reports
    .filter((report) => report.severity === "High" || report.severity === "Critical")
    .map((report) => parseInsightTime(report.date))
    .filter((time): time is number => time !== null)
    .sort((a, b) => b - a)[0];

  const closedWithResolution = reports.filter(
    (report) => report.status === "Closed" && report.resolutionDays != null,
  );
  const closedWithinSla = closedWithResolution.filter(
    (report) =>
      typeof report.resolutionDays === "number" &&
      typeof report.slaHours === "number" &&
      report.resolutionDays * 24 <= report.slaHours,
  ).length;

  return {
    rolling30Days: {
      current: countInRange(reports, rolling30Start, now),
      previous: countInRange(reports, previous30Start, rolling30Start),
    },
    rolling12Months: {
      current: countInRange(reports, rolling12Start, now),
      previous: countInRange(reports, previous12Start, rolling12Start),
    },
    daysSinceLastHighOrCritical:
      typeof lastHighOrCritical === "number"
        ? Math.max(0, Math.floor((Date.now() - lastHighOrCritical) / 86400000))
        : 0,
    closedWithinSla: {
      percent: closedWithResolution.length
        ? Math.round((closedWithinSla / closedWithResolution.length) * 100)
        : 0,
      closedOnTime: closedWithinSla,
      resolvedTotal: closedWithResolution.length,
    },
  };
}

function routeParam(req: Request, name: string) {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : (value ?? "");
}

function assignmentScreenUrl(req: Request, id: string) {
  const path = `/report/${encodeURIComponent(id)}/assign`;
  const configuredFrontend = process.env.FRONTEND_URL?.split(",")[0]?.trim();
  if (configuredFrontend) return new URL(path, configuredFrontend).toString();

  const referer = req.get("referer");
  if (referer) {
    try {
      return new URL(path, new URL(referer).origin).toString();
    } catch {
      // Fall through to local development fallback.
    }
  }

  return `http://localhost:5173${path}`;
}

function broadcastReport(report: unknown) {
  const payload = `event: report\ndata: ${JSON.stringify(report)}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(payload);
    } catch {
      cleanupClient(id);
    }
  }
}

function broadcastStats(stats: unknown) {
  const payload = `event: stats\ndata: ${JSON.stringify(stats)}\n\n`;
  for (const [id, client] of sseClients.entries()) {
    try {
      client.res.write(payload);
    } catch {
      cleanupClient(id);
    }
  }
}

function cleanupClient(clientId: string) {
  const client = sseClients.get(clientId);
  if (client?.heartbeat) clearInterval(client.heartbeat);
  sseClients.delete(clientId);
}

function csvEscape(value: unknown) {
  const raw = String(value ?? "");
  const text = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function createReportsRouter() {
  const router = Router();

  router.get("/corrective-action-requests/:token", async (req, res) => {
    const token = routeParam(req, "token");
    try {
      const request = await getCorrectiveActionRequestByToken(token);
      if (!request)
        return res.status(404).json({ error: "Corrective action request not found" });
      res.json({ data: request });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load corrective action request";
      const status = /expired/i.test(message) ? 410 : 400;
      res.status(status).json({ error: message });
    }
  });

  router.post("/corrective-action-requests/:token/submit", async (req, res) => {
    const token = routeParam(req, "token");
    const parsed = CorrectiveActionRequestSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }

    try {
      const submitted = await submitCorrectiveActionRequest({
        token,
        ...parsed.data,
      });
      res.json({ data: submitted });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit corrective action";
      const status = /not found/i.test(message) ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  router.post("/corrective-action-requests/:token/acknowledge", async (req, res) => {
    const token = routeParam(req, "token");
    const parsed = CorrectiveActionAcknowledgementSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors });
    }
    try {
      const acknowledged = await acknowledgeCorrectiveActionSupervisorFollowUp({
        token,
        note: parsed.data.note,
      });
      res.json({ data: acknowledged });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to acknowledge corrective action follow-up";
      const status = /not found/i.test(message) ? 404 : 400;
      res.status(status).json({ error: message });
    }
  });

  router.post(
    "/corrective-action-requests/reminders",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const daysBefore = Number(req.body?.daysBefore ?? 3);
      try {
        const result = await sendCorrectiveActionReminders(daysBefore);
        res.json({
          data: {
            ...result,
            message: `Processed ${result.sent} corrective action reminder${result.sent === 1 ? "" : "s"}.`,
          },
        });
      } catch (error) {
        console.error("Failed to process corrective action reminders", error);
        res.status(500).json({ error: "Failed to process corrective action reminders" });
      }
    },
  );

  router.post(
    "/corrective-action-requests/:requestId/notifications/resend",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const requestId = routeParam(req, "requestId");
      try {
        const result = await resendCorrectiveActionNotifications({
          requestId,
          actor: req.user,
        });
        res.json({ data: result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to resend corrective action notifications";
        const status = /not found/i.test(message) ? 404 : 500;
        res.status(status).json({ error: message });
      }
    },
  );

  router.post(
    "/corrective-action-requests/:requestId/acknowledgement-reminder",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const requestId = routeParam(req, "requestId");
      try {
        const result = await sendCorrectiveActionAcknowledgementReminder({
          requestId,
          actor: req.user,
        });
        res.json({ data: result });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to send corrective action acknowledgement reminder";
        const status = /not found/i.test(message) ? 404 : 400;
        res.status(status).json({ error: message });
      }
    },
  );

  router.patch(
    "/corrective-action-requests/:requestId/review",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const requestId = routeParam(req, "requestId");
      const parsed = CorrectiveActionRequestReviewSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      try {
        const result = await updateCorrectiveActionRequestReview({
          requestId,
          actionPlanDueDate: parsed.data.actionPlanDueDate ?? null,
          actionPlanItems: parsed.data.actionPlanItems,
          actor: req.user,
        });
        res.json({ data: result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to update corrective action review";
        const status = /not found/i.test(message) ? 404 : 500;
        res.status(status).json({ error: message });
      }
    },
  );

  router.post(
    "/corrective-action-requests/:requestId/comments",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const requestId = routeParam(req, "requestId");
      const parsed = CorrectiveActionRequestCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }
      try {
        const result = await addCorrectiveActionSupervisorComment({
          requestId,
          text: parsed.data.text,
          actor: req.user,
        });
        res.json({ data: result });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Failed to add corrective action comment";
        const status = /not found/i.test(message) ? 404 : 500;
        res.status(status).json({ error: message });
      }
    },
  );

  router.get(
    "/date-audit",
    authenticateUser,
    requirePermission("reports:read"),
    async (req, res) => {
      const requestedSampleLimit = Number(String(req.query.sampleLimit ?? "25"));
      const sampleLimit = Number.isFinite(requestedSampleLimit)
        ? Math.min(100, Math.max(0, Math.trunc(requestedSampleLimit)))
        : 25;

      try {
        const summary = await auditReportTimestamps(sampleLimit);
        res.json({
          data: {
            ...summary,
            sampleLimit,
            generatedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        console.error("Failed to audit report timestamps", error);
        res.status(500).json({ error: "Failed to audit report timestamps" });
      }
    },
  );

  router.get(
    "/",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const filters = readReportFilters(req);
      const { page, limit } = readPagination(req);
      const cacheKey = buildReportsCacheKey("list", {
        role: req.user?.role ?? "unknown",
        filters,
        page,
        limit,
      });

      try {
        setCachedJsonHeaders(res, REPORTS_LIST_CACHE_TTL_SECONDS);
        const result = await cacheService.getOrSet(
          cacheKey,
          () => reportsService.list(filters, page, limit),
          REPORTS_LIST_CACHE_TTL_SECONDS,
        );
        res.json({ data: result });
      } catch (error) {
        console.error("Failed to load reports", error);
        res.status(500).json({ error: "Failed to load reports" });
      }
    },
  );

  router.get(
    "/events",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const origin = req.headers.origin;
      const allowedOrigin =
        typeof origin === "string" &&
        /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(
          origin,
        )
          ? origin
          : process.env.FRONTEND_URL || "*";

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Vary", "Origin");
      res.flushHeaders?.();

      const clientId = uuidv4();
      const client = {
        id: clientId,
        res,
        heartbeat: setInterval(() => res.write(": keep-alive\n\n"), 15000),
      };
      sseClients.set(clientId, client);
      res.write(": connected\n\n");
      res.on("close", () => cleanupClient(clientId));
      res.on("error", () => cleanupClient(clientId));
    },
  );

  router.get(
    "/stats",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const cacheKey = buildReportsCacheKey("stats", {
        role: req.user?.role ?? "unknown",
      });
      try {
        setCachedJsonHeaders(res, REPORTS_DASHBOARD_CACHE_TTL_SECONDS);
        const stats = await cacheService.getOrSet(
          cacheKey,
          () => reportsService.stats(),
          REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
        );
        res.json({ data: stats });
      } catch (error) {
        console.error("Failed to load stats", error);
        res.status(500).json({ error: "Failed to load stats" });
      }
    },
  );

  router.get(
    "/summary",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const filters = readReportFilters(req);
      const cacheKey = buildReportsCacheKey("summary", {
        role: req.user?.role ?? "unknown",
        filters,
      });
      try {
        setCachedJsonHeaders(res, REPORTS_DASHBOARD_CACHE_TTL_SECONDS);
        const summary = await cacheService.getOrSet(
          cacheKey,
          () => reportsService.summary(filters),
          REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
        );
        res.json({ data: summary });
      } catch (error) {
        console.error("Failed to load summary", error);
        res.status(500).json({ error: "Failed to load summary" });
      }
    },
  );

  router.get(
    "/dashboard",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const startedAt = Date.now();
      const filters = readReportFilters(req);
      const { page, limit } = readPagination(req);
      const cacheKey = buildReportsCacheKey("dashboard", {
        role: req.user?.role ?? "unknown",
        filters,
        page,
        limit,
      });

      try {
        setCachedJsonHeaders(res, REPORTS_DASHBOARD_CACHE_TTL_SECONDS);
        const payload = await cacheService.getOrSetWithMeta(
          cacheKey,
          async () => {
            const [reports, summary, topReporters, analyticsReports] = await Promise.all([
              reportsService.list(filters, page, limit),
              reportsService.summary(filters),
              reportsService.topReportersMonthToDate(6),
              reportsService.listDashboardAnalytics(filters),
            ]);
            const dedupedAnalyticsReports = dedupeDashboardReports(analyticsReports);

            return {
              reports: {
                ...reports,
                data: dedupeDashboardReports(reports.data),
              },
              summary,
              topReporters,
              analyticsPreview: dedupedAnalyticsReports,
              insights: buildDashboardInsights(dedupedAnalyticsReports),
              generatedAt: new Date().toISOString(),
            };
          },
          REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
        );
        metricsService.recordCacheEvent("reports-dashboard", payload.cacheStatus);
        metricsService.recordLatency("reports-dashboard", Date.now() - startedAt);
        res.setHeader(
          "X-Cache",
          payload.cacheStatus === "hit"
            ? "HIT"
            : payload.cacheStatus === "coalesced"
              ? "HIT-COALESCED"
              : payload.cacheStatus.toUpperCase(),
        );
        res.json({ data: payload.value });
      } catch (error) {
        metricsService.incrementCounter("reports-dashboard.errors");
        console.error("Failed to load dashboard snapshot", error);
        res.status(500).json({ error: "Failed to load dashboard snapshot" });
      }
    },
  );

  router.get(
    "/monthly-ehs",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      try {
        const month = queryString(req.query.month);
        const payload = await getMonthlyEhsReport(month);
        res.json({ data: payload });
      } catch (error) {
        console.error("Failed to load monthly EHS report", error);
        res.status(500).json({ error: "Failed to load monthly EHS report" });
      }
    },
  );

  router.get(
    "/selection-export",
    authenticateUser,
    requirePermission("reports:read"),
    async (req, res) => {
      const ids = String(req.query.ids || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);
      if (ids.length === 0)
        return res.status(400).json({ error: "ids query parameter required" });

      try {
        const rows = await reportsService.selectionExport(ids);
        const headers = [
          "ID",
          "Date",
          "Location",
          "Reporter",
          "Department",
          "Shift",
          "Type",
          "Category",
          "Severity",
          "Status",
          "AssignedTo",
          "Description",
        ];
        const csv = [
          headers.join(","),
          ...rows.map((r: any) =>
            [
              r.id,
              r.date?.toISOString?.() ?? r.date,
              r.location,
              r.reporter,
              r.department,
              r.shift,
              r.type,
              r.category,
              r.severity,
              r.status,
              r.assigned_to ?? r.assignedTo ?? "",
              r.description,
            ]
              .map(csvEscape)
              .join(","),
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=crown-EHS-selection-${Date.now()}.csv`,
        );
        res.send(csv);
      } catch (error) {
        console.error("Failed to export selection", error);
        res.status(500).json({ error: "Failed to export selection" });
      }
    },
  );

  router.get(
    "/top-reporters-mtd",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const requestedLimit = Number(String(req.query.limit ?? "6"));
      const limit = Number.isFinite(requestedLimit)
        ? Math.min(20, Math.max(1, Math.trunc(requestedLimit)))
        : 6;
      const cacheKey = buildReportsCacheKey("top-reporters", {
        role: req.user?.role ?? "unknown",
        limit,
      });

      try {
        setCachedJsonHeaders(res, REPORTS_DASHBOARD_CACHE_TTL_SECONDS);
        const topReporters = await cacheService.getOrSet(
          cacheKey,
          () => reportsService.topReportersMonthToDate(limit),
          REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
        );
        res.json({ data: topReporters });
      } catch (error) {
        console.error("Failed to load top reporters MTD", error);
        res.status(500).json({ error: "Failed to load top reporters MTD" });
      }
    },
  );

  router.get(
    "/leaderboard",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const requestedMonth = typeof req.query.month === "string" ? req.query.month.trim() : "";
      const requestedReporter = typeof req.query.reporter === "string" ? req.query.reporter.trim() : "";
      const cacheKey = buildReportsCacheKey("leaderboard", {
        role: req.user?.role ?? "unknown",
        month: requestedMonth || "all",
        reporter: requestedReporter || "all",
      });

      try {
        setCachedJsonHeaders(res, REPORTS_DASHBOARD_CACHE_TTL_SECONDS);
        const leaderboard = await cacheService.getOrSet(
          cacheKey,
          () => reportsService.getLeaderboard(requestedMonth || undefined, requestedReporter || undefined),
          REPORTS_DASHBOARD_CACHE_TTL_SECONDS,
        );
        res.json({ data: leaderboard });
      } catch (error) {
        console.error("Failed to load leaderboard", error);
        res.status(500).json({ error: "Failed to load leaderboard" });
      }
    },
  );

  router.get(
    "/generate",
    authenticateUser,
    requirePermission("reports:read"),
    async (req, res) => {
      try {
        const rows = await reportsService.generateExport({
          status: queryString(req.query.status),
          severity: queryString(req.query.severity),
          location: queryString(req.query.location),
          days: queryString(req.query.days),
          search: queryString(req.query.search),
          category: queryString(req.query.category),
          dateFrom: queryString(req.query.dateFrom),
          dateTo: queryString(req.query.dateTo),
        });
        const headers = [
          "ID",
          "Date",
          "Location",
          "Reporter",
          "Severity",
          "Status",
          "Category",
          "Type",
          "Description",
          "AssignedTo",
        ];
        const csv = [
          headers.join(","),
          ...rows.map((r: any) =>
            [
              r.id,
              r.date?.toISOString?.() ?? r.date,
              r.location,
              r.reporter,
              r.severity,
              r.status,
              r.category,
              r.type,
              r.description,
              r.assigned_to ?? r.assignedTo ?? "",
            ]
              .map(csvEscape)
              .join(","),
          ),
        ].join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=crown-EHS-reports-${new Date().toISOString().split("T")[0]}.csv`,
        );
        res.send(csv);
      } catch (error) {
        console.error("Failed to generate export", error);
        res.status(500).json({ error: "Failed to generate export" });
      }
    },
  );

  router.get("/:id/photo", async (req: Request, res: Response) => {
    const id = routeParam(req, "id");
    const rawSize = Number(req.query.size) || 400;
    const size = Math.max(
      100,
      Math.min(1920, Number.isFinite(rawSize) ? rawSize : 400),
    );
    const format = String(req.query.format || "webp").toLowerCase();

    try {
      const { photoUrl, found } = await reportsService.getPhotoUrl(id);
      if (!found || !photoUrl) {
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader("Cache-Control", "no-store");
        res.status(200).send(PLACEHOLDER_IMAGE);
        return;
      }

      // Prefer the photo already fetched from Drive and stored in PostgreSQL
      // during sync. This renders reliably without Drive sign-in/redirect.
      const { getStoredReportPhoto, storeReportPhotoFromDrive } = await import(
        "./report-photo.service.js"
      );
      let stored = await getStoredReportPhoto(id);
      if (!stored && photoUrl) {
        try {
          await storeReportPhotoFromDrive(id, photoUrl);
          stored = await getStoredReportPhoto(id);
        } catch {
          stored = null;
        }
      }
      if (stored) {
        const sharp = (await import("sharp")).default;
        let processed: Buffer = stored.data;
        let outputContentType = stored.contentType;
        const metadata = await sharp(stored.data).metadata();
        if (metadata.width && metadata.width > size) {
          processed = await sharp(stored.data)
            .resize(size, undefined, { withoutEnlargement: true })
            .toBuffer();
        }
        if (format === "png") {
          processed = await sharp(processed).png().toBuffer();
          outputContentType = "image/png";
        } else if (format === "jpeg" || format === "jpg") {
          processed = await sharp(processed).jpeg({ quality: 80 }).toBuffer();
          outputContentType = "image/jpeg";
        } else {
          processed = await sharp(processed).webp({ quality: 80 }).toBuffer();
          outputContentType = "image/webp";
        }
        res.setHeader("Content-Type", outputContentType);
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, immutable",
        );
        res.setHeader("ETag", `${id}-${size}-${format}`);
        res.send(processed);
        return;
      }

      // Google Drive links need to be converted to direct image URLs.
      const normalizedPhotoUrl = photoUrl
        .split(",")[0]
        .trim()
        .replace(/\/open\?id=([^&]+)/, "/uc?export=view&id=$1")
        .replace(/\/file\/d\/([^/]+)/, "/uc?export=view&id=$1");

      if (
        normalizedPhotoUrl.startsWith("http://") ||
        normalizedPhotoUrl.startsWith("https://")
      ) {
        if (!isUrlAllowedForFetch(normalizedPhotoUrl)) {
          res.setHeader("Content-Type", "image/svg+xml");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Cache-Control", "no-store");
          res.status(200).send(PLACEHOLDER_IMAGE);
          return;
        }

        const fetchRes = await safeFetch(normalizedPhotoUrl, {
          headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
        });

        if (!fetchRes.ok) {
          res.setHeader("Content-Type", "image/svg+xml");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Cache-Control", "no-store");
          res.status(200).send(PLACEHOLDER_IMAGE);
          return;
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
        const contentType =
          fetchRes.headers.get("content-type") || "image/jpeg";

        // Drive returns an HTML sign-in page for private files; don't redirect
        // the browser to it. A clean 404 lets the UI show a placeholder.
        if (!contentType.startsWith("image/")) {
          res.setHeader("Content-Type", "image/svg+xml");
          res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
          res.setHeader("Cache-Control", "no-store");
          res.status(200).send(PLACEHOLDER_IMAGE);
          return;
        }

        const sharp = (await import("sharp")).default;
        let processed: Buffer = buffer;
        let outputContentType = contentType;
        const metadata = await sharp(buffer).metadata();

        if (metadata.width && metadata.width > size) {
          processed = await sharp(buffer)
            .resize(size, undefined, { withoutEnlargement: true })
            .toBuffer();
        }

        if (format === "png") {
          processed = await sharp(processed).png().toBuffer();
          outputContentType = "image/png";
        } else if (format === "jpeg" || format === "jpg") {
          processed = await sharp(processed).jpeg({ quality: 80 }).toBuffer();
          outputContentType = "image/jpeg";
        } else {
          processed = await sharp(processed).webp({ quality: 80 }).toBuffer();
          outputContentType = "image/webp";
        }

        res.setHeader("Content-Type", outputContentType);
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        res.setHeader(
          "Cache-Control",
          "public, max-age=86400, s-maxage=604800, immutable",
        );
        res.setHeader("ETag", `${id}-${size}-${format}`);
        res.send(processed);
        return;
      }

      const { getFromS3 } =
        await import("../../shared/infrastructure/storage/s3.service.js");
      const buffer = await getFromS3(photoUrl);
      const sharp = (await import("sharp")).default;
      let processed: Buffer = buffer;
      let outputContentType = "image/webp";
      const metadata = await sharp(buffer).metadata();

      if (metadata.width && metadata.width > size) {
        processed = await sharp(buffer)
          .resize(size, undefined, { withoutEnlargement: true })
          .toBuffer();
      }

      if (format === "png") {
        processed = await sharp(processed).png().toBuffer();
        outputContentType = "image/png";
      } else if (format === "jpeg" || format === "jpg") {
        processed = await sharp(processed).jpeg({ quality: 80 }).toBuffer();
        outputContentType = "image/jpeg";
      } else {
        processed = await sharp(processed).webp({ quality: 80 }).toBuffer();
        outputContentType = "image/webp";
      }

      res.setHeader("Content-Type", outputContentType);
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, immutable",
      );
      res.setHeader("ETag", `${id}-${size}-${format}`);
      res.send(processed);
    } catch (error) {
      console.error("Failed to serve photo", error);
      res.setHeader("Content-Type", "image/svg+xml");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).send(PLACEHOLDER_IMAGE);
    }
  });

  router.get(
    "/:id",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const cacheKey = buildReportsCacheKey("detail", {
        role: req.user?.role ?? "unknown",
        id,
      });
      const report = await cacheService.getOrSet(
        cacheKey,
        () => reportsService.getById(id),
        REPORTS_DETAIL_CACHE_TTL_SECONDS,
      );
      if (!report) return res.status(404).json({ error: "Not found" });
      setCachedJsonHeaders(res, REPORTS_DETAIL_CACHE_TTL_SECONDS);
      res.json({ data: report });
    },
  );

  router.get(
    "/:id/assign",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req, res) => {
      const id = routeParam(req, "id");
      res.redirect(302, assignmentScreenUrl(req, id));
    },
  );

  router.post(
    "/",
    authenticateUser,
    requirePermission("reports:create"),
    async (req: AuthRequest, res) => {
      const parsed = CreateReportSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });

      try {
        const saved = await reportsService.create(parsed.data, req);
        await invalidateReportsCache();
        res.status(201).json({ data: saved });
      } catch (error) {
        console.error("Failed to create report", error);
        res.status(500).json({ error: "Failed to create report" });
      }
    },
  );

  router.patch(
    "/:id/status",
    authenticateUser,
    requirePermission("reports:update"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const parsed = StatusSchema.safeParse(req.body?.status);
      if (!parsed.success)
        return res.status(400).json({ error: "Invalid status" });

      const updated = await reportsService.updateStatus(id, parsed.data, req);
      if (!updated) return res.status(404).json({ error: "Not found" });
      await invalidateReportsCache();
      res.json({ data: updated });
    },
  );

  router.patch(
    "/bulk-status",
    authenticateUser,
    requirePermission("reports:update"),
    async (req: AuthRequest, res) => {
      const parsed = BulkReportStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const { ids, status } = parsed.data;
      const result = await reportsService.bulkUpdateStatus(ids, status, req);
      await invalidateReportsCache();
      res.json({ data: { ...result, status } });
    },
  );

  router.patch(
    "/:id/assign",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const assignedTo = String(req.body?.assignedTo ?? "")
        .trim()
        .toLowerCase();
      const assignedToCopy: string[] = Array.isArray(req.body?.assignedToCopy)
        ? Array.from(
            new Set<string>(
              req.body.assignedToCopy
                .map((item: unknown) => String(item).trim().toLowerCase())
                .filter((item: string) => Boolean(item)),
            ),
          )
        : [];
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(assignedTo)) {
        return res.status(400).json({
          error: "Primary assignment recipient must be a valid email address",
        });
      }

      const updated = await reportsService.updateAssignment(
        id,
        assignedTo,
        assignedToCopy,
        req,
      );
      if (!updated) return res.status(404).json({ error: "Not found" });
      await invalidateReportsCache();
      broadcastReport(updated);
      res.json({ data: updated });
    },
  );

  router.post(
    "/:id/corrective-action-requests",
    authenticateUser,
    requirePermission("reports:assign"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const parsed = CorrectiveActionRequestCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors });
      }

      const report = await reportsService.getById(id);
      if (!report) return res.status(404).json({ error: "Report not found" });

      try {
        const created = await createCorrectiveActionRequest({
          reportId: id,
          recipientEmail: parsed.data.recipientEmail,
          recipientName: parsed.data.recipientName,
          assignedByEmail: parsed.data.assignedByEmail || req.user?.email,
          assignedByName: parsed.data.assignedByName || req.user?.name || req.user?.email,
          copiedRecipientEmails: parsed.data.copiedRecipientEmails,
          reportType: report.type,
          reportCategory: report.category,
          reportDescription: report.description,
          reportLocation: report.location,
          reportDepartment: report.department,
          assigneeNote: parsed.data.assigneeNote,
          priority: parsed.data.priority,
          dueDate: parsed.data.dueDate,
        });
        res.status(201).json({ data: created });
      } catch (error) {
        console.error("Failed to create corrective action request", error);
        res.status(500).json({
          error:
            error instanceof Error
              ? error.message
              : "Failed to create corrective action request",
        });
      }
    },
  );

  router.get(
    "/:id/corrective-action-requests",
    authenticateUser,
    requirePermission("reports:read"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      try {
        const report = await reportsService.getById(id);
        if (!report) return res.status(404).json({ error: "Report not found" });
        const requests = await listCorrectiveActionRequestsByReport(id);
        res.json({ data: requests });
      } catch (error) {
        console.error("Failed to load corrective action requests", error);
        res.status(500).json({ error: "Failed to load corrective action requests" });
      }
    },
  );

  router.post(
    "/:id/closure-requests",
    authenticateUser,
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const submittedBy = String(req.user?.name || req.user?.email || "");
      const submittedByEmail = String(req.user?.email || "");
      const resolutionNotes = String(req.body?.resolutionNotes || "").trim();
      const photos = Array.isArray(req.body?.photos)
        ? req.body.photos.map((photo: unknown) => String(photo)).filter(Boolean)
        : [];

      if (!resolutionNotes) {
        return res.status(400).json({
          error: "Resolution notes are required to request closure",
        });
      }

      try {
        const { createClosureRequest } = await import(
          "../../services/report-closure.service.js"
        );
        const request = await createClosureRequest({
          reportId: id,
          submittedBy,
          submittedByEmail,
          resolutionNotes,
          photos,
        });
        res.status(201).json({ data: request });
      } catch (error) {
        console.error("Failed to create closure request", error);
        res.status(500).json({ error: "Failed to create closure request" });
      }
    },
  );

  router.post(
    "/:id/closure-requests/:requestId/approve",
    authenticateUser,
    requirePermission("reports:approve"),
    async (req: AuthRequest, res) => {
      const reportId = routeParam(req, "id");
      const requestId = routeParam(req, "requestId");
      const reviewedBy = String(req.user?.name || req.user?.email || "");
      const reviewedByEmail = String(req.user?.email || "");
      const reviewNotes = String(req.body?.reviewNotes || "").trim();

      try {
          const { approveClosureRequest } = await import(
            "../../services/report-closure.service.js"
          );
        const updated = await approveClosureRequest({
          requestId,
          reportId,
          reviewedBy,
          reviewedByEmail,
          reviewNotes,
        });
        res.json({ data: updated });
      } catch (error) {
        console.error("Failed to approve closure request", error);
        res.status(400).json({
          error: error instanceof Error ? error.message : "Failed to approve closure request",
        });
      }
    },
  );

  router.post(
    "/:id/closure-requests/:requestId/reject",
    authenticateUser,
    requirePermission("reports:approve"),
    async (req: AuthRequest, res) => {
      const reportId = routeParam(req, "id");
      const requestId = routeParam(req, "requestId");
      const reviewedBy = String(req.user?.name || req.user?.email || "");
      const reviewedByEmail = String(req.user?.email || "");
      const reviewNotes = String(req.body?.reviewNotes || "").trim();

      if (!reviewNotes) {
        return res.status(400).json({
          error: "Review notes are required to reject a closure request",
        });
      }

      try {
          const { rejectClosureRequest } = await import(
            "../../services/report-closure.service.js"
          );
        const updated = await rejectClosureRequest({
          requestId,
          reportId,
          reviewedBy,
          reviewedByEmail,
          reviewNotes,
        });
        res.json({ data: updated });
      } catch (error) {
        console.error("Failed to reject closure request", error);
        res.status(400).json({
          error: error instanceof Error ? error.message : "Failed to reject closure request",
        });
      }
    },
  );

  router.get(
    "/:id/closure-requests",
    authenticateUser,
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      try {
          const { listClosureRequests } = await import(
            "../../services/report-closure.service.js"
          );
        const requests = await listClosureRequests(id);
        res.json({ data: requests });
      } catch (error) {
        console.error("Failed to load closure requests", error);
        res.status(500).json({ error: "Failed to load closure requests" });
      }
    },
  );

  router.post(
    "/:id/comments",
    authenticateUser,
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const author = String(
        req.body?.author || req.user?.name || req.user?.email || "",
      );
      const text = String(req.body?.text || "");
      if (!author || !text)
        return res.status(400).json({ error: "author and text required" });

      const updated = await reportsService.addComment(id, author, text, req);
      if (!updated) return res.status(404).json({ error: "Not found" });
      await invalidateReportsCache();
      res.json({ data: updated });
    },
  );

  router.patch(
    "/:id",
    authenticateUser,
    requirePermission("reports:update"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const updated = await reportsService.update(id, req.body, req);
      if (!updated) return res.status(404).json({ error: "Not found" });
      await invalidateReportsCache();
      res.json({ data: updated });
    },
  );

  router.delete(
    "/:id",
    authenticateUser,
    requirePermission("reports:update"),
    async (req: AuthRequest, res) => {
      const id = routeParam(req, "id");
      const result = await reportsService.delete(id, req);
      if (!result) return res.status(404).json({ error: "Not found" });
      await invalidateReportsCache();
      res.json({ data: result });
    },
  );

  return router;
}

export { broadcastReport, broadcastStats };

