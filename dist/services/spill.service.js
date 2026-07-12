import { BaseService } from "./base.service.js";
import { z } from "zod";
export const SpillSeveritySchema = z.enum(["Minor", "Major", "Critical"]);
export const SpillSchema = z.object({
    id: z.string().optional(),
    spillNo: z.string().optional(),
    chemical: z.string().min(1).max(200),
    casNumber: z.string().max(50).optional(),
    quantity: z.number().min(0),
    unit: z.string().min(1).max(50),
    location: z.string().min(1).max(200),
    date: z.string().min(1),
    time: z.string().min(1),
    severity: SpillSeveritySchema,
    affectedArea: z.string().max(2000).optional(),
    responseActions: z.string().max(5000).optional(),
    cleanupCompleted: z.boolean().default(false),
    cleanupDate: z.string().optional(),
    reportedToNema: z.boolean().default(false),
    nemaReportDate: z.string().optional(),
    photoUrl: z.string().optional(),
    reportedBy: z.string().min(1).max(200),
    createdBy: z.string().min(1).max(200),
});
export class SpillService extends BaseService {
    constructor() {
        super("spills", SpillSchema);
    }
    async createSpill(data) {
        const record = await this.create({ ...data, spillNo: `SPILL-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getSpills(filters) { return this.getAll(filters); }
    async getSpillById(id) { return this.getById(id); }
    async getStats() {
        const db = this.getDb?.() || require("../lib/database.js").getDb();
        const all = this.allRows?.(db, `SELECT * FROM spills`) || [];
        const total = all.length;
        const minor = all.filter((r) => r.severity === "Minor").length;
        const major = all.filter((r) => r.severity === "Major").length;
        const critical = all.filter((r) => r.severity === "Critical").length;
        const reportedToNema = all.filter((r) => r.reportedToNema).length;
        await this.saveDb?.(db) || require("../lib/database.js").saveDb(db);
        return { total, minor, major, critical, reportedToNema };
    }
}
