import { BaseService } from "./base.service.js";
import { z } from "zod";
export const ContextAnalysisSchema = z.object({
    id: z.string().optional(),
    analysisNo: z.string().optional(),
    title: z.string().min(1).max(300),
    period: z.string().min(1).max(50),
    politicalFactors: z.string().max(2000).optional(),
    economicFactors: z.string().max(2000).optional(),
    socialFactors: z.string().max(2000).optional(),
    technologicalFactors: z.string().max(2000).optional(),
    legalFactors: z.string().max(2000).optional(),
    environmentalFactors: z.string().max(2000).optional(),
    internalStrengths: z.string().max(2000).optional(),
    internalWeaknesses: z.string().max(2000).optional(),
    opportunities: z.string().max(2000).optional(),
    threats: z.string().max(2000).optional(),
    scopeStatement: z.string().max(2000).optional(),
    status: z.string().default("Active"),
    reviewedBy: z.string().max(200).optional(),
    reviewedAt: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export const InterestedPartySchema = z.object({
    id: z.string().optional(),
    partyNo: z.string().optional(),
    name: z.string().min(1).max(300),
    type: z.string().min(1).max(100),
    category: z.string().min(1).max(100),
    contactPerson: z.string().max(200).optional(),
    contactEmail: z.string().email().max(200).optional(),
    contactPhone: z.string().max(20).optional(),
    influence: z.string().max(200).optional(),
    expectations: z.string().max(2000).optional(),
    communicationFrequency: z.string().max(100).optional(),
    lastContactDate: z.string().optional(),
    status: z.string().default("Active"),
    notes: z.string().max(1000).optional(),
    createdBy: z.string().min(1).max(200),
});
export class ContextService extends BaseService {
    partyService;
    constructor() {
        super("context_analysis", ContextAnalysisSchema);
        this.partyService = new BaseService("interested_parties", InterestedPartySchema);
    }
    async createContext(data) {
        const record = await this.create({
            ...data,
            analysisNo: `CTX-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        });
        return record;
    }
    async getContexts() { return this.getAll(); }
    async getContextById(id) { return this.getById(id); }
    async createParty(data) {
        const record = await this.partyService.create({ ...data, partyNo: `IP-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}` });
        return record;
    }
    async getParties() { return this.partyService.getAll(); }
    async getPartyById(id) { return this.partyService.getById(id); }
    async getPartiesByType(type) { return this.partyService.getAll({ type }); }
}
