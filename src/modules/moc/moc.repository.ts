import { Pool } from "pg";
import type { CreateMocInput, MocRecord, MocStats, UpdateMocInput } from "./moc.types.js";

const now = () => new Date().toISOString();

function asMoc(row: Record<string, unknown>): MocRecord {
  return {
    id: String(row.id),
    mocNo: String(row.moc_no),
    title: String(row.title),
    changeType: String(row.change_type) as MocRecord["changeType"],
    area: String(row.area),
    site: String(row.site),
    department: String(row.department),
    requestedBy: String(row.requested_by),
    requestedAt: String(row.requested_at),
    status: String(row.status) as MocRecord["status"],
    summary: String(row.summary),
    justification: String(row.justification),
    riskReviewSummary: row.risk_review_summary ? String(row.risk_review_summary) : undefined,
    riskLevel: String(row.risk_level) as MocRecord["riskLevel"],
    implementationPlan: row.implementation_plan ? String(row.implementation_plan) : undefined,
    pssrRequired: Boolean(row.pssr_required),
    pssrCompleted: Boolean(row.pssr_completed),
    approver: row.approver ? String(row.approver) : undefined,
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    closedAt: row.closed_at ? String(row.closed_at) : undefined,
    rejectionReason: row.rejection_reason ? String(row.rejection_reason) : undefined,
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class MocRepository {
  constructor(private pool: Pool) {}

  async findAll(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        if (["title", "site", "department", "assignedTo", "requestedBy"].includes(key)) {
          where.push(`${column} ILIKE $${idx}`);
          params.push(`%${value}%`);
        } else {
          where.push(`${column} = $${idx}`);
          params.push(value);
        }
        idx++;
      });
    }
    const result = await this.pool.query(
      `SELECT * FROM moc_records ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => asMoc(row as unknown as Record<string, unknown>));
  }

  async findById(id: string) {
    const result = await this.pool.query("SELECT * FROM moc_records WHERE id = $1", [id]);
    return result.rows[0] ? asMoc(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async create(data: CreateMocInput) {
    const mocNo = `MOC-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const result = await this.pool.query(
      `INSERT INTO moc_records (
        id, moc_no, title, change_type, area, site, department, requested_by, requested_at, status,
        summary, justification, risk_review_summary, risk_level, implementation_plan, pssr_required,
        pssr_completed, approver, approved_at, assigned_to, due_date, closed_at, rejection_reason,
        created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22,
        $23, $24, $25
      ) RETURNING *`,
      [
        mocNo,
        data.title,
        data.changeType,
        data.area,
        data.site,
        data.department,
        data.requestedBy,
        data.requestedAt,
        data.status,
        data.summary,
        data.justification,
        data.riskReviewSummary ?? null,
        data.riskLevel,
        data.implementationPlan ?? null,
        data.pssrRequired,
        data.pssrCompleted,
        data.approver ?? null,
        data.approvedAt ?? null,
        data.assignedTo ?? null,
        data.dueDate ?? null,
        data.closedAt ?? null,
        data.rejectionReason ?? null,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asMoc(result.rows[0] as unknown as Record<string, unknown>);
  }

  async update(id: string, data: UpdateMocInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      title: "title",
      changeType: "change_type",
      area: "area",
      site: "site",
      department: "department",
      requestedBy: "requested_by",
      requestedAt: "requested_at",
      status: "status",
      summary: "summary",
      justification: "justification",
      riskReviewSummary: "risk_review_summary",
      riskLevel: "risk_level",
      implementationPlan: "implementation_plan",
      pssrRequired: "pssr_required",
      pssrCompleted: "pssr_completed",
      approver: "approver",
      approvedAt: "approved_at",
      assignedTo: "assigned_to",
      dueDate: "due_date",
      closedAt: "closed_at",
      rejectionReason: "rejection_reason",
    };
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || !map[key]) return;
      updates.push(`${map[key]} = $${idx}`);
      params.push(value);
      idx++;
    });
    if (!updates.length) return this.findById(id);
    updates.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);
    const result = await this.pool.query(
      `UPDATE moc_records SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0] ? asMoc(result.rows[0] as unknown as Record<string, unknown>) : null;
  }

  async delete(id: string) {
    const result = await this.pool.query("DELETE FROM moc_records WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getStats(): Promise<MocStats> {
    const [statuses, overdue] = await Promise.all([
      this.pool.query(`SELECT status, COUNT(*)::int AS count FROM moc_records GROUP BY status`),
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM moc_records WHERE due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('Closed','Rejected')`,
      ),
    ]);
    const by = new Map<string, number>();
    statuses.rows.forEach((row) => by.set(String(row.status), Number(row.count)));
    return {
      total: Array.from(by.values()).reduce((sum, value) => sum + value, 0),
      draft: by.get("Draft") ?? 0,
      underReview: by.get("Under Review") ?? 0,
      approved: by.get("Approved") ?? 0,
      implementation: by.get("Implementation") ?? 0,
      pssr: by.get("PSSR") ?? 0,
      closed: by.get("Closed") ?? 0,
      overdue: Number(overdue.rows[0]?.count ?? 0),
    };
  }
}
