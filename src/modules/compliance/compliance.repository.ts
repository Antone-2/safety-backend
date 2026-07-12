import { Pool } from "pg";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import type {
  ComplianceObligation,
  ComplianceAudit,
  LegalUpdate,
  CreateComplianceObligationInput,
  UpdateComplianceObligationInput,
  CreateComplianceAuditInput,
  UpdateComplianceAuditInput,
  CreateLegalUpdateInput,
  UpdateLegalUpdateInput,
  ComplianceDashboard,
} from "./compliance.types.js";

const now = () => new Date().toISOString();

function asObligation(row: Record<string, unknown>): ComplianceObligation {
  return {
    id: String(row.id),
    title: String(row.title),
    legislation: String(row.legislation),
    requirement: String(row.requirement),
    frequency: String(row.frequency),
    responsibility: String(row.responsibility),
    site: String(row.site),
    department: String(row.department),
    dueDate: row.due_date ? String(row.due_date) : undefined,
    status: String(row.status) as ComplianceObligation["status"],
    lastComplianceDate: row.last_compliance_date
      ? String(row.last_compliance_date)
      : undefined,
    evidence: row.evidence ? String(row.evidence) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asAudit(row: Record<string, unknown>): ComplianceAudit {
  let teamMembers: string[] = [];
  if (Array.isArray(row.team_members)) {
    teamMembers = row.team_members.map((m: unknown) => String(m));
  }

  let findings: unknown[] = [];
  if (Array.isArray(row.findings)) {
    findings = row.findings;
  }

  return {
    id: String(row.id),
    title: String(row.title),
    type: String(row.type) as ComplianceAudit["type"],
    status: String(row.status) as ComplianceAudit["status"],
    site: String(row.site),
    department: String(row.department),
    leadAuditor: String(row.lead_auditor),
    teamMembers,
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    scope: row.scope ? String(row.scope) : undefined,
    criteria: row.criteria ? String(row.criteria) : undefined,
    findings,
    reportUrl: row.report_url ? String(row.report_url) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asLegalUpdate(row: Record<string, unknown>): LegalUpdate {
  return {
    id: String(row.id),
    title: String(row.title),
    legislation: String(row.legislation),
    jurisdiction: String(row.jurisdiction),
    effectiveDate: String(row.effective_date),
    summary: String(row.summary),
    impactAssessment: row.impact_assessment
      ? String(row.impact_assessment)
      : undefined,
    actionRequired: row.action_required
      ? String(row.action_required)
      : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    status: String(row.status) as LegalUpdate["status"],
    source: row.source ? String(row.source) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ComplianceRepository {
  constructor(private pool: Pool = pgPool) {}

  async findObligations(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "site") {
            where.push(`${pgKey} ILIKE $${idx}`);
            params.push(`%${value}%`);
          } else {
            where.push(`${pgKey} = $${idx}`);
            params.push(value);
          }
          idx++;
        }
      });
    }

    const sql = `SELECT * FROM compliance_obligations ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) =>
      asObligation(row as unknown as Record<string, unknown>),
    );
  }

  async findObligationById(id: string) {
    const result = await this.pool.query(
      "SELECT * FROM compliance_obligations WHERE id = $1",
      [id],
    );
    return result.rows[0]
      ? asObligation(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async createObligation(data: CreateComplianceObligationInput) {
    const result = await this.pool.query(
      `INSERT INTO compliance_obligations (id, title, legislation, requirement, frequency, responsibility, site, department, due_date, status, last_compliance_date, evidence, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        data.title,
        data.legislation,
        data.requirement,
        data.frequency,
        data.responsibility,
        data.site,
        data.department,
        data.dueDate ?? null,
        data.status ?? "Pending",
        data.lastComplianceDate ?? null,
        data.evidence ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asObligation(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateObligation(id: string, data: UpdateComplianceObligationInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      title: "title",
      legislation: "legislation",
      requirement: "requirement",
      frequency: "frequency",
      responsibility: "responsibility",
      site: "site",
      department: "department",
      dueDate: "due_date",
      status: "status",
      lastComplianceDate: "last_compliance_date",
      evidence: "evidence",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) return this.findObligationById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE compliance_obligations SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0]
      ? asObligation(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async deleteObligation(id: string) {
    const result = await this.pool.query(
      "DELETE FROM compliance_obligations WHERE id = $1",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async findAudits(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "site") {
            where.push(`${pgKey} ILIKE $${idx}`);
            params.push(`%${value}%`);
          } else {
            where.push(`${pgKey} = $${idx}`);
            params.push(value);
          }
          idx++;
        }
      });
    }

    const sql = `SELECT * FROM audits ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) =>
      asAudit(row as unknown as Record<string, unknown>),
    );
  }

  async findAuditById(id: string) {
    const result = await this.pool.query("SELECT * FROM audits WHERE id = $1", [
      id,
    ]);
    return result.rows[0]
      ? asAudit(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async createAudit(data: CreateComplianceAuditInput) {
    const result = await this.pool.query(
      `INSERT INTO audits (id, title, type, status, site, department, lead_auditor, team_members, start_date, end_date, scope, criteria, findings, report_url, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12::jsonb, $13, $14, $15, $16)
       RETURNING *`,
      [
        data.title,
        data.type,
        data.status ?? "Planned",
        data.site,
        data.department,
        data.leadAuditor,
        JSON.stringify(data.teamMembers ?? []),
        data.startDate,
        data.endDate,
        data.scope ?? null,
        data.criteria ?? null,
        JSON.stringify(data.findings ?? []),
        data.reportUrl ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asAudit(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateAudit(id: string, data: UpdateComplianceAuditInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      title: "title",
      type: "type",
      status: "status",
      site: "site",
      department: "department",
      leadAuditor: "lead_auditor",
      teamMembers: "team_members",
      startDate: "start_date",
      endDate: "end_date",
      scope: "scope",
      criteria: "criteria",
      findings: "findings",
      reportUrl: "report_url",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "teamMembers" || key === "findings") {
          fields.push(`${map[key]} = $${idx}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${map[key]} = $${idx}`);
          params.push(value);
        }
        idx++;
      }
    });

    if (fields.length === 0) return this.findAuditById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE audits SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0]
      ? asAudit(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async deleteAudit(id: string) {
    const result = await this.pool.query("DELETE FROM audits WHERE id = $1", [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  async findLegalUpdates(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          where.push(`${pgKey} = $${idx}`);
          params.push(value);
          idx++;
        }
      });
    }

    const sql = `SELECT * FROM legal_updates ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) =>
      asLegalUpdate(row as unknown as Record<string, unknown>),
    );
  }

  async findLegalUpdateById(id: string) {
    const result = await this.pool.query(
      "SELECT * FROM legal_updates WHERE id = $1",
      [id],
    );
    return result.rows[0]
      ? asLegalUpdate(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async createLegalUpdate(data: CreateLegalUpdateInput) {
    const result = await this.pool.query(
      `INSERT INTO legal_updates (id, title, legislation, jurisdiction, effective_date, summary, impact_assessment, action_required, assigned_to, due_date, status, source, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING *`,
      [
        data.title,
        data.legislation,
        data.jurisdiction,
        data.effectiveDate,
        data.summary,
        data.impactAssessment ?? null,
        data.actionRequired ?? null,
        data.assignedTo ?? null,
        data.dueDate ?? null,
        data.status ?? "New",
        data.source ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asLegalUpdate(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateLegalUpdate(id: string, data: UpdateLegalUpdateInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      title: "title",
      legislation: "legislation",
      jurisdiction: "jurisdiction",
      effectiveDate: "effective_date",
      summary: "summary",
      impactAssessment: "impact_assessment",
      actionRequired: "action_required",
      assignedTo: "assigned_to",
      dueDate: "due_date",
      status: "status",
      source: "source",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) return this.findLegalUpdateById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE legal_updates SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0]
      ? asLegalUpdate(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async deleteLegalUpdate(id: string) {
    const result = await this.pool.query(
      "DELETE FROM legal_updates WHERE id = $1",
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async getDashboard(): Promise<ComplianceDashboard> {
    const obligationsResult = await this.pool.query(
      "SELECT status FROM compliance_obligations",
    );
    const auditsResult = await this.pool.query("SELECT status FROM audits");

    const obligations = obligationsResult.rows;
    const audits = auditsResult.rows;

    const total = obligations.length;
    const compliant = obligations.filter(
      (o) => o.status === "Compliant",
    ).length;
    const nonCompliant = obligations.filter(
      (o) => o.status === "Non-Compliant",
    ).length;
    const pending = obligations.filter((o) => o.status === "Pending").length;
    const openAudits = audits.filter((a) => a.status === "In Progress").length;

    return { total, compliant, nonCompliant, pending, openAudits };
  }
}
