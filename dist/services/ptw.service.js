import { BaseService } from "./base.service.js";
import { z } from "zod";
import { getDb, saveDb, allRows } from "../lib/database.js";
export const PtwStatusSchema = z.enum(["draft", "applicant", "supervisor", "ehs", "issuer", "approval", "active", "closed", "expired"]);
export const PtwTypeSchema = z.enum(["Hot Work", "Cold Work", "Confined Space", "Electrical", "Excavation", "Height Work", "General"]);
export const PtwSchema = z.object({
    id: z.string().optional(),
    type: PtwTypeSchema,
    status: PtwStatusSchema.default("draft"),
    location: z.string().min(1).max(200),
    applicant: z.string().min(1).max(200),
    applicantContact: z.string().max(50).optional(),
    supervisor: z.string().max(200).optional(),
    ehsOfficer: z.string().max(200).optional(),
    issuer: z.string().max(200).optional(),
    approver: z.string().max(200).optional(),
    description: z.string().min(1).max(5000),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    hazards: z.string().max(2000).optional(),
    precautions: z.string().max(2000).optional(),
    ppeRequired: z.array(z.string().max(100)).optional(),
    isolationRequired: z.boolean().default(false),
    isolationDetails: z.string().max(2000).optional(),
    fireWatchRequired: z.boolean().default(false),
    gasTestRequired: z.boolean().default(false),
    gasTestResult: z.string().max(200).optional(),
    gasTestBefore: z.string().optional(),
    gasTestAfter: z.string().optional(),
    fireWatchAssigned: z.string().optional(),
    attachments: z.string().optional().default("[]"),
    comments: z.string().optional().default("[]"),
    linkedJsaId: z.string().optional(),
    linkedIncidentId: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export class PtwService extends BaseService {
    constructor() {
        super("permits", PtwSchema);
    }
    async createPermit(data) {
        const record = await this.create(data);
        return record;
    }
    async getPermits(filters) {
        return this.getAll(filters);
    }
    async getPermitById(id) {
        return this.getById(id);
    }
    async updatePermit(id, data) {
        return this.update(id, data);
    }
    async advanceStatus(id, newStatus) {
        return this.update(id, { status: newStatus });
    }
    async getActivePermits() {
        return this.getAll({ status: "active" });
    }
    async getExpiredPermits() {
        const db = await getDb();
        const rows = allRows(db, `SELECT * FROM ${this.tableName} WHERE status = 'active' AND endDate < ?`, [new Date().toISOString()]);
        await saveDb(db);
        return rows;
    }
    async addComment(id, comment) {
        const permit = await this.getById(id);
        if (!permit)
            throw new Error("Permit not found");
        const comments = JSON.parse(permit.comments || "[]");
        comments.push(comment);
        return this.update(id, { comments: JSON.stringify(comments) });
    }
}
