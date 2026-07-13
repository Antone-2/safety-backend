import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { allRows, getDb, saveDb } from "../../lib/database.js";
import { randomBytes } from "crypto";
import {
  sendReportAssignmentNotifications,
  type AssignmentDeliveryResult,
  type AssignmentRecipient,
} from "../../lib/email.js";
import { awardReporterPoints } from "../../services/leaderboard.service.js";

const PHOTO_COL = "photo_url";
const DATE_COL = "date";
const LOCATION_COL = "location";
const REPORTER_COL = "reporter";
const DESCRIPTION_COL = "description";
const SEVERITY_COL = "severity";
const STATUS_COL = "status";
const CATEGORY_COL = "category";
const TYPE_COL = "type";
const SLA_COL = "sla_hours";
const DUE_COL = "due_at";
const ASSIGNED_COL = "assigned_to";
const ASSIGNED_COPY_COL = "assigned_to_copy";
const NEAR_MISS_COL = "is_near_miss";
const ANON_COL = "anonymous";
const DEPT_COL = "department";
const SHIFT_COL = "shift";
const COMPLIANCE_COL = "compliance_required";
const COMPLIANCE_DUE_COL = "compliance_due_at";
const SOURCE_COL = "source";
const RESOLUTION_COL = "resolution_days";
const CREATED_COL = "created_at";
const UPDATED_COL = "updated_at";

type ReportRow = Record<string, any>;
type CommentRow = {
  author: string;
  text: string;
  created_at?: string;
  at?: string;
};
type AuditRow = {
  actor?: string;
  actor_id?: string;
  actor_email?: string;
  action: string;
  context?: any;
  created_at?: string;
  timestamp?: string;
};

function isPgAvailable(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

async function writeAuditLogBestEffort(
  input: Parameters<typeof writeAuditLog>[0],
): Promise<void> {
  try {
    await writeAuditLog(input);
  } catch (error) {
    console.warn(
      "Audit log write skipped:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function toCamelCase(row: ReportRow): ReportRow {
  if (!row || Object.keys(row).some((k) => k.includes("_"))) {
    const r: ReportRow = { ...row };
    r.id = r.id;
    r.date = r.date instanceof Date ? r.date.toISOString() : r.date;
    r.location = r.location;
    r.reporter = r.reporter;
    r.description = r.description;
    r.severity = r.severity;
    r.status = r.status;
    r.category = r.category;
    r.type = r.type;
    r.resolutionDays = r.resolution_days ?? undefined;
    r.slaHours = r.sla_hours;
    r.dueAt = r.due_at instanceof Date ? r.due_at.toISOString() : r.due_at;
    r.assignedTo = r.assigned_to ?? undefined;
    r.assignedToCopy = parseJsonArray(r.assigned_to_copy);
    r.isNearMiss = Boolean(r.is_near_miss);
    r.anonymous = Boolean(r.anonymous);
    r.department = r.department;
    r.shift = r.shift;
    r.complianceRequired = Boolean(r.compliance_required);
    r.complianceDueAt =
      r.compliance_due_at instanceof Date
        ? r.compliance_due_at.toISOString()
        : (r.compliance_due_at ?? undefined);
    r.photoUrl = String(r.photo_url ?? "").trim();
    r.source = r.source;
    r.createdAt =
      r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at;
    r.updatedAt =
      r.updated_at instanceof Date ? r.updated_at.toISOString() : r.updated_at;
    return r;
  }
  return row;
}

function mapReport(
  row: ReportRow,
  comments: CommentRow[] = [],
  audit: AuditRow[] = [],
) {
  const mapped = toCamelCase(row);
  return {
    id: mapped.id,
    date: mapped.date,
    location: mapped.location,
    reporter: mapped.reporter,
    description: mapped.description,
    severity: mapped.severity,
    status: mapped.status,
    category: mapped.category,
    type: mapped.type,
    resolutionDays: mapped.resolutionDays,
    slaHours: mapped.slaHours,
    dueAt: mapped.dueAt,
    assignedTo: mapped.assignedTo,
    assignedToCopy: parseJsonArray(mapped.assignedToCopy),
    comments: comments.map((c) => ({
      author: c.author,
      at: c.created_at ?? c.at ?? "",
      text: c.text,
    })),
    isNearMiss: mapped.isNearMiss,
    anonymous: mapped.anonymous,
    department: mapped.department,
    shift: mapped.shift,
    complianceRequired: mapped.complianceRequired,
    complianceDueAt: mapped.complianceDueAt,
    photoUrl: String(mapped.photoUrl ?? "").trim(),
    source: mapped.source,
    auditHistory: audit.map((entry) => ({
      at: entry.created_at ?? entry.timestamp ?? "",
      actor: entry.actor_email || entry.actor || entry.actor_id || "System",
      action: entry.action,
      detail: entry.context?.detail ?? entry.context?.event ?? undefined,
    })),
  };
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return String(value)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function assignmentActorEmail(request?: any): string {
  return normalizeEmail(request?.user?.email || request?.body?.assignedBy);
}

async function recordAssignmentNotifications(
  reportId: string,
  notifications: AssignmentDeliveryResult[],
): Promise<void> {
  if (!notifications.length) return;

  try {
    const db = await getDb();
    const now = new Date().toISOString();
    const insert = db.prepare(
      "INSERT INTO notifications (id, reportId, channel, recipient, subject, message, delivered, createdAt, read) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    );

    for (const notification of notifications) {
      insert.run([
        `NOTIF-${Date.now()}-${randomBytes(4).toString("hex")}`,
        reportId,
        notification.mode,
        notification.recipient,
        notification.subject,
        notification.error
          ? `${notification.message}\n\nDelivery error: ${notification.error}`
          : notification.message,
        notification.delivered ? 1 : 0,
        now,
        0,
      ]);
    }

    await saveDb(db);
  } catch (error) {
    console.warn(
      "Assignment notification persistence skipped:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function syncReportWorkflowState(input: {
  reportId: string;
  state: string;
  assignedTo?: string | null;
  dueAt?: string | Date | null;
  context?: Record<string, unknown>;
}) {
  if (!isPgAvailable()) return;

  try {
    await pgPool.query(
      `INSERT INTO workflow_instances (resource_type, resource_id, workflow_name, state, assigned_to, due_at, context)
       VALUES ('report', $1, 'report', $2, $3, $4, $5::jsonb)
       ON CONFLICT (resource_type, resource_id, workflow_name)
       DO UPDATE SET
         state = EXCLUDED.state,
         assigned_to = EXCLUDED.assigned_to,
         due_at = EXCLUDED.due_at,
         context = workflow_instances.context || EXCLUDED.context,
         updated_at = NOW()`,
      [
        input.reportId,
        input.state,
        input.assignedTo ?? null,
        input.dueAt ? new Date(input.dueAt).toISOString() : null,
        JSON.stringify(input.context ?? {}),
      ],
    );

  } catch (error) {
    console.warn(
      "Workflow state sync skipped:",
      error instanceof Error ? error.message : String(error),
    );
  }
}

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return `https://placehold.co/${size}x${size}/1e293b/ffffff?text=${encodeURIComponent(shortId)}`;
}

function normalizeReportInput(input: any): ReportRow {
  return {
    id: input.id,
    date: input.date instanceof Date ? input.date.toISOString() : input.date,
    location: input.location,
    reporter: input.reporter,
    description: input.description,
    severity: input.severity,
    status: input.status,
    category: input.category,
    type: input.type,
    resolutionDays: input.resolutionDays ?? input.resolution_days,
    slaHours: input.slaHours ?? input.sla_hours,
    dueAt:
      input.dueAt instanceof Date
        ? input.dueAt.toISOString()
        : (input.dueAt ?? input.due_at),
    assignedTo: input.assignedTo ?? input.assigned_to,
    assignedToCopy: JSON.stringify(
      Array.isArray(input.assignedToCopy) ? input.assignedToCopy : [],
    ),
    isNearMiss: (input.isNearMiss ?? input.is_near_miss) ? 1 : 0,
    anonymous: input.anonymous ? 1 : 0,
    department: input.department,
    shift: input.shift,
    complianceRequired:
      (input.complianceRequired ?? input.compliance_required) ? 1 : 0,
    complianceDueAt:
      input.complianceDueAt instanceof Date
        ? input.complianceDueAt.toISOString()
        : (input.complianceDueAt ?? input.compliance_due_at),
    photoUrl: input.photoUrl ?? input.photo_url ?? "",
    source: input.source ?? "manual",
    createdAt: input.createdAt ?? input.created_at ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? input.updated_at ?? new Date().toISOString(),
  };
}

export class ReportsService {
  async list(filters: any = {}, page = 1, limit = 50) {
    if (isPgAvailable()) {
      return this.listPg(filters, page, limit);
    }
    return this.listSqlite(filters, page, limit);
  }

  private async listPg(filters: any, page: number, limit: number) {
    const where: string[] = ["1=1"];
    const params: unknown[] = [];
    let idx = 1;

    if (filters.status) {
      where.push(`status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.severity) {
      where.push(`severity = $${idx++}`);
      params.push(filters.severity);
    }
    if (filters.location && filters.location !== "All") {
      where.push(`location = $${idx++}`);
      params.push(filters.location);
    }
    if (filters.category && filters.category !== "All") {
      where.push(`category = $${idx++}`);
      params.push(filters.category);
    }
    if (filters.days && filters.days !== "9999") {
      where.push(`date >= $${idx++}`);
      params.push(
        new Date(Date.now() - Number(filters.days) * 86400000).toISOString(),
      );
    }
    if (filters.search) {
      where.push(
        `(description ILIKE $${idx} OR reporter ILIKE $${idx} OR id ILIKE $${idx})`,
      );
      params.push(`%${filters.search}%`);
      idx++;
    }

    const whereSql = where.join(" AND ");
    const offset = (page - 1) * limit;
    const totalResult = await pgPool.query(
      `SELECT COUNT(*)::int AS total FROM reports WHERE ${whereSql}`,
      params,
    );
    const rows = filters.all
      ? await pgPool.query(
          `SELECT * FROM reports WHERE ${whereSql} ORDER BY date DESC`,
          params,
        )
      : await pgPool.query(
          `SELECT * FROM reports WHERE ${whereSql} ORDER BY date DESC LIMIT $${idx++} OFFSET $${idx}`,
          [...params, limit, offset],
        );

    return {
      data: rows.rows.map((row) => mapReport(row)),
      total: totalResult.rows[0]?.total ?? 0,
      page,
      limit: filters.all ? rows.rows.length : limit,
    };
  }

  private async listSqlite(filters: any, page: number, limit: number) {
    const db = await getDb();
    const where: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (filters.status) {
      where.push(`status = ?`);
      params.push(filters.status);
    }
    if (filters.severity) {
      where.push(`severity = ?`);
      params.push(filters.severity);
    }
    if (filters.location && filters.location !== "All") {
      where.push(`location = ?`);
      params.push(filters.location);
    }
    if (filters.category && filters.category !== "All") {
      where.push(`category = ?`);
      params.push(filters.category);
    }
    if (filters.days && filters.days !== "9999") {
      where.push(`date >= ?`);
      params.push(
        new Date(Date.now() - Number(filters.days) * 86400000).toISOString(),
      );
    }
    if (filters.search) {
      where.push(`(description LIKE ? OR reporter LIKE ? OR id LIKE ?)`);
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
      );
    }

    const whereSql = where.length
      ? `WHERE ${where.join(" AND ")}`
      : "WHERE 1=1";
    const offset = (page - 1) * limit;

    const totalRow = allRows(
      db,
      `SELECT COUNT(*) as total FROM reports ${whereSql}`,
      params,
    )[0];
    const rows = filters.all
      ? allRows(
          db,
          `SELECT * FROM reports ${whereSql} ORDER BY date DESC`,
          params,
        )
      : allRows(
          db,
          `SELECT * FROM reports ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );

    return {
      data: rows.map((row) => mapReport(row)),
      total: Number(totalRow?.total ?? 0),
      page,
      limit: filters.all ? rows.length : limit,
    };
  }

  async getById(id: string) {
    if (isPgAvailable()) {
      return this.getByIdPg(id);
    }
    return this.getByIdSqlite(id);
  }

  private async getByIdPg(id: string) {
    const rowResult = await pgPool.query(
      "SELECT * FROM reports WHERE id = $1",
      [id],
    );
    const row = rowResult.rows[0];
    if (!row) return null;

    const [comments, audit] = await Promise.all([
      pgPool.query(
        "SELECT author, text, created_at FROM report_comments WHERE report_id = $1 ORDER BY created_at ASC",
        [id],
      ),
      pgPool.query(
        "SELECT actor_id, actor_email, action, context, created_at FROM audit_logs WHERE resource_type = 'report' AND resource_id = $1 ORDER BY created_at DESC",
        [id],
      ),
    ]);

    return mapReport(row, comments.rows, audit.rows);
  }

  private async getByIdSqlite(id: string) {
    const db = await getDb();
    const rows = allRows(db, "SELECT * FROM reports WHERE id = ?", [id]);
    const row = rows[0];
    if (!row) return null;

    const comments = allRows(
      db,
      "SELECT author, text, at FROM comments WHERE reportId = ? ORDER BY at ASC",
      [id],
    ) as CommentRow[];
    const audit = allRows(
      db,
      "SELECT actor, action, detail, createdAt FROM report_audit WHERE reportId = ? ORDER BY createdAt DESC",
      [id],
    ) as AuditRow[];

    return mapReport(row, comments, audit);
  }

  async create(input: any, request?: any) {
    if (isPgAvailable()) {
      return this.createPg(input, request);
    }
    return this.createSqlite(input, request);
  }

  private async createPg(input: any, request?: any) {
    const id = `RPT-${String(Date.now()).slice(-5)}`;
    const now = new Date();
    const slaHours =
      input.severity === "Critical" ? 24 : input.severity === "High" ? 72 : 168;
    const dueAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
    const complianceRequired = Boolean(
      input.complianceRequired ||
      input.severity === "Critical" ||
      input.severity === "High",
    );
    const complianceDueAt = complianceRequired
      ? new Date(dueAt.getTime() + 86400000 * 3).toISOString()
      : null;
    const photoUrl = input.photoUrl?.trim() || getPlaceholderPhotoUrl(id);

    await pgPool.query(
      `INSERT INTO reports (
        id, date, location, reporter, description, severity, status, category, type,
        sla_hours, due_at, is_near_miss, anonymous, department, shift,
        compliance_required, compliance_due_at, photo_url, source
      ) VALUES ($1, NOW(), $2, $3, $4, $5, 'Open', $6, $7, $8, $9, FALSE, $10, $11, $12, $13, $14, $15, 'manual')`,
      [
        id,
        input.location,
        input.reporter,
        input.description,
        input.severity,
        input.category,
        input.type,
        slaHours,
        dueAt.toISOString(),
        input.anonymous,
        input.department,
        input.shift,
        complianceRequired,
        complianceDueAt,
        photoUrl,
      ],
    );

    await awardReporterPoints({
      date: now,
      reporter: input.reporter,
      severity: input.severity,
      anonymous: input.anonymous,
    });

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.created",
        resourceType: "report",
        resourceId: id,
        context: {
          detail: `Severity: ${input.severity}; Location: ${input.location}`,
        },
        request,
      });
    }

    await syncReportWorkflowState({
      reportId: id,
      state: "Open",
      dueAt: dueAt.toISOString(),
      context: {
        source: "report.created",
        severity: input.severity,
        location: input.location,
      },
    });

    return this.getById(id);
  }

  private async createSqlite(input: any, request?: any) {
    const db = await getDb();
    const id = `RPT-${String(Date.now()).slice(-5)}`;
    const now = new Date();
    const slaHours =
      input.severity === "Critical" ? 24 : input.severity === "High" ? 72 : 168;
    const dueAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);
    const complianceRequired = Boolean(
      input.complianceRequired ||
      input.severity === "Critical" ||
      input.severity === "High",
    );
    const complianceDueAt = complianceRequired
      ? new Date(dueAt.getTime() + 86400000 * 3).toISOString()
      : null;
    const photoUrl = input.photoUrl?.trim() || getPlaceholderPhotoUrl(id);
    const createdAt = new Date().toISOString();

    db.run(
      `INSERT INTO reports (
        id, date, location, reporter, description, severity, status, category, type,
        slaHours, dueAt, isNearMiss, anonymous, department, shift,
        complianceRequired, complianceDueAt, photoUrl, source, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        createdAt,
        input.location,
        input.reporter,
        input.description,
        input.severity,
        input.category,
        input.type,
        slaHours,
        dueAt.toISOString(),
        input.anonymous ? 1 : 0,
        input.department,
        input.shift,
        complianceRequired ? 1 : 0,
        complianceDueAt,
        photoUrl,
        "manual",
        createdAt,
      ],
    );

    await saveDb(db);

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.created",
        resourceType: "report",
        resourceId: id,
        context: {
          detail: `Severity: ${input.severity}; Location: ${input.location}`,
        },
        request,
      });
    }

    return this.getById(id);
  }

  async updateStatus(id: string, status: string, request?: any) {
    if (isPgAvailable()) {
      return this.updateStatusPg(id, status, request);
    }
    return this.updateStatusSqlite(id, status, request);
  }

  private async updateStatusPg(id: string, status: string, request?: any) {
    const before = await this.getById(id);
    const row = await pgPool.query(
      "UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [status, id],
    );
    if (!row.rows[0]) return null;

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.status.updated",
        resourceType: "report",
        resourceId: id,
        changes: [{ field: "status", before: before?.status, after: status }],
        actor: request.user,
        request,
      });
    }

    await syncReportWorkflowState({
      reportId: id,
      state: status,
      assignedTo: row.rows[0].assigned_to,
      dueAt: row.rows[0].due_at,
      context: { source: "report.status.updated" },
    });

    return this.getById(id);
  }

  private async updateStatusSqlite(id: string, status: string, request?: any) {
    const db = await getDb();
    const before = await this.getById(id);
    const rows = allRows(
      db,
      "UPDATE reports SET status = ?, updatedAt = ? WHERE id = ? RETURNING *",
      [status, new Date().toISOString(), id],
    );
    const row = rows[0];
    if (!row) return null;

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.status.updated",
        resourceType: "report",
        resourceId: id,
        changes: [{ field: "status", before: before?.status, after: status }],
        actor: request.user,
        request,
      });
    }

    await saveDb(db);
    return this.getByIdSqlite(id);
  }

  async updateAssignment(
    id: string,
    assignedTo: string,
    assignedToCopy: string[],
    request?: any,
  ) {
    if (isPgAvailable()) {
      try {
        return await this.updateAssignmentPg(
          id,
          assignedTo,
          assignedToCopy,
          request,
        );
      } catch (error) {
        console.warn(
          "PostgreSQL assignment update failed; falling back to SQLite:",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
    return this.updateAssignmentSqlite(id, assignedTo, assignedToCopy, request);
  }

  private async notifyAssignment(
    report: any,
    assignedTo: string,
    assignedToCopy: string[],
    request?: any,
  ): Promise<AssignmentDeliveryResult[]> {
    const assignerEmail = assignmentActorEmail(request);
    const assignerName = String(request?.user?.name || "").trim();
    const assignedBy = assignerEmail
      ? assignerName
        ? `${assignerName} <${assignerEmail}>`
        : assignerEmail
      : "the EHS system";
    const recipients: AssignmentRecipient[] = [];

    if (isEmail(assignerEmail)) {
      recipients.push({
        email: assignerEmail,
        name: assignerName || assignerEmail,
        role: "assigner",
      });
    }

    const primaryEmail = normalizeEmail(assignedTo);
    if (isEmail(primaryEmail)) {
      recipients.push({ email: primaryEmail, role: "primary" });
    }

    for (const email of assignedToCopy.map(normalizeEmail)) {
      if (isEmail(email)) {
        recipients.push({ email, role: "secondary" });
      }
    }

    const notifications = await sendReportAssignmentNotifications(
      report,
      recipients,
      assignedBy,
      primaryEmail || assignedTo,
    );
    await recordAssignmentNotifications(report.id, notifications);
    return notifications;
  }

  private async updateAssignmentPg(
    id: string,
    assignedTo: string,
    assignedToCopy: string[],
    request?: any,
  ) {
    const row = await pgPool.query(
      "UPDATE reports SET assigned_to = $1, assigned_to_copy = $2::jsonb, updated_at = NOW() WHERE id = $3 RETURNING *",
      [assignedTo || null, JSON.stringify(assignedToCopy), id],
    );
    if (!row.rows[0]) return null;

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.assignment.updated",
        resourceType: "report",
        resourceId: id,
        changes: [
          { field: "assignedTo", before: undefined, after: assignedTo || null },
          { field: "assignedToCopy", before: undefined, after: assignedToCopy },
        ],
        context: { detail: `Assigned to: ${assignedTo || "Unassigned"}` },
        actor: request.user,
        request,
      });
    }

    await syncReportWorkflowState({
      reportId: id,
      state: "Assigned",
      assignedTo,
      dueAt: row.rows[0].due_at,
      context: {
        source: "report.assignment.updated",
        copiedTo: assignedToCopy,
      },
    });

    const updated = await this.getById(id);
    if (!updated) return null;
    const assignmentNotifications = await this.notifyAssignment(
      updated,
      assignedTo,
      assignedToCopy,
      request,
    );
    return { ...updated, assignmentNotifications };
  }

  private async updateAssignmentSqlite(
    id: string,
    assignedTo: string,
    assignedToCopy: string[],
    request?: any,
  ) {
    const db = await getDb();
    const row = db
      .prepare("SELECT * FROM reports WHERE id = ?")
      .getAsObject([id]) as Record<string, unknown> | undefined;
    if (!row) return null;

    const assignedToCopyJson = JSON.stringify(assignedToCopy);
    const reportColumns = new Set(
      (
        allRows(db, "PRAGMA table_info(reports)") as Array<{ name?: string }>
      ).map((column) => String(column.name)),
    );
    const sets = ["assignedTo = ?"];
    const params: unknown[] = [assignedTo || null];
    if (reportColumns.has("assignedToCopy")) {
      sets.push("assignedToCopy = ?");
      params.push(assignedToCopyJson);
    }
    if (reportColumns.has("updatedAt")) {
      sets.push("updatedAt = ?");
      params.push(new Date().toISOString());
    }
    params.push(id);
    db.prepare(`UPDATE reports SET ${sets.join(", ")} WHERE id = ?`).run(
      params,
    );

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.assignment.updated",
        resourceType: "report",
        resourceId: id,
        changes: [
          { field: "assignedTo", before: undefined, after: assignedTo || null },
          { field: "assignedToCopy", before: undefined, after: assignedToCopy },
        ],
        context: { detail: `Assigned to: ${assignedTo || "Unassigned"}` },
        actor: request.user,
        request,
      });
    }

    await saveDb(db);
    const updated = await this.getById(id);
    if (!updated) return null;
    const assignmentNotifications = await this.notifyAssignment(
      updated,
      assignedTo,
      assignedToCopy,
      request,
    );
    return { ...updated, assignmentNotifications };
  }

  async addComment(id: string, author: string, text: string, request?: any) {
    if (isPgAvailable()) {
      return this.addCommentPg(id, author, text, request);
    }
    return this.addCommentSqlite(id, author, text, request);
  }

  private async addCommentPg(
    id: string,
    author: string,
    text: string,
    request?: any,
  ) {
    const exists = await pgPool.query("SELECT id FROM reports WHERE id = $1", [
      id,
    ]);
    if (!exists.rows[0]) return null;

    await pgPool.query(
      "INSERT INTO report_comments (report_id, author, text) VALUES ($1, $2, $3)",
      [id, author, text],
    );

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.comment.added",
        resourceType: "report",
        resourceId: id,
        context: { detail: text },
        actor: request.user,
        request,
      });
    }

    return this.getById(id);
  }

  private async addCommentSqlite(
    id: string,
    author: string,
    text: string,
    request?: any,
  ) {
    const db = await getDb();
    const rows = allRows(db, "SELECT id FROM reports WHERE id = ?", [id]);
    if (!rows[0]) return null;

    const commentId = `cmt-${randomBytes(6).toString("hex")}`;
    db.run(
      "INSERT INTO comments (id, reportId, author, text, at) VALUES (?, ?, ?, ?, ?)",
      [commentId, id, author, text, new Date().toISOString()],
    );

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.comment.added",
        resourceType: "report",
        resourceId: id,
        context: { detail: text },
        actor: request.user,
        request,
      });
    }

    await saveDb(db);
    return this.getById(id);
  }

  async update(id: string, fields: Record<string, any>, request?: any) {
    if (isPgAvailable()) {
      return this.updatePg(id, fields, request);
    }
    return this.updateSqlite(id, fields, request);
  }

  private async updatePg(
    id: string,
    fields: Record<string, any>,
    request?: any,
  ) {
    const before = await this.getById(id);
    if (!before) return null;
    const allowed: Record<string, string> = {
      location: "location",
      reporter: "reporter",
      description: "description",
      severity: "severity",
      category: "category",
      type: "type",
      department: "department",
      shift: "shift",
      assignedTo: "assigned_to",
      status: "status",
      photoUrl: "photo_url",
    };

    const sets: string[] = [];
    const params: any[] = [];
    let idx = 1;

    for (const [inputKey, column] of Object.entries(allowed)) {
      if (fields[inputKey] !== undefined) {
        sets.push(`${column} = $${idx++}`);
        params.push(fields[inputKey]);
      }
    }
    if (sets.length === 0) return this.getById(id);
    params.push(id);

    const updatedRow = await pgPool.query(
      `UPDATE reports SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!updatedRow.rows[0]) return null;
    const after = mapReport(updatedRow.rows[0]);

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.updated",
        resourceType: "report",
        resourceId: id,
        changes: diffRecord(
          before as Record<string, unknown>,
          after as Record<string, unknown>,
        ),
        context: { fields: Object.keys(fields) },
        actor: request.user,
        request,
      });
    }

    if (fields.status !== undefined || fields.assignedTo !== undefined) {
      await syncReportWorkflowState({
        reportId: id,
        state: after.status,
        assignedTo: after.assignedTo,
        dueAt: after.dueAt,
        context: { source: "report.updated", fields: Object.keys(fields) },
      });
    }

    return this.getById(id);
  }

  private async updateSqlite(
    id: string,
    fields: Record<string, any>,
    request?: any,
  ) {
    const db = await getDb();
    const allowed: Record<string, string> = {
      location: "location",
      reporter: "reporter",
      description: "description",
      severity: "severity",
      category: "category",
      type: "type",
      department: "department",
      shift: "shift",
      assignedTo: "assignedTo",
      status: "status",
      photoUrl: "photoUrl",
    };

    const sets: string[] = [];
    const params: any[] = [];

    for (const [inputKey, column] of Object.entries(allowed)) {
      if (fields[inputKey] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(fields[inputKey]);
      }
    }
    if (sets.length === 0) return this.getById(id);
    params.push(new Date().toISOString(), id);

    const existing = await this.getById(id);
    if (!existing) return null;

    db.prepare(
      `UPDATE reports SET ${sets.join(", ")}, updatedAt = ? WHERE id = ?`,
    ).run(params);

    await saveDb(db);

    if (request) {
      const after = await this.getById(id);
      await writeAuditLogBestEffort({
        action: "report.updated",
        resourceType: "report",
        resourceId: id,
        changes: after
          ? diffRecord(
              existing as Record<string, unknown>,
              after as Record<string, unknown>,
            )
          : [],
        context: { fields: Object.keys(fields) },
        actor: request.user,
        request,
      });
    }

    return this.getById(id);
  }

  async delete(id: string, request?: any) {
    if (isPgAvailable()) {
      return this.deletePg(id, request);
    }
    return this.deleteSqlite(id, request);
  }

  private async deletePg(id: string, request?: any) {
    const deleted = await pgPool.query(
      "DELETE FROM reports WHERE id = $1 RETURNING id",
      [id],
    );
    if (!deleted.rows[0]) return null;

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.deleted",
        resourceType: "report",
        resourceId: id,
        actor: request.user,
        request,
      });
    }

    return { ok: true, deleted: id };
  }

  private async deleteSqlite(id: string, request?: any) {
    const db = await getDb();
    const rows = allRows(db, "DELETE FROM reports WHERE id = ? RETURNING id", [
      id,
    ]);
    const row = rows[0];
    if (!row) return null;

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.deleted",
        resourceType: "report",
        resourceId: id,
        actor: request.user,
        request,
      });
    }

    await saveDb(db);
    return { ok: true, deleted: id };
  }

  async getPhotoUrl(id: string): Promise<{ photoUrl: string; found: boolean }> {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        "SELECT photo_url FROM reports WHERE id = $1",
        [id],
      );
      const row = result.rows[0];
      if (!row) return { photoUrl: "", found: false };
      return { photoUrl: String(row.photo_url ?? "").trim(), found: true };
    }

    const db = await getDb();
    const rows = allRows(db, "SELECT photoUrl FROM reports WHERE id = ?", [id]);
    const row = rows[0] as any;
    if (!row) return { photoUrl: "", found: false };
    return { photoUrl: String(row.photoUrl ?? "").trim(), found: true };
  }

  async stats() {
    if (isPgAvailable()) {
      const result = await pgPool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
          COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed,
          COUNT(*) FILTER (WHERE date >= date_trunc('day', NOW()))::int AS today,
          COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days')::int AS week,
          COALESCE(ROUND(AVG(resolution_days) FILTER (WHERE status = 'Closed' AND resolution_days IS NOT NULL), 1), 0)::float AS "avgResolution"
        FROM reports
      `);
      return (
        result.rows[0] ?? {
          total: 0,
          open: 0,
          closed: 0,
          today: 0,
          week: 0,
          avgResolution: 0,
        }
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

    const total = Number(
      (allRows(db, "SELECT COUNT(*) as c FROM reports") as any[])[0]?.c ?? 0,
    );
    const open = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE status = 'Open'",
        ) as any[]
      )[0]?.c ?? 0,
    );
    const closed = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'",
        ) as any[]
      )[0]?.c ?? 0,
    );
    const todayCount = Number(
      (
        allRows(db, "SELECT COUNT(*) as c FROM reports WHERE date >= ?", [
          today,
        ]) as any[]
      )[0]?.c ?? 0,
    );
    const weekCount = Number(
      (
        allRows(db, "SELECT COUNT(*) as c FROM reports WHERE date >= ?", [
          weekAgo,
        ]) as any[]
      )[0]?.c ?? 0,
    );
    const avgResolution = Number(
      (
        allRows(
          db,
          "SELECT AVG(resolutionDays) as avg FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL",
        ) as any[]
      )[0]?.avg ?? 0,
    );

    return {
      total,
      open,
      closed,
      today: todayCount,
      week: weekCount,
      avgResolution: Math.round(avgResolution * 10) / 10,
    };
  }

  async summary() {
    if (isPgAvailable()) {
      const result = await pgPool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
          COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed,
          COUNT(*) FILTER (WHERE date >= date_trunc('day', NOW()))::int AS today,
          COUNT(*) FILTER (WHERE date >= NOW() - INTERVAL '7 days')::int AS week,
          COUNT(*) FILTER (WHERE severity = 'Critical' AND status != 'Closed')::int AS "criticalOpen",
          COUNT(*) FILTER (WHERE status != 'Closed' AND due_at IS NOT NULL AND due_at < NOW())::int AS overdue,
          COALESCE(ROUND(AVG(resolution_days) FILTER (WHERE status = 'Closed' AND resolution_days IS NOT NULL), 1), 0)::float AS "avgResolution"
        FROM reports
      `);
      return (
        result.rows[0] ?? {
          total: 0,
          open: 0,
          closed: 0,
          today: 0,
          week: 0,
          criticalOpen: 0,
          overdue: 0,
          avgResolution: 0,
        }
      );
    }

    const db = await getDb();
    const now = new Date().toISOString();
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const total = Number(
      (allRows(db, "SELECT COUNT(*) as c FROM reports") as any[])[0]?.c ?? 0,
    );
    const open = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE status = 'Open'",
        ) as any[]
      )[0]?.c ?? 0,
    );
    const closed = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE status = 'Closed'",
        ) as any[]
      )[0]?.c ?? 0,
    );
    const todayCount = Number(
      (
        allRows(db, "SELECT COUNT(*) as c FROM reports WHERE date >= ?", [
          today,
        ]) as any[]
      )[0]?.c ?? 0,
    );
    const weekCount = Number(
      (
        allRows(db, "SELECT COUNT(*) as c FROM reports WHERE date >= ?", [
          weekAgo,
        ]) as any[]
      )[0]?.c ?? 0,
    );
    const criticalOpen = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE severity = 'Critical' AND status != 'Closed'",
        ) as any[]
      )[0]?.c ?? 0,
    );
    const overdue = Number(
      (
        allRows(
          db,
          "SELECT COUNT(*) as c FROM reports WHERE status != 'Closed' AND dueAt IS NOT NULL AND dueAt < ?",
          [now],
        ) as any[]
      )[0]?.c ?? 0,
    );
    const avgResolution = Number(
      (
        allRows(
          db,
          "SELECT AVG(resolutionDays) as avg FROM reports WHERE status = 'Closed' AND resolutionDays IS NOT NULL",
        ) as any[]
      )[0]?.avg ?? 0,
    );

    return {
      total,
      open,
      closed,
      today: todayCount,
      week: weekCount,
      criticalOpen,
      overdue,
      avgResolution: Math.round(avgResolution * 10) / 10,
    };
  }

  async selectionExport(ids: string[]) {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        "SELECT * FROM reports WHERE id = ANY($1::text[]) ORDER BY date DESC",
        [ids],
      );
      return result.rows;
    }

    const db = await getDb();
    const placeholders = ids.map(() => "?").join(",");
    return allRows(
      db,
      `SELECT * FROM reports WHERE id IN (${placeholders}) ORDER BY date DESC`,
      ids,
    );
  }

  async generateExport() {
    if (isPgAvailable()) {
      const result = await pgPool.query(
        "SELECT * FROM reports ORDER BY date DESC",
      );
      return result.rows;
    }

    const db = await getDb();
    return allRows(db, "SELECT * FROM reports ORDER BY date DESC");
  }
}

export const reportsService = new ReportsService();
