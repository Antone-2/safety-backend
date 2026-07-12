import { Router } from "express";
import { z } from "zod";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore } from "../lib/firebase.js";
import { getDb, saveDb } from "../lib/database.js";
import { sendTestEmail, TestEmailSchema } from "../lib/email.js";
import { authenticateUser, requirePermission } from "../shared/middleware/auth.middleware.js";
const router = Router();
const KEY = "app_settings";
const defaultSchema = z.object({
    sites: z.array(z.string()),
    hazards: z.array(z.string()),
    severities: z.array(z.object({ name: z.string(), slaHours: z.number(), color: z.string() })),
    schedule: z.object({
        enabled: z.boolean(),
        freq: z.string(),
        email: z.string(),
    }),
});
function getDefaults() {
    return {
        sites: [
            "Mogadishu - Factory", "Nakuru - Depot", "Sinai - Export Warehouse",
            "Likoni - Head Office & Warehouse", "Mombasa - Factory", "Kenpoly - Depot",
        ],
        hazards: [
            "Slip / Trip", "Chemical Spill", "PPE Violation", "Electrical",
            "Falling Object", "Vehicle / Forklift", "Inhalation / Fumes",
            "Fire / Ignition", "Manual Handling", "Noise Exposure",
        ],
        severities: [
            { name: "Low", slaHours: 168, color: "#10b981" },
            { name: "Medium", slaHours: 96, color: "#f59e0b" },
            { name: "High", slaHours: 48, color: "#f97316" },
            { name: "Critical", slaHours: 24, color: "#ef4444" },
        ],
        schedule: { enabled: true, freq: "weekly", email: process.env.DEFAULT_NOTIFICATION_EMAIL || "" },
    };
}
router.get("/", authenticateUser, requirePermission("settings:read"), async (_req, res) => {
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        const doc = await db.collection("settings").doc(KEY).get();
        if (!doc.exists)
            return res.json(getDefaults());
        try {
            return res.json(doc.data());
        }
        catch {
            return res.json(getDefaults());
        }
    }
    const db = await getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").getAsObject([KEY]);
    if (!row)
        return res.json(getDefaults());
    try {
        return res.json(JSON.parse(row.value));
    }
    catch {
        return res.json(getDefaults());
    }
});
router.put("/", authenticateUser, requirePermission("settings:update"), async (req, res) => {
    const parsed = defaultSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    if (isFirebaseAvailable()) {
        const db = getFirebase();
        await db.collection("settings").doc(KEY).set(sanitizeForFirestore(parsed.data));
        return res.json(parsed.data);
    }
    const db = await getDb();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run([KEY, JSON.stringify(parsed.data)]);
    await saveDb(db);
    res.json(parsed.data);
});
router.post("/test-email", authenticateUser, requirePermission("settings:update"), async (req, res) => {
    const parsed = TestEmailSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.errors });
    const result = await sendTestEmail(parsed.data);
    res.json(result);
});
export default router;
