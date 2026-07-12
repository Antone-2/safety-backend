import { Pool } from "pg";
import type { Sds, CreateSdsInput, UpdateSdsInput, SdsStats } from "./sds.types.js";

const now = () => new Date().toISOString();

function asSds(row: Record<string, unknown>): Sds {
  return {
    id: String(row.id),
    sdsNo: row.sds_no ? String(row.sds_no) : undefined,
    chemicalName: String(row.chemical_name),
    casNumber: row.cas_number ? String(row.cas_number) : undefined,
    formula: row.formula ? String(row.formula) : undefined,
    supplier: row.supplier ? String(row.supplier) : undefined,
    sdsUrl: row.sds_url ? String(row.sds_url) : undefined,
    hazardClass: row.hazard_class ? String(row.hazard_class) : undefined,
    signalWord: row.signal_word ? String(row.signal_word) : undefined,
    pictograms: row.pictograms ? String(row.pictograms) : undefined,
    storageRequirements: row.storage_requirements ? String(row.storage_requirements) : undefined,
    ppeRequired: row.ppe_required ? String(row.ppe_required) : undefined,
    firstAidMeasure: row.first_aid_measure ? String(row.first_aid_measure) : undefined,
    spillProcedures: row.spill_procedures ? String(row.spill_procedures) : undefined,
    effectiveDate: row.effective_date ? String(row.effective_date) : undefined,
    nextReviewDate: row.next_review_date ? String(row.next_review_date) : undefined,
    version: row.version ? String(row.version) : undefined,
    status: String(row.status) as Sds["status"],
    location: row.location ? String(row.location) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SdsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "chemicalName" || key === "supplier") {
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

    const sql = `SELECT * FROM sds_library ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asSds(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM sds_library WHERE id = $1", [id]);
    return result.rows[0] ? asSds(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async searchByChemical(name: string) {
    const result = await this.pool.query("SELECT * FROM sds_library WHERE chemical_name ILIKE $1 ORDER BY created_at DESC", [`%${name}%`]);
    return result.rows.map((row) => asSds(row as unknown as Record<string, unknown>));
  }

  async create(data: CreateSdsInput) {
    const sdsNo = `SDS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const result = await this.pool.query(
      `INSERT INTO sds_library (id, sds_no, chemical_name, cas_number, formula, supplier, sds_url, hazard_class, signal_word, pictograms, storage_requirements, ppe_required, first_aid_measure, spill_procedures, effective_date, next_review_date, version, status, location, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
       RETURNING *`,
      [
        sdsNo,
        data.chemicalName,
        data.casNumber ?? null,
        data.formula ?? null,
        data.supplier ?? null,
        data.sdsUrl ?? null,
        data.hazardClass ?? null,
        data.signalWord ?? null,
        data.pictograms ?? null,
        data.storageRequirements ?? null,
        data.ppeRequired ?? null,
        data.firstAidMeasure ?? null,
        data.spillProcedures ?? null,
        data.effectiveDate ?? null,
        data.nextReviewDate ?? null,
        data.version ?? null,
        data.status ?? "Active",
        data.location ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asSds(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateSdsInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      chemicalName: "chemical_name",
      casNumber: "cas_number",
      formula: "formula",
      supplier: "supplier",
      sdsUrl: "sds_url",
      hazardClass: "hazard_class",
      signalWord: "signal_word",
      pictograms: "pictograms",
      storageRequirements: "storage_requirements",
      ppeRequired: "ppe_required",
      firstAidMeasure: "first_aid_measure",
      spillProcedures: "spill_procedures",
      effectiveDate: "effective_date",
      nextReviewDate: "next_review_date",
      version: "version",
      status: "status",
      location: "location",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) return this.findById(id);

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE sds_library SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asSds(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM sds_library WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<SdsStats> {
    const result = await this.pool.query("SELECT status, COUNT(*) as count FROM sds_library GROUP BY status");
    const stats: Record<string, number> = {};
    result.rows.forEach((row) => {
      stats[String(row.status)] = parseInt(row.count as unknown as string, 10);
    });

    const overdueResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM sds_library WHERE next_review_date IS NOT NULL AND next_review_date <= NOW()"
    );
    const overdue = parseInt(overdueResult.rows[0]?.count ?? "0", 10);

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      active: stats["Active"] || 0,
      expired: stats["Expired"] || 0,
      overdue,
    };
  }
}
