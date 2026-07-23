import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { sendTestEmail, TestEmailSchema } from "../lib/email.js";
import type { SettingsPayload } from "../lib/types.js";
import { authenticateUser, requirePermission } from "../shared/middleware/auth.middleware.js";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

const router = Router();
const KEY = "app_settings";
const IntegrationTestSchema = z.object({
  type: z.enum(["slack", "teams", "zapier"]),
  url: z.string().trim().optional(),
});

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
  accessMatrix: z.record(z.record(z.boolean())).optional(),
  importHistory: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        imported: z.number(),
        skipped: z.number(),
        at: z.string(),
        message: z.string(),
      }),
    )
    .optional(),
  notificationLogs: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        title: z.string(),
        message: z.string(),
        at: z.string(),
      }),
    )
    .optional(),
  auditLog: z
    .array(
      z.object({
        id: z.string(),
        at: z.string(),
        actor: z.string(),
        action: z.string(),
      }),
    )
    .optional(),
  integrations: z
    .object({
      googleFormId: z.string(),
      googleApiKey: z.string(),
      googleSheetName: z.string(),
      googleDriveFileId: z.string(),
      slackWebhook: z.string(),
      teamsWebhook: z.string(),
      zapierKey: z.string(),
    })
    .optional(),
  notificationContacts: z
    .object({
      email: z.string(),
      phone: z.string(),
      whatsapp: z.string(),
      criticalOnly: z.boolean(),
      frequency: z.string(),
    })
    .optional(),
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
    accessMatrix: {},
    importHistory: [],
    notificationLogs: [],
    auditLog: [],
    integrations: {
      googleFormId: "",
      googleApiKey: "",
      googleSheetName: "",
      googleDriveFileId: "",
      slackWebhook: "",
      teamsWebhook: "",
      zapierKey: "",
    },
    notificationContacts: {
      email: process.env.DEFAULT_NOTIFICATION_EMAIL || "",
      phone: "",
      whatsapp: "",
      criticalOnly: true,
      frequency: "weekly",
    },
  };
}

function isAllowedWebhookUrl(value: string) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return false;
    return true;
  } catch {
    return false;
  }
}

async function getStoredSettings() {
  const result = await pgPool.query<{ value: SettingsPayload }>(
    "SELECT value FROM app_settings WHERE key = $1",
    [KEY],
  );
  return result.rows[0]?.value ?? getDefaults();
}

router.get("/", authenticateUser, requirePermission("settings:read"), async (_req: Request, res: Response) => {
  return res.json(await getStoredSettings());
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

router.post(
  "/test-integration",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const parsed = IntegrationTestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const settings = await getStoredSettings();
    const integrationType = parsed.data.type;
    const storedIntegrations = settings.integrations ?? getDefaults().integrations!;
    const configuredUrl =
      parsed.data.url ||
      (integrationType === "slack"
        ? storedIntegrations.slackWebhook
        : integrationType === "teams"
          ? storedIntegrations.teamsWebhook
          : storedIntegrations.zapierKey);

    if (!configuredUrl) {
      return res.status(400).json({
        ok: false,
        delivered: false,
        type: integrationType,
        message: `No ${integrationType} endpoint is configured`,
      });
    }

    if (!isAllowedWebhookUrl(configuredUrl)) {
      return res.status(400).json({
        ok: false,
        delivered: false,
        type: integrationType,
        message:
          integrationType === "zapier"
            ? "Zapier testing requires a valid HTTPS webhook URL"
            : `The configured ${integrationType} webhook must be a valid HTTPS URL`,
      });
    }

    const payload =
      integrationType === "teams"
        ? {
            "@type": "MessageCard",
            "@context": "https://schema.org/extensions",
            summary: "Crown Paints EHS integration test",
            themeColor: "0078D7",
            title: "Crown Paints EHS integration test",
            text: "This is a live integration test from the admin settings page.",
          }
        : {
            text: `Crown Paints EHS integration test at ${new Date().toISOString()}`,
            source: "admin-settings",
          };

    try {
      const response = await fetch(configuredUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return res.status(502).json({
          ok: false,
          delivered: false,
          type: integrationType,
          message: `${integrationType} test failed with HTTP ${response.status}`,
        });
      }

      return res.json({
        ok: true,
        delivered: true,
        type: integrationType,
        message: `${integrationType} integration test delivered successfully`,
      });
    } catch (error) {
      return res.status(502).json({
        ok: false,
        delivered: false,
        type: integrationType,
        message: error instanceof Error ? error.message : `Failed to reach ${integrationType} endpoint`,
      });
    }
  },
);

export default router;
