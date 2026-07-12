import { BaseService } from "./base.service.js";
import { z } from "zod";
export const SdsSchema = z.object({
    id: z.string().optional(),
    sdsNo: z.string().optional(),
    chemicalName: z.string().min(1).max(200),
    casNumber: z.string().max(50).optional(),
    formula: z.string().max(200).optional(),
    supplier: z.string().max(200).optional(),
    sdsUrl: z.string().url().optional(),
    hazardClass: z.string().max(200).optional(),
    signalWord: z.string().max(100).optional(),
    pictograms: z.string().max(500).optional(),
    storageRequirements: z.string().max(2000).optional(),
    ppeRequired: z.string().max(500).optional(),
    firstAidMeasure: z.string().max(2000).optional(),
    spillProcedures: z.string().max(2000).optional(),
    effectiveDate: z.string().optional(),
    nextReviewDate: z.string().optional(),
    version: z.string().max(20).optional(),
    status: z.string().default("Active"),
    location: z.string().max(200).optional(),
    notes: z.string().max(1000).optional(),
    createdBy: z.string().min(1).max(200),
});
export class SdsService extends BaseService {
    constructor() {
        super("sds_library", SdsSchema);
    }
    async createSds(data) {
        const record = await this.create({ ...data, sdsNo: `SDS-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getSdsList(filters) { return this.getAll(filters); }
    async getSdsById(id) { return this.getById(id); }
    async searchByChemical(name) { return this.getAll({ chemicalName: name }); }
    async getStats() {
        const db = this.getDb?.() || require("../lib/database.js").getDb();
        const all = this.allRows?.(db, `SELECT * FROM sds_library`) || [];
        const total = all.length;
        const active = all.filter((r) => r.status === "Active").length;
        const overdue = all.filter((r) => r.nextReviewDate && new Date(r.nextReviewDate) < new Date()).length;
        await this.saveDb?.(db) || require("../lib/database.js").saveDb(db);
        return { total, active, overdue };
    }
}
