import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendTestEmail, TestEmailSchema } from "../lib/email.js";
import type { SettingsPayload } from "../lib/types.js";
import { authenticateUser, requirePermission } from "../shared/middleware/auth.middleware.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

const router = Router();
const KEY = "app_settings";

const defaultSchema = z.object({
  sites: z.array(z.string()),
  hazards: z.array(z.string()),
  severities: z.array(
    z.object({ name: z.string(), slaHours: z.number(), color: z.string() }),
  ),
  schedule: z.object({
    enabled: z.boolean(),
    freq: z.string(),
    email: z.string(),
  }),
});

function getDefaults(): SettingsPayload {
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

router.get("/", authenticateUser, requirePermission("settings:read"), async (_req: Request, res: Response) => {
  const result = await pgPool.query<{ value: SettingsPayload }>(
    "SELECT value FROM app_settings WHERE key = $1",
    [KEY],
  );
  return res.json(result.rows[0]?.value ?? getDefaults());
});

router.put("/", authenticateUser, requirePermission("settings:update"), async (req: Request, res: Response) => {
  const parsed = defaultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  await pgPool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify(parsed.data)],
  );
  res.json(parsed.data);
});

router.post(
  "/test-email",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const parsed = TestEmailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const result = await sendTestEmail(parsed.data);
    res.json(result);
  },
);

export default router;
