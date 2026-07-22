import { Router, type Request } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, requirePermission, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { sendCapaAssignmentNotifications, sendCapaReminder } from "../../lib/email.js";

const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
const CapaStatusSchema = z.enum(["Open", "In Progress", "Completed", "Overdue", "Cancelled"]);
const CapaTypeSchema = z.enum(["Corrective", "Preventive", "Improvement"]);
const CapaActionItemStatusSchema = z.enum(["Planned", "Assigned", "In Progress", "Completed", "Blocked"]);
const CapaActionItemSchema = z.object({
  action: z.string().min(1).max(500),
  byWho: z.string().min(1).max(200),
  byWhen: z.string().min(1),
  status: CapaActionItemStatusSchema.default("Planned"),
  evidence: z.string().max(500).optional(),
  remarks: z.string().max(1000).optional(),
});

const CreateCapaSchema = z.object({
  type: CapaTypeSchema.default("Corrective"),
  status: CapaStatusSchema.default("Open"),
  priority: CapaPrioritySchema.default("Medium"),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().default(""),
  source: z.string().min(1).max(100),
  sourceRef: z.string().max(100).optional(),
  linkedIncidentId: z.string().optional(),
  linkedAuditId: z.string().optional(),
  linkedRiskId: z.string().optional(),
  rootCause: z.string().max(5000).optional(),
  actionPlan: z.string().min(1).max(5000),
  owner: z.string().min(1).max(200),
  ownerEmail: z.string().email().optional(),
  backupOwner: z.string().max(200).optional(),
  escalationOwner: z.string().max(200).optional(),
  reminderDays: z.number().int().min(0).max(90).optional(),
  actionItems: z.array(CapaActionItemSchema).optional().default([]),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  dueDate: z.string().min(1),
  startDate: z.string().optional(),
  completedDate: z.string().optional(),
  verificationNote: z.string().max(2000).optional(),
  verifiedBy: z.string().max(200).optional(),
  verifiedAt: z.string().optional(),
  effectivenessCheck: z.string().max(2000).optional(),
  effectivenessResult: z.string().max(200).optional(),
  costEstimate: z.number().optional(),
  actualCost: z.number().optional(),
  attachments: z.union([z.string(), z.array(z.unknown())]).optional().default("[]"),
  createdBy: z.string().min(1).max(200).optional(),
});

const UpdateCapaSchema = CreateCapaSchema.partial();

type CapaRow = Record<string, any>;

function routeParam(req: Request, name: string) {
  const value = req.params[name];
  return Array.isArray(value) ? value[0] : value ?? "";
}

function toIso(value: unknown) {
  return value instanceof Date ? value.toISOString() : value ?? undefined;
}

function attachmentsToJson(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string" && value.trim()) {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify([value]);
    }
  }
  return "[]";
}

function isEmail(value: string | undefined | null) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function toDate(value: unknown) {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function jsonArray(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "string" && value.trim()) {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return "[]";
    }
  }
  return "[]";
}

function mapCapa(row: CapaRow) {
  return {
    id: String(row.id),
    capaNo: row.capa_no,
    type: row.type,
    status: row.status,
    priority: row.priority,
    title: row.title,
    description: row.description,
    source: row.source,
    sourceRef: row.source_ref ?? undefined,
    linkedIncidentId: row.linked_incident_id ?? undefined,
    linkedAuditId: row.linked_audit_id ?? undefined,
    linkedRiskId: row.linked_risk_id ?? undefined,
    rootCause: row.root_cause ?? undefined,
    actionPlan: row.action_plan,
    owner: row.owner,
    ownerEmail: row.owner_email ?? undefined,
    backupOwner: row.backup_owner ?? undefined,
    escalationOwner: row.escalation_owner ?? undefined,
    reminderDays:
      row.reminder_days === null || row.reminder_days === undefined
        ? undefined
        : Number(row.reminder_days),
    actionItems: Array.isArray(row.action_items)
      ? row.action_items
      : [],
    department: row.department,
    site: row.site,
    dueDate: toIso(row.due_date),
    startDate: toIso(row.start_date),
    completedDate: toIso(row.completed_date),
    verificationNote: row.verification_note ?? undefined,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: toIso(row.verified_at),
    effectivenessCheck: row.effectiveness_check ?? undefined,
    effectivenessResult: row.effectiveness_result ?? undefined,
    costEstimate: row.cost_estimate === null ? undefined : Number(row.cost_estimate),
    actualCost: row.actual_cost === null ? undefined : Number(row.actual_cost),
    attachments: JSON.stringify(row.attachments ?? []),
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function assignmentUpdateSummary(before: Record<string, unknown>, after: Record<string, unknown>) {
  const labels: Record<string, string> = {
    ownerEmail: "owner email",
    backupOwner: "backup assignee",
    escalationOwner: "escalation contact",
    reminderDays: "reminder days",
    dueDate: "due date",
    actionPlan: "action plan",
    actionItems: "task rows",
    status: "status",
  };

  return Object.entries(labels)
    .filter(([field]) => JSON.stringify(before[field]) !== JSON.stringify(after[field]))
    .map(([field, label]) => label)
    .join(", ");
}

async function notifyCapaAssignment(record: ReturnType<typeof mapCapa>, options?: {
  assignedBy?: string;
  updateSummary?: string;
}) {
  const recipients: Array<{
    to: string;
    role: "owner" | "backup" | "escalation";
    capaId: string;
    title: string;
    source: string;
    actionPlan: string;
    dueDate: string;
    site: string;
    department: string;
    owner: string;
    assignedBy?: string;
    status?: string;
    updateSummary?: string;
  }> = [];

  if (isEmail(record.ownerEmail)) {
    recipients.push({
      to: String(record.ownerEmail),
      role: "owner",
      capaId: String(record.capaNo || record.id),
      title: String(record.title),
      source: String(record.source),
      actionPlan: String(record.actionPlan),
      dueDate: String(record.dueDate),
      site: String(record.site),
      department: String(record.department),
      owner: String(record.owner),
      assignedBy: options?.assignedBy,
      status: String(record.status),
      updateSummary: options?.updateSummary,
    });
  }

  if (isEmail(record.backupOwner)) {
    recipients.push({
      to: String(record.backupOwner),
      role: "backup",
      capaId: String(record.capaNo || record.id),
      title: String(record.title),
      source: String(record.source),
      actionPlan: String(record.actionPlan),
      dueDate: String(record.dueDate),
      site: String(record.site),
      department: String(record.department),
      owner: String(record.owner),
      assignedBy: options?.assignedBy,
      status: String(record.status),
      updateSummary: options?.updateSummary,
    });
  }

  if (isEmail(record.escalationOwner)) {
    recipients.push({
      to: String(record.escalationOwner),
      role: "escalation",
      capaId: String(record.capaNo || record.id),
      title: String(record.title),
      source: String(record.source),
      actionPlan: String(record.actionPlan),
      dueDate: String(record.dueDate),
      site: String(record.site),
      department: String(record.department),
      owner: String(record.owner),
      assignedBy: options?.assignedBy,
      status: String(record.status),
      updateSummary: options?.updateSummary,
    });
  }

  if (!recipients.length) return [];
  return sendCapaAssignmentNotifications(recipients);
}

type CapaNotificationRecipientResult = {
  recipient: string;
  role: "owner" | "backup" | "escalation";
  delivered: boolean;
  mode: "brevo" | "smtp" | "internal" | "failed";
  error?: string;
};

type CapaNotificationSummary = {
  delivered: number;
  queued: number;
  failed: number;
  message: string;
  recipients: CapaNotificationRecipientResult[];
};

function summarizeAssignmentNotifications(
  notifications: Awaited<ReturnType<typeof notifyCapaAssignment>>,
): CapaNotificationSummary | null {
  const list = notifications ?? [];
  if (!list.length) return null;
  const delivered = list.filter((item) => item.delivered).length;
  const queued = list.filter((item) => item.mode === "internal").length;
  const failed = list.filter((item) => item.mode === "failed").length;
  return {
    delivered,
    queued,
    failed,
    message:
      failed > 0
        ? `Assignment notifications: ${delivered} sent, ${queued} queued locally, ${failed} failed.`
        : queued > 0
          ? `Assignment notifications: ${delivered} sent, ${queued} queued locally.`
          : `Assignment notifications: ${delivered} sent.`,
    recipients: list.map((item) => ({
      recipient: item.recipient,
      role: item.role,
      delivered: item.delivered,
      mode: item.mode,
      error: item.error,
    })),
  };
}

type CapaNotificationHistoryRecipient = CapaNotificationRecipientResult;

type CapaNotificationHistoryEntry = {
  id: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  createdAt: string;
  delivered: number;
  queued: number;
  failed: number;
  message: string;
  recipients: CapaNotificationHistoryRecipient[];
};

async function getCapaNotificationHistory(id: string): Promise<CapaNotificationHistoryEntry[]> {
  const result = await pgPool.query(
    `SELECT id, action, actor_email, actor_role, created_at, context
     FROM audit_logs
     WHERE resource_type = 'capa'
       AND resource_id = $1
       AND context ? 'notifications'
     ORDER BY created_at DESC`,
    [id],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    actorEmail: row.actor_email ?? undefined,
    actorRole: row.actor_role ?? undefined,
    createdAt: String(toIso(row.created_at) || new Date().toISOString()),
    delivered: Number(row.context?.notifications?.delivered ?? 0),
    queued: Number(row.context?.notifications?.queued ?? 0),
    failed: Number(row.context?.notifications?.failed ?? 0),
    message: String(row.context?.notifications?.message ?? ""),
    recipients: Array.isArray(row.context?.notifications?.recipients)
      ? row.context.notifications.recipients.map((item: Record<string, unknown>) => ({
          recipient: String(item.recipient || ""),
          role:
            item.role === "backup" || item.role === "escalation" ? item.role : "owner",
          delivered: Boolean(item.delivered),
          mode:
            item.mode === "brevo" ||
            item.mode === "smtp" ||
            item.mode === "failed" ||
            item.mode === "internal"
              ? item.mode
              : "internal",
          error: item.error ? String(item.error) : undefined,
        }))
      : [],
  }));
}

function nextCapaNo() {
  return `CAPA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}

async function getCapaById(id: string) {
  const result = await pgPool.query("SELECT * FROM capa WHERE id = $1", [id]);
  return result.rows[0] ? mapCapa(result.rows[0]) : null;
}

function buildUpdate(data: Record<string, unknown>) {
  const columns: Record<string, string> = {
    type: "type",
    status: "status",
    priority: "priority",
    title: "title",
    description: "description",
    source: "source",
    sourceRef: "source_ref",
    linkedIncidentId: "linked_incident_id",
    linkedAuditId: "linked_audit_id",
    linkedRiskId: "linked_risk_id",
    rootCause: "root_cause",
    actionPlan: "action_plan",
    owner: "owner",
    ownerEmail: "owner_email",
    backupOwner: "backup_owner",
    escalationOwner: "escalation_owner",
    reminderDays: "reminder_days",
    actionItems: "action_items",
    department: "department",
    site: "site",
    dueDate: "due_date",
    startDate: "start_date",
    completedDate: "completed_date",
    verificationNote: "verification_note",
    verifiedBy: "verified_by",
    verifiedAt: "verified_at",
    effectivenessCheck: "effectiveness_check",
    effectivenessResult: "effectiveness_result",
    costEstimate: "cost_estimate",
    actualCost: "actual_cost",
    attachments: "attachments",
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  for (const [key, column] of Object.entries(columns)) {
    if (data[key] !== undefined) {
      if (key === "attachments" || key === "actionItems") {
        fields.push(`${column} = $${idx++}::jsonb`);
        params.push(key === "attachments" ? attachmentsToJson(data[key]) : jsonArray(data[key]));
      } else {
        fields.push(`${column} = $${idx++}`);
        params.push(data[key]);
      }
    }
  }

  return { fields, params, nextIndex: idx };
}

export function createCapaRouter() {
  const router = Router();

  router.use(authenticateUser);

  router.get("/", async (req, res) => {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    let idx = 1;
    if (typeof req.query.status === "string") {
      where.push(`status = $${idx++}`);
      params.push(req.query.status);
    }
    if (typeof req.query.priority === "string") {
      where.push(`priority = $${idx++}`);
      params.push(req.query.priority);
    }
    const result = await pgPool.query(`SELECT * FROM capa WHERE ${where.join(" AND ")} ORDER BY created_at DESC`, params);
    res.json(result.rows.map(mapCapa));
  });

  router.get("/dashboard", async (_req, res) => {
    const [statsResult, sourcesResult] = await Promise.all([
      pgPool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
          COUNT(*) FILTER (WHERE status = 'In Progress')::int AS "inProgress",
          COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
          COUNT(*) FILTER (WHERE status NOT IN ('Cancelled', 'Completed') AND due_date < NOW())::int AS overdue,
          COUNT(*) FILTER (WHERE priority IN ('High', 'Critical'))::int AS "highPriority"
        FROM capa
      `),
      pgPool.query("SELECT source, COUNT(*)::int AS count FROM capa GROUP BY source"),
    ]);
    const sources = Object.fromEntries(sourcesResult.rows.map((row) => [row.source, row.count]));
    res.json({ ...(statsResult.rows[0] ?? {}), sources });
  });

  router.get("/stats", async (_req, res) => {
    const result = await pgPool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
        COUNT(*) FILTER (WHERE status = 'In Progress')::int AS "inProgress",
        COUNT(*) FILTER (WHERE status = 'Completed')::int AS completed,
        COUNT(*) FILTER (WHERE status NOT IN ('Cancelled', 'Completed') AND due_date < NOW())::int AS overdue
      FROM capa
    `);
    res.json(result.rows[0] ?? { total: 0, open: 0, inProgress: 0, completed: 0, overdue: 0 });
  });

  router.get("/overdue", async (_req, res) => {
    const result = await pgPool.query("SELECT * FROM capa WHERE status NOT IN ('Cancelled', 'Completed') AND due_date < NOW() ORDER BY due_date ASC");
    res.json(result.rows.map(mapCapa));
  });

  router.get("/:id/notifications", async (req, res) => {
    const id = routeParam(req, "id");
    const record = await getCapaById(id);
    if (!record) return res.status(404).json({ error: "CAPA not found" });
    res.json(await getCapaNotificationHistory(id));
  });

  router.post("/:id/notifications/resend", requirePermission("capa:update"), async (req: AuthRequest, res) => {
    const id = routeParam(req, "id");
    const record = await getCapaById(id);
    if (!record) return res.status(404).json({ error: "CAPA not found" });

    const notifications = await notifyCapaAssignment(record, {
      assignedBy: req.user?.name || req.user?.email || "System",
      updateSummary: "manual resend",
    });
    const notificationSummary = summarizeAssignmentNotifications(notifications);

    await writeAuditLog({
      action: "capa.notifications.resent",
      resourceType: "capa",
      resourceId: id,
      context: { notifications: notificationSummary },
      actor: req.user,
      request: req,
    });

    res.json({
      record,
      notifications: notificationSummary,
    });
  });

  router.get("/:id", async (req, res) => {
    const record = await getCapaById(routeParam(req, "id"));
    if (!record) return res.status(404).json({ error: "CAPA not found" });
    res.json(record);
  });

  router.post("/", requirePermission("capa:create"), async (req: AuthRequest, res) => {
    const parsed = CreateCapaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const input = parsed.data;
    const createdBy = input.createdBy || req.user?.name || req.user?.email || "System";

    const result = await pgPool.query(
      `INSERT INTO capa (
        capa_no, type, status, priority, title, description, source, source_ref,
        linked_incident_id, linked_audit_id, linked_risk_id, root_cause, action_plan,
        owner, owner_email, backup_owner, escalation_owner, reminder_days, action_items,
        department, site, due_date, start_date, completed_date,
        verification_note, verified_by, verified_at, effectiveness_check,
        effectiveness_result, cost_estimate, actual_cost, attachments, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19::jsonb,
        $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29::jsonb, $30
      ) RETURNING *`,
      [
        nextCapaNo(),
        input.type,
        input.status,
        input.priority,
        input.title,
        input.description,
        input.source,
        input.sourceRef ?? null,
        input.linkedIncidentId ?? null,
        input.linkedAuditId ?? null,
        input.linkedRiskId ?? null,
        input.rootCause ?? null,
        input.actionPlan,
        input.owner,
        input.ownerEmail ?? null,
        input.backupOwner ?? null,
        input.escalationOwner ?? null,
        input.reminderDays ?? null,
        jsonArray(input.actionItems),
        input.department,
        input.site,
        input.dueDate,
        input.startDate ?? null,
        input.completedDate ?? null,
        input.verificationNote ?? null,
        input.verifiedBy ?? null,
        input.verifiedAt ?? null,
        input.effectivenessCheck ?? null,
        input.effectivenessResult ?? null,
        input.costEstimate ?? null,
        input.actualCost ?? null,
        attachmentsToJson(input.attachments),
        createdBy,
      ],
    );
    const record = mapCapa(result.rows[0]);
    const notifications = await notifyCapaAssignment(record, {
      assignedBy: req.user?.name || req.user?.email || createdBy,
    });
    const notificationSummary = summarizeAssignmentNotifications(notifications);
    await writeAuditLog({
      action: "capa.created",
      resourceType: "capa",
      resourceId: record.id,
      context: {
        capaNo: record.capaNo,
        source: record.source,
        notifications: notificationSummary,
      },
      actor: req.user,
      request: req,
    });
    res.status(201).json({
      record,
      notifications: notificationSummary,
    });
  });

  router.patch("/:id/status", requirePermission("capa:update"), async (req: AuthRequest, res) => {
    const id = routeParam(req, "id");
    const parsed = z.object({ status: CapaStatusSchema }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const before = await getCapaById(id);
    if (!before) return res.status(404).json({ error: "CAPA not found" });

    const result = await pgPool.query("UPDATE capa SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [parsed.data.status, id]);
    const record = mapCapa(result.rows[0]);
    await writeAuditLog({
      action: "capa.status.updated",
      resourceType: "capa",
      resourceId: id,
      changes: [{ field: "status", before: before.status, after: record.status }],
      actor: req.user,
      request: req,
    });
    res.json(record);
  });

  router.patch("/:id", requirePermission("capa:update"), async (req: AuthRequest, res) => {
    const id = routeParam(req, "id");
    const parsed = UpdateCapaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.errors });
    const before = await getCapaById(id);
    if (!before) return res.status(404).json({ error: "CAPA not found" });

    const { fields, params, nextIndex } = buildUpdate(parsed.data);
    if (fields.length === 0) return res.status(400).json({ error: "No supported fields supplied" });
    params.push(id);
    const result = await pgPool.query(`UPDATE capa SET ${fields.join(", ")}, updated_at = NOW() WHERE id = $${nextIndex} RETURNING *`, params);
    const record = mapCapa(result.rows[0]);
    const summary = assignmentUpdateSummary(
      before as Record<string, unknown>,
      record as Record<string, unknown>,
    );
    const notifications = summary
      ? await notifyCapaAssignment(record, {
          assignedBy: req.user?.name || req.user?.email || "System",
          updateSummary: summary,
        })
      : [];
    const notificationSummary = summary ? summarizeAssignmentNotifications(notifications) : null;
    await writeAuditLog({
      action: "capa.updated",
      resourceType: "capa",
      resourceId: id,
      changes: diffRecord(before as Record<string, unknown>, record as Record<string, unknown>),
      context: { notifications: notificationSummary },
      actor: req.user,
      request: req,
    });
    if (summary) {
      return res.json({
        record,
        notifications: notificationSummary,
      });
    }
    res.json({ record, notifications: null });
  });

  router.delete("/:id", requirePermission("capa:update"), async (req: AuthRequest, res) => {
    const id = routeParam(req, "id");
    const result = await pgPool.query("DELETE FROM capa WHERE id = $1 RETURNING id", [id]);
    if (!result.rows[0]) return res.status(404).json({ error: "CAPA not found" });
    await writeAuditLog({
      action: "capa.deleted",
      resourceType: "capa",
      resourceId: id,
      actor: req.user,
      request: req,
    });
    res.json({ ok: true, deleted: id, success: true });
  });

  router.post("/:id/verify", requirePermission("capa:verify"), async (req: AuthRequest, res) => {
    const id = routeParam(req, "id");
    const before = await getCapaById(id);
    if (!before) return res.status(404).json({ error: "CAPA not found" });
    const verificationNote = String(req.body?.verificationNote ?? "");
    const verifiedBy = String(req.body?.verifiedBy || req.user?.name || req.user?.email || "System");
    const result = await pgPool.query(
      `UPDATE capa
       SET status = 'Completed',
           completed_date = COALESCE(completed_date, NOW()),
           verification_note = $1,
           verified_by = $2,
           verified_at = NOW(),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [verificationNote, verifiedBy, id],
    );
    const record = mapCapa(result.rows[0]);
    await writeAuditLog({
      action: "capa.verified",
      resourceType: "capa",
      resourceId: id,
      changes: diffRecord(before as Record<string, unknown>, record as Record<string, unknown>),
      actor: req.user,
      request: req,
    });
    res.json(record);
  });

  router.post("/reminders", requirePermission("capa:update"), async (req, res) => {
    const fallbackDaysBefore = Number(req.body?.daysBefore ?? 3);
    const result = await pgPool.query(
      `SELECT id, capa_no, title, action_plan, owner, owner_email, escalation_owner, due_date, reminder_days
       FROM capa
       WHERE status NOT IN ('Cancelled', 'Completed')`,
    );

    let sent = 0;
    let escalated = 0;

    for (const row of result.rows) {
      const dueDate = toDate(row.due_date);
      if (!dueDate) continue;

      const now = new Date();
      const dueStart = new Date(dueDate);
      dueStart.setHours(0, 0, 0, 0);
      const nowStart = new Date(now);
      nowStart.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round(
        (dueStart.getTime() - nowStart.getTime()) / (24 * 60 * 60 * 1000),
      );

      const reminderDays =
        row.reminder_days === null || row.reminder_days === undefined
          ? fallbackDaysBefore
          : Number(row.reminder_days);

      const shouldRemindOwner = isEmail(row.owner_email) && daysUntilDue >= 0 && daysUntilDue <= reminderDays;
      const shouldEscalate = isEmail(row.escalation_owner) && daysUntilDue < 0;

      if (shouldRemindOwner) {
        await sendCapaReminder({
          to: String(row.owner_email),
          capaId: String(row.capa_no || row.id),
          action: String(row.action_plan || row.title || "Assigned CAPA action"),
          dueDate: dueDate.toISOString(),
        });
        sent += 1;
      }

      if (shouldEscalate) {
        await sendCapaReminder({
          to: String(row.escalation_owner),
          capaId: String(row.capa_no || row.id),
          action: `Escalation for overdue CAPA owned by ${String(row.owner || "Unassigned")}: ${String(row.action_plan || row.title || "")}`,
          dueDate: dueDate.toISOString(),
        });
        escalated += 1;
      }
    }

    res.json({
      sent,
      escalated,
      message: `Processed ${sent} owner reminder${sent === 1 ? "" : "s"} and ${escalated} escalation${escalated === 1 ? "" : "s"}.`,
    });
  });

  return router;
}
