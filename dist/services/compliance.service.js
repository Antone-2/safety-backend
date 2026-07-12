import { BaseService } from "./base.service.js";
import { z } from "zod";
export const ComplianceObligationSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    legislation: z.string().min(1).max(200),
    requirement: z.string().min(1).max(2000),
    frequency: z.string().min(1).max(100),
    responsibility: z.string().min(1).max(200),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    dueDate: z.string().optional(),
    status: z.string().default("Compliant"),
    lastComplianceDate: z.string().optional(),
    evidence: z.string().optional(),
    notes: z.string().max(1000).optional(),
    createdBy: z.string().min(1).max(200),
});
export const AuditSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    type: z.enum(["Internal", "External", "Regulatory", "Management Review"]),
    status: z.enum(["Planned", "In Progress", "Completed", "Closed"]).default("Planned"),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    leadAuditor: z.string().min(1).max(200),
    teamMembers: z.string().optional().default("[]"),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    scope: z.string().max(2000).optional(),
    criteria: z.string().max(2000).optional(),
    findings: z.string().optional().default("[]"),
    reportUrl: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export const LegalUpdateSchema = z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    legislation: z.string().min(1).max(200),
    jurisdiction: z.string().min(1).max(100),
    effectiveDate: z.string().min(1),
    summary: z.string().min(1).max(2000),
    impactAssessment: z.string().max(2000).optional(),
    actionRequired: z.string().max(2000).optional(),
    assignedTo: z.string().max(200).optional(),
    dueDate: z.string().optional(),
    status: z.string().default("New"),
    source: z.string().max(500).optional(),
    createdBy: z.string().min(1).max(200),
});
export class ComplianceService {
    obligationService;
    auditService;
    legalUpdateService;
    constructor() {
        this.obligationService = new BaseService("compliance_obligations", ComplianceObligationSchema);
        this.auditService = new BaseService("audits", AuditSchema);
        this.legalUpdateService = new BaseService("legal_updates", LegalUpdateSchema);
    }
    async createObligation(data) {
        return this.obligationService.create(data);
    }
    async getObligations(filters) {
        return this.obligationService.getAll(filters);
    }
    async updateObligation(id, data) {
        return this.obligationService.update(id, data);
    }
    async createAudit(data) {
        return this.auditService.create(data);
    }
    async getAudits(filters) {
        return this.auditService.getAll(filters);
    }
    async updateAudit(id, data) {
        return this.auditService.update(id, data);
    }
    async createLegalUpdate(data) {
        return this.legalUpdateService.create(data);
    }
    async getLegalUpdates(filters) {
        return this.legalUpdateService.getAll(filters);
    }
    async updateLegalUpdate(id, data) {
        return this.legalUpdateService.update(id, data);
    }
    async getComplianceDashboard() {
        const obligations = await this.obligationService.getAll();
        const total = obligations.length;
        const compliant = obligations.filter((o) => o.status === "Compliant").length;
        const nonCompliant = obligations.filter((o) => o.status === "Non-Compliant").length;
        const pending = obligations.filter((o) => o.status === "Pending").length;
        const audits = await this.auditService.getAll();
        const openAudits = audits.filter((a) => a.status === "In Progress").length;
        return { total, compliant, nonCompliant, pending, openAudits };
    }
}
