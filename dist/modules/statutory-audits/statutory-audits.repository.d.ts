import { Pool } from "pg";
import type { StatutoryAuditRecord, AuditLocationCategory, AuditTypeEnum } from "./statutory-audits.types.js";
export declare class StatutoryAuditRepository {
    private pool;
    constructor(pool?: Pool);
    findAll(filters?: {
        locationCategory?: string;
        locationName?: string;
    }): Promise<StatutoryAuditRecord[]>;
    getMatrix(filters?: {
        locationCategory?: string;
        search?: string;
    }): Promise<{
        locations: Array<{
            locationCategory: AuditLocationCategory;
            locationName: string;
            sortOrder: number;
            audits: Record<string, {
                dateDone?: string;
                remarks?: string;
                referenceNo?: string;
            }>;
        }>;
        auditTypes: AuditTypeEnum[];
    }>;
    upsertRecord(locationCategory: string, locationName: string, sortOrder: number, auditType: string, data: {
        dateDone?: string;
        remarks?: string;
        referenceNo?: string;
    }): Promise<void>;
    existsByLocation(locationCategory: string, locationName: string): Promise<boolean>;
    deleteByLocation(locationCategory: string, locationName: string): Promise<void>;
    getSummary(): Promise<{
        totalLocations: number;
        validCount: number;
        expiredCount: number;
        wipCount: number;
        plannedCount: number;
    }>;
}
