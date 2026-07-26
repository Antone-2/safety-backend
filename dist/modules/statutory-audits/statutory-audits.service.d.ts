import { StatutoryAuditRepository } from "./statutory-audits.repository.js";
import type { StatutoryAuditMatrixResponse, AuditLocationCategory, AuditTypeEnum, StatutoryAuditRecord } from "./statutory-audits.types.js";
export declare class StatutoryAuditService {
    private repository;
    constructor(repository: StatutoryAuditRepository);
    getMatrix(filters?: {
        locationCategory?: string;
        search?: string;
    }): Promise<StatutoryAuditMatrixResponse>;
    upsertRecord(input: {
        locationCategory: AuditLocationCategory;
        locationName: string;
        sortOrder: number;
        auditType: AuditTypeEnum;
        dateDone?: string;
        remarks?: string;
        referenceNo?: string;
    }): Promise<StatutoryAuditRecord>;
    deleteLocation(locationCategory: AuditLocationCategory, locationName: string): Promise<boolean>;
}
