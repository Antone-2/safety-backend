import { BaseService } from "./base.service.js";
import { z } from "zod";
export const PpeTypeSchema = z.enum(["Hard Hat", "Safety Shoes", "Safety Glasses", "Gloves", "Respirator", "Ear Protection", "Coveralls", "Face Shield", "Chemical Suit", "Other"]);
export const PpeSchema = z.object({
    id: z.string().optional(),
    ppeNo: z.string().optional(),
    type: PpeTypeSchema,
    description: z.string().min(1).max(500),
    assignedTo: z.string().max(200).optional(),
    department: z.string().max(100).optional(),
    site: z.string().min(1).max(200),
    issuedDate: z.string().optional(),
    expiryDate: z.string().optional(),
    condition: z.string().max(500).optional(),
    inspectionDate: z.string().optional(),
    inspectionDueDate: z.string().optional(),
    status: z.string().default("Issued"),
    serialNumber: z.string().max(100).optional(),
    certificateUrl: z.string().optional(),
    notes: z.string().max(1000).optional(),
    createdBy: z.string().min(1).max(200),
});
export class PpeService extends BaseService {
    constructor() {
        super("ppe_equipment", PpeSchema);
    }
    async createPpe(data) {
        const record = await this.create({ ...data, ppeNo: `PPE-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getPpeItems(filters) { return this.getAll(filters); }
    async getPpeById(id) { return this.getById(id); }
    async getStats() {
        const db = this.getDb?.() || require("../lib/database.js").getDb();
        const all = this.allRows?.(db, `SELECT * FROM ppe_equipment`) || [];
        const total = all.length;
        const issued = all.filter((r) => r.status === "Issued").length;
        const expired = all.filter((r) => r.status === "Expired").length;
        const dueForInspection = all.filter((r) => r.inspectionDueDate && new Date(r.inspectionDueDate) < new Date()).length;
        await this.saveDb?.(db) || require("../lib/database.js").saveDb(db);
        return { total, issued, expired, dueForInspection };
    }
}
