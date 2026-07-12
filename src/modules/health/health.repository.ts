import { Pool } from "pg";
import type { HealthRecord, CreateHealthRecordInput, UpdateHealthRecordInput, HealthStats } from "./health.types.js";

const now = () => new Date().toISOString();

function asHealthRecord(row: Record<string, unknown>): HealthRecord {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name),
    department: String(row.department),
    site: String(row.site),
    type: String(row.type) as HealthRecord["type"],
    examinationDate: String(row.examination_date),
    nextDueDate: String(row.next_due_date),
    frequency: String(row.frequency),
    results: row.results ? String(row.results) : undefined,
    findings: row.findings ? String(row.findings) : undefined,
    restrictions: row.restrictions ? String(row.restrictions) : undefined,
    fitnessForWork: Boolean(row.fitness_for_work),
    doctorName: String(row.doctor_name),
    doctorRegistration: row.doctor_registration ? String(row.doctor_registration) : undefined,
    clinicName: row.clinic_name ? String(row.clinic_name) : undefined,
    reportUrl: row.report_url ? String(row.report_url) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class HealthRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
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

    const sql = `SELECT * FROM health_surveillance ${where.length > 0 ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC`;
    const result = await this.pool.query(sql, params);
    return result.rows.map((row) => asHealthRecord(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM health_surveillance WHERE id = $1", [id]);
    return result.rows[0] ? asHealthRecord(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreateHealthRecordInput) {
    const result = await this.pool.query(
      `INSERT INTO health_surveillance (id, employee_id, employee_name, department, site, type, examination_date, next_due_date, frequency, results, findings, restrictions, fitness_for_work, doctor_name, doctor_registration, clinic_name, report_url, notes, created_by, created_at, updated_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
       RETURNING *`,
      [
        data.employeeId,
        data.employeeName,
        data.department,
        data.site,
        data.type,
        data.examinationDate,
        data.nextDueDate,
        data.frequency,
        data.results ?? null,
        data.findings ?? null,
        data.restrictions ?? null,
        data.fitnessForWork,
        data.doctorName,
        data.doctorRegistration ?? null,
        data.clinicName ?? null,
        data.reportUrl ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ]
    );
    return asHealthRecord(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateHealthRecordInput) {
    const fields: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    const map: Record<string, string> = {
      employeeId: "employee_id",
      employeeName: "employee_name",
      department: "department",
      site: "site",
      type: "type",
      examinationDate: "examination_date",
      nextDueDate: "next_due_date",
      frequency: "frequency",
      results: "results",
      findings: "findings",
      restrictions: "restrictions",
      fitnessForWork: "fitness_for_work",
      doctorName: "doctor_name",
      doctorRegistration: "doctor_registration",
      clinicName: "clinic_name",
      reportUrl: "report_url",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined && map[key]) {
        fields.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      }
    });

    if (fields.length === 0) {
      const result = await this.pool.query("SELECT * FROM health_surveillance WHERE id = $1", [id]);
      return result.rows[0] ? asHealthRecord(result.rows[0] as unknown as Record<string, unknown>) : null;
    }

    fields.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const sql = `UPDATE health_surveillance SET ${fields.join(", ")} WHERE id = $${idx + 1} RETURNING *`;
    const result = await this.pool.query(sql, params);
    return result.rows[0] ? asHealthRecord(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM health_surveillance WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findExpiring(daysBefore: number): Promise<HealthRecord[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysBefore);
    const result = await this.pool.query(
      "SELECT * FROM health_surveillance WHERE next_due_date <= $1 AND fitness_for_work = TRUE ORDER BY next_due_date ASC",
      [futureDate.toISOString()]
    );
    return result.rows.map((row) => asHealthRecord(row as unknown as Record<string, unknown>));
  }

  async getStats(): Promise<HealthStats> {
    const result = await this.pool.query("SELECT type, fitness_for_work, COUNT(*) as count FROM health_surveillance GROUP BY type, fitness_for_work");
    const rows = result.rows;

    const total = rows.reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const fitForWork = rows.filter((row) => row.fitness_for_work).reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const notFit = rows.filter((row) => !row.fitness_for_work).reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const audiometric = rows.filter((row) => row.type === "Audiometric").reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);
    const respiratory = rows.filter((row) => row.type === "Respiratory").reduce((sum, row) => sum + parseInt(row.count as unknown as string, 10), 0);

    return { total, fitForWork, notFit, audiometric, respiratory };
  }
}
