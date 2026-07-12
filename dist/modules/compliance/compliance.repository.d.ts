import { Pool } from "pg";
import type { ComplianceObligation, ComplianceAudit, LegalUpdate, CreateComplianceObligationInput, UpdateComplianceObligationInput, CreateComplianceAuditInput, UpdateComplianceAuditInput, CreateLegalUpdateInput, UpdateLegalUpdateInput, ComplianceDashboard } from "./compliance.types.js";
export declare class ComplianceRepository {
    private pool;
    constructor(pool?: Pool);
    findObligations(filters?: Record<string, unknown>): Promise<ComplianceObligation[]>;
    findObligationById(id: string): Promise<ComplianceObligation | null>;
    createObligation(data: CreateComplianceObligationInput): Promise<ComplianceObligation>;
    updateObligation(id: string, data: UpdateComplianceObligationInput): Promise<ComplianceObligation | null>;
    deleteObligation(id: string): Promise<boolean>;
    findAudits(filters?: Record<string, unknown>): Promise<ComplianceAudit[]>;
    findAuditById(id: string): Promise<ComplianceAudit | null>;
    createAudit(data: CreateComplianceAuditInput): Promise<ComplianceAudit>;
    updateAudit(id: string, data: UpdateComplianceAuditInput): Promise<ComplianceAudit | null>;
    deleteAudit(id: string): Promise<boolean>;
    findLegalUpdates(filters?: Record<string, unknown>): Promise<LegalUpdate[]>;
    findLegalUpdateById(id: string): Promise<LegalUpdate | null>;
    createLegalUpdate(data: CreateLegalUpdateInput): Promise<LegalUpdate>;
    updateLegalUpdate(id: string, data: UpdateLegalUpdateInput): Promise<LegalUpdate | null>;
    deleteLegalUpdate(id: string): Promise<boolean>;
    getDashboard(): Promise<ComplianceDashboard>;
}
