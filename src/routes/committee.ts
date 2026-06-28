import { Router, type Request, type Response } from "express";
import { isFirebaseAvailable, getFirebase } from "../lib/firebase.js";
import { getDb, saveDb } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import { sendTestEmail } from "../lib/email.js";

const router = Router();
const KEY = "she_committee_members";

export async function getCommitteeMembers() {
  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("settings").doc(KEY).get();
    if (!doc.exists) return [];
    try {
      const members = doc.data()?.members;
      return Array.isArray(members) ? members.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  }

  const db = await getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject([KEY]) as { value?: string } | undefined;
  if (!row || !row.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

router.get("/", async (_req: Request, res: Response) => {
  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    const doc = await db.collection("settings").doc(KEY).get();
    if (!doc.exists) return res.json([]);
    try { return res.json(doc.data()?.members ?? []); } catch { return res.json([]); }
  }

  const db = await getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject([KEY]) as { value?: string } | undefined;
  if (!row || !row.value) return res.json([]);
  try { return res.json(JSON.parse(row.value)); } catch { return res.json([]); }
});

router.put("/", async (req: Request, res: Response) => {
  const members = Array.isArray(req.body) ? req.body : [];
  if (isFirebaseAvailable()) {
    const db = getFirebase()!;
    await db.collection("settings").doc(KEY).set({ members });
    return res.json({ members });
  }

  const db = await getDb();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run([KEY, JSON.stringify(members)]);
  await saveDb(db);
  res.json({ members });
});

router.post("/test", async (req: Request, res: Response) => {
  const payload = Array.isArray(req.body) ? req.body : [];
  const subject = (req.query.subject as string) || "SHE Committee Test Notification";
  const message = (req.query.message as string) || "This is a test notification for the SHE committee.";

  const db = await getDb();
  const now = new Date().toISOString();
  let sent = 0;
  for (const recipient of payload) {
    try {
      const to = String(recipient);
      const result = await sendTestEmail({ to, subject, message });
      if (result?.delivered) {
        sent += 1;
        continue;
      }
    } catch (err) {
      // fallthrough to queue
    }

    const id = uuidv4();
    db.prepare(
      "INSERT OR REPLACE INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run([id, "", "email", String(recipient), subject, message, 0, now, 0]);
  }
  await saveDb(db);
  res.json({ ok: true, sent });
});

export default router;
