import { BaseService } from "./base.service.js";
import { z } from "zod";
export const HeightWorkStatusSchema = z.enum(["Planned", "Permit Issued", "In Progress", "Completed", "Cancelled"]);
export const HeightWorkSchema = z.object({
    id: z.string().optional(),
    permitNo: z.string().optional(),
    location: z.string().min(1).max(200),
    building: z.string().min(1).max(100),
    floor: z.string().max(50).optional(),
    taskDescription: z.string().min(1).max(2000),
    height: z.number().min(0),
    fallProtection: z.string().max(2000).optional(),
    rescuePlan: z.string().max(2000).optional(),
    harnessInspectionDate: z.string().optional(),
    anchorPointInspected: z.boolean().default(false),
    workersCount: z.number().min(1).default(1),
    workers: z.string().max(1000).optional(),
    supervisor: z.string().min(1).max(200),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    status: HeightWorkStatusSchema.default("Planned"),
    incidentReport: z.string().max(2000).optional(),
    photos: z.string().optional().default("[]"),
    notes: z.string().max(2000).optional(),
    createdBy: z.string().min(1).max(200),
});
export class HeightWorkService extends BaseService {
    constructor() {
        super("height_works", HeightWorkSchema);
    }
    async createHeightWork(data) {
        const record = await this.create({ ...data, permitNo: `HGT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getHeightWorks(filters) { return this.getAll(filters); }
    async getHeightWorkById(id) { return this.getById(id); }
    async getStats() {
        const db = this.getDb?.() || require("../lib/database.js").getDb();
        const all = this.allRows?.(db, `SELECT * FROM height_works`) || [];
        const total = all.length;
        const inProgress = all.filter((r) => r.status === "In Progress").length;
        const completed = all.filter((r) => r.status === "Completed").length;
        const planned = all.filter((r) => r.status === "Planned").length;
        await this.saveDb?.(db) || require("../lib/database.js").saveDb(db);
        return { total, inProgress, completed, planned };
    }
}
