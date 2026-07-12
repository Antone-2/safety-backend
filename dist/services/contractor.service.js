import { BaseService } from "./base.service.js";
import { z } from "zod";
export const ContractorStatusSchema = z.enum(["Active", "Suspended", "Blacklisted", "Expired"]);
export const ContractorSchema = z.object({
    id: z.string().optional(),
    companyName: z.string().min(1).max(200),
    registrationNumber: z.string().min(1).max(100),
    contactPerson: z.string().min(1).max(200),
    contactEmail: z.string().email().max(200),
    contactPhone: z.string().max(20),
    physicalAddress: z.string().max(500).optional(),
    services: z.string().max(1000).optional(),
    certifications: z.string().max(1000).optional(),
    insuranceExpiry: z.string().optional(),
    safetyRating: z.number().min(0).max(5).optional(),
    incidents: z.number().default(0),
    lastAuditDate: z.string().optional(),
    status: ContractorStatusSchema.default("Active"),
    inductionDate: z.string().optional(),
    inductionExpiry: z.string().optional(),
    documents: z.string().optional().default("[]"),
    performanceScore: z.number().min(0).max(100).optional(),
    createdBy: z.string().min(1).max(200),
});
export const ContractorIncidentSchema = z.object({
    id: z.string().optional(),
    contractorId: z.string().min(1).max(100),
    incidentType: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    severity: z.enum(["Low", "Medium", "High", "Critical"]),
    date: z.string().min(1),
    location: z.string().min(1).max(200),
    actionTaken: z.string().max(2000).optional(),
    followUpRequired: z.boolean().default(false),
    createdBy: z.string().min(1).max(200),
});
export class ContractorService {
    contractorService;
    incidentService;
    constructor() {
        this.contractorService = new BaseService("contractors", ContractorSchema);
        this.incidentService = new BaseService("contractor_incidents", ContractorIncidentSchema);
    }
    async createContractor(data) {
        return this.contractorService.create(data);
    }
    async getContractors(filters) {
        return this.contractorService.getAll(filters);
    }
    async getContractorById(id) {
        return this.contractorService.getById(id);
    }
    async updateContractor(id, data) {
        return this.contractorService.update(id, data);
    }
    async recordIncident(data) {
        const incident = await this.incidentService.create(data);
        const contractor = await this.contractorService.getById(data.contractorId);
        if (contractor) {
            const incidents = (contractor.incidents || 0) + 1;
            await this.contractorService.update(data.contractorId, { incidents });
        }
        return incident;
    }
    async getContractorIncidents(contractorId) {
        return this.incidentService.getAll({ contractorId });
    }
    async getContractorStats() {
        const contractors = await this.contractorService.getAll();
        const total = contractors.length;
        const active = contractors.filter((c) => c.status === "Active").length;
        const suspended = contractors.filter((c) => c.status === "Suspended").length;
        const blacklisted = contractors.filter((c) => c.status === "Blacklisted").length;
        const avgRating = contractors.reduce((sum, c) => sum + (c.safetyRating || 0), 0) / total || 0;
        return { total, active, suspended, blacklisted, avgRating: avgRating.toFixed(1) };
    }
}
