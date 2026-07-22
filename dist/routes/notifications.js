import { Router } from "express";
import { authenticateUser, } from "../shared/middleware/auth.middleware.js";
import { requireRole } from "../middleware/auth.js";
import { notificationCenterService } from "../services/notification-center.service.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
const router = Router();
export async function listNotifications() {
    const result = await pgPool.query(`SELECT nr.id, nj.resource_id AS report_id, nr.channel, nr.recipient,
            COALESCE(nj.payload->>'subject', nj.event_key) AS subject,
            COALESCE(nj.payload->>'message', '') AS message,
            (nr.status = 'delivered') AS delivered,
            (nr.read_at IS NOT NULL) AS read,
            nr.created_at
     FROM notification_recipients nr
     JOIN notification_jobs nj ON nj.id = nr.job_id
     ORDER BY nr.created_at DESC`);
    return result.rows.map((row) => ({
        id: String(row.id ?? ""),
        reportId: String(row.report_id ?? ""),
        channel: String(row.channel ?? ""),
        recipient: String(row.recipient ?? ""),
        subject: String(row.subject ?? ""),
        message: String(row.message ?? ""),
        delivered: Boolean(row.delivered),
        read: Boolean(row.read),
        createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    }));
}
export async function markNotificationsRead(ids) {
    if (!ids.length)
        return;
    await pgPool.query("UPDATE notification_recipients SET read_at = NOW(), updated_at = NOW() WHERE id = ANY($1::uuid[])", [ids]);
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
router.get("/digests", authenticateUser, async (req, res) => {
    const digests = await notificationCenterService.listDigests({ userId: req.user?.id });
    res.json(digests);
});
router.patch("/digests/:id", authenticateUser, async (req, res) => {
    const id = String(req.params.id);
    const existing = await pgPool.query("SELECT * FROM notification_digest_subscriptions WHERE id = $1", [id]);
    const row = existing.rows[0];
    if (!row)
        return res.status(404).json({ error: "Digest subscription not found" });
    if (row.user_id !== req.user?.id && req.user?.role !== "super-admin") {
        return res.status(403).json({ error: "Forbidden" });
    }
    const updated = await notificationCenterService.updateDigest(id, {
        cadence: req.body.cadence,
        channels: req.body.channels,
        active: req.body.active,
    });
    res.json(updated);
});
router.delete("/digests/:id", authenticateUser, async (req, res) => {
    const id = String(req.params.id);
    const existing = await pgPool.query("SELECT * FROM notification_digest_subscriptions WHERE id = $1", [id]);
    const row = existing.rows[0];
    if (!row)
        return res.status(404).json({ error: "Digest subscription not found" });
    if (row.user_id !== req.user?.id && req.user?.role !== "super-admin") {
        return res.status(403).json({ error: "Forbidden" });
    }
    await notificationCenterService.deleteDigest(id);
    res.json({ ok: true });
});
export default router;
