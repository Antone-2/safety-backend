import { BaseService } from "./base.service.js";
import { z } from "zod";
export const JsaStatusSchema = z.enum(["draft", "in-review", "active", "completed", "archived"]);
export const JsaStepSchema = z.object({
    id: z.string(),
    description: z.string().min(1).max(1000),
    hazards: z.array(z.string()),
    controls: z.array(z.string()),
    existingRisk: z.enum(["Low", "Medium", "High", "Critical"]),
    residualRisk: z.enum(["Low", "Medium", "High", "Critical"]),
});
export const JsaSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    location: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    status: JsaStatusSchema.default("draft"),
    steps: z.array(JsaStepSchema).optional().default([]),
    createdBy: z.string().min(1).max(200),
    reviewedBy: z.string().max(200).optional(),
    reviewedAt: z.string().optional(),
});
export class JsaService extends BaseService {
    constructor() {
        super("jsa", JsaSchema);
    }
    async createJsa(data) {
        return this.create(data);
    }
    async getJsaList(filters) {
        return this.getAll(filters);
    }
    async getJsaById(id) {
        return this.getById(id);
    }
    async updateJsa(id, data) {
        return this.update(id, data);
    }
    async submitForReview(id) {
        return this.update(id, { status: "in-review" });
    }
    async approveJsa(id, reviewedBy) {
        return this.update(id, { status: "active", reviewedBy, reviewedAt: new Date().toISOString() });
    }
    async archiveJsa(id) {
        return this.update(id, { status: "archived" });
    }
    async addStep(id, step) {
        const jsa = await this.getById(id);
        if (!jsa)
            throw new Error("JSA not found");
        const steps = jsa.steps || [];
        steps.push(step);
        return this.update(id, { steps });
    }
}
