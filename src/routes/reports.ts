import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
import {
  SeveritySchema,
  StatusSchema,
  CreateReportSchema,
  REPORT_SOURCE_GOOGLE_SHEETS,
  REPORT_SOURCE_MANUAL,
} from "../lib/types.js";
import { authMiddleware } from "./auth.js";
import { sendIncidentNotification, sendAssignmentNotification } from "../lib/email.js";
import { getCommitteeMembers } from "./committee.js";
import { getPlaceholderImageUrl } from "../lib/config.js";
import { awardPointsForReport } from "../lib/leaderboard.js";

const router = Router();

type SSEClient = {
  id: string;
  res: Response;
};

const sseClients: Map<string, SSEClient> = new Map();

export function broadcastReport(report: any) {
  const payload = `event: report\ndata: ${JSON.stringify(report)}\n\n`;
  for (const client of sseClients.values()) {
    client.res.write(payload);
  }
}

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return getPlaceholderImageUrl(shortId, size);
}

function normalizeReporterName(name: unknown) {
  const raw = String(name ?? "").trim();
  const lower = raw.toLowerCase();

  const looksLikePlaceholder =
    !raw ||
    lower === "employee" ||
    lower === "na" ||
    lower === "n/a" ||
    lower === "unknown" ||
    lower === "null" ||
    lower === "undefined";

  return looksLikePlaceholder ? "" : raw;
}

function getPhotoUrlForDisplay(photoUrl: unknown, reportId: unknown) {
  const raw = String(photoUrl ?? "").trim();
  const fallback = getPlaceholderPhotoUrl(reportId);
  if (!raw) return fallback;

  const driveMatch = raw.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([^/&?]+)/i);
  if (driveMatch?.[1]) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
  }

  return raw || fallback;
}

function parseAssignedToCopy(value: any) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function mapRow(row: any, comments: { author: string; at: string; text: string }[]) {
  const reporterNormalized = normalizeReporterName(row.reporter);
  const reporter = reporterNormalized || (row.assignedTo ? String(row.assignedTo) : "");

  const photoUrl = getPhotoUrlForDisplay(row.photoUrl, row.id);
  const photos = String(row.photoUrl ?? "")
    .split(",")
    .map((url: string) => url.trim())
    .filter(Boolean)
    .map((url: string) => getPhotoUrlForDisplay(url, row.id));

  return {
    ...row,
    reporter,
    isNearMiss: Boolean(row.isNearMiss),
    anonymous: Boolean(row.anonymous),
    complianceRequired: Boolean(row.complianceRequired),
    comments,
    resolutionDays: row.resolutionDays ?? undefined,
    complianceDueAt: row.complianceDueAt ?? undefined,
    assignedTo: row.assignedTo ?? undefined,
    assignedToCopy: parseAssignedToCopy(row.assignedToCopy),
    photoUrl,
    photos: photos.length > 0 ? photos : undefined,
  };
};

const fetchComments = (db: any, reportId: string) => {
  return allRows(
    db,
    "SELECT author, at, text FROM comments WHERE reportId = ? ORDER BY at ASC",
    [reportId],
  ) as { author: string; at: string; text: string }[];
};

const fetchAudit = (db: any, reportId: string) => {
  return allRows(
    db,
    "SELECT actor, action, detail, createdAt FROM report_audit WHERE reportId = ? ORDER BY createdAt DESC",
    [reportId],
  ) as { actor: string; action: string; detail?: string; createdAt: string }[];
};

const rowMapper = (db: any, row: any) => {
  const comments = fetchComments(db, row.id);
  const audit = fetchAudit(db, row.id);
  return {
    ...mapRow(row, comments),
    auditHistory: audit.map((entry) => ({
      at: entry.createdAt,
      actor: entry.actor,
      action: entry.action,
      detail: entry.detail,
    })),
  };
};

const listRowMapper = (row: any) => ({
  ...mapRow(row, []),
  comments: [],
  auditHistory: [],
});

function normalizeReportField(value: unknown) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function reportDedupeKey(row: any) {
  return [
    normalizeReportField(row.date),
    normalizeReportField(row.location),
    normalizeReportField(row.reporter),
    normalizeReportField(row.description),
    normalizeReportField(row.category),
    normalizeReportField(row.type),
    normalizeReportField(row.severity),
  ].join("::");
}

function dedupeReports(rows: any[]) {
  const byKey = new Map<string, any>();
  for (const row of rows) {
    const key = reportDedupeKey(row);
    const existing = byKey.get(key);
    if (!existing || new Date(row.date).getTime() >= new Date(existing.date).getTime()) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
}

const routeParam = (req: Request, name: string) => {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value ?? "";
};

const queryString = (value: unknown) => (typeof value === "string" ? value : undefined);

router.get("/", async (req: Request, res: Response) => {
  const db = await getDb();

  const status = queryString(req.query.status);
  const severity = queryString(req.query.severity);
  const location = queryString(req.query.location);
  const days = queryString(req.query.days);
  const from = queryString(req.query.from);
  const to = queryString(req.query.to);
  const search = queryString(req.query.search);
  const category = queryString(req.query.category);

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const offset = (page - 1) * limit;

  let sql = "SELECT * FROM reports WHERE source = ?";
  const countSql = "SELECT COUNT(*) as total FROM reports WHERE source = ?";
  const params: any[] = [REPORT_SOURCE_GOOGLE_SHEETS];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (severity) {
    sql += " AND severity = ?";
    params.push(severity);
  }
  if (location && location !== "All") {
    sql += " AND location = ?";
    params.push(location);
  }
  if (category && category !== "All") {
    sql += " AND category = ?";
    params.push(category);
  }
  if (days && days !== "9999") {
    const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString();
    sql += " AND date >= ?";
    params.push(cutoff);
  }
  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (search) {
    sql += " AND (description LIKE ? OR reporter LIKE ? OR id LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const totalResult = db.prepare(countSql).getAsObject(params) as any;
  const total = Number(totalResult.total ?? 0);

  sql += " ORDER BY date DESC LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const rows = allRows(db, sql, params) as any[];
  const dedupedRows = dedupeReports(rows);
  const mapped = dedupedRows.map((row: any) => listRowMapper(row));
  res.json({ data: mapped, total, page, limit });
});

router.get("/stats", async (_req: Request, res: Response) => {
  const db = await getDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);

  const summary = db
    .prepare(
      `SELECT
        COUNT(*) AS total,
        SUM(status = 'Open') AS open,
        SUM(status = 'Closed') AS closed,
        SUM(date >= ?) AS today,
        SUM(date >= ?) AS week,
        AVG(CAST(resolutionDays AS REAL)) AS avgResolution
      FROM reports
      WHERE source = ?`,
    )
    .getAsObject([today.toISOString(), week.toISOString(), REPORT_SOURCE_GOOGLE_SHEETS]) as any;

  const avg = summary.avgResolution ? +Number(summary.avgResolution).toFixed(1) : 0;

  res.json({
    total: Number(summary.total ?? 0),
    open: Number(summary.open ?? 0),
    closed: Number(summary.closed ?? 0),
    today: Number(summary.today ?? 0),
    week: Number(summary.week ?? 0),
    avgResolution: Number.isNaN(avg) ? 0 : avg,
  });
});

router.get("/summary", async (_req: Request, res: Response) => {
  const db = await getDb();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const now = new Date().toISOString();

  const status = queryString(_req.query.status);
  const severity = queryString(_req.query.severity);
  const location = queryString(_req.query.location);
  const days = queryString(_req.query.days);
  const from = queryString(_req.query.from);
  const to = queryString(_req.query.to);
  const search = queryString(_req.query.search);
  const category = queryString(_req.query.category);

  let sql = `SELECT
        COUNT(*) AS total,
        SUM(status = 'Open') AS open,
        SUM(status = 'Closed') AS closed,
        SUM(date >= ?) AS today,
        SUM(date >= ?) AS week,
        SUM(CASE WHEN status != 'Closed' AND severity = 'Critical' THEN 1 ELSE 0 END) AS criticalOpen,
        SUM(CASE WHEN status != 'Closed' AND dueAt < ? THEN 1 ELSE 0 END) AS overdue,
        AVG(CAST(resolutionDays AS REAL)) AS avgResolution
      FROM reports
      WHERE source = ?`;

  const params: any[] = [today.toISOString(), week.toISOString(), now, REPORT_SOURCE_GOOGLE_SHEETS];

  if (status) {
    sql += " AND status = ?";
    params.push(status);
  }
  if (severity) {
    sql += " AND severity = ?";
    params.push(severity);
  }
  if (location && location !== "All") {
    sql += " AND location = ?";
    params.push(location);
  }
  if (category && category !== "All") {
    sql += " AND category = ?";
    params.push(category);
  }
  if (days && days !== "9999") {
    const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString();
    sql += " AND date >= ?";
    params.push(cutoff);
  }
  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  if (search) {
    sql += " AND (description LIKE ? OR reporter LIKE ? OR id LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const summary = db.prepare(sql).getAsObject(params) as any;
  const avg = summary.avgResolution ? +Number(summary.avgResolution).toFixed(1) : 0;

  res.json({
    total: Number(summary.total ?? 0),
    open: Number(summary.open ?? 0),
    closed: Number(summary.closed ?? 0),
    today: Number(summary.today ?? 0),
    week: Number(summary.week ?? 0),
    criticalOpen: Number(summary.criticalOpen ?? 0),
    overdue: Number(summary.overdue ?? 0),
    avgResolution: Number.isNaN(avg) ? 0 : avg,
  });
});

router.get("/events", async (req: Request, res: Response) => {
  const origin = req.headers.origin;
  const allowedOrigin =
    typeof origin === "string" &&
    /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin)
      ? origin
      : process.env.FRONTEND_URL || "*";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Vary", "Origin");

  const clientId = uuidv4();
  sseClients.set(clientId, { id: clientId, res });

  res.write(": connected\n\n");

  res.on("close", () => sseClients.delete(clientId));
  res.on("error", () => sseClients.delete(clientId));
});

router.get("/:id", async (req: Request, res: Response) => {
  const db = await getDb();
  const id = routeParam(req, "id");
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;

  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(rowMapper(db, row));
});

router.post("/", async (req: Request, res: Response) => {
  const db = await getDb();
  const parsed = CreateReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  const input = parsed.data;

  const id = `RPT-${String(Date.now()).slice(-5)}`;
  const now = new Date();
  const date = now.toISOString();

  const dueDate = new Date(
    now.getTime() +
      (input.severity === "Critical" ? 1 : input.severity === "High" ? 3 : 7) * 86400000,
  );

  const slaHours = input.severity === "Critical" ? 24 : input.severity === "High" ? 72 : 168;
  const photoUrl = input.photoUrl?.trim() || getPlaceholderImageUrl(id.slice(-3), 80);

  const complianceRequired = Boolean(
    input.complianceRequired || input.severity === "Critical" || input.severity === "High",
  );
  const complianceDueAt = complianceRequired
    ? new Date(dueDate.getTime() + 86400000 * 3).toISOString()
    : null;

  const stmt = db.prepare(`
    INSERT INTO reports (
      id,
      date,
      location,
      reporter,
      description,
      severity,
      status,
      category,
      type,
      resolutionDays,
      slaHours,
      dueAt,
      assignedTo,
      isNearMiss,
      anonymous,
      department,
      shift,
      complianceRequired,
      complianceDueAt,
      photoUrl,
      source
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    id,
    date,
    input.location,
    input.reporter,
    input.description,
    input.severity,
    "Open",
    input.category,
    input.type,
    null,
    slaHours,
    dueDate.toISOString(),
    null,
    0,
    input.anonymous ? 1 : 0,
    input.department,
    input.shift,
    complianceRequired ? 1 : 0,
    complianceDueAt,
    photoUrl,
    REPORT_SOURCE_MANUAL,
  ]);

  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any;
  const saved = rowMapper(db, row);

  await awardPointsForReport(db, {
    date: saved.date,
    reporter: saved.reporter,
    severity: saved.severity,
  });

  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    `AUD-${Date.now()}`,
    saved.id,
    "System",
    "Report created",
    `Severity: ${saved.severity}; Location: ${saved.location}`,
    date,
  ]);

  await saveDb(db);

  if (input.severity === "Critical" || input.severity === "High") {
    const settingsRow = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .getAsObject(["app_settings"]) as { value?: string } | undefined;
    const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;

    const recipient =
      settings?.schedule?.email ||
      process.env.SMTP_FROM ||
      process.env.DEFAULT_NOTIFICATION_EMAIL ||
      "safety@crownpaints.co.ke";

    const result = await sendIncidentNotification(saved as any, recipient);
    const notificationId = `NOTIF-${Date.now()}`;

    db.prepare(
      "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([
      notificationId,
      saved.id,
      result.mode,
      recipient,
      result.message.includes("Critical") || result.message.includes("High")
        ? `Incident alert: ${saved.id}`
        : "Incident alert",
      result.message,
      result.delivered ? 1 : 0,
      new Date().toISOString(),
      0,
    ]);

    await saveDb(db);
  }

  broadcastReport(saved);
  res.status(201).json(saved);
});

router.patch("/:id/status", authMiddleware, async (req: Request, res: Response) => {
  const db = await getDb();
  const { status } = req.body as { status: string };
  const parsed = StatusSchema.safeParse(status);
  if (!parsed.success) return res.status(400).json({ error: "Invalid status" });

  const id = routeParam(req, "id");
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });

  db.prepare("UPDATE reports SET status = ? WHERE id = ?").run([parsed.data, id]);
  await saveDb(db);

  const updated = rowMapper(db, { ...row, status: parsed.data });

  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    `AUD-${Date.now()}`,
    updated.id,
    "System",
    "Status updated",
    `Status: ${parsed.data}`,
    new Date().toISOString(),
  ]);

  await saveDb(db);

  if (updated.severity === "Critical" || updated.severity === "High") {
    const settingsRow = db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .getAsObject(["app_settings"]) as { value?: string } | undefined;
    const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;

    const recipient =
      settings?.schedule?.email ||
      process.env.SMTP_FROM ||
      process.env.DEFAULT_NOTIFICATION_EMAIL ||
      "safety@crownpaints.co.ke";

    const result = await sendIncidentNotification(updated as any, recipient);
    const notificationId = `NOTIF-${Date.now()}`;

    db.prepare(
      "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([
      notificationId,
      updated.id,
      result.mode,
      recipient,
      `Incident alert: ${updated.id}`,
      result.message,
      result.delivered ? 1 : 0,
      new Date().toISOString(),
      0,
    ]);

    await saveDb(db);
  }

  broadcastReport(updated);
  res.json(updated);
});

router.patch("/:id/assign", authMiddleware, async (req: Request, res: Response) => {
  const db = await getDb();
  const { assignedTo, assignedToCopy } = req.body as {
    assignedTo: string;
    assignedToCopy?: string[];
  };
  const id = routeParam(req, "id");

  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });

  const committeeMembers = await getCommitteeMembers();
  const requestedCopies = Array.isArray(assignedToCopy)
    ? assignedToCopy.filter((item): item is string => Boolean(item))
    : [];
  const allCopies = Array.from(
    new Set([...(assignedTo ? [assignedTo] : []), ...requestedCopies, ...committeeMembers].filter(Boolean)),
  );
  const copyRecipients = allCopies.filter((recipient) => recipient !== assignedTo);
  const copyValue = copyRecipients.length > 0 ? JSON.stringify(copyRecipients) : null;

  db.prepare("UPDATE reports SET assignedTo = ?, assignedToCopy = ? WHERE id = ?").run([
    assignedTo,
    copyValue,
    id,
  ]);
  await saveDb(db);

  const updated = rowMapper(db, { ...row, assignedTo, assignedToCopy: copyValue });

  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    `AUD-${Date.now()}`,
    updated.id,
    "System",
    "Assignment updated",
    `Assigned to: ${assignedTo || "Unassigned"}${
      copyRecipients.length > 0 ? `; Copied: ${copyRecipients.join(", ")}` : ""
    }`,
    new Date().toISOString(),
  ]);

  await saveDb(db);

  if (assignedTo) {
    const result = await sendAssignmentNotification(updated as any, assignedTo);
    const notificationId = `NOTIF-${Date.now()}`;

    db.prepare(
      "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([
      notificationId,
      updated.id,
      String(result.mode),
      result.recipient ?? assignedTo,
      `Task assigned: ${updated.id}`,
      `Assigned to ${assignedTo}. ${updated.description}`,
      result.delivered ? 1 : 0,
      new Date().toISOString(),
      0,
    ]);

    await saveDb(db);
  }

  if (copyRecipients.length > 0) {
    for (const recipient of copyRecipients) {
      if (!recipient || recipient === assignedTo) continue;
      const result = await sendAssignmentNotification(updated as any, recipient);
      const notificationId = `NOTIF-${Date.now()}-${recipient}`;

      db.prepare(
        "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run([
        notificationId,
        updated.id,
        String(result.mode),
        recipient,
        `Task CC: ${updated.id}`,
        `CC recipient ${recipient} notified for ${updated.id}. ${updated.description}`,
        result.delivered ? 1 : 0,
        new Date().toISOString(),
        0,
      ]);

      db.prepare(
        "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
      ).run([
        `AUD-${Date.now()}-${recipient}`,
        updated.id,
        "System",
        "Committee member notified",
        `Copied: ${recipient}`,
        new Date().toISOString(),
      ]);
    }
    await saveDb(db);
  }

  broadcastReport(updated);
  res.json(updated);
});

router.patch("/:id/complete", authMiddleware, async (req: Request, res: Response) => {
  const db = await getDb();
  const { completedBy, resolutionNote } = req.body as {
    completedBy?: string;
    resolutionNote?: string;
  };
  const id = routeParam(req, "id");

  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });

  const now = new Date();
  const createdAt = now.toISOString();

  const resolutionDays = row.date
    ? Math.max(0, Math.round((now.getTime() - new Date(row.date).getTime()) / 86400000))
    : null;

  db.prepare("UPDATE reports SET status = ?, resolutionDays = ? WHERE id = ?").run([
    "Closed",
    resolutionDays,
    id,
  ]);

  if (resolutionNote) {
    db.prepare("INSERT INTO comments (id, reportId, author, at, text) VALUES (?, ?, ?, ?, ?)").run([
      uuidv4(),
      id,
      completedBy || "System",
      createdAt,
      resolutionNote,
    ]);
  }

  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    `AUD-${Date.now()}`,
    id,
    completedBy || "System",
    "Task completed",
    resolutionNote ? `Resolution note: ${resolutionNote}` : "Task marked complete",
    createdAt,
  ]);

  await saveDb(db);

  const updated = rowMapper(db, db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any);

  db.prepare(
    "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    `NOTIF-${Date.now()}`,
    updated.id,
    "internal",
    completedBy || "System",
    `Task completed: ${updated.id}`,
    resolutionNote
      ? `Completed by ${completedBy || "System"}: ${resolutionNote}`
      : `Task completed for report ${updated.id}`,
    0,
    createdAt,
    0,
  ]);

  await saveDb(db);

  broadcastReport(updated);
  res.json(updated);
});

router.post("/:id/comments", authMiddleware, async (req: Request, res: Response) => {
  const db = await getDb();
  const { author, text } = req.body as { author: string; text: string };

  if (!author || !text) return res.status(400).json({ error: "author and text required" });

  const id = routeParam(req, "id");
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });

  const commentId = uuidv4();
  const at = new Date().toISOString();

  db.prepare(
    "INSERT INTO comments (id, reportId, author, at, text) VALUES (?, ?, ?, ?, ?)",
  ).run([commentId, id, author, at, text]);

  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([`AUD-${Date.now()}`, id, author, "Comment added", `Comment by ${author}`, at]);

  await saveDb(db);

  const updated = rowMapper(db, row);
  broadcastReport(updated);
  res.status(201).json(updated);
});

router.get("/audit/:id", authMiddleware, async (req: Request, res: Response) => {
  const db = await getDb();
  const id = routeParam(req, "id");
  const audit = fetchAudit(db, id);
  res.json({ id, audit });
});

export default router;

