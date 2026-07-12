import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { CreateReportSchema, StatusSchema } from "../../lib/types.js";
import { writeAuditLog } from "../../shared/audit/audit.service.js";
import {
  authenticateUser,
  requirePermission,
  type AuthRequest,
} from "../../shared/middleware/auth.middleware.js";
import { reportsService } from "./reports.service.js";

type SseClient = {
  id: string;
  res: Response;
  heartbeat?: NodeJS.Timeout;
};

const sseClients = new Map<string, SseClient>();

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return `https://placehold.co/${size}x${size}/1e293b/ffffff?text=${encodeURIComponent(shortId)}`;
}

function queryString(value: unknown) {
  return typeof value === "string" ? value : undefined;
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
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function createReportsRouter() {
  const router = Router();

  router.get(
    "/",
    authenticateUser,
    requirePermission("reports:read"),
    async (req, res) => {
      const status = queryString(req.query.status);
      const severity = queryString(req.query.severity);
      const location = queryString(req.query.location);
      const days = queryString(req.query.days);
      const search = queryString(req.query.search);
      const category = queryString(req.query.category);
      const page = Number(String(req.query.page)) || 1;
      const all = String(req.query.all || "").toLowerCase() === "true";
      const limit = all ? 0 : Number(String(req.query.limit)) || 50;

      try {
        const result = await reportsService.list(
          { status, severity, location, days, search, category, all },
          page,
          limit,
        );
        res.json(result);
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
    async (req, res) => {
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
    async (_req, res) => {
      try {
        const stats = await reportsService.stats();
        res.json(stats);
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
    async (_req, res) => {
      try {
        const summary = await reportsService.summary();
        res.json(summary);
      } catch (error) {
        console.error("Failed to load summary", error);
        res.status(500).json({ error: "Failed to load summary" });
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
    "/generate",
    authenticateUser,
    requirePermission("reports:read"),
    async (_req, res) => {
      try {
        const rows = await reportsService.generateExport();
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
      if (!found) return res.status(404).json({ error: "Not found" });
      if (!photoUrl) return res.status(404).json({ error: "No photo" });

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
        const fetchRes = await fetch(normalizedPhotoUrl, {
          headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
          redirect: "follow",
        });

        if (!fetchRes.ok) {
          return res.redirect(302, photoUrl.split(",")[0].trim());
        }

        const arrayBuffer = await fetchRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer as ArrayBuffer);
        const contentType =
          fetchRes.headers.get("content-type") || "image/jpeg";

        if (!contentType.startsWith("image/")) {
          return res.redirect(302, photoUrl.split(",")[0].trim());
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
      res.setHeader(
        "Cache-Control",
        "public, max-age=86400, s-maxage=604800, immutable",
      );
      res.setHeader("ETag", `${id}-${size}-${format}`);
      res.send(processed);
    } catch (error) {
      console.error("Failed to serve photo", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  router.get(
    "/:id",
    authenticateUser,
    requirePermission("reports:read"),
    async (req, res) => {
      const id = routeParam(req, "id");
      const report = await reportsService.getById(id);
      if (!report) return res.status(404).json({ error: "Not found" });
      res.json(report);
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
        res.status(201).json(saved);
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
      res.json(updated);
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
        return res
          .status(400)
          .json({
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
      broadcastReport(updated);
      res.json(updated);
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
      res.json(updated);
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
      res.json(updated);
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
      res.json(result);
    },
  );

  return router;
}

export { broadcastReport, broadcastStats };
