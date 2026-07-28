import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";

export const ObjectiveStatusSchema = z.enum([
  "Not Started",
  "In Progress",
  "On Track",
  "At Risk",
  "Off Track",
  "Achieved",
  "Cancelled",
]);
export type ObjectiveStatus = z.infer<typeof ObjectiveStatusSchema>;

export const EHSObjectiveSchema = z.object({
  id: z.string().optional(),
  objectiveNo: z.string().optional(),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional(),
  category: z.string().min(1).max(100),
  department: z.string().min(1).max(100),
  site: z.string().min(1).max(200),
  owner: z.string().min(1).max(200),
  targetValue: z.number().optional(),
  currentValue: z.number().optional(),
  unit: z.string().max(50).optional(),
  baseline: z.string().max(200).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  status: ObjectiveStatusSchema.default("Not Started"),
  progress: z.number().min(0).max(100).default(0),
  linkedRisks: z.string().optional().default("[]"),
  linkedKpis: z.string().optional().default("[]"),
  linkedCapaIds: z.string().optional().default("[]"),
  evidence: z.string().max(2000).optional(),
  lastReviewed: z.string().optional(),
  reviewedBy: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});

export type EHSObjectiveInput = z.infer<typeof EHSObjectiveSchema>;
type ObjectiveRecord = EHSObjectiveInput & { id: string; createdAt: string; updatedAt: string };

const now = () => new Date().toISOString();

function mapRow(row: Record<string, unknown>): ObjectiveRecord {
  return {
    id: String(row.id),
    objectiveNo: row.objective_no ? String(row.objective_no) : undefined,
    title: String(row.title ?? ""),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category ?? ""),
    department: String(row.department ?? ""),
    site: String(row.site ?? ""),
    owner: String(row.owner ?? ""),
    targetValue: row.target_value == null ? undefined : Number(row.target_value),
    currentValue: row.current_value == null ? undefined : Number(row.current_value),
    unit: row.unit ? String(row.unit) : undefined,
    baseline: row.baseline ? String(row.baseline) : undefined,
    startDate: row.start_date ? new Date(String(row.start_date)).toISOString() : "",
    endDate: row.end_date ? new Date(String(row.end_date)).toISOString() : "",
    status: String(row.status ?? "Not Started") as ObjectiveStatus,
    progress: Number(row.progress ?? 0),
    linkedRisks: String(row.linked_risks ?? "[]"),
    linkedKpis: String(row.linked_kpis ?? "[]"),
    linkedCapaIds: String(row.linked_capa_ids ?? "[]"),
    evidence: row.evidence ? String(row.evidence) : undefined,
    lastReviewed: row.last_reviewed ? new Date(String(row.last_reviewed)).toISOString() : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by ?? "System"),
    createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
  };
}

export class ObjectivesService {
  private validate(data: EHSObjectiveInput) {
    return EHSObjectiveSchema.parse(data);
  }

  async getAll(filters?: Record<string, unknown>): Promise<ObjectiveRecord[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    const columns: Record<string, string> = {
      id: "id",
      objectiveNo: "objective_no",
      title: "title",
      category: "category",
      department: "department",
      site: "site",
      owner: "owner",
      status: "status",
      createdBy: "created_by",
    };

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        const column = columns[key];
        if (!column || value === undefined || value === null || value === "") return;
        params.push(value);
        where.push(`${column} = $${params.length}`);
      });
    }

    const sql = `SELECT * FROM ehs_objectives${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
    const result = await pgPool.query(sql, params);
    return result.rows.map((row) => mapRow(row as Record<string, unknown>));
  }

  async getById(id: string): Promise<ObjectiveRecord | null> {
    const result = await pgPool.query("SELECT * FROM ehs_objectives WHERE id = $1", [id]);
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async createObjective(data: EHSObjectiveInput): Promise<ObjectiveRecord> {
    const validated = this.validate({
      ...data,
      objectiveNo: data.objectiveNo ?? `OBJ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
    });
    const id = validated.id || uuidv4();
    const timestamp = now();
    const result = await pgPool.query(
      `INSERT INTO ehs_objectives (
        id, objective_no, title, description, category, department, site, owner,
        target_value, current_value, unit, baseline, start_date, end_date, status,
        progress, linked_risks, linked_kpis, linked_capa_ids, evidence, last_reviewed,
        reviewed_by, notes, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26
      )
      RETURNING *`,
      [
        id,
        validated.objectiveNo ?? null,
        validated.title,
        validated.description ?? null,
        validated.category,
        validated.department,
        validated.site,
        validated.owner,
        validated.targetValue ?? null,
        validated.currentValue ?? null,
        validated.unit ?? null,
        validated.baseline ?? null,
        validated.startDate,
        validated.endDate,
        validated.status ?? "Not Started",
        validated.progress ?? 0,
        validated.linkedRisks ?? "[]",
        validated.linkedKpis ?? "[]",
        validated.linkedCapaIds ?? "[]",
        validated.evidence ?? null,
        validated.lastReviewed ?? null,
        validated.reviewedBy ?? null,
        validated.notes ?? null,
        validated.createdBy,
        timestamp,
        timestamp,
      ],
    );
    return mapRow(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, data: Record<string, unknown>): Promise<ObjectiveRecord | null> {
    const existing = await this.getById(id);
    if (!existing) throw new Error("Objective not found");

    const fields: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, string> = {
      objectiveNo: "objective_no",
      title: "title",
      description: "description",
      category: "category",
      department: "department",
      site: "site",
      owner: "owner",
      targetValue: "target_value",
      currentValue: "current_value",
      unit: "unit",
      baseline: "baseline",
      startDate: "start_date",
      endDate: "end_date",
      status: "status",
      progress: "progress",
      linkedRisks: "linked_risks",
      linkedKpis: "linked_kpis",
      linkedCapaIds: "linked_capa_ids",
      evidence: "evidence",
      lastReviewed: "last_reviewed",
      reviewedBy: "reviewed_by",
      notes: "notes",
      createdBy: "created_by",
    };

    Object.entries(data).forEach(([key, value]) => {
      const column = map[key];
      if (!column || value === undefined) return;
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    });

    if (fields.length === 0) return existing;

    params.push(now());
    fields.push(`updated_at = $${params.length}`);
    params.push(id);

    const result = await pgPool.query(
      `UPDATE ehs_objectives SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`,
      params,
    );
    return result.rows[0] ? mapRow(result.rows[0] as Record<string, unknown>) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await pgPool.query("DELETE FROM ehs_objectives WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getByStatus(status: string) {
    return this.getAll({ status });
  }

  async getByDepartment(department: string) {
    return this.getAll({ department });
  }

  async getByOwner(owner: string) {
    return this.getAll({ owner });
  }

  async getAtRisk() {
    return this.getAll({ status: "At Risk" });
  }

  async getOffTrack() {
    return this.getAll({ status: "Off Track" });
  }

  async getStats() {
    const result = await pgPool.query("SELECT status FROM ehs_objectives");
    const all = result.rows;
    const total = all.length;
    const achieved = all.filter((r: any) => r.status === "Achieved").length;
    const onTrack = all.filter((r: any) => r.status === "On Track").length;
    const atRisk = all.filter((r: any) => r.status === "At Risk").length;
    const offTrack = all.filter((r: any) => r.status === "Off Track").length;
    const notStarted = all.filter((r: any) => r.status === "Not Started").length;
    const completionRate = total > 0 ? Math.round((achieved / total) * 100) : 0;
    return { total, achieved, onTrack, atRisk, offTrack, notStarted, completionRate };
  }
}
