import { Pool } from "pg";
import type {
  CreateExposureMonitoringInput,
  ExposureMonitoringRecord,
  ExposureMonitoringStats,
  UpdateExposureMonitoringInput,
} from "./exposure-monitoring.types.js";

const now = () => new Date().toISOString();

function asRecord(row: Record<string, unknown>): ExposureMonitoringRecord {
  return {
    id: String(row.id),
    sampleNo: String(row.sample_no),
    title: String(row.title),
    exposureType: String(row.exposure_type) as ExposureMonitoringRecord["exposureType"],
    samplingMethod: String(row.sampling_method) as ExposureMonitoringRecord["samplingMethod"],
    site: String(row.site),
    department: String(row.department),
    area: String(row.area),
    jobTitle: row.job_title ? String(row.job_title) : undefined,
    monitoredGroup: row.monitored_group ? String(row.monitored_group) : undefined,
    sampledPerson: row.sampled_person ? String(row.sampled_person) : undefined,
    sampleDate: String(row.sample_date),
    analysisDate: row.analysis_date ? String(row.analysis_date) : undefined,
    parameter: String(row.parameter),
    unit: String(row.unit),
    resultValue: Number(row.result_value),
    limitValue: Number(row.limit_value),
    actionLevel: row.action_level != null ? Number(row.action_level) : undefined,
    exceedance: Boolean(row.exceedance),
    status: String(row.status) as ExposureMonitoringRecord["status"],
    riskLevel: String(row.risk_level) as ExposureMonitoringRecord["riskLevel"],
    controlsInPlace: row.controls_in_place ? String(row.controls_in_place) : undefined,
    recommendations: row.recommendations ? String(row.recommendations) : undefined,
    correctiveActionOwner: row.corrective_action_owner ? String(row.corrective_action_owner) : undefined,
    correctiveActionDueDate: row.corrective_action_due_date ? String(row.corrective_action_due_date) : undefined,
    medicalSurveillanceRequired: Boolean(row.medical_surveillance_required),
    linkedHealthRecordId: row.linked_health_record_id ? String(row.linked_health_record_id) : undefined,
    laboratoryName: row.laboratory_name ? String(row.laboratory_name) : undefined,
    certificateUrl: row.certificate_url ? String(row.certificate_url) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class ExposureMonitoringRepository {
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
      `SELECT * FROM exposure_monitoring_records ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY sample_date DESC, created_at DESC`,
      params,
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM exposure_monitoring_records WHERE id = $1", [id]);
    return result.rows[0] ? asRecord(result.rows[0] as Record<string, unknown>) : null;
  }

  async create(data: CreateExposureMonitoringInput) {
    const sampleNo = `EXP-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const exceedance = data.resultValue > data.limitValue;
    const result = await this.pool.query(
      `INSERT INTO exposure_monitoring_records (
        id, sample_no, title, exposure_type, sampling_method, site, department, area, job_title,
        monitored_group, sampled_person, sample_date, analysis_date, parameter, unit, result_value,
        limit_value, action_level, exceedance, status, risk_level, controls_in_place, recommendations,
        corrective_action_owner, corrective_action_due_date, medical_surveillance_required,
        linked_health_record_id, laboratory_name, certificate_url, notes, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32
      ) RETURNING *`,
      [
        sampleNo,
        data.title,
        data.exposureType,
        data.samplingMethod,
        data.site,
        data.department,
        data.area,
        data.jobTitle ?? null,
        data.monitoredGroup ?? null,
        data.sampledPerson ?? null,
        data.sampleDate,
        data.analysisDate ?? null,
        data.parameter,
        data.unit,
        data.resultValue,
        data.limitValue,
        data.actionLevel ?? null,
        exceedance,
        data.status,
        data.riskLevel,
        data.controlsInPlace ?? null,
        data.recommendations ?? null,
        data.correctiveActionOwner ?? null,
        data.correctiveActionDueDate ?? null,
        data.medicalSurveillanceRequired,
        data.linkedHealthRecordId ?? null,
        data.laboratoryName ?? null,
        data.certificateUrl ?? null,
        data.notes ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asRecord(result.rows[0] as Record<string, unknown>);
  }

  async update(id: string, data: UpdateExposureMonitoringInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      title: "title",
      exposureType: "exposure_type",
      samplingMethod: "sampling_method",
      site: "site",
      department: "department",
      area: "area",
      jobTitle: "job_title",
      monitoredGroup: "monitored_group",
      sampledPerson: "sampled_person",
      sampleDate: "sample_date",
      analysisDate: "analysis_date",
      parameter: "parameter",
      unit: "unit",
      resultValue: "result_value",
      limitValue: "limit_value",
      actionLevel: "action_level",
      exceedance: "exceedance",
      status: "status",
      riskLevel: "risk_level",
      controlsInPlace: "controls_in_place",
      recommendations: "recommendations",
      correctiveActionOwner: "corrective_action_owner",
      correctiveActionDueDate: "corrective_action_due_date",
      medicalSurveillanceRequired: "medical_surveillance_required",
      linkedHealthRecordId: "linked_health_record_id",
      laboratoryName: "laboratory_name",
      certificateUrl: "certificate_url",
      notes: "notes",
    };

    const nextData: Record<string, unknown> = { ...data };
    if (data.resultValue !== undefined || data.limitValue !== undefined) {
      const current = await this.findById(id);
      if (current) {
        nextData.exceedance = (data.resultValue ?? current.resultValue) > (data.limitValue ?? current.limitValue);
      }
    }

    Object.entries(nextData).forEach(([key, value]) => {
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
      `UPDATE exposure_monitoring_records SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ? asRecord(result.rows[0] as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM exposure_monitoring_records WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findExceedances() {
    const result = await this.pool.query(
      `SELECT * FROM exposure_monitoring_records
       WHERE exceedance = TRUE
       ORDER BY sample_date DESC, created_at DESC`,
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async findOverdueActions(daysBefore: number) {
    const future = new Date();
    future.setDate(future.getDate() + daysBefore);
    const result = await this.pool.query(
      `SELECT * FROM exposure_monitoring_records
       WHERE corrective_action_due_date IS NOT NULL
         AND corrective_action_due_date <= $1
         AND status NOT IN ('Closed')
       ORDER BY corrective_action_due_date ASC`,
      [future.toISOString()],
    );
    return result.rows.map((row) => asRecord(row as Record<string, unknown>));
  }

  async getStats(): Promise<ExposureMonitoringStats> {
    const [statusResult, overdueResult] = await Promise.all([
      this.pool.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE status = 'Planned')::int AS planned,
           COUNT(*) FILTER (WHERE status = 'Sampled')::int AS sampled,
           COUNT(*) FILTER (WHERE status = 'Reviewed')::int AS reviewed,
           COUNT(*) FILTER (WHERE exceedance = TRUE)::int AS exceedances,
           COUNT(*) FILTER (WHERE medical_surveillance_required = TRUE)::int AS medical_surveillance_required
         FROM exposure_monitoring_records`,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS overdue
         FROM exposure_monitoring_records
         WHERE corrective_action_due_date IS NOT NULL
           AND corrective_action_due_date < NOW()
           AND status <> 'Closed'`,
      ),
    ]);

    return {
      total: Number(statusResult.rows[0]?.total ?? 0),
      planned: Number(statusResult.rows[0]?.planned ?? 0),
      sampled: Number(statusResult.rows[0]?.sampled ?? 0),
      reviewed: Number(statusResult.rows[0]?.reviewed ?? 0),
      exceedances: Number(statusResult.rows[0]?.exceedances ?? 0),
      medicalSurveillanceRequired: Number(statusResult.rows[0]?.medical_surveillance_required ?? 0),
      overdueActions: Number(overdueResult.rows[0]?.overdue ?? 0),
    };
  }
}
