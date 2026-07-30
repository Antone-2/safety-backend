import { Pool } from "pg";
import { Incident, IncidentInput, IncidentType, IncidentSeverity, IncidentStatus } from "./incidents.types.js";

type ColumnMap = Set<string>;

function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export class IncidentsRepository {
  private readonly columnCache = new Map<string, Promise<ColumnMap>>();

  constructor(private pool: Pool) {}

  private async getTableColumns(table: string): Promise<ColumnMap> {
    let cached = this.columnCache.get(table);
    if (!cached) {
      cached = this.pool
        .query(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = current_schema()
             AND table_name = $1`,
          [table],
        )
        .then((result) => new Set(result.rows.map((row) => normalizeColumnName(String(row.column_name)))));
      this.columnCache.set(table, cached);
    }
    return cached;
  }

  private resolveColumn(columns: ColumnMap, ...candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (columns.has(normalizeColumnName(candidate))) {
        return candidate;
      }
    }
    return null;
  }

  private requireColumn(columns: ColumnMap, table: string, ...candidates: string[]): string {
    const column = this.resolveColumn(columns, ...candidates);
    if (!column) {
      throw new Error(`Missing required column on ${table}: ${candidates.join(", ")}`);
    }
    return column;
  }

  private selectColumn(columns: ColumnMap, alias: string, ...candidates: string[]): string {
    const column = this.requireColumn(columns, "reports", ...candidates);
    return `${column} AS ${alias}`;
  }

  private async getReportsSelectSql(whereSql?: string, includeOrder = true): Promise<string> {
    const columns = await this.getTableColumns("reports");
    const createdAt = this.requireColumn(columns, "reports", "created_at", "createdAt", "createdat", "date");
    const updatedAt = this.resolveColumn(columns, "updated_at", "updatedAt", "updatedat", "created_at", "createdAt", "createdat", "date") ?? createdAt;

    return `SELECT
      ${this.selectColumn(columns, "id", "id")},
      ${this.selectColumn(columns, "type", "type")},
      ${this.selectColumn(columns, "severity", "severity")},
      ${this.selectColumn(columns, "status", "status")},
      ${this.selectColumn(columns, "location", "location")},
      ${this.selectColumn(columns, "department", "department")},
      ${this.selectColumn(columns, "shift", "shift")},
      ${this.selectColumn(columns, "description", "description")},
      ${this.selectColumn(columns, "reporter", "reporter")},
      ${this.selectColumn(columns, "reporter_email", "reporter_email", "reporterEmail", "reporteremail")},
      ${this.selectColumn(columns, "reporter_phone", "reporter_phone", "reporterPhone", "reporterphone")},
      ${this.selectColumn(columns, "anonymous", "anonymous")},
      ${this.selectColumn(columns, "is_near_miss", "is_near_miss", "isNearMiss", "isnearmiss")},
      ${this.selectColumn(columns, "photo_url", "photo_url", "photoUrl", "photourl")},
      ${this.selectColumn(columns, "assigned_to", "assigned_to", "assignedTo", "assignedto")},
      ${this.selectColumn(columns, "assigned_to_copy", "assigned_to_copy", "assignedToCopy", "assignedtocopy")},
      ${this.selectColumn(columns, "sla_hours", "sla_hours", "slaHours", "slahours")},
      ${this.selectColumn(columns, "due_at", "due_at", "dueAt", "dueat")},
      ${this.selectColumn(columns, "resolution_days", "resolution_days", "resolutionDays", "resolutiondays")},
      ${this.selectColumn(columns, "compliance_required", "compliance_required", "complianceRequired", "compliancerequired")},
      ${this.selectColumn(columns, "compliance_due_at", "compliance_due_at", "complianceDueAt", "compliancedueat")},
      ${this.selectColumn(columns, "source", "source")},
      ${createdAt} AS created_at,
      ${updatedAt} AS updated_at
      FROM reports
      ${whereSql ? `${whereSql} AND ` : "WHERE "}
        (
          LOWER(COALESCE(category, '')) LIKE '%incident%'
          OR LOWER(COALESCE(category, '')) LIKE '%accident%'
          OR LOWER(COALESCE(category, '')) LIKE '%near miss%'
          OR LOWER(COALESCE(type, '')) IN ('near miss', 'first aid', 'medical treatment', 'lost time', 'fatality', 'property damage', 'environmental')
        )
      ${includeOrder ? `ORDER BY ${createdAt} DESC` : ""}`;
  }

  async findAll(filters?: Record<string, unknown>): Promise<Incident[]> {
    const columns = await this.getTableColumns("incidents");
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const column = this.resolveColumn(columns, key, key.toLowerCase(), key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
          if (!column) return;
          if (key === "location" || key === "department" || key === "reporter" || key === "assignedTo") {
            where.push(`${column} ILIKE $${idx}`);
            params.push(`%${value}%`);
          } else {
            where.push(`${column} = $${idx}`);
            params.push(value);
          }
          idx++;
        }
      });
    }

    const createdAt = this.requireColumn(columns, "incidents", "created_at", "createdAt", "createdat");
    const sql = `SELECT * FROM incidents ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${createdAt} DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows as Incident[];
  }

  async findAllReports(): Promise<Record<string, unknown>[]> {
    const result = await this.pool.query(await this.getReportsSelectSql());
    return result.rows as Record<string, unknown>[];
  }

  async findReportById(id: string): Promise<Record<string, unknown> | null> {
    const result = await this.pool.query(await this.getReportsSelectSql("WHERE id = $1", false), [id]);
    return (result.rows[0] as Record<string, unknown>) || null;
  }

  async findById(id: string): Promise<Incident | null> {
    const result = await this.pool.query("SELECT * FROM incidents WHERE id = $1", [id]);
    return (result.rows[0] as Incident) || null;
  }

  async create(data: IncidentInput): Promise<Incident> {
    const now = new Date().toISOString();
    const result = await this.pool.query(
      `INSERT INTO incidents (id, type, severity, status, location, department, shift, description, reporter, reporter_email, reporter_phone, anonymous, is_near_miss, photo_url, photos, assigned_to, assigned_to_copy, sla_hours, due_at, resolution_days, root_cause, corrective_action, preventive_action, investigation_method, witness_statement, regulatory_notification_required, regulatory_notification_date, compliance_required, compliance_due_at, source, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $16::jsonb, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
       RETURNING *`,
      [
        data.type,
        data.severity,
        data.status ?? "Open",
        data.location,
        data.department,
        data.shift,
        data.description,
        data.reporter,
        data.reporterEmail ?? null,
        data.reporterPhone ?? null,
        data.anonymous ? 1 : 0,
        data.isNearMiss ? 1 : 0,
        data.photoUrl ?? null,
        JSON.stringify(data.photos ?? []),
        data.assignedTo ?? null,
        JSON.stringify(data.assignedToCopy ?? []),
        data.slaHours ?? 24,
        data.dueAt ?? null,
        data.resolutionDays ?? null,
        data.rootCause ?? null,
        data.correctiveAction ?? null,
        data.preventiveAction ?? null,
        data.investigationMethod ?? null,
        data.witnessStatement ?? null,
        data.regulatoryNotificationRequired ? 1 : 0,
        data.regulatoryNotificationDate ?? null,
        data.complianceRequired ? 1 : 0,
        data.complianceDueAt ?? null,
        data.source ?? "manual",
        now,
        now,
      ]
    );
    return result.rows[0] as Incident;
  }

  async update(id: string, data: Partial<IncidentInput>): Promise<Incident | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      severity: "severity",
      status: "status",
      location: "location",
      department: "department",
      shift: "shift",
      description: "description",
      reporter: "reporter",
      reporterEmail: "reporter_email",
      reporterPhone: "reporter_phone",
      anonymous: "anonymous",
      isNearMiss: "is_near_miss",
      photoUrl: "photo_url",
      photos: "photos",
      assignedTo: "assigned_to",
      assignedToCopy: "assigned_to_copy",
      slaHours: "sla_hours",
      dueAt: "due_at",
      resolutionDays: "resolution_days",
      rootCause: "root_cause",
      correctiveAction: "corrective_action",
      preventiveAction: "preventive_action",
      investigationMethod: "investigation_method",
      witnessStatement: "witness_statement",
      regulatoryNotificationRequired: "regulatory_notification_required",
      regulatoryNotificationDate: "regulatory_notification_date",
      complianceRequired: "compliance_required",
      complianceDueAt: "compliance_due_at",
      source: "source",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "photos" || key === "assignedToCopy") {
          fields.push(`${map[key]} = $${idx}::jsonb`);
          params.push(JSON.stringify(value));
        } else if (key === "anonymous" || key === "isNearMiss" || key === "regulatoryNotificationRequired" || key === "complianceRequired") {
          fields.push(`${map[key]} = $${idx}`);
          params.push((value as boolean) ? 1 : 0);
        } else {
          fields.push(`${map[key]} = $${idx}`);
          params.push(value);
        }
        idx++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE incidents SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return (result.rows[0] as Incident) || null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.pool.query("DELETE FROM incidents WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    const columns = await this.getTableColumns("incidents");
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const column = this.resolveColumn(columns, key, key.toLowerCase(), key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`));
          if (!column) return;
          where.push(`${column} = $${idx}`);
          params.push(value);
          idx++;
        }
      });
    }

    const sql = `SELECT COUNT(*) as count FROM incidents ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}`;
    const result = await this.pool.query(sql, params);
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }
}
