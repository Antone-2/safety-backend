import { Router, type Request, type Response } from "express";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { authMiddleware } from "./auth.js";

const router = Router();

export interface NotificationSummary {
  id: string;
  reportId: string;
  channel: string;
  recipient: string;
  subject: string;
  message: string;
  delivered: boolean;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(): Promise<NotificationSummary[]> {
  const db = await getDb();
  const rows = allRows(
    db,
    "SELECT id, reportId, channel, recipient, subject, message, delivered, createdAt, COALESCE(read, 0) as read FROM notifications ORDER BY createdAt DESC",
  ) as Array<Record<string, unknown>>;

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

export async function markNotificationsRead(ids: string[]) {
  if (!ids.length) return;
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
  db.prepare(`UPDATE notifications SET read = 1 WHERE id IN (${placeholders})`).run(ids);
  await saveDb(db);
}

router.get("/", authMiddleware, async (_req: Request, res: Response) => {
  const notifications = await listNotifications();
  res.json(notifications);
});

router.post("/read", authMiddleware, async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  await markNotificationsRead(ids.filter((item: unknown): item is string => typeof item === "string"));
  res.json({ ok: true });
});

export default router;
