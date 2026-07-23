import { BaseService } from "./base.service.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

export const JsaStatusSchema = z.enum(["draft", "in-review", "active", "completed", "archived"]);
export type JsaStatus = z.infer<typeof JsaStatusSchema>;

export const JsaStepSchema = z.object({
  id: z.string(),
  description: z.string().min(1).max(1000),
  hazards: z.array(z.string()),
  controls: z.array(z.string()),
  existingRisk: z.enum(["Low", "Medium", "High", "Critical"]),
  residualRisk: z.enum(["Low", "Medium", "High", "Critical"]),
});

export const JsaSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  status: JsaStatusSchema.default("draft"),
  steps: z.array(JsaStepSchema).optional().default([]),
  createdBy: z.string().min(1).max(200),
  reviewedBy: z.string().max(200).optional(),
  reviewedAt: z.string().optional(),
});

export type JsaInput = z.infer<typeof JsaSchema>;

function normalizeSteps(value: unknown): Array<z.infer<typeof JsaStepSchema>> {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function mapJsaRow(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    description: row.description === null ? undefined : String(row.description ?? ""),
    location: String(row.location),
    department: String(row.department),
    status: String(row.status) as JsaStatus,
    steps: normalizeSteps(row.steps),
    createdBy: String(row.createdBy ?? row.createdby ?? ""),
    reviewedBy: row.reviewedBy ?? row.reviewedby ?? undefined,
    reviewedAt: row.reviewedAt ?? row.reviewedat ?? undefined,
    createdAt: String(row.createdAt ?? row.createdat ?? ""),
    updatedAt: String(row.updatedAt ?? row.updatedat ?? ""),
  };
}

export class JsaService extends BaseService {
  constructor() {
    super("jsa", JsaSchema);
  }

  async createJsa(data: JsaInput) {
    const validated = this.validate(data);
    const id = validated.id || randomUUID();
    const createdAt = new Date().toISOString();
    const updatedAt = createdAt;
    const steps = JSON.stringify(validated.steps ?? []);

    const result = await pgPool.query(
      `INSERT INTO jsa (id, title, description, location, department, status, steps, createdBy, createdAt, updatedAt, reviewedBy, reviewedAt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, title, description, location, department, status, steps, createdBy AS "createdBy", createdAt AS "createdAt", updatedAt AS "updatedAt", reviewedBy AS "reviewedBy", reviewedAt AS "reviewedAt"`,
      [
        id,
        validated.title,
        validated.description ?? null,
        validated.location,
        validated.department,
        validated.status,
        steps,
        validated.createdBy,
        createdAt,
        updatedAt,
        validated.reviewedBy ?? null,
        validated.reviewedAt ?? null,
      ],
    );

    return mapJsaRow(result.rows[0]);
  }

  async getJsaList(filters?: Record<string, any>) {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters?.status) {
      params.push(filters.status);
      where.push(`status = $${params.length}`);
    }
    if (filters?.location) {
      params.push(filters.location);
      where.push(`location = $${params.length}`);
    }
    if (filters?.department) {
      params.push(filters.department);
      where.push(`department = $${params.length}`);
    }

    const sql = `SELECT id, title, description, location, department, status, steps, createdBy AS "createdBy", createdAt AS "createdAt", updatedAt AS "updatedAt", reviewedBy AS "reviewedBy", reviewedAt AS "reviewedAt"
      FROM jsa${where.length > 0 ? ` WHERE ${where.join(" AND ")}` : ""}
      ORDER BY createdAt DESC`;

    const result = await pgPool.query(sql, params);
    return result.rows.map(mapJsaRow);
  }

  async getJsaById(id: string) {
    const result = await pgPool.query(
      `SELECT id, title, description, location, department, status, steps, createdBy AS "createdBy", createdAt AS "createdAt", updatedAt AS "updatedAt", reviewedBy AS "reviewedBy", reviewedAt AS "reviewedAt"
       FROM jsa WHERE id = $1`,
      [id],
    );
    return mapJsaRow(result.rows[0] ?? null);
  }

  async updateJsa(id: string, data: Record<string, any>) {
    const existing = await this.getJsaById(id);
    if (!existing) throw new Error("JSA not found");

    const updates: string[] = [];
    const params: unknown[] = [];

    if (data.title !== undefined) {
      params.push(String(data.title));
      updates.push(`title = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description === null ? null : String(data.description));
      updates.push(`description = $${params.length}`);
    }
    if (data.location !== undefined) {
      params.push(String(data.location));
      updates.push(`location = $${params.length}`);
    }
    if (data.department !== undefined) {
      params.push(String(data.department));
      updates.push(`department = $${params.length}`);
    }
    if (data.status !== undefined) {
      params.push(String(data.status));
      updates.push(`status = $${params.length}`);
    }
    if (data.steps !== undefined) {
      params.push(JSON.stringify(data.steps));
      updates.push(`steps = $${params.length}`);
    }
    if (data.createdBy !== undefined) {
      params.push(String(data.createdBy));
      updates.push(`createdBy = $${params.length}`);
    }
    if (data.reviewedBy !== undefined) {
      params.push(data.reviewedBy === null ? null : String(data.reviewedBy));
      updates.push(`reviewedBy = $${params.length}`);
    }
    if (data.reviewedAt !== undefined) {
      params.push(data.reviewedAt === null ? null : String(data.reviewedAt));
      updates.push(`reviewedAt = $${params.length}`);
    }

    params.push(new Date().toISOString());
    updates.push(`updatedAt = $${params.length}`);
    params.push(id);

    const result = await pgPool.query(
      `UPDATE jsa SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING id, title, description, location, department, status, steps, createdBy AS "createdBy", createdAt AS "createdAt", updatedAt AS "updatedAt", reviewedBy AS "reviewedBy", reviewedAt AS "reviewedAt"`,
      params,
    );

    return mapJsaRow(result.rows[0] ?? null);
  }

  async submitForReview(id: string) {
    return this.updateJsa(id, { status: "in-review" });
  }

  async approveJsa(id: string, reviewedBy: string) {
    return this.updateJsa(id, {
      status: "active",
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    });
  }

  async archiveJsa(id: string) {
    return this.updateJsa(id, { status: "archived" });
  }

  async addStep(id: string, step: z.infer<typeof JsaStepSchema>) {
    const jsa = await this.getJsaById(id);
    if (!jsa) throw new Error("JSA not found");
    const steps = [...(jsa.steps || []), step];
    return this.updateJsa(id, { steps });
  }
}
