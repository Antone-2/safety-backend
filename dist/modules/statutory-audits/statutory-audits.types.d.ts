import { z } from "zod";
export declare const AuditLocationCategorySchema: z.ZodEnum<["FACTORIES", "DEPOTS", "SHOWROOMS"]>;
export type AuditLocationCategory = z.infer<typeof AuditLocationCategorySchema>;
export declare const AuditTypeEnumSchema: z.ZodEnum<["Occupational Safety & Health Audit", "NEMA/EA AUDIT", "FIRE SAFETY AUDIT", "NOISE LEVELS ASSESSMENT", "ENERGY AUDIT REPORT", "EFFLUENT DISCHARGE LICENSE", "STACK EMISSION", "AIR QUALITY ANALYSIS", "MEDICAL EXAMINATION REPORT", "RISK ASSESSMENT REPORT"]>;
export type AuditTypeEnum = z.infer<typeof AuditTypeEnumSchema>;
export declare const ALL_AUDIT_TYPES: AuditTypeEnum[];
export interface StatutoryAuditRecord {
    id: string;
    locationCategory: AuditLocationCategory;
    locationName: string;
    sortOrder: number;
    auditType: AuditTypeEnum;
    dateDone?: string;
    remarks?: string;
    referenceNo?: string;
    createdAt: string;
    updatedAt: string;
}
export interface StatutoryAuditCell {
    auditType: AuditTypeEnum;
    dateDone?: string;
    remarks?: string;
    referenceNo?: string;
}
export interface StatutoryAuditLocation {
    locationCategory: AuditLocationCategory;
    locationName: string;
    sortOrder: number;
    audits: StatutoryAuditCell[];
}
export interface StatutoryAuditMatrixResponse {
    locations: StatutoryAuditLocation[];
    auditTypes: AuditTypeEnum[];
    summary: {
        totalLocations: number;
        validCount: number;
        expiredCount: number;
        wipCount: number;
        plannedCount: number;
    };
}
export declare const UpsertStatutoryAuditRecordSchema: z.ZodObject<{
    locationCategory: z.ZodEnum<["FACTORIES", "DEPOTS", "SHOWROOMS"]>;
    locationName: z.ZodString;
    sortOrder: z.ZodNumber;
    auditType: z.ZodEnum<["Occupational Safety & Health Audit", "NEMA/EA AUDIT", "FIRE SAFETY AUDIT", "NOISE LEVELS ASSESSMENT", "ENERGY AUDIT REPORT", "EFFLUENT DISCHARGE LICENSE", "STACK EMISSION", "AIR QUALITY ANALYSIS", "MEDICAL EXAMINATION REPORT", "RISK ASSESSMENT REPORT"]>;
    dateDone: z.ZodOptional<z.ZodString>;
    remarks: z.ZodOptional<z.ZodString>;
    referenceNo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    locationCategory: "FACTORIES" | "DEPOTS" | "SHOWROOMS";
    locationName: string;
    sortOrder: number;
    auditType: "Occupational Safety & Health Audit" | "NEMA/EA AUDIT" | "FIRE SAFETY AUDIT" | "NOISE LEVELS ASSESSMENT" | "ENERGY AUDIT REPORT" | "EFFLUENT DISCHARGE LICENSE" | "STACK EMISSION" | "AIR QUALITY ANALYSIS" | "MEDICAL EXAMINATION REPORT" | "RISK ASSESSMENT REPORT";
    remarks?: string | undefined;
    dateDone?: string | undefined;
    referenceNo?: string | undefined;
}, {
    locationCategory: "FACTORIES" | "DEPOTS" | "SHOWROOMS";
    locationName: string;
    sortOrder: number;
    auditType: "Occupational Safety & Health Audit" | "NEMA/EA AUDIT" | "FIRE SAFETY AUDIT" | "NOISE LEVELS ASSESSMENT" | "ENERGY AUDIT REPORT" | "EFFLUENT DISCHARGE LICENSE" | "STACK EMISSION" | "AIR QUALITY ANALYSIS" | "MEDICAL EXAMINATION REPORT" | "RISK ASSESSMENT REPORT";
    remarks?: string | undefined;
    dateDone?: string | undefined;
    referenceNo?: string | undefined;
}>;
export declare const DeleteStatutoryAuditLocationSchema: z.ZodObject<{
    locationCategory: z.ZodEnum<["FACTORIES", "DEPOTS", "SHOWROOMS"]>;
    locationName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    locationCategory: "FACTORIES" | "DEPOTS" | "SHOWROOMS";
    locationName: string;
}, {
    locationCategory: "FACTORIES" | "DEPOTS" | "SHOWROOMS";
    locationName: string;
}>;
