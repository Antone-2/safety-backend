import { Router, type Request } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, requirePermission, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";

const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
const CapaStatusSchema = z.enum(["Open", "In Progress", "Completed", "Overdue", "Cancelled"]);
const CapaTypeSchema = z.enum(["Corrective", "Preventive", "Improvement"]);

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
      if (key === "attachments") {
        fields.push(`${column} = $${idx++}::jsonb`);
        params.push(attachmentsToJson(data[key]));
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
        owner, department, site, due_date, start_date, completed_date,
        verification_note, verified_by, verified_at, effectiveness_check,
        effectiveness_result, cost_estimate, actual_cost, attachments, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26, $27::jsonb, $28
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
    await writeAuditLog({
      action: "capa.created",
      resourceType: "capa",
      resourceId: record.id,
      context: { capaNo: record.capaNo, source: record.source },
      actor: req.user,
      request: req,
    });
    res.status(201).json(record);
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
    await writeAuditLog({
      action: "capa.updated",
      resourceType: "capa",
      resourceId: id,
      changes: diffRecord(before as Record<string, unknown>, record as Record<string, unknown>),
      actor: req.user,
      request: req,
    });
    res.json(record);
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
    const daysBefore = Number(req.body?.daysBefore ?? 3);
    const result = await pgPool.query(
      "SELECT COUNT(*)::int AS count FROM capa WHERE status NOT IN ('Cancelled', 'Completed') AND due_date <= NOW() + ($1::int * INTERVAL '1 day')",
      [daysBefore],
    );
    const sent = result.rows[0]?.count ?? 0;
    res.json({ sent, message: `Queued ${sent} CAPA reminder${sent === 1 ? "" : "s"}` });
  });

  return router;
}
