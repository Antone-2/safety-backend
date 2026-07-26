import { z } from "zod";
export const AuditLocationCategorySchema = z.enum(["FACTORIES", "DEPOTS", "SHOWROOMS"]);
export const AuditTypeEnumSchema = z.enum([
    "Occupational Safety & Health Audit",
    "NEMA/EA AUDIT",
    "FIRE SAFETY AUDIT",
    "NOISE LEVELS ASSESSMENT",
    "ENERGY AUDIT REPORT",
    "EFFLUENT DISCHARGE LICENSE",
    "STACK EMISSION",
    "AIR QUALITY ANALYSIS",
    "MEDICAL EXAMINATION REPORT",
    "RISK ASSESSMENT REPORT",
]);
export const ALL_AUDIT_TYPES = [
    "Occupational Safety & Health Audit",
    "NEMA/EA AUDIT",
    "FIRE SAFETY AUDIT",
    "NOISE LEVELS ASSESSMENT",
    "ENERGY AUDIT REPORT",
    "EFFLUENT DISCHARGE LICENSE",
    "STACK EMISSION",
    "AIR QUALITY ANALYSIS",
    "MEDICAL EXAMINATION REPORT",
    "RISK ASSESSMENT REPORT",
];
export const UpsertStatutoryAuditRecordSchema = z.object({
    locationCategory: AuditLocationCategorySchema,
    locationName: z.string().trim().min(1).max(200),
    sortOrder: z.coerce.number().int().min(0).max(9999),
    auditType: AuditTypeEnumSchema,
    dateDone: z.string().trim().max(120).optional(),
    remarks: z.string().trim().max(200).optional(),
    referenceNo: z.string().trim().max(200).optional(),
});
export const DeleteStatutoryAuditLocationSchema = z.object({
    locationCategory: AuditLocationCategorySchema,
    locationName: z.string().trim().min(1).max(200),
});
