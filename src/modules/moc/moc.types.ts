import { z } from "zod";

export const MocStatusSchema = z.enum([
  "Draft",
  "Under Review",
  "Approved",
  "Implementation",
  "PSSR",
  "Closed",
  "Rejected",
]);

export const MocChangeTypeSchema = z.enum([
  "Process",
  "Equipment",
  "Material",
  "Procedure",
  "Organization",
  "Temporary",
]);

export const MocRiskLevelSchema = z.enum(["Low", "Medium", "High", "Critical"]);

export type MocStatus = z.infer<typeof MocStatusSchema>;
export type MocChangeType = z.infer<typeof MocChangeTypeSchema>;
export type MocRiskLevel = z.infer<typeof MocRiskLevelSchema>;

export interface MocRecord {
  id: string;
  mocNo: string;
  title: string;
  changeType: MocChangeType;
  area: string;
  site: string;
  department: string;
  requestedBy: string;
  requestedAt: string;
  status: MocStatus;
  summary: string;
  justification: string;
  riskReviewSummary?: string;
  riskLevel: MocRiskLevel;
  implementationPlan?: string;
  pssrRequired: boolean;
  pssrCompleted: boolean;
  approver?: string;
  approvedAt?: string;
  assignedTo?: string;
  dueDate?: string;
  closedAt?: string;
  rejectionReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateMocSchema = z.object({
  title: z.string().min(1).max(200),
  changeType: MocChangeTypeSchema,
  area: z.string().min(1).max(200),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  requestedBy: z.string().min(1).max(200),
  requestedAt: z.string().min(1),
  status: MocStatusSchema.default("Draft"),
  summary: z.string().min(1).max(4000),
  justification: z.string().min(1).max(4000),
  riskReviewSummary: z.string().max(4000).optional(),
  riskLevel: MocRiskLevelSchema.default("Medium"),
  implementationPlan: z.string().max(4000).optional(),
  pssrRequired: z.boolean().default(false),
  pssrCompleted: z.boolean().default(false),
  approver: z.string().max(200).optional(),
  approvedAt: z.string().optional(),
  assignedTo: z.string().max(200).optional(),
  dueDate: z.string().optional(),
  closedAt: z.string().optional(),
  rejectionReason: z.string().max(2000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateMocInput = z.infer<typeof CreateMocSchema>;

export const UpdateMocSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  changeType: MocChangeTypeSchema.optional(),
  area: z.string().min(1).max(200).optional(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  requestedBy: z.string().min(1).max(200).optional(),
  requestedAt: z.string().min(1).optional(),
  status: MocStatusSchema.optional(),
  summary: z.string().min(1).max(4000).optional(),
  justification: z.string().min(1).max(4000).optional(),
  riskReviewSummary: z.string().max(4000).optional().nullable(),
  riskLevel: MocRiskLevelSchema.optional(),
  implementationPlan: z.string().max(4000).optional().nullable(),
  pssrRequired: z.boolean().optional(),
  pssrCompleted: z.boolean().optional(),
  approver: z.string().max(200).optional().nullable(),
  approvedAt: z.string().optional().nullable(),
  assignedTo: z.string().max(200).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  closedAt: z.string().optional().nullable(),
  rejectionReason: z.string().max(2000).optional().nullable(),
});
export type UpdateMocInput = z.infer<typeof UpdateMocSchema>;

export const MocTransitionSchema = z.object({
  event: z.enum([
    "submit-review",
    "approve",
    "start-implementation",
    "complete-pssr",
    "close",
    "reject",
  ]),
  approver: z.string().max(200).optional(),
  approvedAt: z.string().optional(),
  rejectionReason: z.string().max(2000).optional(),
});
export type MocTransitionInput = z.infer<typeof MocTransitionSchema>;

export interface MocStats {
  total: number;
  draft: number;
  underReview: number;
  approved: number;
  implementation: number;
  pssr: number;
  closed: number;
  overdue: number;
}
