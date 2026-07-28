import { BaseService } from "./base.service.js";
import { z } from "zod";
const EmergencyPlanSchemaBase = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    scenario: z.string().min(1).max(200),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    procedures: z.string().min(1).max(5000),
    emergencyContacts: z.string().min(1).max(2000),
    assemblyPoints: z.string().max(1000).optional(),
    specialInstructions: z.string().max(2000).optional(),
    lastReviewed: z.string().optional(),
    nextReview: z.string().optional(),
    status: z.string().default("Active"),
    createdBy: z.string().min(1).max(200),
});
export const EmergencyPlanSchema = EmergencyPlanSchemaBase
    .refine((data) => {
    if (!data.lastReviewed || !data.nextReview)
        return true;
    const lastReviewed = new Date(data.lastReviewed);
    const nextReview = new Date(data.nextReview);
    return (!Number.isNaN(lastReviewed.getTime()) &&
        !Number.isNaN(nextReview.getTime()) &&
        nextReview >= lastReviewed);
}, {
    message: "Next review date must be the same as or after the last reviewed date",
    path: ["nextReview"],
});
const DrillSchemaBase = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    type: z.enum(["Fire", "Evacuation", "Spill", "Earthquake", "Medical", "Other"]),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    scheduledDate: z.string().min(1),
    actualDate: z.string().optional(),
    participants: z.number().min(0).optional(),
    duration: z.number().min(0).optional(),
    scenario: z.string().max(2000).optional(),
    findings: z.string().max(2000).optional(),
    observations: z.string().max(2000).optional(),
    improvements: z.string().max(2000).optional(),
    coordinator: z.string().min(1).max(200),
    status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
    createdBy: z.string().min(1).max(200),
});
export const DrillSchema = DrillSchemaBase
    .refine((data) => {
    if (!data.actualDate)
        return true;
    const scheduledDate = new Date(data.scheduledDate);
    const actualDate = new Date(data.actualDate);
    return (!Number.isNaN(scheduledDate.getTime()) &&
        !Number.isNaN(actualDate.getTime()) &&
        actualDate >= scheduledDate);
}, {
    message: "Actual drill date must be the same as or after the scheduled date",
    path: ["actualDate"],
});
export const EmergencyContactSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(200),
    role: z.string().min(1).max(100),
    site: z.string().min(1).max(200),
    department: z.string().max(100).optional(),
    phone: z.string().min(1).max(20),
    email: z.string().email().max(200).optional(),
    alternatePhone: z.string().max(20).optional(),
    isPrimary: z.boolean().default(false),
    isERT: z.boolean().default(false),
    notes: z.string().max(500).optional(),
    createdBy: z.string().min(1).max(200),
});
export class EmergencyService {
    planService;
    drillService;
    contactService;
    constructor() {
        this.planService = new BaseService("emergency_plans", EmergencyPlanSchemaBase);
        this.drillService = new BaseService("drills", DrillSchemaBase);
        this.contactService = new BaseService("emergency_contacts", EmergencyContactSchema);
    }
    async createPlan(data) {
        return this.planService.create(EmergencyPlanSchema.parse(data));
    }
    async getPlans() {
        return this.planService.getAll();
    }
    async getPlanById(id) {
        return this.planService.getById(id);
    }
    async updatePlan(id, data) {
        const current = await this.getPlanById(id);
        if (!current)
            return null;
        return this.planService.update(id, EmergencyPlanSchema.parse({ ...current, ...data }));
    }
    async deletePlan(id) {
        const current = await this.getPlanById(id);
        if (!current)
            return null;
        await this.planService.delete(id);
        return current;
    }
    async createDrill(data) {
        return this.drillService.create(DrillSchema.parse(data));
    }
    async getDrills(filters) {
        return this.drillService.getAll(filters);
    }
    async updateDrill(id, data) {
        const current = await this.drillService.getById(id);
        if (!current)
            return null;
        return this.drillService.update(id, DrillSchema.parse({ ...current, ...data }));
    }
    async deleteDrill(id) {
        const current = await this.drillService.getById(id);
        if (!current)
            return null;
        await this.drillService.delete(id);
        return current;
    }
    async createContact(data) {
        return this.contactService.create(data);
    }
    async getContacts(filters) {
        return this.contactService.getAll(filters);
    }
    async updateContact(id, data) {
        return this.contactService.update(id, data);
    }
    async deleteContact(id) {
        const current = await this.contactService.getById(id);
        if (!current)
            return null;
        await this.contactService.delete(id);
        return current;
    }
    async getEmergencyStats() {
        const plans = await this.planService.getAll();
        const drills = await this.drillService.getAll();
        const contacts = await this.contactService.getAll();
        return {
            totalPlans: plans.length,
            activePlans: plans.filter((p) => p.status === "Active").length,
            totalDrills: drills.length,
            completedDrills: drills.filter((d) => d.status === "Completed").length,
            scheduledDrills: drills.filter((d) => d.status === "Scheduled").length,
            totalContacts: contacts.length,
            ertMembers: contacts.filter((c) => c.isERT).length,
        };
    }
}
