import { Pool } from "pg";
import type {
  RiskMatrix,
  RiskRegister,
  BowTie,
  CreateRiskMatrixInput,
  CreateRiskRegisterInput,
  CreateBowTieInput,
  RiskDashboard,
} from "./risk.types.js";

const now = () => new Date().toISOString();

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function asMatrix(row: Record<string, unknown>): RiskMatrix {
  return {
    id: String(row.id),
    name: String(row.name),
    description: row.description ? String(row.description) : undefined,
    likelihoodScale: parseJson(row.likelihood_scale, {}),
    severityScale: parseJson(row.severity_scale, {}),
    levels: parseJson(row.levels, []),
    isDefault: Boolean(row.is_default),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asRegister(row: Record<string, unknown>): RiskRegister {
  return {
    id: String(row.id),
    title: String(row.title),
    location: String(row.location),
    department: String(row.department),
    activity: String(row.activity),
    hazard: String(row.hazard),
    existingControls: String(row.existing_controls),
    likelihood: Number(row.likelihood),
    severity: Number(row.severity),
    riskRating: Number(row.risk_rating),
    riskLevel: String(row.risk_level) as RiskRegister["riskLevel"],
    additionalControls: row.additional_controls ? String(row.additional_controls) : undefined,
    residualLikelihood: row.residual_likelihood != null ? Number(row.residual_likelihood) : undefined,
    residualSeverity: row.residual_severity != null ? Number(row.residual_severity) : undefined,
    residualRiskRating: row.residual_risk_rating != null ? Number(row.residual_risk_rating) : undefined,
    residualRiskLevel: row.residual_risk_level ? String(row.residual_risk_level) as RiskRegister["residualRiskLevel"] : undefined,
    reviewDate: row.review_date ? String(row.review_date) : undefined,
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    status: String(row.status),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asBowTie(row: Record<string, unknown>): BowTie {
  return {
    id: String(row.id),
    title: String(row.title),
    topEvent: String(row.top_event),
    threats: row.threats ? String(row.threats) : undefined,
    preventiveBarriers: row.preventive_barriers ? String(row.preventive_barriers) : undefined,
    consequences: row.consequences ? String(row.consequences) : undefined,
    recoveryBarriers: row.recovery_barriers ? String(row.recovery_barriers) : undefined,
    location: String(row.location),
    department: String(row.department),
    createdBy: String(row.created_by),
    status: String(row.status),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class RiskRepository {
  private readonly columnCache = new Map<string, Promise<Set<string>>>();

  constructor(private pool: Pool) {}

  private async getTableColumns(table: string): Promise<Set<string>> {
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

  private resolveColumn(columns: Set<string>, ...candidates: string[]): string | null {
    for (const candidate of candidates) {
      if (columns.has(normalizeColumnName(candidate))) return candidate;
    }
    return null;
  }

  private requireColumn(columns: Set<string>, table: string, ...candidates: string[]): string {
    const column = this.resolveColumn(columns, ...candidates);
    if (!column) {
      throw new Error(`Missing required column on ${table}: ${candidates.join(", ")}`);
    }
    return column;
  }

  private selectReportColumn(columns: Set<string>, alias: string, ...candidates: string[]): string {
    const column = this.requireColumn(columns, "reports", ...candidates);
    return `${column} AS ${alias}`;
  }

  private async getRiskReportsSql(): Promise<string> {
    const columns = await this.getTableColumns("reports");
    const createdAt = this.requireColumn(columns, "reports", "created_at", "createdAt", "createdat", "date");
    const updatedAt =
      this.resolveColumn(columns, "updated_at", "updatedAt", "updatedat", "created_at", "createdAt", "createdat", "date") ??
      createdAt;

    return `SELECT
      ${this.selectReportColumn(columns, "id", "id")},
      ${this.selectReportColumn(columns, "location", "location")},
      ${this.selectReportColumn(columns, "department", "department")},
      ${this.selectReportColumn(columns, "description", "description")},
      ${this.selectReportColumn(columns, "severity", "severity")},
      ${this.selectReportColumn(columns, "category", "category")},
      ${this.selectReportColumn(columns, "type", "type")},
      ${this.selectReportColumn(columns, "source", "source")},
      ${this.selectReportColumn(columns, "reporter", "reporter")},
      ${createdAt} AS created_at,
      ${updatedAt} AS updated_at
      FROM reports
      WHERE
        COALESCE(${this.requireColumn(columns, "reports", "location")}, '') <> ''
        OR COALESCE(${this.requireColumn(columns, "reports", "description")}, '') <> ''
        OR COALESCE(${this.requireColumn(columns, "reports", "category")}, '') <> ''
      ORDER BY ${createdAt} DESC`;
  }

  // Risk Matrices
  async getMatrices(): Promise<RiskMatrix[]> {
    const result = await this.pool.query(`SELECT * FROM risk_matrices ORDER BY created_at DESC`);
    return result.rows.map((row) => asMatrix(row as Record<string, unknown>));
  }

  async getMatrixById(id: string): Promise<RiskMatrix | null> {
    const result = await this.pool.query(`SELECT * FROM risk_matrices WHERE id = $1`, [id]);
    return result.rows[0] ? asMatrix(result.rows[0] as Record<string, unknown>) : null;
  }

  async getDefaultMatrix(): Promise<RiskMatrix | null> {
    const result = await this.pool.query(`SELECT * FROM risk_matrices WHERE is_default = true ORDER BY created_at DESC LIMIT 1`);
    return result.rows[0] ? asMatrix(result.rows[0] as Record<string, unknown>) : null;
  }

  async createMatrix(data: CreateRiskMatrixInput): Promise<RiskMatrix> {
    const result = await this.pool.query(
      `INSERT INTO risk_matrices (
        id, name, description, likelihood_scale, severity_scale, levels, is_default, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9
      )
      RETURNING *`,
      [
        data.name,
        data.description || null,
        JSON.stringify(data.likelihoodScale),
        JSON.stringify(data.severityScale),
        JSON.stringify(data.levels),
        data.isDefault ? 1 : 0,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asMatrix(result.rows[0] as Record<string, unknown>);
  }

  // Risk Registers
  async getRegisters(filters?: Record<string, any>): Promise<RiskRegister[]> {
    const columns = await this.getTableColumns("risk_registers");
    if (columns.size === 0) {
      return [];
    }

    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = this.resolveColumn(columns, toSnake(key), key, key.toLowerCase());
          if (!pgKey) return;
          where.push(`${pgKey} = $${idx}`);
          params.push(value);
          idx++;
        }
      });
    }

    const createdAt = this.requireColumn(columns, "risk_registers", "created_at", "createdAt", "createdat");
    const sql = `SELECT * FROM risk_registers ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${createdAt} DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asRegister(row as Record<string, unknown>));
  }

  async getRegisterById(id: string): Promise<RiskRegister | null> {
    const columns = await this.getTableColumns("risk_registers");
    if (columns.size === 0) {
      return null;
    }
    const result = await this.pool.query(`SELECT * FROM risk_registers WHERE id = $1`, [id]);
    return result.rows[0] ? asRegister(result.rows[0] as Record<string, unknown>) : null;
  }

  async deleteRegister(id: string): Promise<boolean> {
    const result = await this.pool.query(`DELETE FROM risk_registers WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createRegister(data: CreateRiskRegisterInput & { riskRating: number; riskLevel: string }): Promise<RiskRegister> {
    const result = await this.pool.query(
      `INSERT INTO risk_registers (
        id, title, location, department, activity, hazard, existing_controls, likelihood, severity, risk_rating, risk_level,
        additional_controls, residual_likelihood, residual_severity, residual_risk_rating, residual_risk_level,
        review_date, reviewed_by, status, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
      )
      RETURNING *`,
      [
        data.title,
        data.location,
        data.department,
        data.activity,
        data.hazard,
        data.existingControls,
        data.likelihood,
        data.severity,
        data.riskRating,
        data.riskLevel,
        data.additionalControls || null,
        data.residualLikelihood || null,
        data.residualSeverity || null,
        null,
        null,
        data.reviewDate || null,
        data.reviewedBy || null,
        data.status,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asRegister(result.rows[0] as Record<string, unknown>);
  }

  async updateRegister(id: string, data: Record<string, unknown>): Promise<RiskRegister | null> {
    const existing = await this.getRegisterById(id);
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

    if (data.title !== undefined) push("title", data.title);
    if (data.location !== undefined) push("location", data.location);
    if (data.department !== undefined) push("department", data.department);
    if (data.activity !== undefined) push("activity", data.activity);
    if (data.hazard !== undefined) push("hazard", data.hazard);
    if (data.existingControls !== undefined) push("existing_controls", data.existingControls);
    if (data.likelihood !== undefined) push("likelihood", data.likelihood);
    if (data.severity !== undefined) push("severity", data.severity);
    if (data.riskRating !== undefined) push("risk_rating", data.riskRating);
    if (data.riskLevel !== undefined) push("risk_level", data.riskLevel);
    if (data.additionalControls !== undefined) push("additional_controls", data.additionalControls);
    if (data.residualLikelihood !== undefined) push("residual_likelihood", data.residualLikelihood);
    if (data.residualSeverity !== undefined) push("residual_severity", data.residualSeverity);
    if (data.residualRiskRating !== undefined) push("residual_risk_rating", data.residualRiskRating);
    if (data.residualRiskLevel !== undefined) push("residual_risk_level", data.residualRiskLevel);
    if (data.reviewDate !== undefined) push("review_date", data.reviewDate);
    if (data.reviewedBy !== undefined) push("reviewed_by", data.reviewedBy);
    if (data.status !== undefined) push("status", data.status);

    push("updated_at", now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE risk_registers SET ${fields.join(", ")} WHERE id = $${idx} RETURNING *`,
      params,
    );
    return result.rows[0] ? asRegister(result.rows[0] as Record<string, unknown>) : null;
  }

  // Bow Ties
  async getBowTies(): Promise<BowTie[]> {
    const result = await this.pool.query(`SELECT * FROM bow_ties ORDER BY created_at DESC`);
    return result.rows.map((row) => asBowTie(row as Record<string, unknown>));
  }

  async createBowTie(data: CreateBowTieInput): Promise<BowTie> {
    const result = await this.pool.query(
      `INSERT INTO bow_ties (
        id, title, top_event, threats, preventive_barriers, consequences, recovery_barriers, location, department, created_by, status, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      )
      RETURNING *`,
      [
        data.title,
        data.topEvent,
        data.threats || null,
        data.preventiveBarriers || null,
        data.consequences || null,
        data.recoveryBarriers || null,
        data.location,
        data.department,
        data.createdBy,
        data.status,
        now(),
        now(),
      ],
    );
    return asBowTie(result.rows[0] as Record<string, unknown>);
  }

  async getRiskReportCandidates(): Promise<Record<string, unknown>[]> {
    const columns = await this.getTableColumns("reports");
    if (columns.size === 0) {
      return [];
    }
    const result = await this.pool.query(await this.getRiskReportsSql());
    return result.rows as Record<string, unknown>[];
  }

  // Dashboard
  async getRiskDashboard(): Promise<RiskDashboard> {
    const result = await this.pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE risk_level = 'Low')::int AS low,
        COUNT(*) FILTER (WHERE risk_level = 'Medium')::int AS medium,
        COUNT(*) FILTER (WHERE risk_level = 'High')::int AS high,
        COUNT(*) FILTER (WHERE risk_level = 'Critical')::int AS critical
      FROM risk_registers
    `);
    const row = result.rows[0];
    return {
      total: Number(row?.total ?? 0),
      low: Number(row?.low ?? 0),
      medium: Number(row?.medium ?? 0),
      high: Number(row?.high ?? 0),
      critical: Number(row?.critical ?? 0),
    };
  }
}
