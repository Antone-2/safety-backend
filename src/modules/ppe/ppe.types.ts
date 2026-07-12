import { z } from "zod";

export const PpeTypeSchema = z.enum([
  "Hard Hat",
  "Safety Shoes",
  "Safety Glasses",
  "Gloves",
  "Respirator",
  "Ear Protection",
  "Coveralls",
  "Face Shield",
  "Chemical Suit",
  "Other",
]);
export type PpeType = z.infer<typeof PpeTypeSchema>;

export const PpeConditionSchema = z.enum(["New", "Good", "Fair", "Poor", "Expired", "Damaged"]);
export type PpeCondition = z.infer<typeof PpeConditionSchema>;

export const PpeStatusSchema = z.enum(["Issued", "Returned", "Expired", "Damaged", "Lost"]);
export type PpeStatus = z.infer<typeof PpeStatusSchema>;

export interface Ppe {
  id: string;
  ppeNo?: string;
  type: PpeType;
  description: string;
  assignedTo?: string;
  department?: string;
  site: string;
  issuedDate?: string;
  expiryDate?: string;
  condition?: PpeCondition;
  inspectionDate?: string;
  inspectionDueDate?: string;
  status: PpeStatus;
  serialNumber?: string;
  certificateUrl?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreatePpeSchema = z.object({
  type: PpeTypeSchema,
  description: z.string().min(1).max(500),
  assignedTo: z.string().max(200).optional(),
  department: z.string().max(100).optional(),
  site: z.string().min(1).max(200),
  issuedDate: z.string().optional(),
  expiryDate: z.string().optional(),
  condition: PpeConditionSchema.optional(),
  inspectionDate: z.string().optional(),
  inspectionDueDate: z.string().optional(),
  status: PpeStatusSchema.default("Issued"),
  serialNumber: z.string().max(100).optional(),
  certificateUrl: z.string().optional(),
  notes: z.string().max(1000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreatePpeInput = z.infer<typeof CreatePpeSchema>;

export const UpdatePpeSchema = z.object({
  type: PpeTypeSchema.optional(),
  description: z.string().min(1).max(500).optional(),
  assignedTo: z.string().max(200).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  site: z.string().min(1).max(200).optional(),
  issuedDate: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  condition: PpeConditionSchema.optional().nullable(),
  inspectionDate: z.string().optional().nullable(),
  inspectionDueDate: z.string().optional().nullable(),
  status: PpeStatusSchema.optional(),
  serialNumber: z.string().max(100).optional().nullable(),
  certificateUrl: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type UpdatePpeInput = z.infer<typeof UpdatePpeSchema>;

export interface PpeStats {
  total: number;
  issued: number;
  expired: number;
  dueForInspection: number;
}
