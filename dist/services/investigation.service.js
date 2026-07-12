import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, saveDb, allRows } from "../lib/database.js";
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
export class InvestigationService extends BaseService {
    constructor() {
        super("investigations", InvestigationSchema);
    }
    async createInvestigation(data) {
        const record = await this.create({
            ...data,
            investigationNo: `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        });
        return record;
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
    async getStats() {
        const db = await getDb();
        const all = allRows(db, `SELECT * FROM investigations`);
        const total = all.length;
        const pending = all.filter((r) => r.status === "Pending").length;
        const inProgress = all.filter((r) => r.status === "In Progress").length;
        const completed = all.filter((r) => r.status === "Completed").length;
        const closed = all.filter((r) => r.status === "Closed").length;
        const critical = all.filter((r) => r.priority === "Critical").length;
        await saveDb(db);
        return { total, pending, inProgress, completed, closed, critical };
    }
}
