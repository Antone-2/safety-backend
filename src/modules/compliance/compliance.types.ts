import { z } from "zod";

export const ComplianceStatusSchema = z.enum(["Compliant", "Non-Compliant", "Pending"]);
export type ComplianceStatus = z.infer<typeof ComplianceStatusSchema>;

export const AuditTypeSchema = z.enum(["Internal", "External", "Regulatory", "Management Review"]);
export type AuditType = z.infer<typeof AuditTypeSchema>;

export const AuditStatusSchema = z.enum(["Planned", "In Progress", "Completed", "Closed"]);
export type AuditStatus = z.infer<typeof AuditStatusSchema>;

export const LegalUpdateStatusSchema = z.enum(["New", "Under Review", "Action Required", "Implemented", "Closed"]);
export type LegalUpdateStatus = z.infer<typeof LegalUpdateStatusSchema>;

export interface ComplianceObligation {
  id: string;
  title: string;
  legislation: string;
  requirement: string;
  frequency: string;
  responsibility: string;
  site: string;
  department: string;
  dueDate?: string;
  status: ComplianceStatus;
  lastComplianceDate?: string;
  evidence?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateComplianceObligationSchema = z.object({
  title: z.string().min(1).max(200),
  legislation: z.string().min(1).max(200),
  requirement: z.string().min(1).max(2000),
  frequency: z.string().min(1).max(100),
  responsibility: z.string().min(1).max(200),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  dueDate: z.string().optional(),
  status: ComplianceStatusSchema.default("Pending"),
  lastComplianceDate: z.string().optional(),
  evidence: z.string().optional(),
  notes: z.string().max(1000).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateComplianceObligationInput = z.infer<typeof CreateComplianceObligationSchema>;

export const UpdateComplianceObligationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  legislation: z.string().min(1).max(200).optional(),
  requirement: z.string().min(1).max(2000).optional(),
  frequency: z.string().min(1).max(100).optional(),
  responsibility: z.string().min(1).max(200).optional(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  dueDate: z.string().optional().nullable(),
  status: ComplianceStatusSchema.optional(),
  lastComplianceDate: z.string().optional().nullable(),
  evidence: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type UpdateComplianceObligationInput = z.infer<typeof UpdateComplianceObligationSchema>;

export interface ComplianceAudit {
  id: string;
  title: string;
  type: AuditType;
  status: AuditStatus;
  site: string;
  department: string;
  leadAuditor: string;
  teamMembers: string[];
  startDate: string;
  endDate: string;
  scope?: string;
  criteria?: string;
  findings: unknown[];
  reportUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateComplianceAuditSchema = z.object({
  title: z.string().min(1).max(200),
  type: AuditTypeSchema,
  status: AuditStatusSchema.default("Planned"),
  site: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  leadAuditor: z.string().min(1).max(200),
  teamMembers: z.array(z.string().max(200)).optional().default([]),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  scope: z.string().max(2000).optional(),
  criteria: z.string().max(2000).optional(),
  findings: z.array(z.unknown()).optional().default([]),
  reportUrl: z.string().optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateComplianceAuditInput = z.infer<typeof CreateComplianceAuditSchema>;

export const UpdateComplianceAuditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: AuditTypeSchema.optional(),
  status: AuditStatusSchema.optional(),
  site: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  leadAuditor: z.string().min(1).max(200).optional(),
  teamMembers: z.array(z.string().max(200)).optional().nullable(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  scope: z.string().max(2000).optional().nullable(),
  criteria: z.string().max(2000).optional().nullable(),
  findings: z.array(z.unknown()).optional().nullable(),
  reportUrl: z.string().optional().nullable(),
});
export type UpdateComplianceAuditInput = z.infer<typeof UpdateComplianceAuditSchema>;

export interface LegalUpdate {
  id: string;
  title: string;
  legislation: string;
  jurisdiction: string;
  effectiveDate: string;
  summary: string;
  impactAssessment?: string;
  actionRequired?: string;
  assignedTo?: string;
  dueDate?: string;
  status: LegalUpdateStatus;
  source?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateLegalUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  legislation: z.string().min(1).max(200),
  jurisdiction: z.string().min(1).max(100),
  effectiveDate: z.string().min(1),
  summary: z.string().min(1).max(2000),
  impactAssessment: z.string().max(2000).optional(),
  actionRequired: z.string().max(2000).optional(),
  assignedTo: z.string().max(200).optional(),
  dueDate: z.string().optional(),
  status: LegalUpdateStatusSchema.default("New"),
  source: z.string().max(500).optional(),
  createdBy: z.string().min(1).max(200),
});
export type CreateLegalUpdateInput = z.infer<typeof CreateLegalUpdateSchema>;

export const UpdateLegalUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  legislation: z.string().min(1).max(200).optional(),
  jurisdiction: z.string().min(1).max(100).optional(),
  effectiveDate: z.string().min(1).optional(),
  summary: z.string().min(1).max(2000).optional(),
  impactAssessment: z.string().max(2000).optional().nullable(),
  actionRequired: z.string().max(2000).optional().nullable(),
  assignedTo: z.string().max(200).optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: LegalUpdateStatusSchema.optional(),
  source: z.string().max(500).optional().nullable(),
});
export type UpdateLegalUpdateInput = z.infer<typeof UpdateLegalUpdateSchema>;

export interface ComplianceDashboard {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  openAudits: number;
}
