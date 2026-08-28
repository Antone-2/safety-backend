import { Pool } from "pg";
import type {
  CreateInspectionInput,
  CreateInspectionTemplateInput,
  InspectionFinding,
  InspectionRecord,
  InspectionStats,
  InspectionTemplate,
  UpdateInspectionInput,
  UpdateInspectionTemplateInput,
} from "./inspections.types.js";

const now = () => new Date().toISOString();

function asTemplate(row: Record<string, unknown>): InspectionTemplate {
  return {
    id: String(row.id),
    title: String(row.title),
    area: String(row.area),
    frequency: String(row.frequency),
    site: String(row.site),
    department: String(row.department),
    checklist: Array.isArray(row.checklist) ? (row.checklist as InspectionTemplate["checklist"]) : [],
    active: Boolean(row.active),
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function asFinding(row: Record<string, unknown>): InspectionFinding {
  return {
    id: String(row.id),
    inspectionId: String(row.inspection_id),
    checklistItemId: row.checklist_item_id ? String(row.checklist_item_id) : undefined,
    observation: String(row.observation),
    severity: String(row.severity) as InspectionFinding["severity"],
    actionOwner: row.action_owner ? String(row.action_owner) : undefined,
    dueDate: row.due_date ? String(row.due_date) : undefined,
    status: String(row.status) as InspectionFinding["status"],
    createdAt: String(row.created_at),
  };
}

function asInspection(
  row: Record<string, unknown>,
  findings: InspectionFinding[],
): InspectionRecord {
  return {
    id: String(row.id),
    templateId: row.template_id ? String(row.template_id) : undefined,
    templateTitle: row.template_title ? String(row.template_title) : undefined,
    title: String(row.title),
    inspectionDate: String(row.inspection_date),
    dueDate: String(row.due_date),
    status: String(row.status) as InspectionRecord["status"],
    inspector: String(row.inspector),
    site: String(row.site),
    department: String(row.department),
    area: String(row.area),
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    recurrence: row.recurrence ? String(row.recurrence) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    findings,
    checklistCompletion: {
      total: Number(row.checklist_total ?? 0),
      completed: Number(row.checklist_completed ?? 0),
    },
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class InspectionsRepository {
  constructor(private pool: Pool) {}

  async findTemplates(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        if (key === "title" || key === "area" || key === "site") {
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
      `SELECT * FROM inspection_templates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`,
      params,
    );
    return result.rows.map((row) => asTemplate(row as unknown as Record<string, unknown>));
  }

  async findTemplateById(id: string) {
    const result = await this.pool.query("SELECT * FROM inspection_templates WHERE id = $1", [id]);
    return result.rows[0]
      ? asTemplate(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async createTemplate(data: CreateInspectionTemplateInput) {
    const result = await this.pool.query(
      `INSERT INTO inspection_templates (
        id, title, area, frequency, site, department, checklist, active, created_by, created_at, updated_at
      ) VALUES (
        gen_random_uuid()::text, $1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10
      ) RETURNING *`,
      [
        data.title,
        data.area,
        data.frequency,
        data.site,
        data.department,
        JSON.stringify(data.checklist),
        data.active ?? true,
        data.createdBy,
        now(),
        now(),
      ],
    );
    return asTemplate(result.rows[0] as unknown as Record<string, unknown>);
  }

  async updateTemplate(id: string, data: UpdateInspectionTemplateInput) {
    const updates: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    const map: Record<string, string> = {
      title: "title",
      area: "area",
      frequency: "frequency",
      site: "site",
      department: "department",
      checklist: "checklist",
      active: "active",
    };
    Object.entries(data).forEach(([key, value]) => {
      if (value === undefined || !map[key]) return;
      if (key === "checklist") {
        updates.push(`${map[key]} = $${idx}::jsonb`);
        params.push(JSON.stringify(value));
      } else {
        updates.push(`${map[key]} = $${idx}`);
        params.push(value);
      }
      idx++;
    });
    if (!updates.length) return this.findTemplateById(id);
    updates.push(`updated_at = $${idx}`);
    params.push(now());
    params.push(id);
    const result = await this.pool.query(
      `UPDATE inspection_templates SET ${updates.join(", ")} WHERE id = $${idx + 1} RETURNING *`,
      params,
    );
    return result.rows[0]
      ? asTemplate(result.rows[0] as unknown as Record<string, unknown>)
      : null;
  }

  async findInspections(filters?: Record<string, unknown>) {
    const where: string[] = [];
    const params: unknown[] = [];
    let idx = 1;
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") return;
        const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
        if (key === "title" || key === "site" || key === "department" || key === "area") {
          where.push(`i.${column} ILIKE $${idx}`);
          params.push(`%${value}%`);
        } else {
          where.push(`i.${column} = $${idx}`);
          params.push(value);
        }
        idx++;
      });
    }
    const result = await this.pool.query(
      `SELECT
         i.*,
         t.title AS template_title
       FROM inspections i
       LEFT JOIN inspection_templates t ON t.id = i.template_id
       ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY i.inspection_date DESC, i.created_at DESC`,
      params,
    );
    const findings = await this.findFindingsByInspectionIds(
      result.rows.map((row) => String(row.id)),
    );
    return result.rows.map((row) =>
      asInspection(
        row as unknown as Record<string, unknown>,
        findings.get(String(row.id)) ?? [],
      ),
    );
  }

  async findInspectionById(id: string) {
    const result = await this.pool.query(
      `SELECT i.*, t.title AS template_title
       FROM inspections i
       LEFT JOIN inspection_templates t ON t.id = i.template_id
       WHERE i.id = $1
       LIMIT 1`,
      [id],
    );
    if (!result.rows[0]) return null;
    const findings = await this.findFindingsByInspectionIds([id]);
    return asInspection(
      result.rows[0] as unknown as Record<string, unknown>,
      findings.get(id) ?? [],
    );
  }

  async createInspection(data: CreateInspectionInput) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const created = await client.query(
        `INSERT INTO inspections (
          id, template_id, title, inspection_date, due_date, status, inspector, site, department,
          area, assigned_to, recurrence, notes, checklist_total, checklist_completed, created_by, created_at, updated_at
        ) VALUES (
          gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        ) RETURNING id::text`,
        [
          data.templateId ?? null,
          data.title,
          data.inspectionDate,
          data.dueDate,
          data.status,
          data.inspector,
          data.site,
          data.department,
          data.area,
          data.assignedTo ?? null,
          data.recurrence ?? null,
          data.notes ?? null,
          data.checklistCompletion?.total ?? 0,
          data.checklistCompletion?.completed ?? 0,
          data.createdBy,
          now(),
          now(),
        ],
      );
      const inspectionId = String(created.rows[0]?.id);
      for (const finding of data.findings ?? []) {
        await client.query(
          `INSERT INTO inspection_findings (
            id, inspection_id, checklist_item_id, observation, severity, action_owner, due_date, status, created_at
          ) VALUES (
            gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8
          )`,
          [
            inspectionId,
            finding.checklistItemId ?? null,
            finding.observation,
            finding.severity,
            finding.actionOwner ?? null,
            finding.dueDate ?? null,
            finding.status,
            now(),
          ],
        );
      }
      await client.query("COMMIT");
      return this.findInspectionById(inspectionId);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateInspection(id: string, data: UpdateInspectionInput) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const updates: string[] = [];
      const params: unknown[] = [];
      let idx = 1;
      const map: Record<string, string> = {
        templateId: "template_id",
        title: "title",
        inspectionDate: "inspection_date",
        dueDate: "due_date",
        status: "status",
        inspector: "inspector",
        site: "site",
        department: "department",
        area: "area",
        assignedTo: "assigned_to",
        recurrence: "recurrence",
        notes: "notes",
      };
      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || !map[key]) return;
        updates.push(`${map[key]} = $${idx}`);
        params.push(value);
        idx++;
      });
      if (data.checklistCompletion) {
        updates.push(`checklist_total = $${idx}`);
        params.push(data.checklistCompletion.total);
        idx++;
        updates.push(`checklist_completed = $${idx}`);
        params.push(data.checklistCompletion.completed);
        idx++;
      }
      if (updates.length) {
        updates.push(`updated_at = $${idx}`);
        params.push(now());
        params.push(id);
        await client.query(
          `UPDATE inspections SET ${updates.join(", ")} WHERE id = $${idx + 1}`,
          params,
        );
      }
      if (data.findings) {
        await client.query("DELETE FROM inspection_findings WHERE inspection_id = $1", [id]);
        for (const finding of data.findings) {
          await client.query(
            `INSERT INTO inspection_findings (
              id, inspection_id, checklist_item_id, observation, severity, action_owner, due_date, status, created_at
            ) VALUES (
              gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8
            )`,
            [
              id,
              finding.checklistItemId ?? null,
              finding.observation,
              finding.severity,
              finding.actionOwner ?? null,
              finding.dueDate ?? null,
              finding.status,
              now(),
            ],
          );
        }
      }
      await client.query("COMMIT");
      return this.findInspectionById(id);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteInspection(id: string) {
    const result = await this.pool.query("DELETE FROM inspections WHERE id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async findFindingsByInspectionIds(ids: string[]) {
    if (!ids.length) return new Map<string, InspectionFinding[]>();
    const result = await this.pool.query(
      `SELECT * FROM inspection_findings WHERE inspection_id = ANY($1::text[]) ORDER BY created_at ASC`,
      [ids],
    );
    const findings = new Map<string, InspectionFinding[]>();
    result.rows.forEach((row) => {
      const finding = asFinding(row as unknown as Record<string, unknown>);
      const list = findings.get(finding.inspectionId) ?? [];
      list.push(finding);
      findings.set(finding.inspectionId, list);
    });
    return findings;
  }

  async getStats(): Promise<InspectionStats> {
    const [templates, inspections, findings] = await Promise.all([
      this.pool.query(`SELECT COUNT(*)::int AS count FROM inspection_templates WHERE active = TRUE`),
      this.pool.query(
        `SELECT status, COUNT(*)::int AS count FROM inspections GROUP BY status`,
      ),
      this.pool.query(
        `SELECT COUNT(*)::int AS count FROM inspection_findings WHERE status = 'Open'`,
      ),
    ]);
    const byStatus = new Map<string, number>();
    inspections.rows.forEach((row) => byStatus.set(String(row.status), Number(row.count)));
    return {
      totalTemplates: Number(templates.rows[0]?.count ?? 0),
      scheduled: byStatus.get("Scheduled") ?? 0,
      inProgress: byStatus.get("In Progress") ?? 0,
      completed: byStatus.get("Completed") ?? 0,
      overdue: byStatus.get("Overdue") ?? 0,
      openFindings: Number(findings.rows[0]?.count ?? 0),
    };
  }
}
