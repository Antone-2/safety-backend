import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { StatusSchema, CreateReportSchema } from "../lib/types.js";
import { sendIncidentNotification } from "../lib/email.js";
import { describeFieldChanges } from "../lib/audit.js";
import { getPlaceholderImageUrl } from "../lib/config.js";
const router = Router();
const sseClients = new Map();
function broadcastReport(report) {
    const payload = `event: report\ndata: ${JSON.stringify(report)}\n\n`;
    for (const client of sseClients.values()) {
        client.res.write(payload);
    }
}
function broadcastStats(stats) {
    const payload = `event: stats\ndata: ${JSON.stringify(stats)}\n\n`;
    for (const client of sseClients.values()) {
        client.res.write(payload);
    }
}
function getPlaceholderPhotoUrl(id, size = 80) {
    const shortId = String(id ?? "").slice(-3) || "N/A";
    return getPlaceholderImageUrl(shortId, size);
}
const mapRow = (row, comments) => ({
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
const fetchComments = (db, reportId) => {
    return allRows(db, "SELECT author, at, text FROM comments WHERE reportId = ? ORDER BY at ASC", [reportId]);
};
const fetchAudit = (db, reportId) => {
    return allRows(db, "SELECT actor, action, detail, createdAt FROM report_audit WHERE reportId = ? ORDER BY createdAt DESC", [reportId]);
};
const rowMapper = (db, row) => {
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
function normalizeReportField(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}
function reportDedupeKey(row) {
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
function dedupeReports(rows) {
    const byKey = new Map();
    for (const row of rows) {
        const key = reportDedupeKey(row);
        const existing = byKey.get(key);
        if (!existing || new Date(row.date).getTime() >= new Date(existing.date).getTime()) {
            byKey.set(key, row);
        }
    }
    return Array.from(byKey.values());
}
const routeParam = (req, name) => {
    const value = req.params[name];
    return Array.isArray(value) ? value[0] : (value ?? "");
};
const queryString = (value) => typeof value === "string" ? value : undefined;
router.get("/", async (req, res) => {
    const db = await getDb();
    const status = queryString(req.query.status);
    const severity = queryString(req.query.severity);
    const location = queryString(req.query.location);
    const days = queryString(req.query.days);
    const search = queryString(req.query.search);
    const category = queryString(req.query.category);
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    let sql = "SELECT * FROM reports WHERE 1=1";
    const countSql = "SELECT COUNT(*) as total FROM reports WHERE 1=1";
    const params = [];
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
    if (search) {
        sql += " AND (description LIKE ? OR reporter LIKE ? OR id LIKE ?)";
        const q = `%${search}%`;
        params.push(q, q, q);
    }
    const totalResult = db.prepare(countSql).getAsObject(params);
    const total = Number(totalResult.c ?? 0);
    sql += " ORDER BY date DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const rows = allRows(db, sql, params);
    const dedupedRows = dedupeReports(rows);
    const mapped = dedupedRows.map((row) => rowMapper(db, row));
    res.json({ data: mapped, total, page, limit });
});
router.get("/stats", async (_req, res) => {
    const db = await getDb();
    const total = Number(db.prepare("SELECT COUNT(*) as c FROM reports").getAsObject().c ?? 0);
    const open = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Open'").getAsObject().c ?? 0);
    const closed = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'").getAsObject().c ?? 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([today.toISOString()]).c ?? 0);
    const week = new Date();
    week.setDate(week.getDate() - 7);
    const weekCount = Number(db.prepare("SELECT COUNT(*) as c FROM reports WHERE date >= ?").getAsObject([week.toISOString()]).c ?? 0);
    const closedRows = allRows(db, "SELECT resolutionDays FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL");
    const avg = closedRows.length ? +(closedRows.reduce((s, r) => s + Number(r.resolutionDays), 0) / closedRows.length).toFixed(1) : 0;
    res.json({ total, open, closed, today: todayCount, week: weekCount, avgResolution: avg });
});
router.get("/events", async (req, res) => {
    const origin = req.headers.origin;
    const allowedOrigin = typeof origin === "string" && /^(https?:\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin)
        ? origin
        : process.env.FRONTEND_URL || "*";
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
    const clientId = uuidv4();
    sseClients.set(clientId, { id: clientId, res: res });
    res.write(": connected\n\n");
    res.on("close", () => {
        sseClients.delete(clientId);
    });
    res.on("error", () => {
        sseClients.delete(clientId);
    });
});
router.get("/:id", async (req, res) => {
    const db = await getDb();
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    res.json(rowMapper(db, row));
});
router.post("/", async (req, res) => {
    const db = await getDb();
    const parsed = CreateReportSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const input = parsed.data;
    const id = `RPT-${String(Date.now()).slice(-5)}`;
    const now = new Date();
    const date = now.toISOString();
    const dueDate = new Date(now.getTime() + (input.severity === "Critical" ? 1 : input.severity === "High" ? 3 : 7) * 86400000);
    const slaHours = input.severity === "Critical" ? 24 : input.severity === "High" ? 72 : 168;
    const photoUrl = input.photoUrl?.trim() || getPlaceholderImageUrl(id.slice(-3), 80);
    const complianceRequired = Boolean(input.complianceRequired || input.severity === "Critical" || input.severity === "High");
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
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
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
        const settingsRow = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(["app_settings"]);
        const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;
        const recipient = settings?.schedule?.email || process.env.SMTP_FROM || process.env.DEFAULT_NOTIFICATION_EMAIL || "safety@crownpaints.co.ke";
        const result = await sendIncidentNotification(saved, recipient);
        const notificationId = `NOTIF-${Date.now()}`;
        db.prepare("INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run([notificationId, saved.id, result.mode, recipient, result.message.includes("Critical") || result.message.includes("High") ? `Incident alert: ${saved.id}` : "Incident alert", result.message, result.delivered ? 1 : 0, new Date().toISOString(), 0]);
        await saveDb(db);
    }
    broadcastReport(saved);
    res.status(201).json(saved);
});
router.patch("/:id/status", async (req, res) => {
    const db = await getDb();
    const { status } = req.body;
    const parsed = StatusSchema.safeParse(status);
    if (!parsed.success)
        return res.status(400).json({ error: "Invalid status" });
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
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
        const settingsRow = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject(["app_settings"]);
        const settings = settingsRow?.value ? JSON.parse(settingsRow.value) : null;
        const recipient = settings?.schedule?.email || process.env.SMTP_FROM || process.env.DEFAULT_NOTIFICATION_EMAIL || "safety@crownpaints.co.ke";
        const result = await sendIncidentNotification(updated, recipient);
        const notificationId = `NOTIF-${Date.now()}`;
        db.prepare("INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
            .run([notificationId, updated.id, result.mode, recipient, `Incident alert: ${updated.id}`, result.message, result.delivered ? 1 : 0, new Date().toISOString(), 0]);
        await saveDb(db);
    }
    broadcastReport(updated);
    res.json(updated);
});
router.patch("/:id/assign", async (req, res) => {
    const db = await getDb();
    const { assignedTo } = req.body;
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    db.prepare("UPDATE reports SET assignedTo = ? WHERE id = ?").run([assignedTo, id]);
    await saveDb(db);
    const updated = rowMapper(db, { ...row, assignedTo });
    db.prepare("INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
        `AUD-${Date.now()}`,
        updated.id,
        "System",
        "Assignment updated",
        `Assigned to: ${assignedTo || "Unassigned"}`,
        new Date().toISOString(),
    ]);
    await saveDb(db);
    broadcastReport(updated);
    res.json(updated);
});
router.post("/:id/comments", async (req, res) => {
    const db = await getDb();
    const { author, text } = req.body;
    if (!author || !text)
        return res.status(400).json({ error: "author and text required" });
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const commentId = uuidv4();
    const at = new Date().toISOString();
    db.prepare("INSERT INTO comments (id, reportId, author, at, text) VALUES (?, ?, ?, ?, ?)").run([commentId, id, author, at, text]);
    await saveDb(db);
    const updated = rowMapper(db, row);
    db.prepare("INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
        `AUD-${Date.now()}`,
        updated.id,
        author,
        "Comment added",
        text,
        at,
    ]);
    await saveDb(db);
    broadcastReport(updated);
    res.json(updated);
});
router.patch("/:id", async (req, res) => {
    const db = await getDb();
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    const { location, reporter, description, severity, category, type, department, shift, assignedTo, status, photoUrl } = req.body;
    const before = { ...row };
    const changes = {};
    if (location !== undefined) {
        changes.location = location;
        db.prepare("UPDATE reports SET location = ? WHERE id = ?").run([location, id]);
    }
    if (reporter !== undefined) {
        changes.reporter = reporter;
        db.prepare("UPDATE reports SET reporter = ? WHERE id = ?").run([reporter, id]);
    }
    if (description !== undefined) {
        changes.description = description;
        db.prepare("UPDATE reports SET description = ? WHERE id = ?").run([description, id]);
    }
    if (severity !== undefined) {
        changes.severity = severity;
        db.prepare("UPDATE reports SET severity = ? WHERE id = ?").run([severity, id]);
    }
    if (category !== undefined) {
        changes.category = category;
        db.prepare("UPDATE reports SET category = ? WHERE id = ?").run([category, id]);
    }
    if (type !== undefined) {
        changes.type = type;
        db.prepare("UPDATE reports SET type = ? WHERE id = ?").run([type, id]);
    }
    if (department !== undefined) {
        changes.department = department;
        db.prepare("UPDATE reports SET department = ? WHERE id = ?").run([department, id]);
    }
    if (shift !== undefined) {
        changes.shift = shift;
        db.prepare("UPDATE reports SET shift = ? WHERE id = ?").run([shift, id]);
    }
    if (assignedTo !== undefined) {
        changes.assignedTo = assignedTo;
        db.prepare("UPDATE reports SET assignedTo = ? WHERE id = ?").run([assignedTo, id]);
    }
    if (status !== undefined) {
        changes.status = status;
        db.prepare("UPDATE reports SET status = ? WHERE id = ?").run([status, id]);
    }
    if (photoUrl !== undefined) {
        changes.photoUrl = photoUrl;
        db.prepare("UPDATE reports SET photoUrl = ? WHERE id = ?").run([photoUrl, id]);
    }
    await saveDb(db);
    const updated = rowMapper(db, db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]));
    const detail = describeFieldChanges(before, { ...before, ...changes });
    if (detail) {
        db.prepare("INSERT INTO report_audit (id, reportId, actor, action, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run([
            `AUD-${Date.now()}`,
            updated.id,
            "You",
            "Report edited",
            detail,
            new Date().toISOString(),
        ]);
        await saveDb(db);
    }
    broadcastReport(updated);
    res.json(updated);
});
router.delete("/:id", async (req, res) => {
    const db = await getDb();
    const id = routeParam(req, "id");
    const row = db.prepare("SELECT * FROM reports WHERE id = ?").getAsObject([id]);
    if (!row)
        return res.status(404).json({ error: "Not found" });
    db.prepare("DELETE FROM comments WHERE reportId = ?").run([id]);
    db.prepare("DELETE FROM reports WHERE id = ?").run([id]);
    await saveDb(db);
    res.json({ ok: true, deleted: id });
});
router.post("/generate", async (_req, res) => {
    const db = await getDb();
    const rows = allRows(db, "SELECT * FROM reports ORDER BY date DESC");
    const headers = ["ID", "Date", "Location", "Reporter", "Severity", "Status", "Category", "Type", "Description", "AssignedTo"];
    const csv = [
        headers.join(","),
        ...rows.map(r => [
            r.id, r.date, r.location, r.reporter, r.severity, r.status, r.category, r.type,
            `"${r.description.replace(/"/g, '""')}"`, r.assignedTo ?? ""
        ].join(","))
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=crown-hse-reports-${new Date().toISOString().split("T")[0]}.csv`);
    res.send(csv);
});
router.get("/selection-export", async (req, res) => {
    const db = await getDb();
    const ids = req.query.ids;
    if (!ids || (Array.isArray(ids) && ids.length === 0)) {
        return res.status(400).json({ error: "ids query parameter required" });
    }
    const idList = Array.isArray(ids) ? ids : [ids];
    const placeholders = idList.map(() => "?").join(",");
    const rows = allRows(db, `SELECT * FROM reports WHERE id IN (${placeholders})`, idList);
    const headers = ["ID", "Date", "Location", "Reporter", "Department", "Shift", "Type", "Category", "Severity", "Status", "AssignedTo", "Description"];
    const csv = [
        headers.join(","),
        ...rows.map(r => [
            r.id, r.date, r.location, r.reporter, r.department, r.shift, r.type, r.category,
            r.severity, r.status, r.assignedTo ?? "", `"${r.description.replace(/"/g, '""')}"`
        ].join(","))
    ].join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=crown-hse-selection-${Date.now()}.csv`);
    res.send(csv);
});
export { broadcastReport, broadcastStats };
export default router;
