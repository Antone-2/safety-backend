import { Pool } from "pg";
import type { Permit, CreatePermitInput, UpdatePermitInput, PermitAttachment, PermitComment, PermitStatus } from "./permits.types.js";

function toSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

const now = () => new Date().toISOString();

function asPermit(row: Record<string, unknown>): Permit {
  return {
    id: String(row.id),
    type: String(row.type) as Permit["type"],
    status: String(row.status) as PermitStatus,
    location: String(row.location),
    applicant: String(row.applicant),
    applicantContact: row.applicant_contact ? String(row.applicant_contact) : undefined,
    supervisor: row.supervisor ? String(row.supervisor) : undefined,
    ehsOfficer: row.ehs_officer ? String(row.ehs_officer) : undefined,
    issuer: row.issuer ? String(row.issuer) : undefined,
    approver: row.approver ? String(row.approver) : undefined,
    description: String(row.description),
    startDate: String(row.start_date),
    endDate: String(row.end_date),
    hazards: row.hazards ? String(row.hazards) : undefined,
    precautions: row.precautions ? String(row.precautions) : undefined,
    ppeRequired: Array.isArray(row.ppe_required) ? row.ppe_required.map(String) : undefined,
    isolationRequired: Boolean(row.isolation_required),
    isolationDetails: row.isolation_details ? String(row.isolation_details) : undefined,
    fireWatchRequired: Boolean(row.fire_watch_required),
    gasTestRequired: Boolean(row.gas_test_required),
    gasTestResult: row.gas_test_result ? String(row.gas_test_result) : undefined,
    gasTestBefore: row.gas_test_before ? String(row.gas_test_before) : undefined,
    gasTestAfter: row.gas_test_after ? String(row.gas_test_after) : undefined,
    fireWatchAssigned: row.fire_watch_assigned ? String(row.fire_watch_assigned) : undefined,
    attachments: Array.isArray(row.attachments) ? row.attachments.map((a: unknown) => (a as PermitAttachment)) : [],
    comments: Array.isArray(row.comments) ? row.comments.map((c: unknown) => (c as PermitComment)) : [],
    linkedJsaId: row.linked_jsa_id ? String(row.linked_jsa_id) : undefined,
    linkedIncidentId: row.linked_incident_id ? String(row.linked_incident_id) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class PermitsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = toSnake(key);
          if (key === "location") {
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

    const sql = `SELECT * FROM permits ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asPermit(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM permits WHERE id = $1", [id]);
    return result.rows[0] ? asPermit(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreatePermitInput, createdBy: string) {
    const result = await this.pool.query(
      `INSERT INTO permits (id, type, status, location, applicant, applicant_contact, supervisor, ehs_officer, issuer, approver, description, start_date, end_date, hazards, precautions, ppe_required, isolation_required, isolation_details, fire_watch_required, gas_test_required, gas_test_result, gas_test_before, gas_test_after, fire_watch_assigned, attachments, comments, linked_jsa_id, linked_incident_id, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16, $17, $18, $19, $20, $21, $22, $23, $24::jsonb, $25::jsonb, $26, $27, $28, $29, $30)
       RETURNING *`,
      [
        data.type,
        "draft",
        data.location,
        data.applicant,
        data.applicantContact ?? null,
        data.supervisor ?? null,
        data.ehsOfficer ?? null,
        data.issuer ?? null,
        data.approver ?? null,
        data.description,
        data.startDate,
        data.endDate,
        data.hazards ?? null,
        data.precautions ?? null,
        JSON.stringify(data.ppeRequired ?? []),
        data.isolationRequired ?? false,
        data.isolationDetails ?? null,
        data.fireWatchRequired ?? false,
        data.gasTestRequired ?? false,
        data.gasTestResult ?? null,
        data.gasTestBefore ?? null,
        data.gasTestAfter ?? null,
        data.fireWatchAssigned ?? null,
        JSON.stringify(data.attachments ?? []),
        JSON.stringify(data.comments ?? []),
        data.linkedJsaId ?? null,
        data.linkedIncidentId ?? null,
        createdBy,
        now(),
        now(),
      ]
    );
    return asPermit(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdatePermitInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      location: "location",
      applicant: "applicant",
      applicantContact: "applicant_contact",
      supervisor: "supervisor",
      ehsOfficer: "ehs_officer",
      issuer: "issuer",
      approver: "approver",
      description: "description",
      startDate: "start_date",
      endDate: "end_date",
      hazards: "hazards",
      precautions: "precautions",
      ppeRequired: "ppe_required",
      isolationRequired: "isolation_required",
      isolationDetails: "isolation_details",
      fireWatchRequired: "fire_watch_required",
      gasTestRequired: "gas_test_required",
      gasTestResult: "gas_test_result",
      gasTestBefore: "gas_test_before",
      gasTestAfter: "gas_test_after",
      fireWatchAssigned: "fire_watch_assigned",
      status: "status",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "ppeRequired") {
          fields.push(`${map[key]} = $${idx}::jsonb`);
          params.push(JSON.stringify(value));
        } else {
          fields.push(`${map[key]} = $${idx}`);
          params.push(value);
        }
        idx++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE permits SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asPermit(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM permits WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async count(filters?: Record<string, unknown>): Promise<number> {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = toSnake(key);
          where.push(`${pgKey} = $${idx}`);
          params.push(value);
          idx++;
        }
      });
    }

    const sql = `SELECT COUNT(*) as count FROM permits ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""}`;
    const result = await this.pool.query(sql, params);
    return parseInt(result.rows[0]?.count ?? "0", 10);
  }
}
