import { z } from "zod";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { v4 as uuidv4 } from "uuid";
export const InvestigationStatusSchema = z.enum(["Pending", "In Progress", "Completed", "Closed"]);
export const InvestigationPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const InvestigationEvidenceSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    url: z.string().url().optional(),
    uploadedAt: z.string(),
    uploadedBy: z.string().min(1).max(200),
    type: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
});
export const InvestigationSchema = z.object({
    id: z.string().optional(),
    investigationNo: z.string().optional(),
    incidentId: z.string().min(1).max(100),
    title: z.string().min(1).max(300),
    description: z.string().min(1).max(5000),
    investigator: z.string().min(1).max(200),
    investigationTeam: z.string().max(1000).optional(),
    status: InvestigationStatusSchema.default("Pending"),
    priority: InvestigationPrioritySchema.default("Medium"),
    evidence: z.array(InvestigationEvidenceSchema).optional().default([]),
    rootCause: z.string().max(5000).optional(),
    contributingFactors: z.string().max(5000).optional(),
    correctiveActions: z.string().max(5000).optional(),
    preventiveActions: z.string().max(5000).optional(),
    findings: z.string().max(5000).optional(),
    recommendations: z.string().max(5000).optional(),
    dueDate: z.string().optional(),
    completedDate: z.string().optional(),
    reviewedBy: z.string().max(200).optional(),
    reviewedAt: z.string().optional(),
    incidentForm: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
const now = () => new Date().toISOString();
function parseEvidence(value) {
    if (Array.isArray(value))
        return value;
    if (!value)
        return [];
    try {
        const parsed = JSON.parse(String(value));
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function mapRow(row) {
    return {
        id: String(row.id),
        investigationNo: row.investigation_no ? String(row.investigation_no) : undefined,
        incidentId: String(row.incident_id ?? ""),
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        investigator: String(row.investigator ?? ""),
        investigationTeam: row.investigation_team ? String(row.investigation_team) : undefined,
        status: String(row.status ?? "Pending"),
        priority: String(row.priority ?? "Medium"),
        evidence: parseEvidence(row.evidence),
        rootCause: row.root_cause ? String(row.root_cause) : undefined,
        contributingFactors: row.contributing_factors ? String(row.contributing_factors) : undefined,
        correctiveActions: row.corrective_actions ? String(row.corrective_actions) : undefined,
        preventiveActions: row.preventive_actions ? String(row.preventive_actions) : undefined,
        findings: row.findings ? String(row.findings) : undefined,
        recommendations: row.recommendations ? String(row.recommendations) : undefined,
        dueDate: row.due_date ? new Date(String(row.due_date)).toISOString() : undefined,
        completedDate: row.completed_date ? new Date(String(row.completed_date)).toISOString() : undefined,
        reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
        reviewedAt: row.reviewed_at ? new Date(String(row.reviewed_at)).toISOString() : undefined,
        incidentForm: row.incident_form ? String(row.incident_form) : undefined,
        createdBy: String(row.created_by ?? "System"),
        createdAt: row.created_at ? new Date(String(row.created_at)).toISOString() : now(),
        updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : now(),
    };
}
export class InvestigationService {
    validate(data) {
        return InvestigationSchema.parse(data);
    }
    async getAll(filters) {
        const where = [];
        const params = [];
        const columns = {
            id: "id",
            investigationNo: "investigation_no",
            incidentId: "incident_id",
            title: "title",
            description: "description",
            investigator: "investigator",
            investigationTeam: "investigation_team",
            status: "status",
            priority: "priority",
            createdBy: "created_by",
        };
        if (filters) {
            Object.entries(filters).forEach(([key, value]) => {
                const column = columns[key];
                if (!column || value === undefined || value === null || value === "")
                    return;
                params.push(value);
                where.push(`${column} = $${params.length}`);
            });
        }
        const sql = `SELECT * FROM investigations${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC`;
        const result = await pgPool.query(sql, params);
        return result.rows.map((row) => mapRow(row));
    }
    async getById(id) {
        const result = await pgPool.query("SELECT * FROM investigations WHERE id = $1", [id]);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async createInvestigation(data) {
        const validated = this.validate({
            ...data,
            investigationNo: data.investigationNo ?? `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        });
        const id = validated.id || uuidv4();
        const timestamp = now();
        const result = await pgPool.query(`INSERT INTO investigations (
        id, investigation_no, incident_id, title, description, investigator, investigation_team,
        status, priority, evidence, root_cause, contributing_factors, corrective_actions,
        preventive_actions, findings, recommendations, due_date, completed_date, reviewed_by,
        reviewed_at, incident_form, created_by, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10::jsonb, $11, $12, $13,
        $14, $15, $16, $17, $18, $19,
        $20, $21, $22, $23, $24
      )
      RETURNING *`, [
            id,
            validated.investigationNo ?? null,
            validated.incidentId,
            validated.title,
            validated.description,
            validated.investigator,
            validated.investigationTeam ?? null,
            validated.status ?? "Pending",
            validated.priority ?? "Medium",
            JSON.stringify(validated.evidence ?? []),
            validated.rootCause ?? null,
            validated.contributingFactors ?? null,
            validated.correctiveActions ?? null,
            validated.preventiveActions ?? null,
            validated.findings ?? null,
            validated.recommendations ?? null,
            validated.dueDate ?? null,
            validated.completedDate ?? null,
            validated.reviewedBy ?? null,
            validated.reviewedAt ?? null,
            validated.incidentForm ?? null,
            validated.createdBy,
            timestamp,
            timestamp,
        ]);
        return mapRow(result.rows[0]);
    }
    async getByIncidentId(incidentId) {
        return this.getAll({ incidentId });
    }
    async getByStatus(status) {
        return this.getAll({ status });
    }
    async getByPriority(priority) {
        return this.getAll({ priority });
    }
    async addEvidence(id, evidence) {
        const investigation = await this.getById(id);
        if (!investigation)
            throw new Error("Investigation not found");
        const evidenceList = investigation.evidence || [];
        const newEvidence = { ...evidence, id: crypto.randomUUID(), uploadedAt: new Date().toISOString() };
        const updated = { ...investigation, evidence: [...evidenceList, newEvidence] };
        return this.update(id, { evidence: updated.evidence });
    }
    async completeInvestigation(id, data) {
        const updateData = { ...data, status: "Completed", completedDate: new Date().toISOString() };
        if (data.reviewedBy)
            updateData.reviewedAt = new Date().toISOString();
        return this.update(id, updateData);
    }
    async update(id, data) {
        const existing = await this.getById(id);
        if (!existing)
            throw new Error("Investigation not found");
        const fields = [];
        const params = [];
        const map = {
            investigationNo: "investigation_no",
            incidentId: "incident_id",
            title: "title",
            description: "description",
            investigator: "investigator",
            investigationTeam: "investigation_team",
            status: "status",
            priority: "priority",
            evidence: "evidence",
            rootCause: "root_cause",
            contributingFactors: "contributing_factors",
            correctiveActions: "corrective_actions",
            preventiveActions: "preventive_actions",
            findings: "findings",
            recommendations: "recommendations",
            dueDate: "due_date",
            completedDate: "completed_date",
            reviewedBy: "reviewed_by",
            reviewedAt: "reviewed_at",
            incidentForm: "incident_form",
            createdBy: "created_by",
        };
        Object.entries(data).forEach(([key, value]) => {
            const column = map[key];
            if (!column || value === undefined)
                return;
            if (key === "evidence") {
                params.push(JSON.stringify(value ?? []));
                fields.push(`${column} = $${params.length}::jsonb`);
                return;
            }
            params.push(value);
            fields.push(`${column} = $${params.length}`);
        });
        if (fields.length === 0)
            return existing;
        params.push(now());
        fields.push(`updated_at = $${params.length}`);
        params.push(id);
        const result = await pgPool.query(`UPDATE investigations SET ${fields.join(", ")} WHERE id = $${params.length} RETURNING *`, params);
        return result.rows[0] ? mapRow(result.rows[0]) : null;
    }
    async delete(id) {
        const result = await pgPool.query("DELETE FROM investigations WHERE id = $1", [id]);
        return (result.rowCount ?? 0) > 0;
    }
    async getStats() {
        const result = await pgPool.query("SELECT * FROM investigations ORDER BY created_at DESC");
        const all = result.rows;
        const total = all.length;
        const pending = all.filter((r) => r.status === "Pending").length;
        const inProgress = all.filter((r) => r.status === "In Progress").length;
        const completed = all.filter((r) => r.status === "Completed").length;
        const closed = all.filter((r) => r.status === "Closed").length;
        const critical = all.filter((r) => r.priority === "Critical").length;
        return { total, pending, inProgress, completed, closed, critical };
    }
}
