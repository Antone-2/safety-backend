import { Pool } from "pg";
import type { Contractor, ContractorIncident, CreateContractorInput, UpdateContractorInput, CreateContractorIncidentInput, ContractorStats } from "./contractors.types.js";

const now = () => new Date().toISOString();

function asContractor(row: Record<string, unknown>): Contractor {
  let documents: string[] = [];
  if (Array.isArray(row.documents)) {
    documents = row.documents.map((d: unknown) => String(d));
  }

  return {
    id: String(row.id),
    companyName: String(row.company_name),
    registrationNumber: String(row.registration_number),
    contactPerson: String(row.contact_person),
    contactEmail: String(row.contact_email),
    contactPhone: String(row.contact_phone),
    physicalAddress: row.physical_address ? String(row.physical_address) : undefined,
    services: row.services ? String(row.services) : undefined,
    certifications: row.certifications ? String(row.certifications) : undefined,
    insuranceExpiry: row.insurance_expiry ? String(row.insurance_expiry) : undefined,
    safetyRating: row.safety_rating ? Number(row.safety_rating) : undefined,
    incidents: Number(row.incidents),
    lastAuditDate: row.last_audit_date ? String(row.last_audit_date) : undefined,
    status: String(row.status) as Contractor["status"],
    inductionDate: row.induction_date ? String(row.induction_date) : undefined,
    inductionExpiry: row.induction_expiry ? String(row.induction_expiry) : undefined,
    documents,
    performanceScore: row.performance_score ? Number(row.performance_score) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asIncident(row: Record<string, unknown>): ContractorIncident {
  return {
    id: String(row.id),
    contractorId: String(row.contractor_id),
    incidentType: String(row.incident_type),
    description: String(row.description),
    severity: String(row.severity) as ContractorIncident["severity"],
    date: String(row.date),
    location: String(row.location),
    actionTaken: row.action_taken ? String(row.action_taken) : undefined,
    followUpRequired: Boolean(row.follow_up_required),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
  };
}

export class ContractorsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "companyName") {
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

    const sql = `SELECT * FROM contractors ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asContractor(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM contractors WHERE id = $1", [id]);
    return result.rows[0] ? asContractor(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreateContractorInput) {
    const result = await this.pool.query(
      `INSERT INTO contractors (id, company_name, registration_number, contact_person, contact_email, contact_phone, physical_address, services, certifications, insurance_expiry, safety_rating, incidents, last_audit_date, status, induction_date, induction_expiry, documents, performance_score, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb, $17, $18, $19, $20)
       RETURNING *`,
      [
        data.companyName,
        data.registrationNumber,
        data.contactPerson,
        data.contactEmail,
        data.contactPhone ?? null,
        data.physicalAddress ?? null,
        data.services ?? null,
        data.certifications ?? null,
        data.insuranceExpiry ?? null,
        data.safetyRating ?? null,
        0,
        data.lastAuditDate ?? null,
        data.status ?? "Active",
        data.inductionDate ?? null,
        data.inductionExpiry ?? null,
        JSON.stringify(data.documents ?? []),
        data.performanceScore ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asContractor(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateContractorInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      companyName: "company_name",
      registrationNumber: "registration_number",
      contactPerson: "contact_person",
      contactEmail: "contact_email",
      contactPhone: "contact_phone",
      physicalAddress: "physical_address",
      services: "services",
      certifications: "certifications",
      insuranceExpiry: "insurance_expiry",
      safetyRating: "safety_rating",
      incidents: "incidents",
      lastAuditDate: "last_audit_date",
      status: "status",
      inductionDate: "induction_date",
      inductionExpiry: "induction_expiry",
      documents: "documents",
      performanceScore: "performance_score",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        if (key === "documents") {
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

    const sql = `UPDATE contractors SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asContractor(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM contractors WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async createIncident(data: CreateContractorIncidentInput) {
    const result = await this.pool.query(
      `INSERT INTO contractor_incidents (id, contractor_id, incident_type, description, severity, date, location, action_taken, follow_up_required, created_by, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        data.contractorId,
        data.incidentType,
        data.description,
        data.severity,
        data.date,
        data.location,
        data.actionTaken ?? null,
        data.followUpRequired ?? false,
        data.createdBy,
        now(),
      ]
    );
    return asIncident(result.rows[0] as unknown as Record<string, unknown>);
  }

  async findIncidents(contractorId: string) {
    const result = await this.pool.query("SELECT * FROM contractor_incidents WHERE contractor_id = $1 ORDER BY created_at DESC", [contractorId]);
    return result.rows.map((row) => asIncident(row as unknown as Record<string, unknown>));
  }

  async incrementIncidentCount(contractorId: string) {
    const contractor = await this.findById(contractorId);
    if (!contractor) return;
    await this.update(contractorId, { incidents: contractor.incidents + 1 });
  }

  async getStats(): Promise<ContractorStats> {
    const result = await this.pool.query("SELECT status, COUNT(*) as count FROM contractors GROUP BY status");
    const stats: Record<string, number> = {};
    result.rows.forEach((row) => {
      stats[String(row.status)] = parseInt(row.count as unknown as string, 10);
    });

    const ratingResult = await this.pool.query("SELECT AVG(safety_rating) as avg_rating FROM contractors WHERE safety_rating IS NOT NULL");
    const avgRating = ratingResult.rows[0]?.avg_rating ? Number(ratingResult.rows[0].avg_rating).toFixed(1) : "0.0";

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      active: stats["Active"] || 0,
      suspended: stats["Suspended"] || 0,
      blacklisted: stats["Blacklisted"] || 0,
      avgRating: avgRating,
    };
  }
}
