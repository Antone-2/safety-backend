import { z } from "zod";

export const SdsStatusSchema = z.enum(["Active", "Expired", "Under Review", "Archived"]);
export type SdsStatus = z.infer<typeof SdsStatusSchema>;

export interface Sds {
  id: string;
  sdsNo?: string;
  chemicalName: string;
  casNumber?: string;
  formula?: string;
  supplier?: string;
  sdsUrl?: string;
  hazardClass?: string;
  signalWord?: string;
  pictograms?: string;
  storageRequirements?: string;
  ppeRequired?: string;
  firstAidMeasure?: string;
  spillProcedures?: string;
  effectiveDate?: string;
  nextReviewDate?: string;
  version?: string;
  status: SdsStatus;
  location?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateSdsSchema = z.object({
  chemicalName: z.string().min(1).max(200),
  casNumber: z.string().max(50).optional(),
  formula: z.string().max(200).optional(),
  supplier: z.string().max(200).optional(),
  sdsUrl: z.string().url().optional(),
  hazardClass: z.string().max(200).optional(),
  signalWord: z.string().max(100).optional(),
  pictograms: z.string().max(500).optional(),
  storageRequirements: z.string().max(2000).optional(),
  ppeRequired: z.string().max(500).optional(),
  firstAidMeasure: z.string().max(2000).optional(),
  spillProcedures: z.string().max(2000).optional(),
  effectiveDate: z.string().optional(),
  nextReviewDate: z.string().optional(),
  version: z.string().max(20).optional(),
  status: SdsStatusSchema.default("Active"),
  location: z.string().max(200).optional(),
  notes: z.string().max(1000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateSdsInput = z.infer<typeof CreateSdsSchema>;

export const UpdateSdsSchema = z.object({
  chemicalName: z.string().min(1).max(200).optional(),
  casNumber: z.string().max(50).optional().nullable(),
  formula: z.string().max(200).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  sdsUrl: z.string().url().optional().nullable(),
  hazardClass: z.string().max(200).optional().nullable(),
  signalWord: z.string().max(100).optional().nullable(),
  pictograms: z.string().max(500).optional().nullable(),
  storageRequirements: z.string().max(2000).optional().nullable(),
  ppeRequired: z.string().max(500).optional().nullable(),
  firstAidMeasure: z.string().max(2000).optional().nullable(),
  spillProcedures: z.string().max(2000).optional().nullable(),
  effectiveDate: z.string().optional().nullable(),
  nextReviewDate: z.string().optional().nullable(),
  version: z.string().max(20).optional().nullable(),
  status: SdsStatusSchema.optional(),
  location: z.string().max(200).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type UpdateSdsInput = z.infer<typeof UpdateSdsSchema>;

export interface SdsStats {
  total: number;
  active: number;
  expired: number;
  overdue: number;
}
