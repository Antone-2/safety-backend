import { z } from "zod";

export const SafetyAlertSeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const SafetyAlertStatusSchema = z.enum(["Draft", "Published", "Archived"]);
export const SafetyAlertCategorySchema = z.enum([
  "Incident",
  "Near Miss",
  "Lesson Learned",
  "Regulatory",
  "Seasonal",
  "Operational",
  "Other",
]);

export type SafetyAlertSeverity = z.infer<typeof SafetyAlertSeveritySchema>;
export type SafetyAlertStatus = z.infer<typeof SafetyAlertStatusSchema>;
export type SafetyAlertCategory = z.infer<typeof SafetyAlertCategorySchema>;

export interface SafetyAlertRecord {
  id: string;
  alertNo: string;
  title: string;
  category: SafetyAlertCategory;
  severity: SafetyAlertSeverity;
  status: SafetyAlertStatus;
  summary: string;
  immediateActions?: string;
  lessonsLearned: string;
  sourceType?: string;
  sourceRef?: string;
  audience?: string;
  sites?: string[];
  departments?: string[];
  effectiveFrom: string;
  effectiveUntil?: string;
  acknowledgementRequired: boolean;
  publishedBy?: string;
  publishedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyAlertAcknowledgement {
  id: string;
  alertId: string;
  userId: string;
  userName: string;
  userEmail?: string;
  acknowledgedAt: string;
  comments?: string;
}

export interface SafetyAlertStats {
  total: number;
  draft: number;
  published: number;
  archived: number;
  acknowledgementRequired: number;
  overdueAcknowledgements: number;
}

export const CreateSafetyAlertSchema = z.object({
  title: z.string().min(1).max(200),
  category: SafetyAlertCategorySchema,
  severity: SafetyAlertSeveritySchema.default("Medium"),
  status: SafetyAlertStatusSchema.default("Draft"),
  summary: z.string().min(1).max(4000),
  immediateActions: z.string().max(2000).optional(),
  lessonsLearned: z.string().min(1).max(4000),
  sourceType: z.string().max(120).optional(),
  sourceRef: z.string().max(120).optional(),
  audience: z.string().max(200).optional(),
  sites: z.array(z.string().min(1).max(120)).optional(),
  departments: z.array(z.string().min(1).max(120)).optional(),
  effectiveFrom: z.string().min(1),
  effectiveUntil: z.string().optional(),
  acknowledgementRequired: z.boolean().default(false),
  publishedBy: z.string().max(200).optional(),
  publishedAt: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateSafetyAlertInput = z.infer<typeof CreateSafetyAlertSchema>;

export const UpdateSafetyAlertSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  category: SafetyAlertCategorySchema.optional(),
  severity: SafetyAlertSeveritySchema.optional(),
  status: SafetyAlertStatusSchema.optional(),
  summary: z.string().min(1).max(4000).optional(),
  immediateActions: z.string().max(2000).optional().nullable(),
  lessonsLearned: z.string().min(1).max(4000).optional(),
  sourceType: z.string().max(120).optional().nullable(),
  sourceRef: z.string().max(120).optional().nullable(),
  audience: z.string().max(200).optional().nullable(),
  sites: z.array(z.string().min(1).max(120)).optional().nullable(),
  departments: z.array(z.string().min(1).max(120)).optional().nullable(),
  effectiveFrom: z.string().min(1).optional(),
  effectiveUntil: z.string().optional().nullable(),
  acknowledgementRequired: z.boolean().optional(),
  publishedBy: z.string().max(200).optional().nullable(),
  publishedAt: z.string().optional().nullable(),
});
export type UpdateSafetyAlertInput = z.infer<typeof UpdateSafetyAlertSchema>;

export const AcknowledgeSafetyAlertSchema = z.object({
  userId: z.string().min(1).max(120),
  userName: z.string().min(1).max(200),
  userEmail: z.string().email().max(200).optional(),
  comments: z.string().max(1000).optional(),
});
export type AcknowledgeSafetyAlertInput = z.infer<typeof AcknowledgeSafetyAlertSchema>;
