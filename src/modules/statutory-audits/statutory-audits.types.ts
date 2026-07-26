import { z } from "zod";

export const AuditLocationCategorySchema = z.enum(["FACTORIES", "DEPOTS", "SHOWROOMS"]);
export type AuditLocationCategory = z.infer<typeof AuditLocationCategorySchema>;

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
export type AuditTypeEnum = z.infer<typeof AuditTypeEnumSchema>;

export const ALL_AUDIT_TYPES: AuditTypeEnum[] = [
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

