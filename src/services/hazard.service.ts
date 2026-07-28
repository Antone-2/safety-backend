import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";

export const HazardCategorySchema = z.enum([
  "Slip/Trip",
  "Chemical Spill",
  "PPE Violation",
  "Electrical",
  "Falling Object",
  "Vehicle/Forklift",
  "Inhalation/Fumes",
  "Fire/Ignition",
  "Manual Handling",
  "Noise Exposure",
  "Confined Space",
  "Fall from Height",
  "Other",
]);
export type HazardCategory = z.infer<typeof HazardCategorySchema>;

export const HazardReportSchema = z.object({
  id: z.string().optional(),
  reportNo: z.string().optional(),
  category: HazardCategorySchema,
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  severity: z.enum(["Low", "Medium", "High", "Critical"]),
  riskLevel: z.string().optional(),
  existingControls: z.string().max(2000).optional(),
  recommendedActions: z.string().max(2000).optional(),
  immediateActionTaken: z.string().max(2000).optional(),
  reportedBy: z.string().min(1).max(200),
  reportedAt: z.string().optional(),
  status: z.string().default("Open"),
  assignedTo: z.string().max(200).optional(),
  resolvedAt: z.string().optional(),
  resolution: z.string().max(2000).optional(),
  photoUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type HazardReportInput = z.infer<typeof HazardReportSchema>;

type HazardRecord = HazardReportInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

const now = () => new Date().toISOString();

function mapRow(row: Record<string, unknown>): HazardRecord {
  return {
    id: String(row.id),
    reportNo: row.report_no ? String(row.report_no) : undefined,
    category: String(row.category ?? "Other") as HazardCategory,
    location: String(row.location ?? ""),
    department: String(row.department ?? ""),
    description: String(row.description ?? ""),
    severity: String(row.severity ?? "Low") as HazardReportInput["severity"],
    riskLevel: row.risk_level ? String(row.risk_level) : undefined,
    existingControls: row.existing_controls ? String(row.existing_controls) : undefined,
    recommendedActions: row.recommended_actions ? String(row.recommended_actions) : undefined,
    immediateActionTaken: row.immediate_action_taken ? String(row.immediate_action_taken) : undefined,
    reportedBy: String(row.reported_by ?? ""),
    reportedAt: row.reported_at ? new Date(String(row.reported_at)).toISOString() : undefined,
    status: String(row.status ?? "Open"),
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)).toISOString() : undefined,
    resolution: row.resolution ? String(row.resolution) : undefined,
    photoUrl: row.photo_url ? String(row.photo_url) : undefined,
    createdBy: String(row.created_by ?? "System"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
  };
}

export class HazardService {
  async getAll(filters?: Record<string, unknown>): Promise<HazardRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const columns: Record<string, string> = {
      category: "category",
      location: "location",
      department: "department",
      severity: "severity",
      status: "status",
      assignedTo: "assigned_to",
      reportedBy: "reported_by",
    };

    Object.entries(filters ?? {}).forEach(([key, value]) => {
      const column = columns[key];
      if (!column || value === undefined || value === null || value === "") return;
      params.push(value);
      where.push(`${column} = $${params.length}`);
    });

    const sql = `SELECT * FROM hazard_reports${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const result = await pgPool.query(sql, params);
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<HazardRecord | null> {
    const result = await pgPool.query("SELECT * FROM hazard_reports WHERE id = $1", [id]);
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async createReport(data: HazardReportInput): Promise<HazardRecord> {
    const validated = HazardReportSchema.parse({
      ...data,
      reportNo: data.reportNo ?? `HAZ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    const id = validated.id || uuidv4();
    const timestamp = now();
    const result = await pgPool.query(
      `INSERT INTO hazard_reports (
        id, report_no, category, location, department, description, severity, risk_level,
        existing_controls, recommended_actions, immediate_action_taken, reported_by, reported_at,
        status, assigned_to, resolved_at, resolution, photo_url, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20, $21
      ) RETURNING *`,
      [
        id,
        validated.reportNo ?? null,
        validated.category,
        validated.location,
        validated.department,
        validated.description,
        validated.severity,
        validated.riskLevel ?? null,
        validated.existingControls ?? null,
        validated.recommendedActions ?? null,
        validated.immediateActionTaken ?? null,
        validated.reportedBy,
        validated.reportedAt ?? null,
        validated.status ?? "Open",
        validated.assignedTo ?? null,
        validated.resolvedAt ?? null,
        validated.resolution ?? null,
        validated.photoUrl ?? null,
        validated.createdBy,
        timestamp,
        timestamp,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, data: Record<string, unknown>): Promise<HazardRecord | null> {
    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      reportNo: "report_no",
      category: "category",
      location: "location",
      department: "department",
      description: "description",
      severity: "severity",
      riskLevel: "risk_level",
      existingControls: "existing_controls",
      recommendedActions: "recommended_actions",
      immediateActionTaken: "immediate_action_taken",
      reportedBy: "reported_by",
      reportedAt: "reported_at",
      status: "status",
      assignedTo: "assigned_to",
      resolvedAt: "resolved_at",
      resolution: "resolution",
      photoUrl: "photo_url",
      createdBy: "created_by",
    };

    Object.entries(data).forEach(([key, value]) => {
      const column = map[key];
      if (!column || value === undefined) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    });

    if (fields.length === 0) return this.getById(id);

    params.push(now());
    fields.push(`updated_at = $${params.length}`);
    params.push(id);

    const result = await pgPool.query(
      `UPDATE hazard_reports SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query("DELETE FROM hazard_reports WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getReports(filters?: Record<string, unknown>) {
    return this.getAll(filters);
  }

  async getReportById(id: string) {
    return this.getById(id);
  }

  async getStats() {
    const result = await pgPool.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Open') AS open,
        COUNT(*) FILTER (WHERE severity = 'Critical') AS critical,
        COUNT(*) FILTER (WHERE severity = 'High') AS high
      FROM hazard_reports
    `);
    return {
      total: Number(result.rows[0]?.total ?? 0),
      open: Number(result.rows[0]?.open ?? 0),
      critical: Number(result.rows[0]?.critical ?? 0),
      high: Number(result.rows[0]?.high ?? 0),
    };
  }
}
