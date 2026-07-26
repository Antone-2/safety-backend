import { Pool } from "pg";
import type {
  KpiDefinition,
  KpiValue,
  CreateKpiDefinitionInput,
  UpdateKpiDefinitionInput,
  CreateKpiValueInput,
  UpdateKpiValueInput,
  KpiDashboardSummary,
} from "./kpi.types.js";

const now = () => new Date().toISOString();

function asDefinition(row: Record<string, unknown>): KpiDefinition {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    category: String(row.category),
    unit: String(row.unit),
    targetValue: Number(row.target_value),
    direction: String(row.direction) as KpiDefinition["direction"],
    isActive: Boolean(row.is_active),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asValue(row: Record<string, unknown>): KpiValue {
  return {
    id: String(row.id),
    definitionId: String(row.definition_id),
    periodStart: String(row.period_start),
    periodEnd: String(row.period_end),
    actualValue: Number(row.actual_value),
    notes: row.notes ? String(row.notes) : undefined,
    recordedBy: String(row.recorded_by),
    recordedAt: String(row.recorded_at),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class KpiRepository {
  constructor(private pool: Pool) {}

  // Definitions
  async getDefinitions(filters?: { category?: string; isActive?: boolean }): Promise<KpiDefinition[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.category) {
      where.push(`category = $${idx}`);
      params.push(filters.category);
      idx++;
    }
    if (filters?.isActive !== undefined) {
      where.push(`is_active = $${idx}`);
      params.push(filters.isActive);
      idx++;
    }

    const sql = `SELECT * FROM kpi_definitions ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asDefinition(row as Record<string, unknown>));
  }

  async getDefinitionById(id: string): Promise<KpiDefinition | null> {
    const result = await this.pool.query(`SELECT * FROM kpi_definitions WHERE id = $1`, [id]);
    return result.rows[0] ? asDefinition(result.rows[0] as Record<string, unknown>) : null;
  }

  async createDefinition(data: CreateKpiDefinitionInput): Promise<KpiDefinition> {
    const result = await this.pool.query(
      `INSERT INTO kpi_definitions (
        id, name, description, category, unit, target_value, direction, is_active, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      RETURNING *`,
      [
        data.name,
        data.description || null,
        data.category,
        data.unit,
        data.targetValue,
        data.direction,
        data.isActive ? 1 : 0,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asDefinition(result.rows[0] as Record<string, unknown>);
  }

  async updateDefinition(id: string, data: UpdateKpiDefinitionInput): Promise<KpiDefinition | null> {
    const existing = await this.getDefinitionById(id);
    if (!existing) return null;

    const updated = { ...existing, ...data, updatedAt: now() };
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx}`);
      params.push(value);
      idx++;
    };

    if (data.name !== undefined) push("name", data.name);
    if (data.description !== undefined) push("description", data.description);
    if (data.category !== undefined) push("category", data.category);
    if (data.unit !== undefined) push("unit", data.unit);
    if (data.targetValue !== undefined) push("target_value", data.targetValue);
    if (data.direction !== undefined) push("direction", data.direction);
    if (data.isActive !== undefined) push("is_active", data.isActive);

    push("updated_at", now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE kpi_definitions SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? asDefinition(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM kpi_definitions WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // Values
  async getValues(filters?: { definitionId?: string; periodStart?: string; periodEnd?: string }): Promise<KpiValue[]> {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters?.definitionId) {
      where.push(`definition_id = $${idx}`);
      params.push(filters.definitionId);
      idx++;
    }
    if (filters?.periodStart) {
      where.push(`period_start >= $${idx}`);
      params.push(filters.periodStart);
      idx++;
    }
    if (filters?.periodEnd) {
      where.push(`period_end <= $${idx}`);
      params.push(filters.periodEnd);
      idx++;
    }

    const sql = `SELECT * FROM kpi_values ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY period_start DESC, recorded_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asValue(row as Record<string, unknown>));
  }

  async getValueById(id: string): Promise<KpiValue | null> {
    const result = await this.pool.query(`SELECT * FROM kpi_values WHERE id = $1`, [id]);
    return result.rows[0] ? asValue(result.rows[0] as Record<string, unknown>) : null;
  }

  async getValuesForPeriod(definitionId: string, periodStart: string, periodEnd: string): Promise<KpiValue | null> {
    const result = await this.pool.query(
      `SELECT * FROM kpi_values WHERE definition_id = $1 AND period_start = $2 AND period_end = $3 LIMIT 1`,
      [definitionId, periodStart, periodEnd],
    );
    return result.rows[0] ? asValue(result.rows[0] as Record<string, unknown>) : null;
  }

  async createValue(data: CreateKpiValueInput): Promise<KpiValue> {
    const result = await this.pool.query(
      `INSERT INTO kpi_values (
        id, definition_id, period_start, period_end, actual_value, notes, recorded_by, recorded_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2::date, $3::date, $4, $5, $6, $7, $8, $9
      )
      RETURNING *`,
      [
        data.definitionId,
        data.periodStart,
        data.periodEnd,
        data.actualValue,
        data.notes || null,
        data.recordedBy,
        now(),
        now(),
        now(),
      ],
    );
    return asValue(result.rows[0] as Record<string, unknown>);
  }

  async updateValue(id: string, data: UpdateKpiValueInput): Promise<KpiValue | null> {
    const existing = await this.getValueById(id);
    if (!existing) return null;

    const updated = { ...existing, ...data, updatedAt: now() };
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const push = (column: string, value: unknown) => {
      fields.push(`${column} = $${idx}`);
      params.push(value);
      idx++;
    };

    if (data.periodStart !== undefined) push("period_start", data.periodStart);
    if (data.periodEnd !== undefined) push("period_end", data.periodEnd);
    if (data.actualValue !== undefined) push("actual_value", data.actualValue);
    if (data.notes !== undefined) push("notes", data.notes);

    push("updated_at", now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE kpi_values SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? asValue(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteValue(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM kpi_values WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getDashboard(): Promise<KpiDashboardSummary> {
    const definitionsResult = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total_definitions,
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_definitions
      FROM kpi_definitions
    `);
    const valuesResult = await this.pool.query(`SELECT COUNT(*)::int AS total_values FROM kpi_values`);
    const categoriesResult = await this.pool.query(`
      SELECT DISTINCT category FROM kpi_definitions ORDER BY category ASC
    `);

    const defRow = definitionsResult.rows[0];
    const valRow = valuesResult.rows[0];

    return {
      totalDefinitions: Number(defRow?.total_definitions ?? 0),
      activeDefinitions: Number(defRow?.active_definitions ?? 0),
      totalValues: Number(valRow?.total_values ?? 0),
      categories: categoriesResult.rows.map((row) => String(row.category)),
    };
  }
}
