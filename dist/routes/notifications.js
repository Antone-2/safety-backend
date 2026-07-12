import { Router } from "express";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { authenticateUser, } from "../shared/middleware/auth.middleware.js";
import { requireRole } from "../middleware/auth.js";
import { notificationCenterService } from "../services/notification-center.service.js";
const router = Router();
export async function listNotifications() {
    const db = await getDb();
    const rows = allRows(db, "SELECT id, reportId, channel, recipient, subject, message, delivered, createdAt, COALESCE(read, 0) as read FROM notifications ORDER BY createdAt DESC");
    return rows.map((row) => ({
        id: String(row.id ?? ""),
        reportId: String(row.reportId ?? ""),
        channel: String(row.channel ?? ""),
        recipient: String(row.recipient ?? ""),
        subject: String(row.subject ?? ""),
        message: String(row.message ?? ""),
        delivered: Boolean(row.delivered),
        read: Boolean(row.read),
        createdAt: String(row.createdAt ?? ""),
    }));
}
export async function markNotificationsRead(ids) {
    if (!ids.length)
        return;
    const db = await getDb();
    const placeholders = ids.map(() => "?").join(",");
    db.prepare(`UPDATE notifications SET read = 1 WHERE id IN (${placeholders})`).run(ids);
    await saveDb(db);
}
router.get("/", authenticateUser, async (req, res) => {
    const notifications = await listNotifications();
    const privileged = req.user?.role === "super-admin" || req.user?.role === "EHS-manager";
    res.json(privileged
        ? notifications
        : notifications.filter((item) => [req.user?.email, req.user?.name].includes(item.recipient)));
});
router.post("/read", authenticateUser, async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    const allowed = (await listNotifications())
        .filter((item) => req.user?.role === "super-admin" ||
        req.user?.role === "EHS-manager" ||
        [req.user?.email, req.user?.name].includes(item.recipient))
        .map((item) => item.id);
    await markNotificationsRead(ids.filter((item) => typeof item === "string" && allowed.includes(item)));
    res.json({ ok: true });
});
router.get("/templates", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const templates = await notificationCenterService.listTemplates();
    res.json(templates);
});
router.post("/templates", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    const template = await notificationCenterService.upsertTemplate(req.body, req.user);
    res.status(201).json(template);
});
router.post("/enqueue", authenticateUser, requireRole(["super-admin", "EHS-manager", "hse-officer"]), async (req, res) => {
    const job = await notificationCenterService.enqueue({
        eventKey: String(req.body.eventKey),
        workflow: req.body.workflow,
        resourceType: req.body.resourceType,
        resourceId: req.body.resourceId,
        payload: req.body.payload || {},
        recipients: Array.isArray(req.body.recipients) ? req.body.recipients : [],
        createdBy: req.user?.email || req.user?.name || "System",
        maxAttempts: Number(req.body.maxAttempts || 3),
    });
    res.status(201).json(job);
});
router.post("/process-due", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    const result = await notificationCenterService.processDue(Number(req.body.limit || 25));
    res.json({ processed: result });
});
router.get("/jobs", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    const jobs = await notificationCenterService.listJobs({
        status: typeof req.query.status === "string" ? req.query.status : undefined,
        limit: typeof req.query.limit === "string" ? Number(req.query.limit) : 100,
    });
    res.json(jobs);
});
router.get("/jobs/:id/recipients", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
    const recipients = await notificationCenterService.listRecipients(String(req.params.id));
    res.json(recipients);
});
router.get("/delivery-status", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const recipients = await notificationCenterService.listRecipients();
    res.json(recipients);
});
router.get("/dashboard", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
    const dashboard = await notificationCenterService.dashboard();
    res.json(dashboard);
});
router.post("/digests", authenticateUser, async (req, res) => {
    const digest = await notificationCenterService.createDigest({
        recipient: String(req.body.recipient || req.user?.email || ""),
        userId: req.user?.id,
        cadence: req.body.cadence,
        channels: req.body.channels,
    });
    res.status(201).json(digest);
});
export default router;
