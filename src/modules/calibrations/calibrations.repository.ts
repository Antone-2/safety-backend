import { Pool } from "pg";
import type {
  CalibrationRecord,
  CalibrationStats,
  CreateCalibrationInput,
  UpdateCalibrationInput,
} from "./calibrations.types.js";

const now = () => new Date().toISOString();

function asRecord(row: Record<string, unknown>): CalibrationRecord {
  return {
    id: String(row.id),
    calibrationNo: String(row.calibration_no),
    equipmentId: row.equipment_id ? String(row.equipment_id) : undefined,
    equipmentName: String(row.equipment_name),
    equipmentType: row.equipment_type ? String(row.equipment_type) : undefined,
    site: String(row.site),
    department: String(row.department),
    location: row.location ? String(row.location) : undefined,
    criticality: String(row.criticality) as CalibrationRecord["criticality"],
    calibrationType: String(row.calibration_type) as CalibrationRecord["calibrationType"],
    status: String(row.status) as CalibrationRecord["status"],
    lastCalibrationDate: row.last_calibration_date ? String(row.last_calibration_date) : undefined,
    dueDate: String(row.due_date),
    performedBy: row.performed_by ? String(row.performed_by) : undefined,
    certificateNo: row.certificate_no ? String(row.certificate_no) : undefined,
    certificateUrl: row.certificate_url ? String(row.certificate_url) : undefined,
    tolerance: row.tolerance ? String(row.tolerance) : undefined,
    resultSummary: row.result_summary ? String(row.result_summary) : undefined,
    passed: Boolean(row.passed),
    outOfTolerance: Boolean(row.out_of_tolerance),
    actionRequired: row.action_required ? String(row.action_required) : undefined,
    actionOwner: row.action_owner ? String(row.action_owner) : undefined,
    actionDueDate: row.action_due_date ? String(row.action_due_date) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class CalibrationsRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        where.push(`${column} = $${idx}`);
        params.push(value);
        idx += 1;
      });
    }

    const result = await this.pool.query(
      `SELECT * FROM calibration_records ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY due_date ASC, created_at DESC`,
      params,
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM calibration_records WHERE id = $1", [id]);
    return result.rows[0] ? asRecord(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(data: CreateCalibrationInput) {
    const calibrationNo = `CAL-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const result = await this.pool.query(
      `INSERT INTO calibration_records (
        id, calibration_no, equipment_id, equipment_name, equipment_type, site, department, location,
        criticality, calibration_type, status, last_calibration_date, due_date, performed_by,
        certificate_no, certificate_url, tolerance, result_summary, passed, out_of_tolerance,
        action_required, action_owner, action_due_date, notes, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24, $25, $26
      ) RETURNING *`,
      [
        calibrationNo,
        data.equipmentId ?? null,
        data.equipmentName,
        data.equipmentType ?? null,
        data.site,
        data.department,
        data.location ?? null,
        data.criticality,
        data.calibrationType,
        data.status,
        data.lastCalibrationDate ?? null,
        data.dueDate,
        data.performedBy ?? null,
        data.certificateNo ?? null,
        data.certificateUrl ?? null,
        data.tolerance ?? null,
        data.resultSummary ?? null,
        data.passed,
        data.outOfTolerance,
        data.actionRequired ?? null,
        data.actionOwner ?? null,
        data.actionDueDate ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asRecord(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, data: UpdateCalibrationInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      equipmentId: "equipment_id",
      equipmentName: "equipment_name",
      equipmentType: "equipment_type",
      site: "site",
      department: "department",
      location: "location",
      criticality: "criticality",
      calibrationType: "calibration_type",
      status: "status",
      lastCalibrationDate: "last_calibration_date",
      dueDate: "due_date",
      performedBy: "performed_by",
      certificateNo: "certificate_no",
      certificateUrl: "certificate_url",
      tolerance: "tolerance",
      resultSummary: "result_summary",
      passed: "passed",
      outOfTolerance: "out_of_tolerance",
      actionRequired: "action_required",
      actionOwner: "action_owner",
      actionDueDate: "action_due_date",
      notes: "notes",
    };

    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || !map[key]) return;
      updates.push(`${map[key]} = $${idx}`);
      params.push(value);
      idx += 1;
    });

    if (!updates.length) return this.findById(id);
    updates.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);

    const result = await this.pool.query(
      `UPDATE calibration_records SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ? asRecord(result.rows[0] as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM calibration_records WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findOverdue() {
    const result = await this.pool.query(
      `SELECT * FROM calibration_records
       WHERE due_date < NOW()
         AND status <> 'Out of Service'
       ORDER BY due_date ASC`,
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async findOutOfTolerance() {
    const result = await this.pool.query(
      `SELECT * FROM calibration_records
       WHERE out_of_tolerance = TRUE
       ORDER BY COALESCE(action_due_date, due_date) ASC, created_at DESC`,
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async getStats(): Promise<CalibrationStats> {
    const result = await this.pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'Planned')::int AS planned,
         COUNT(*) FILTER (WHERE status = 'Calibrated')::int AS calibrated,
         COUNT(*) FILTER (WHERE status = 'Overdue')::int AS overdue,
         COUNT(*) FILTER (WHERE status = 'Out of Service')::int AS out_of_service,
         COUNT(*) FILTER (WHERE out_of_tolerance = TRUE)::int AS out_of_tolerance,
         COUNT(*) FILTER (
           WHERE status = 'Calibrated'
             AND (certificate_no IS NULL OR certificate_no = '')
             AND (certificate_url IS NULL OR certificate_url = '')
         )::int AS certificates_missing
       FROM calibration_records`,
    );

    return {
      total: Number(result.rows[0]?.total ?? 0),
      planned: Number(result.rows[0]?.planned ?? 0),
      calibrated: Number(result.rows[0]?.calibrated ?? 0),
      overdue: Number(result.rows[0]?.overdue ?? 0),
      outOfService: Number(result.rows[0]?.out_of_service ?? 0),
      outOfTolerance: Number(result.rows[0]?.out_of_tolerance ?? 0),
      certificatesMissing: Number(result.rows[0]?.certificates_missing ?? 0),
    };
  }
}
