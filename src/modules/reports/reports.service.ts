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
import { scheduleFollowupsForReport } from "../../services/report-followup.service.js";

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
const GOOGLE_SHEETS_UTC_OFFSET_MINUTES = Number(
  process.env.GOOGLE_SHEETS_UTC_OFFSET_MINUTES ?? "180",
);
const GOOGLE_SHEETS_DATE_ORDER = (process.env.GOOGLE_SHEETS_DATE_ORDER || "mdy").toLowerCase();

export type ReportFilters = {
  status?: string;
  severity?: string;
  location?: string;
  category?: string;
  search?: string;
  days?: string | number;
  dateFrom?: string;
  dateTo?: string;
  all?: boolean;
};

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

export function buildPgFilter(filters: ReportFilters) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  const add = (clause: (placeholder: string) => string, value: unknown) => {
    params.push(value);
    where.push(clause(`$${params.length}`));
  };

  if (filters.status && filters.status !== "All")
    add((p) => `status = ${p}`, filters.status);
  if (filters.severity && filters.severity !== "All")
    add((p) => `severity = ${p}`, filters.severity);
  if (filters.location && filters.location !== "All")
    add((p) => `location = ${p}`, filters.location);
  if (filters.category && filters.category !== "All")
    add((p) => `category = ${p}`, filters.category);
  if (filters.dateFrom) add((p) => `date >= ${p}`, filters.dateFrom);
  if (filters.dateTo) add((p) => `date < ${p}`, filters.dateTo);
  if (!filters.dateFrom && filters.days && String(filters.days) !== "9999") {
    add(
      (p) => `date >= ${p}`,
      new Date(Date.now() - Number(filters.days) * 86400000).toISOString(),
    );
  }
  if (filters.search) {
    params.push(`%${filters.search}%`);
    const p = `$${params.length}`;
    where.push(
      `(description ILIKE ${p} OR reporter ILIKE ${p} OR id ILIKE ${p} OR location ILIKE ${p} OR category ILIKE ${p})`,
    );
  }
  return { whereSql: where.join(" AND "), params };
}

export function buildSqliteFilter(filters: ReportFilters) {
  const where: string[] = ["1=1"];
  const params: unknown[] = [];
  const add = (clause: string, value: unknown) => {
    where.push(clause);
    params.push(value);
  };

  if (filters.status && filters.status !== "All")
    add("status = ?", filters.status);
  if (filters.severity && filters.severity !== "All")
    add("severity = ?", filters.severity);
  if (filters.location && filters.location !== "All")
    add("location = ?", filters.location);
  if (filters.category && filters.category !== "All")
    add("category = ?", filters.category);
  if (filters.dateFrom) add("date >= ?", filters.dateFrom);
  if (filters.dateTo) add("date < ?", filters.dateTo);
  if (!filters.dateFrom && filters.days && String(filters.days) !== "9999") {
    add(
      "date >= ?",
      new Date(Date.now() - Number(filters.days) * 86400000).toISOString(),
    );
  }
  if (filters.search) {
    where.push(
      "(description LIKE ? OR reporter LIKE ? OR id LIKE ? OR location LIKE ? OR category LIKE ?)",
    );
    const search = `%${filters.search}%`;
    params.push(search, search, search, search, search);
  }
  return { whereSql: where.join(" AND "), params };
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
    r.isRecordable = Boolean(r.is_recordable);
    r.isLostTimeInjury = Boolean(r.is_lost_time_injury);
    r.medicalTreatmentCase = Boolean(r.medical_treatment_case);
    r.lostWorkDays = Number(r.lost_work_days ?? 0);
    r.restrictedWorkDays = Number(r.restricted_work_days ?? 0);
    r.classificationSource = r.classification_source ?? undefined;
    r.classificationVerifiedBy = r.classification_verified_by ?? undefined;
    r.classificationVerifiedAt =
      r.classification_verified_at instanceof Date
        ? r.classification_verified_at.toISOString()
        : (r.classification_verified_at ?? undefined);
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
    r.sourceSyncedAt =
      r.source_synced_at instanceof Date
        ? r.source_synced_at.toISOString()
        : (r.source_synced_at ?? undefined);
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
  if (!row || !row.id) return null;
  const mapped = toCamelCase(row);
   return {
     id: mapped.id,
     date: sanitizeIsoDate(mapped.date, mapped.createdAt, mapped.updatedAt),
     location: mapped.location,
     reporter: mapped.reporter,
     description: mapped.description,
     severity: mapped.severity,
     status: mapped.status,
     category: mapped.category,
     type: mapped.type,
     resolutionDays: mapped.resolutionDays,
     slaHours: mapped.slaHours,
     dueAt: sanitizeIsoDate(mapped.dueAt, mapped.date, mapped.createdAt),
     assignedTo: mapped.assignedTo,
     assignedToCopy: parseJsonArray(mapped.assignedToCopy),
     comments: comments.map((c) => ({
       author: c.author,
       at: c.created_at ?? c.at ?? "",
       text: c.text,
     })),
     isNearMiss: mapped.isNearMiss,
     isRecordable: Boolean(mapped.isRecordable),
     isLostTimeInjury: Boolean(mapped.isLostTimeInjury),
     medicalTreatmentCase: Boolean(mapped.medicalTreatmentCase),
     lostWorkDays: Number(mapped.lostWorkDays ?? 0),
     restrictedWorkDays: Number(mapped.restrictedWorkDays ?? 0),
     classificationSource: mapped.classificationSource,
     classificationVerifiedBy: mapped.classificationVerifiedBy,
     classificationVerifiedAt: mapped.classificationVerifiedAt,
     anonymous: mapped.anonymous,
     department: mapped.department,
     shift: mapped.shift,
     complianceRequired: mapped.complianceRequired,
     complianceDueAt: mapped.complianceDueAt
       ? sanitizeIsoDate(mapped.complianceDueAt, mapped.date, mapped.createdAt)
       : undefined,
     photoUrl: String(mapped.photoUrl ?? "").trim(),
     source: mapped.source,
     sourceSyncedAt: mapped.sourceSyncedAt,
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

function sanitizeIsoDate(value: unknown, ...fallbacks: string[]): string {
  const utcOffsetMinutes = Number.isFinite(GOOGLE_SHEETS_UTC_OFFSET_MINUTES)
    ? GOOGLE_SHEETS_UTC_OFFSET_MINUTES
    : 180;
  const fromSheetLocalTime = (
    year: number,
    month: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0,
  ) =>
    new Date(
      Date.UTC(year, month - 1, day, hour, minute, second, millisecond) -
        utcOffsetMinutes * 60_000,
    );

  const attempt = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return "";

    const spreadsheetSerial = Number(trimmed);
    if (
      Number.isFinite(spreadsheetSerial) &&
      spreadsheetSerial >= 20000 &&
      spreadsheetSerial < 100000
    ) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      const parsed = new Date(
        excelEpoch + spreadsheetSerial * 86400000 - utcOffsetMinutes * 60_000,
      );
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    const localDate = trimmed.match(
      /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:[T,\s]+(\d{1,2}):?(\d{2})?(?::?(\d{2}))?\s*(AM|PM)?)?$/i,
    );
    if (localDate) {
      const [, firstRaw, secondRaw, yearRaw, hourRaw, minuteRaw, secondPartRaw, meridiemRaw] =
        localDate;
      const first = Number(firstRaw);
      const second = Number(secondRaw);
      const year = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
      const monthFirst =
        GOOGLE_SHEETS_DATE_ORDER === "mdy"
          ? second > 12 || first <= 12
          : GOOGLE_SHEETS_DATE_ORDER === "dmy"
            ? false
            : second > 12 && first <= 12;
      const day = monthFirst ? second : first;
      const month = monthFirst ? first : second;
      let hour = Number(hourRaw || 0);
      const minute = Number(minuteRaw || 0);
      const secondPart = Number(secondPartRaw || 0);
      const meridiem = meridiemRaw?.toUpperCase();
      if (meridiem === "PM" && hour < 12) hour += 12;
      if (meridiem === "AM" && hour === 12) hour = 0;

      const parsed = fromSheetLocalTime(year, month, day, hour, minute, secondPart);
      const localCheck = new Date(parsed.getTime() + utcOffsetMinutes * 60_000);
      if (
        localCheck.getUTCFullYear() === year &&
        localCheck.getUTCMonth() === month - 1 &&
        localCheck.getUTCDate() === day
      ) {
        return parsed.toISOString();
      }
    }

    const isoLocal = trimmed.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/,
    );
    if (isoLocal) {
      const [, year, month, day, hour, minute, second = "0"] = isoLocal;
      return fromSheetLocalTime(+year, +month, +day, +hour, +minute, +second).toISOString();
    }

    const parsed = new Date(trimmed);
    if (
      !Number.isNaN(parsed.getTime()) &&
      Number.isFinite(parsed.getTime()) &&
      parsed.getUTCFullYear() >= 2000 &&
      parsed.getUTCFullYear() <= 2100
    ) {
      return parsed.toISOString();
    }
    return "";
  };

  const primary = attempt(typeof value === "string" ? value : String(value ?? ""));
  if (primary) return primary;

  for (const fallback of fallbacks) {
    const result = attempt(fallback);
    if (result) return result;
  }

  return new Date().toISOString();
}

function getPlaceholderPhotoUrl(id: unknown, size = 80) {
  const shortId = String(id ?? "").slice(-3) || "N/A";
  return `https://placehold.co/${size}x${size}/1e293b/ffffff?text=${encodeURIComponent(shortId)}`;
}

function normalizeReportInput(input: any): ReportRow {
  return {
    id: input.id,
    date: sanitizeIsoDate(input.date),
    location: input.location,
    reporter: input.reporter,
    description: input.description,
    severity: input.severity,
    status: input.status,
    category: input.category,
    type: input.type,
    resolutionDays: input.resolutionDays ?? input.resolution_days,
    slaHours: input.slaHours ?? input.sla_hours,
    dueAt: sanitizeIsoDate(input.dueAt),
    assignedTo: input.assignedTo ?? input.assigned_to,
    assignedToCopy: JSON.stringify(
      Array.isArray(input.assignedToCopy) ? input.assignedToCopy : [],
    ),
    isNearMiss: (input.isNearMiss ?? input.is_near_miss) ? 1 : 0,
    isRecordable: (input.isRecordable ?? input.is_recordable) ? 1 : 0,
    isLostTimeInjury:
      (input.isLostTimeInjury ?? input.is_lost_time_injury) ? 1 : 0,
    medicalTreatmentCase:
      (input.medicalTreatmentCase ?? input.medical_treatment_case) ? 1 : 0,
    lostWorkDays: Number(input.lostWorkDays ?? input.lost_work_days ?? 0),
    restrictedWorkDays: Number(
      input.restrictedWorkDays ?? input.restricted_work_days ?? 0,
    ),
    classificationSource:
      input.classificationSource ?? input.classification_source,
    classificationVerifiedBy:
      input.classificationVerifiedBy ?? input.classification_verified_by,
    classificationVerifiedAt:
      input.classificationVerifiedAt ?? input.classification_verified_at,
    anonymous: input.anonymous ? 1 : 0,
    department: input.department,
    shift: input.shift,
    complianceRequired:
      (input.complianceRequired ?? input.compliance_required) ? 1 : 0,
    complianceDueAt: sanitizeIsoDate(input.complianceDueAt),
    photoUrl: input.photoUrl ?? input.photo_url ?? "",
    source: input.source ?? "manual",
    createdAt: input.createdAt ?? input.created_at ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? input.updated_at ?? new Date().toISOString(),
  };
}

export class ReportsService {
  async list(filters: ReportFilters = {}, page = 1, limit = 50) {
    page = Math.max(1, Math.trunc(page) || 1);
    limit = filters.all
      ? 0
      : Math.min(100, Math.max(1, Math.trunc(limit) || 50));
    if (isPgAvailable()) {
      return this.listPg(filters, page, limit);
    }
    return this.listSqlite(filters, page, limit);
  }

  private async listPg(filters: ReportFilters, page: number, limit: number) {
    const { whereSql, params } = buildPgFilter(filters);
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
          `SELECT * FROM reports WHERE ${whereSql} ORDER BY date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset],
        );

    return {
      data: rows.rows.map((row) => mapReport(row)).filter((row): row is NonNullable<ReturnType<typeof mapReport>> => row !== null),
      total: totalResult.rows[0]?.total ?? 0,
      page,
      limit: filters.all ? rows.rows.length : limit,
    };
  }

  private async listSqlite(
    filters: ReportFilters,
    page: number,
    limit: number,
  ) {
    const db = await getDb();
    const { whereSql, params } = buildSqliteFilter(filters);
    const offset = (page - 1) * limit;

    const totalRow = allRows(
      db,
      `SELECT COUNT(*) as total FROM reports WHERE ${whereSql}`,
      params,
    )[0];
    const rows = filters.all
      ? allRows(
          db,
          `SELECT * FROM reports WHERE ${whereSql} ORDER BY date DESC`,
          params,
        )
      : allRows(
          db,
          `SELECT * FROM reports WHERE ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`,
          [...params, limit, offset],
        );

    return {
      data: rows.map((row) => mapReport(row)).filter((row): row is NonNullable<ReturnType<typeof mapReport>> => row !== null),
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
        compliance_required, compliance_due_at, photo_url, source,
        is_recordable, is_lost_time_injury, medical_treatment_case,
        lost_work_days, restricted_work_days, classification_source,
        classification_verified_by, classification_verified_at
      ) VALUES ($1, NOW(), $2, $3, $4, $5, 'Open', $6, $7, $8, $9, FALSE, $10, $11, $12, $13, $14, $15, 'manual',
        $16, $17, $18, $19, $20, $21, $22, $23)`,
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
        Boolean(input.isRecordable),
        Boolean(input.isLostTimeInjury),
        Boolean(input.medicalTreatmentCase),
        Number(input.lostWorkDays ?? 0),
        Number(input.restrictedWorkDays ?? 0),
        input.classificationSource ?? null,
        input.classificationSource
          ? request?.user?.email || request?.user?.id || null
          : null,
        input.classificationSource ? now.toISOString() : null,
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
        complianceRequired, complianceDueAt, photoUrl, source, createdAt,
        isRecordable, isLostTimeInjury, medicalTreatmentCase, lostWorkDays,
        restrictedWorkDays, classificationSource, classificationVerifiedBy,
        classificationVerifiedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.isRecordable ? 1 : 0,
        input.isLostTimeInjury ? 1 : 0,
        input.medicalTreatmentCase ? 1 : 0,
        Number(input.lostWorkDays ?? 0),
        Number(input.restrictedWorkDays ?? 0),
        input.classificationSource ?? null,
        input.classificationSource
          ? request?.user?.email || request?.user?.id || null
          : null,
        input.classificationSource ? createdAt : null,
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
    await scheduleFollowupsForReport(id).catch(() => {});
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
    await scheduleFollowupsForReport(id).catch(() => {});
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
      isRecordable: "is_recordable",
      isLostTimeInjury: "is_lost_time_injury",
      medicalTreatmentCase: "medical_treatment_case",
      lostWorkDays: "lost_work_days",
      restrictedWorkDays: "restricted_work_days",
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
    const classificationFields = [
      "isRecordable",
      "isLostTimeInjury",
      "medicalTreatmentCase",
      "lostWorkDays",
      "restrictedWorkDays",
    ];
    if (classificationFields.some((field) => fields[field] !== undefined)) {
      sets.push(`classification_source = $${idx++}`);
      params.push("manual-verified");
      sets.push(`classification_verified_by = $${idx++}`);
      params.push(request?.user?.email || request?.user?.id || "system");
      sets.push("classification_verified_at = NOW()");
    }
    if (sets.length === 0) return this.getById(id);
    params.push(id);

    const updatedRow = await pgPool.query(
      `UPDATE reports SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params,
    );
    if (!updatedRow.rows[0]) return null;
    const after = mapReport(updatedRow.rows[0]);
    if (!after) return null;

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
      isRecordable: "isRecordable",
      isLostTimeInjury: "isLostTimeInjury",
      medicalTreatmentCase: "medicalTreatmentCase",
      lostWorkDays: "lostWorkDays",
      restrictedWorkDays: "restrictedWorkDays",
    };

    const sets: string[] = [];
    const params: any[] = [];

    for (const [inputKey, column] of Object.entries(allowed)) {
      if (fields[inputKey] !== undefined) {
        sets.push(`${column} = ?`);
        params.push(fields[inputKey]);
      }
    }
    const classificationFields = [
      "isRecordable",
      "isLostTimeInjury",
      "medicalTreatmentCase",
      "lostWorkDays",
      "restrictedWorkDays",
    ];
    if (classificationFields.some((field) => fields[field] !== undefined)) {
      sets.push("classificationSource = ?");
      params.push("manual-verified");
      sets.push("classificationVerifiedBy = ?");
      params.push(request?.user?.email || request?.user?.id || "system");
      sets.push("classificationVerifiedAt = ?");
      params.push(new Date().toISOString());
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

  async summary(filters: ReportFilters = {}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    const now = new Date();

    function readPositiveNumber(value: unknown, fallback: number) {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    }

    const totalWorkforce = readPositiveNumber(process.env.TOTAL_WORKFORCE, 250);
    const dailyWorkHours = readPositiveNumber(process.env.DAILY_WORK_HOURS, 8);
    const workDaysPerMonth = readPositiveNumber(process.env.WORK_DAYS_PER_MONTH, 26);
    const lostDayHours = readPositiveNumber(process.env.LOST_DAY_HOURS, 8);

    const periodMultiplier =
      filters.days && String(filters.days) !== "9999"
        ? Math.max(Number(filters.days) / 30, 1 / 30)
        : 12;
    const totalManhoursWorked = Math.round(
      totalWorkforce * dailyWorkHours * workDaysPerMonth * periodMultiplier,
    );

    if (isPgAvailable()) {
      const { whereSql, params } = buildPgFilter(filters);
      const todayParam = `$${params.length + 1}`;
      const weekParam = `$${params.length + 2}`;
      const nowParam = `$${params.length + 3}`;
      const result = await pgPool.query(
        `SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE status = 'Open')::int AS open,
          COUNT(*) FILTER (WHERE status = 'Closed')::int AS closed,
          COUNT(*) FILTER (WHERE date >= ${todayParam})::int AS today,
          COUNT(*) FILTER (WHERE date >= ${weekParam})::int AS week,
          COUNT(*) FILTER (WHERE severity = 'Critical' AND status != 'Closed')::int AS "criticalOpen",
          COUNT(*) FILTER (WHERE status != 'Closed' AND due_at IS NOT NULL AND due_at < ${nowParam})::int AS overdue,
          COALESCE(ROUND(AVG(resolution_days) FILTER (WHERE status = 'Closed' AND resolution_days IS NOT NULL), 1), 0)::float AS "avgResolution",
          COUNT(*) FILTER (WHERE is_recordable = TRUE)::int AS "recordableIncidents",
          COUNT(*) FILTER (WHERE is_lost_time_injury = TRUE)::int AS "lostTimeInjuries",
          COUNT(*) FILTER (WHERE medical_treatment_case = TRUE)::int AS "medicalTreatmentCases",
          COALESCE(SUM(lost_work_days), 0)::int AS "lostWorkDays",
          COALESCE(SUM(restricted_work_days), 0)::int AS "restrictedWorkDays",
          COUNT(*) FILTER (WHERE classification_verified_at IS NULL)::int AS "unclassified",
          COUNT(*) FILTER (WHERE is_near_miss = TRUE OR LOWER(description) LIKE '%near miss%' OR LOWER(description) LIKE '%near-miss%' OR LOWER(category) LIKE '%near miss%')::int AS "nearMissCount",
          COUNT(*) FILTER (WHERE severity = 'Critical')::int AS "severityCritical",
          COUNT(*) FILTER (WHERE severity = 'High')::int AS "severityHigh",
          COUNT(*) FILTER (WHERE severity = 'Medium')::int AS "severityMedium",
          COUNT(*) FILTER (WHERE severity = 'Low')::int AS "severityLow",
          COUNT(*) FILTER (WHERE status = 'Closed')::int AS "closedCount",
          COALESCE(MIN(CASE WHEN is_lost_time_injury = TRUE THEN date END), NULL)::text AS "lastLtiDate"
        FROM reports WHERE ${whereSql}`,
        [
          ...params,
          today.toISOString(),
          weekAgo.toISOString(),
          now.toISOString(),
        ],
      );
      const row = result.rows[0];
      const lastLtiDate = row?.lastLtiDate ? new Date(row.lastLtiDate) : null;
      const daysSinceLastLti = lastLtiDate
        ? Math.max(0, Math.floor((Date.now() - lastLtiDate.getTime()) / 86400000))
        : row?.lostTimeInjuries ? 0 : -1;
      return {
        ...row,
        daysSinceLastLti,
        severityCounts: {
          Critical: row?.severityCritical ?? 0,
          High: row?.severityHigh ?? 0,
          Medium: row?.severityMedium ?? 0,
          Low: row?.severityLow ?? 0,
        },
        totalWorkforce,
        dailyWorkHours,
        workDaysPerMonth,
        lostDayHours,
        totalManhoursWorked,
      };
    }

    const db = await getDb();
    const { whereSql, params } = buildSqliteFilter(filters);
    const row = allRows(
      db,
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) AS today,
        SUM(CASE WHEN date >= ? THEN 1 ELSE 0 END) AS week,
        SUM(CASE WHEN severity = 'Critical' AND status != 'Closed' THEN 1 ELSE 0 END) AS criticalOpen,
        SUM(CASE WHEN status != 'Closed' AND dueAt IS NOT NULL AND dueAt < ? THEN 1 ELSE 0 END) AS overdue,
        COALESCE(AVG(CASE WHEN status = 'Closed' THEN resolutionDays END), 0) AS avgResolution,
        SUM(CASE WHEN isRecordable = 1 THEN 1 ELSE 0 END) AS recordableIncidents,
        SUM(CASE WHEN isLostTimeInjury = 1 THEN 1 ELSE 0 END) AS lostTimeInjuries,
        SUM(CASE WHEN medicalTreatmentCase = 1 THEN 1 ELSE 0 END) AS medicalTreatmentCases,
        COALESCE(SUM(lostWorkDays), 0) AS lostWorkDays,
        COALESCE(SUM(restrictedWorkDays), 0) AS restrictedWorkDays,
        SUM(CASE WHEN classificationVerifiedAt IS NULL THEN 1 ELSE 0 END) AS unclassified,
        SUM(CASE WHEN isNearMiss = 1 OR LOWER(description) LIKE '%near miss%' OR LOWER(description) LIKE '%near-miss%' OR LOWER(category) LIKE '%near miss%' THEN 1 ELSE 0 END) AS nearMissCount,
        SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) AS severityCritical,
        SUM(CASE WHEN severity = 'High' THEN 1 ELSE 0 END) AS severityHigh,
        SUM(CASE WHEN severity = 'Medium' THEN 1 ELSE 0 END) AS severityMedium,
        SUM(CASE WHEN severity = 'Low' THEN 1 ELSE 0 END) AS severityLow,
        SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) AS closedCount,
        MIN(CASE WHEN isLostTimeInjury = 1 THEN date END) AS lastLtiDate
      FROM reports WHERE ${whereSql}`,
      [
        today.toISOString(),
        weekAgo.toISOString(),
        now.toISOString(),
        ...params,
      ],
    )[0] as Record<string, unknown> | undefined;

    const num = (value: unknown) => Number(value ?? 0);
    const lastLti = row?.lastLtiDate ? new Date(String(row.lastLtiDate)) : null;
    const daysSinceLastLti = lastLti
      ? Math.max(0, Math.floor((Date.now() - lastLti.getTime()) / 86400000))
      : row?.lostTimeInjuries ? 0 : -1;
    return {
      total: num(row?.total),
      open: num(row?.open),
      closed: num(row?.closed),
      today: num(row?.today),
      week: num(row?.week),
      criticalOpen: num(row?.criticalOpen),
      overdue: num(row?.overdue),
      avgResolution: Math.round(num(row?.avgResolution) * 10) / 10,
      recordableIncidents: num(row?.recordableIncidents),
      lostTimeInjuries: num(row?.lostTimeInjuries),
      medicalTreatmentCases: num(row?.medicalTreatmentCases),
      lostWorkDays: num(row?.lostWorkDays),
      restrictedWorkDays: num(row?.restrictedWorkDays),
      unclassified: num(row?.unclassified),
      nearMissCount: num(row?.nearMissCount),
      severityCounts: {
        Critical: num(row?.severityCritical),
        High: num(row?.severityHigh),
        Medium: num(row?.severityMedium),
        Low: num(row?.severityLow),
      },
      closedCount: num(row?.closedCount),
      daysSinceLastLti,
      totalWorkforce,
      dailyWorkHours,
      workDaysPerMonth,
      lostDayHours,
      totalManhoursWorked,
    };
  }

  private async legacySummary() {
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

  async generateExport(filters: ReportFilters = {}) {
    const result = await this.list({ ...filters, all: true }, 1, 1);
    return result.data;
  }

  async bulkUpdateStatus(ids: string[], status: string, request?: any) {
    const cleanIds = ids.filter((id) => typeof id === "string" && id.trim().length > 0);
    if (cleanIds.length === 0) return { updated: 0, ids: [] };

    if (isPgAvailable()) {
      return this.bulkUpdateStatusPg(cleanIds, status, request);
    }
    return this.bulkUpdateStatusSqlite(cleanIds, status, request);
  }

  private async bulkUpdateStatusPg(ids: string[], status: string, request?: any) {
    const beforeStatuses = new Map<string, string | undefined>();
    for (const id of ids) {
      const existing = await this.getById(id);
      if (existing) beforeStatuses.set(id, existing.status);
    }

    const result = await pgPool.query(
      "UPDATE reports SET status = $1, updated_at = NOW() WHERE id = ANY($2::text[]) RETURNING id",
      [status, ids],
    );

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.status.bulk_updated",
        resourceType: "report",
        resourceId: ids.join(","),
        context: {
          detail: `Bulk updated ${result.rowCount} reports to ${status}`,
          count: result.rowCount,
        },
        actor: request.user,
        request,
      });
    }

    for (const id of ids) {
      await syncReportWorkflowState({
        reportId: id,
        state: status,
        context: { source: "report.status.bulk_updated" },
      });
    }

    return { updated: result.rowCount ?? 0, ids: result.rows.map((r) => r.id) };
  }

  private async bulkUpdateStatusSqlite(ids: string[], status: string, request?: any) {
    const db = await getDb();
    const placeholders = ids.map(() => "?").join(",");
    const now = new Date().toISOString();
    const rows = allRows(
      db,
      `UPDATE reports SET status = ?, updatedAt = ? WHERE id IN (${placeholders}) RETURNING id`,
      [status, now, ...ids],
    );

    if (request) {
      await writeAuditLogBestEffort({
        action: "report.status.bulk_updated",
        resourceType: "report",
        resourceId: ids.join(","),
        context: {
          detail: `Bulk updated ${rows.length} reports to ${status}`,
          count: rows.length,
        },
        actor: request.user,
        request,
      });
    }

    await saveDb(db);
    return { updated: rows.length, ids: rows.map((r: any) => r.id) };
  }
}

export const reportsService = new ReportsService();
