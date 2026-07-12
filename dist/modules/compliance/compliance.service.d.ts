import { ComplianceObligation, ComplianceAudit, LegalUpdate, ComplianceDashboard, CreateComplianceObligationInput, UpdateComplianceObligationInput, CreateComplianceAuditInput, UpdateComplianceAuditInput, CreateLegalUpdateInput, UpdateLegalUpdateInput } from "./compliance.types.js";
import { ComplianceRepository } from "./compliance.repository.js";
export declare class ComplianceService {
    private repository;
    constructor(repository: ComplianceRepository);
    getObligations(filters?: Record<string, unknown>): Promise<ComplianceObligation[]>;
    getObligationById(id: string): Promise<ComplianceObligation | null>;
    createObligation(data: CreateComplianceObligationInput): Promise<ComplianceObligation>;
    updateObligation(id: string, data: UpdateComplianceObligationInput): Promise<ComplianceObligation | null>;
    deleteObligation(id: string): Promise<boolean>;
    getAudits(filters?: Record<string, unknown>): Promise<ComplianceAudit[]>;
    getAuditById(id: string): Promise<ComplianceAudit | null>;
    createAudit(data: CreateComplianceAuditInput): Promise<ComplianceAudit>;
    updateAudit(id: string, data: UpdateComplianceAuditInput): Promise<ComplianceAudit | null>;
    deleteAudit(id: string): Promise<boolean>;
    getLegalUpdates(filters?: Record<string, unknown>): Promise<LegalUpdate[]>;
    getLegalUpdateById(id: string): Promise<LegalUpdate | null>;
    createLegalUpdate(data: CreateLegalUpdateInput): Promise<LegalUpdate>;
    updateLegalUpdate(id: string, data: UpdateLegalUpdateInput): Promise<LegalUpdate | null>;
    deleteLegalUpdate(id: string): Promise<boolean>;
    getComplianceDashboard(): Promise<ComplianceDashboard>;
}
