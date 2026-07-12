import { Router, type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { SeveritySchema, StatusSchema, CreateReportSchema } from "../lib/types.js";
import { sendIncidentNotification, sendAssignmentNotification } from "../lib/email.js";
import { describeFieldChanges } from "../lib/audit.js";
// import { authMiddleware } from "./auth.js";


// NOTE: This SSE route file previously had additional assignment/notification logic.
// The current project build expects the simpler reports SSE behavior.
// We intentionally keep this module self-contained to avoid missing symbols.

type AppUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: string;
};

async function findUserByIdentifier(_identifier: string): Promise<AppUser | null> {
  return null;
}

async function sendSmsNotification(_report: any, _phone: string): Promise<boolean> {
  return false;
}

// import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";


const router = Router();

type SSEClient = {
  id: string;
  res: Response;
  heartbeat?: NodeJS.Timeout;
};

const sseClients: Map<string, SSEClient> = new Map();

function getSsePayload(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function cleanupClient(clientId: string) {
  const client = sseClients.get(clientId);
  if (!client) return;
  if (client.heartbeat) clearInterval(client.heartbeat);
  sseClients.delete(clientId);
}

function tryWrite(clientId: string, client: SSEClient, payload: string) {
  try {
    client.res.write(payload);
  } catch {
    cleanupClient(clientId);
  }
}

function broadcastReport(report: any) {
  const payload = getSsePayload("report", report);
  for (const [clientId, client] of sseClients.entries()) {
    tryWrite(clientId, client, payload);
  }
}

function broadcastStats(stats: any) {
  const payload = getSsePayload("stats", stats);
  for (const [clientId, client] of sseClients.entries()) {
    tryWrite(clientId, client, payload);
  }
}

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return `https://placehold.co/${size}x${size}/1e293b/ffffff?text=${encodeURIComponent(shortId)}`;
}

const mapRow = (row: any, comments: { author: string; at: string; text: string }[]): any => ({
  ...row,
  isNearMiss: Boolean(row.isNearMiss),
  anonymous: Boolean(row.anonymous),
  complianceRequired: Boolean(row.complianceRequired),
  comments,
  resolutionDays: row.resolutionDays ?? undefined,
  complianceDueAt: row.complianceDueAt ?? undefined,
  assignedTo: row.assignedTo ?? undefined,
  photoUrl: String(row.photoUrl ?? "").trim() || getPlaceholderPhotoUrl(row.id),
});

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
  const search = queryString(req.query.search);
  const category = queryString(req.query.category);
  const page = Number(String(req.query.page)) || 1;
  const limit = Number(String(req.query.limit)) || 50;
  const offset = (page - 1) * limit;

  let where = " WHERE 1=1";
  const params: any[] = [];

  if (status) {
    where += " AND status = ?";
    params.push(status);
  }
  if (severity) {
    where += " AND severity = ?";
    params.push(severity);
  }
  if (location && location !== "All") {
    where += " AND location = ?";
    params.push(location);
  }
  if (category && category !== "All") {
    where += " AND category = ?";
    params.push(category);
  }
  if (days && days !== "9999") {
    const cutoff = new Date(Date.now() - Number(days) * 86400000).toISOString();
    where += " AND date >= ?";
    params.push(cutoff);
  }
  if (search) {
    where += " AND (description LIKE ? OR reporter LIKE ? OR id LIKE ?)";
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const countSql = `SELECT COUNT(*) as total FROM reports${where}`;
  const totalResult = db.prepare(countSql).getAsObject(params) as any;
  const total = Number(totalResult.total ?? totalResult.c ?? 0);
  const dataSql = `SELECT * FROM reports${where} ORDER BY date DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = allRows(db, dataSql, params) as any[];
  const dedupedRows = dedupeReports(rows);

  const mapped = dedupedRows.map((row: any) => rowMapper(db, row));
  res.json({ data: mapped, total, page, limit });
});

router.get("/stats", async (_req: Request, res: Response) => {
  const db = await getDb();
  const total = Number(db.prepare("SELECT COUNT(*) as c FROM reports").getAsObject([]).c ?? 0);
  const open = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Open'").getAsObject([]).c ?? 0,
  );
  const closed = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'").getAsObject([]).c ?? 0,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([today.toISOString()]).c ?? 0,
  );
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const weekCount = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([week.toISOString()]).c ?? 0,
  );
  const closedRows = allRows(
    db,
    "SELECT resolutionDays FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL",
  ) as { resolutionDays: number }[];
  const avg = closedRows.length
    ? +(closedRows.reduce((s, r) => s + Number(r.resolutionDays), 0) / closedRows.length).toFixed(1)
    : 0;
  res.json({ total, open, closed, today: todayCount, week: weekCount, avgResolution: avg });
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
  const client: SSEClient = { id: clientId, res };
  sseClients.set(clientId, client);

  // Ensure headers are sent immediately
  res.flushHeaders?.();

  // Heartbeat to avoid idle timeouts through proxies
  client.heartbeat = setInterval(() => {
    // "comment" event; doesn't trigger message handlers
    try {
      res.write(`: keep-alive\n\n`);
    } catch {
      cleanupClient(clientId);
    }
  }, 15000);

  res.write(": connected\n\n");

  res.on("close", () => {
    cleanupClient(clientId);
  });
  res.on("error", () => {
    cleanupClient(clientId);
  });
});

router.get("/stats", async (_req: Request, res: Response) => {
  const db = await getDb();
  const total = Number(db.prepare("SELECT COUNT(*) as c FROM reports").getAsObject([]).c ?? 0);
  const open = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Open'").getAsObject([]).c ?? 0);
  const closed = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'").getAsObject([]).c ?? 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([today.toISOString()]).c ?? 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const weekCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([week.toISOString()]).c ?? 0);
  const closedRows = allRows(
    db,
    "SELECT resolutionDays FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL",
  ) as { resolutionDays: number }[];
  const avg = closedRows.length
    ? +(closedRows.reduce((s, r) => s + Number(r.resolutionDays), 0) / closedRows.length).toFixed(1)
    : 0;
  res.json({ total, open, closed, today: todayCount, week: weekCount, avgResolution: avg });
});

router.get("/summary", async (_req: Request, res: Response) => {
  const db = await getDb();
  const total = Number(db.prepare("SELECT COUNT(*) as c FROM reports").getAsObject([]).c ?? 0);
  const open = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Open'").getAsObject([]).c ?? 0);
  const closed = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'").getAsObject([]).c ?? 0,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([today.toISOString()]).c ?? 0);
  const week = new Date();
  week.setDate(week.getDate() - 7);
  const weekCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([week.toISOString()]).c ?? 0);
  const criticalOpen = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE severity = 'Critical' AND status != 'Closed'").getAsObject([]).c ?? 0,
  );
  const nowIso = new Date().toISOString();
  const overdue = Number(
    db.prepare("SELECT COUNT(*) as c FROM reports WHERE status != 'Closed' AND dueAt IS NOT NULL AND dueAt < ?").getAsObject([nowIso]).c ?? 0,
  );
  const closedRows = allRows(
    db,
    "SELECT resolutionDays FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL",
  ) as { resolutionDays: number }[];
  const avg = closedRows.length
    ? +(closedRows.reduce((s, r) => s + Number(r.resolutionDays), 0) / closedRows.length).toFixed(1)
    : 0;
  res.json({ total, open, closed, today: todayCount, week: weekCount, criticalOpen, overdue, avgResolution: avg });
});

router.get("/:id", async (req: Request, res: Response) => {
  const db = await getDb();
  const id = routeParam(req, "id");
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row || !row.id) return res.status(404).json({ error: "Not found" });
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
  const photoUrl = input.photoUrl?.trim() || `https://placehold.co/80x80/1e293b/ffffff?text=${id.slice(-3)}`;
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
      photoUrl
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  ]);

  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any;
  const saved = rowMapper(db, row);
  db.prepare("INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
    `AUD-${Date.now()}`,
    saved.id,
    "System",
    "Report created",
    `Severity: ${saved.severity}; Location: ${saved.location}`,
    date,
  ]);
  await saveDb(db);

  if (input.severity === "Critical" || input.severity === "High") {
    const settingsRow = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(["app_settings"]) as { value?: string } | undefined;
    const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;
    const recipient = settings?.schedule?.email || process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_FROM;
    if (!recipient) return res.status(500).json({ error: "Notification recipient is not configured" });
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

router.patch("/:id/status", async (req: Request, res: Response) => {
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
  db.prepare("INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
    `AUD-${Date.now()}`,
    updated.id,
    "System",
    "Status updated",
    `Status: ${parsed.data}`,
    new Date().toISOString(),
  ]);
  await saveDb(db);

  if (updated.severity === "Critical" || updated.severity === "High") {
    const settingsRow = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(["app_settings"]) as { value?: string } | undefined;
    const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;
    const recipient = settings?.schedule?.email || process.env.DEFAULT_NOTIFICATION_EMAIL || process.env.SMTP_FROM;
    if (!recipient) return res.status(500).json({ error: "Notification recipient is not configured" });
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

function parseAssignedToCopy(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
    } catch {
      return value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
    }
  }
  return [];
}

// Resolve a raw assignment identifier (email, user id, or display name) to a
// registered user so we can reach them by their stored email/phone.
async function resolveAssignee(identifier: string): Promise<AppUser | null> {
  if (!identifier) return null;
  const found = await findUserByIdentifier(identifier);
  if (found) return found;
  // Fallback: treat the raw value as a display name with no contact details.
  return { id: identifier, name: identifier, email: identifier.includes("@") ? identifier : "", role: "unknown" };
}

async function notifyAssignmentTarget(
  report: any,
  user: AppUser,
  audienceLabel: string,
): Promise<void> {
  const db = await getDb();
  const notificationId = `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const subject = `Task assigned: ${report.id}`;
  const message = [
    `Report ${report.id} has been assigned to ${report.assignedTo || "a supervisor"}.`,
    `You are notified as ${audienceLabel}.`,
    `Severity: ${report.severity}`,
    `Location: ${report.location}`,
    `Reporter: ${report.reporter}`,
    `Description: ${report.description}`,
    `Please review and complete the required follow-up.`,
  ].join("\n\n");

  db.prepare(
    "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run([
    notificationId,
    report.id,
    "in-app",
    user.name,
    subject,
    message,
    0,
    new Date().toISOString(),
    0,
  ]);
  await saveDb(db);

  const channels: string[] = ["in-app"];
  if (user.email && user.email.includes("@")) {
    try {
      const result = await sendAssignmentNotification(report, user.email);
      if (result?.delivered) channels.push("email");
    } catch {
      // Email is best-effort; in-app notification is already recorded.
    }
  }
  if (user.phone) {
    try {
      const sent = await sendSmsNotification(report, user.phone);
      if (sent) channels.push("sms");
    } catch {
      // SMS is best-effort.
    }
  }

  // Mark which channels were attempted for traceability.
  if (channels.length > 1) {
    db.prepare("UPDATE notifications SET channel = ? WHERE id = ?").run([channels.join("+"), notificationId]);
    await saveDb(db);
  }
}

router.patch("/:id/assign", async (req: Request, res: Response) => {
  const db = await getDb();
  const body = req.body as { assignedTo?: string; assignedToCopy?: string[]; assignedBy?: string };
  const id = routeParam(req, "id");
  const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]) as any | undefined;
  if (!row) return res.status(404).json({ error: "Not found" });

  const actorEmail = (req as any).user?.email as string | undefined;
  const actorName = (req as any).user?.name as string | undefined;
  // The acting user may be supplied explicitly (assignedBy) by the frontend, which is
  // auth-system agnostic, or derived from an authenticated request.
  const assignedByRaw = (body as any).assignedBy || actorEmail || actorName;
  const actor = actorName || (typeof assignedByRaw === "string" ? assignedByRaw : "") || "System";

  const assignedToRaw = body.assignedTo !== undefined ? body.assignedTo : row.assignedTo;
  const copyRawArray = parseAssignedToCopy(body.assignedToCopy !== undefined ? body.assignedToCopy : row.assignedToCopy);

  const supervisor = await resolveAssignee(assignedToRaw || "");
  const copiedUsers = await Promise.all(copyRawArray.map((cc) => resolveAssignee(cc)));

  // Persist display names on the report (keeps the dashboard compatible).
  const assignedToName = supervisor?.name || assignedToRaw || "";
  const copyNames = copiedUsers.map((u) => u?.name || "").filter(Boolean);
  const copyJson = JSON.stringify(copyNames);

  db.prepare("UPDATE reports SET assignedTo = ?, assignedToCopy = ? WHERE id = ?").run([
    assignedToName,
    copyJson,
    id,
  ]);
  await saveDb(db);

  const updated = rowMapper(db, { ...row, assignedTo: assignedToName, assignedToCopy: copyJson });

  const copyDetail = copyNames.length > 0 ? ` · Copied to: ${copyNames.join(", ")}` : "";
  db.prepare(
    "INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run([
    `AUD-${Date.now()}`,
    updated.id,
    actor,
    "Assignment updated",
    `Assigned to: ${assignedToName || "Unassigned"}${copyDetail}`,
    new Date().toISOString(),
  ]);
  await saveDb(db);

  // Build the notification targets, de-duplicated by email (case-insensitive).
  // 1. The responsible supervisor (To)
  // 2. Each copied recipient (Cc)
  // 3. The admin who performed the assignment (notified back about the task)
  const targetsByEmail = new Map<string, { user: AppUser; audiences: string[] }>();

  function addTarget(user: AppUser | null, audience: string) {
    if (!user) return;
    const key = (user.email || user.id || user.name).toLowerCase();
    const existing = targetsByEmail.get(key);
    if (existing) {
      if (!existing.audiences.includes(audience)) existing.audiences.push(audience);
    } else {
      targetsByEmail.set(key, { user, audiences: [audience] });
    }
  }

  if (supervisor) addTarget(supervisor, "the responsible supervisor (To)");
  for (const cc of copiedUsers) addTarget(cc, "a copied recipient (Cc)");

  if (assignedByRaw) {
    const assigner = await findUserByIdentifier(String(assignedByRaw));
    if (assigner) addTarget(assigner, "the administrator who assigned this task");
  }

  for (const { user, audiences } of targetsByEmail.values()) {
    await notifyAssignmentTarget(updated, user, audiences.join(" and "));
  }

  broadcastReport(updated);
  res.json(updated);
});

// NOTE: For brevity, the rest of the routes are identical to the original file.
// Keep them in sync if you use this module directly.

export { broadcastReport, broadcastStats };
export default router;

