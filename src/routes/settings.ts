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
const IntegrationKeySchema = z.enum(["google-forms", "google-drive", "slack", "teams", "zapier"]);
const IntegrationSyncSchema = z.object({
  status: z.enum(["idle", "success", "failed"]),
  message: z.string().min(1).max(500),
});
const IntegrationConfigPatchSchema = z.object({
  googleFormId: z.string().trim().max(300).optional(),
  googleApiKey: z.string().trim().max(500).optional(),
  googleSheetName: z.string().trim().max(300).optional(),
  googleDriveFileId: z.string().trim().max(300).optional(),
  slackWebhook: z.string().trim().max(1000).optional(),
  teamsWebhook: z.string().trim().max(1000).optional(),
  zapierKey: z.string().trim().max(1000).optional(),
  clearSecrets: z.array(z.enum(["googleApiKey", "slackWebhook", "teamsWebhook", "zapierKey"])).optional(),
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
  integrationStatus: z.record(
    z.object({
      configured: z.boolean().optional(),
      lastTestAt: z.string().optional(),
      lastTestStatus: z.enum(["success", "failed"]).optional(),
      lastTestMessage: z.string().optional(),
      lastSyncAt: z.string().optional(),
      lastSyncStatus: z.enum(["idle", "success", "failed"]).optional(),
      lastSyncMessage: z.string().optional(),
      secretUpdatedAt: z.string().optional(),
      updatedBy: z.string().optional(),
    }),
  ).optional(),
  integrationHistory: z.array(
    z.object({
      id: z.string(),
      integration: z.string(),
      event: z.enum(["config.updated", "config.cleared", "test.success", "test.failed", "sync.recorded"]),
      status: z.enum(["success", "failed", "info"]),
      at: z.string(),
      actor: z.string(),
      message: z.string(),
    }),
  ).optional(),
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
    integrationStatus: {},
    integrationHistory: [],
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
  return {
    ...getDefaults(),
    ...(result.rows[0]?.value ?? {}),
  };
}

async function saveStoredSettings(settings: SettingsPayload) {
  await pgPool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [KEY, JSON.stringify(settings)],
  );
}

function actorName(req: Request) {
  const user = (req as Request & { user?: { name?: string; email?: string } }).user;
  return user?.name || user?.email || "System";
}

function maskSecret(value: string, visible = 4) {
  if (!value) return "";
  if (value.length <= visible) return "*".repeat(value.length);
  return `${"*".repeat(Math.max(4, value.length - visible))}${value.slice(-visible)}`;
}

function summarizeIntegrations(settings: SettingsPayload) {
  const integrations = settings.integrations ?? getDefaults().integrations!;
  const statuses = settings.integrationStatus ?? {};
  const map = [
    {
      key: "google-forms",
      label: "Google Forms",
      configured: Boolean(integrations.googleFormId && integrations.googleApiKey && integrations.googleSheetName),
      summary: integrations.googleFormId ? `Sheet ${integrations.googleSheetName || "configured"}` : "Not configured",
      secrets: { googleApiKey: maskSecret(integrations.googleApiKey) },
    },
    {
      key: "google-drive",
      label: "Google Drive",
      configured: Boolean(integrations.googleDriveFileId),
      summary: integrations.googleDriveFileId ? `File ${maskSecret(integrations.googleDriveFileId, 6)}` : "Not configured",
      secrets: {},
    },
    {
      key: "slack",
      label: "Slack",
      configured: Boolean(integrations.slackWebhook),
      summary: integrations.slackWebhook ? maskSecret(integrations.slackWebhook, 8) : "Not configured",
      secrets: { slackWebhook: maskSecret(integrations.slackWebhook, 8) },
    },
    {
      key: "teams",
      label: "Microsoft Teams",
      configured: Boolean(integrations.teamsWebhook),
      summary: integrations.teamsWebhook ? maskSecret(integrations.teamsWebhook, 8) : "Not configured",
      secrets: { teamsWebhook: maskSecret(integrations.teamsWebhook, 8) },
    },
    {
      key: "zapier",
      label: "Zapier",
      configured: Boolean(integrations.zapierKey),
      summary: integrations.zapierKey ? maskSecret(integrations.zapierKey, 8) : "Not configured",
      secrets: { zapierKey: maskSecret(integrations.zapierKey, 8) },
    },
  ] as const;

  return map.map((entry) => ({
    ...entry,
    health: statuses[entry.key] ?? {
      configured: entry.configured,
      lastSyncStatus: "idle" as const,
    },
  }));
}

function appendIntegrationHistory(
  settings: SettingsPayload,
  entry: NonNullable<SettingsPayload["integrationHistory"]>[number],
) {
  const history = settings.integrationHistory ?? [];
  return [entry, ...history].slice(0, 50);
}

router.get("/", authenticateUser, requirePermission("settings:read"), async (_req: Request, res: Response) => {
  return res.json({ data: await getStoredSettings() });
});

router.put("/", authenticateUser, requirePermission("settings:update"), async (req: Request, res: Response) => {
  const parsed = defaultSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

  await saveStoredSettings(parsed.data);
  res.json({ data: parsed.data });
});

router.get(
  "/integrations",
  authenticateUser,
  requirePermission("settings:read"),
  async (_req: Request, res: Response) => {
    const settings = await getStoredSettings();
    res.json({ data: summarizeIntegrations(settings), history: settings.integrationHistory ?? [] });
  },
);

router.patch(
  "/integrations/:integration",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const integration = IntegrationKeySchema.safeParse(req.params.integration);
    if (!integration.success) return res.status(400).json({ error: integration.error.errors });
    const patch = IntegrationConfigPatchSchema.safeParse(req.body);
    if (!patch.success) return res.status(400).json({ error: patch.error.errors });

    const settings = await getStoredSettings();
    const next = {
      ...settings,
      integrations: {
        ...(settings.integrations ?? getDefaults().integrations!),
      },
      integrationStatus: {
        ...(settings.integrationStatus ?? {}),
      },
    } satisfies SettingsPayload;

    const clearSecrets = new Set(patch.data.clearSecrets ?? []);
    for (const [key, value] of Object.entries(patch.data)) {
      if (key === "clearSecrets" || value === undefined) continue;
      (next.integrations as Record<string, string>)[key] = String(value);
    }
    for (const secret of clearSecrets) {
      (next.integrations as Record<string, string>)[secret] = "";
    }

    const statusEntry = {
      ...(next.integrationStatus?.[integration.data] ?? {}),
      configured: Boolean(
        integration.data === "google-forms"
          ? next.integrations?.googleFormId && next.integrations?.googleApiKey && next.integrations?.googleSheetName
          : integration.data === "google-drive"
            ? next.integrations?.googleDriveFileId
            : integration.data === "slack"
              ? next.integrations?.slackWebhook
              : integration.data === "teams"
                ? next.integrations?.teamsWebhook
                : next.integrations?.zapierKey,
      ),
      secretUpdatedAt: new Date().toISOString(),
      updatedBy: actorName(req),
    };
    next.integrationStatus![integration.data] = statusEntry;
    next.integrationHistory = appendIntegrationHistory(next, {
      id: `int-${Date.now()}`,
      integration: integration.data,
      event: clearSecrets.size ? "config.cleared" : "config.updated",
      status: "info",
      at: new Date().toISOString(),
      actor: actorName(req),
      message: clearSecrets.size
        ? `Updated configuration and cleared ${Array.from(clearSecrets).join(", ")}`
        : "Updated integration configuration",
    });

    await saveStoredSettings(next);
    res.json({ data: summarizeIntegrations(next).find((item) => item.key === integration.data) });
  },
);

router.post(
  "/test-email",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const parsed = TestEmailSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const result = await sendTestEmail(parsed.data);
    res.json({ data: result });
  },
);

router.post(
  "/test-integration",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const parsed = IntegrationTestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const storedSettings = await getStoredSettings();
    const integrationType = parsed.data.type;
    const storedIntegrations = storedSettings.integrations ?? getDefaults().integrations!;
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

    const updatedSettings = {
      ...storedSettings,
      integrationStatus: { ...(storedSettings.integrationStatus ?? {}) },
    } satisfies SettingsPayload;

    try {
      const response = await fetch(configuredUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        updatedSettings.integrationStatus![integrationType] = {
          ...(updatedSettings.integrationStatus?.[integrationType] ?? {}),
          configured: true,
          lastTestAt: new Date().toISOString(),
          lastTestStatus: "failed",
          lastTestMessage: `${integrationType} test failed with HTTP ${response.status}`,
          updatedBy: actorName(req),
        };
        updatedSettings.integrationHistory = appendIntegrationHistory(updatedSettings, {
          id: `int-${Date.now()}`,
          integration: integrationType,
          event: "test.failed",
          status: "failed",
          at: new Date().toISOString(),
          actor: actorName(req),
          message: `${integrationType} test failed with HTTP ${response.status}`,
        });
        await saveStoredSettings(updatedSettings);
        return res.status(502).json({
          ok: false,
          delivered: false,
          type: integrationType,
          message: `${integrationType} test failed with HTTP ${response.status}`,
        });
      }

      updatedSettings.integrationStatus![integrationType] = {
        ...(updatedSettings.integrationStatus?.[integrationType] ?? {}),
        configured: true,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: "success",
        lastTestMessage: `${integrationType} integration test delivered successfully`,
        updatedBy: actorName(req),
      };
      updatedSettings.integrationHistory = appendIntegrationHistory(updatedSettings, {
        id: `int-${Date.now()}`,
        integration: integrationType,
        event: "test.success",
        status: "success",
        at: new Date().toISOString(),
        actor: actorName(req),
        message: `${integrationType} integration test delivered successfully`,
      });
      await saveStoredSettings(updatedSettings);
      return res.json({
        data: {
          ok: true,
          delivered: true,
          type: integrationType,
          message: `${integrationType} integration test delivered successfully`,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to reach ${integrationType} endpoint`;
      updatedSettings.integrationStatus![integrationType] = {
        ...(updatedSettings.integrationStatus?.[integrationType] ?? {}),
        configured: true,
        lastTestAt: new Date().toISOString(),
        lastTestStatus: "failed",
        lastTestMessage: message,
        updatedBy: actorName(req),
      };
      updatedSettings.integrationHistory = appendIntegrationHistory(updatedSettings, {
        id: `int-${Date.now()}`,
        integration: integrationType,
        event: "test.failed",
        status: "failed",
        at: new Date().toISOString(),
        actor: actorName(req),
        message,
      });
      await saveStoredSettings(updatedSettings);
      return res.status(502).json({
        ok: false,
        delivered: false,
        type: integrationType,
        message,
      });
    }
  },
);

router.post(
  "/integrations/:integration/sync",
  authenticateUser,
  requirePermission("settings:update"),
  async (req: Request, res: Response) => {
    const integration = IntegrationKeySchema.safeParse(req.params.integration);
    if (!integration.success) return res.status(400).json({ error: integration.error.errors });
    const parsed = IntegrationSyncSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });

    const settings = await getStoredSettings();
    const next = {
      ...settings,
      integrationStatus: { ...(settings.integrationStatus ?? {}) },
    } satisfies SettingsPayload;

    next.integrationStatus![integration.data] = {
      ...(next.integrationStatus?.[integration.data] ?? {}),
      configured: next.integrationStatus?.[integration.data]?.configured ?? true,
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: parsed.data.status,
      lastSyncMessage: parsed.data.message,
      updatedBy: actorName(req),
    };
    next.integrationHistory = appendIntegrationHistory(next, {
      id: `int-${Date.now()}`,
      integration: integration.data,
      event: "sync.recorded",
      status: parsed.data.status === "failed" ? "failed" : parsed.data.status === "success" ? "success" : "info",
      at: new Date().toISOString(),
      actor: actorName(req),
      message: parsed.data.message,
    });
    await saveStoredSettings(next);
    res.json({ data: next.integrationStatus[integration.data] });
  },
);

export default router;
