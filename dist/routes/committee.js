import { Router } from "express";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore } from "../lib/firebase.js";
import { getDb, saveDb } from "../lib/database.js";
import { v4 as uuidv4 } from "uuid";
import { sendTestEmail } from "../lib/email.js";
const router = Router();
const KEY = "she_committee_members";
export async function getCommitteeMembers() {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("settings").doc(KEY).get();
        if (!doc.exists)
            return [];
        try {
            const members = doc.data()?.members;
            return Array.isArray(members) ? members.filter((item) => typeof item === "string") : [];
        }
        catch {
            return [];
        }
    }
    const db = await getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject([KEY]);
    if (!row || !row.value)
        return [];
    try {
        const parsed = JSON.parse(row.value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    }
    catch {
        return [];
    }
}
router.get("/", async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("settings").doc(KEY).get();
        if (!doc.exists)
            return res.json([]);
        try {
            return res.json(doc.data()?.members ?? []);
        }
        catch {
            return res.json([]);
        }
    }
    const db = await getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject([KEY]);
    if (!row || !row.value)
        return res.json([]);
    try {
        return res.json(JSON.parse(row.value));
    }
    catch {
        return res.json([]);
    }
});
router.put("/", async (req, res) => {
    const members = Array.isArray(req.body) ? req.body : [];
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        await db.collection("settings").doc(KEY).set(sanitizeForFirestore({ members }));
        return res.json({ members });
    }
    const db = await getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run([KEY, JSON.stringify(members)]);
    await saveDb(db);
    res.json({ members });
});
router.post("/test", async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body : [];
    const subject = String(String(req.query.subject)) || "SHE Committee Test Notification";
    const message = String(String(req.query.message)) || "This is a test notification for the SHE committee.";
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
        }
        catch (err) {
            // fallthrough to queue
        }
        const id = uuidv4();
        db.prepare("INSERT OR REPLACE INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run([id, "", "email", String(recipient), subject, message, 0, now, 0]);
    }
    await saveDb(db);
    res.json({ ok: true, sent });
});
export default router;
