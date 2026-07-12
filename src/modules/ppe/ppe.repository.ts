import { Pool } from "pg";
import type { Ppe, CreatePpeInput, UpdatePpeInput, PpeStats } from "./ppe.types.js";

const now = () => new Date().toISOString();

function asPpe(row: Record<string, unknown>): Ppe {
  return {
    id: String(row.id),
    ppeNo: row.ppe_no ? String(row.ppe_no) : undefined,
    type: String(row.type) as Ppe["type"],
    description: String(row.description),
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    department: row.department ? String(row.department) : undefined,
    site: String(row.site),
    issuedDate: row.issued_date ? String(row.issued_date) : undefined,
    expiryDate: row.expiry_date ? String(row.expiry_date) : undefined,
    condition: row.condition ? String(row.condition) as Ppe["condition"] : undefined,
    inspectionDate: row.inspection_date ? String(row.inspection_date) : undefined,
    inspectionDueDate: row.inspection_due_date ? String(row.inspection_due_date) : undefined,
    status: String(row.status) as Ppe["status"],
    serialNumber: row.serial_number ? String(row.serial_number) : undefined,
    certificateUrl: row.certificate_url ? String(row.certificate_url) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class PpeRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const pgKey = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
          if (key === "type" || key === "site" || key === "assignedTo") {
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

    const sql = `SELECT * FROM ppe_equipment ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asPpe(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM ppe_equipment WHERE id = $1", [id]);
    return result.rows[0] ? asPpe(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreatePpeInput) {
    const ppeNo = `PPE-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
    const result = await this.pool.query(
      `INSERT INTO ppe_equipment (id, ppe_no, type, description, assigned_to, department, site, issued_date, expiry_date, condition, inspection_date, inspection_due_date, status, serial_number, certificate_url, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        ppeNo,
        data.type,
        data.description,
        data.assignedTo ?? null,
        data.department ?? null,
        data.site,
        data.issuedDate ?? null,
        data.expiryDate ?? null,
        data.condition ?? null,
        data.inspectionDate ?? null,
        data.inspectionDueDate ?? null,
        data.status ?? "Issued",
        data.serialNumber ?? null,
        data.certificateUrl ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asPpe(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdatePpeInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      type: "type",
      description: "description",
      assignedTo: "assigned_to",
      department: "department",
      site: "site",
      issuedDate: "issued_date",
      expiryDate: "expiry_date",
      condition: "condition",
      inspectionDate: "inspection_date",
      inspectionDueDate: "inspection_due_date",
      status: "status",
      serialNumber: "serial_number",
      certificateUrl: "certificate_url",
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

    const sql = `UPDATE ppe_equipment SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asPpe(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM ppe_equipment WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<PpeStats> {
    const result = await this.pool.query("SELECT status, COUNT(*) as count FROM ppe_equipment GROUP BY status");
    const stats: Record<string, number> = {};
    result.rows.forEach((row) => {
      stats[String(row.status)] = parseInt(row.count as unknown as string, 10);
    });

    const expiredResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM ppe_equipment WHERE expiry_date IS NOT NULL AND expiry_date <= NOW()"
    );
    const expired = parseInt(expiredResult.rows[0]?.count ?? "0", 10);

    const inspectionResult = await this.pool.query(
      "SELECT COUNT(*) as count FROM ppe_equipment WHERE inspection_due_date IS NOT NULL AND inspection_due_date <= NOW()"
    );
    const dueForInspection = parseInt(inspectionResult.rows[0]?.count ?? "0", 10);

    return {
      total: Object.values(stats).reduce((sum, count) => sum + count, 0),
      issued: stats["Issued"] || 0,
      expired,
      dueForInspection,
    };
  }
}
