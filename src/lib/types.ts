import { z } from "zod";

export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export const REPORT_SOURCE_MANUAL = "manual";

export const StatusSchema = z.enum(["Open", "In Progress", "Closed"]);
export type Status = z.infer<typeof StatusSchema>;

export const ReportTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition"]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export interface Report {
  id: string;
  date: string;
  location: string;
  reporter: string;
  description: string;
  severity: Severity;
  status: Status;
  category: string;
  type: ReportType;
  resolutionDays?: number;
  slaHours: number;
  dueAt: string;
  assignedTo?: string;
  comments: { author: string; at: string; text: string }[];
  isNearMiss: boolean;
  isRecordable: boolean;
  isLostTimeInjury: boolean;
  medicalTreatmentCase: boolean;
  lostWorkDays: number;
  restrictedWorkDays: number;
  classificationSource?: string;
  classificationVerifiedBy?: string;
  classificationVerifiedAt?: string;
  anonymous: boolean;
  department: string;
  shift: string;
  complianceRequired: boolean;
  complianceDueAt?: string;
  photoUrl: string;
  photos?: string[];
  reporterEmail?: string;
  reporterPhone?: string;
  reporterWhatsApp?: string;
}

export const CreateReportSchema = z.object({
  location: z.string().min(1).max(200),
  reporter: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  severity: SeveritySchema,
  category: z.string().min(1).max(100),
  type: ReportTypeSchema,
  department: z.string().min(1).max(100),
  shift: z.string().min(1).max(50),
  anonymous: z.boolean().optional().default(false),
  complianceRequired: z.boolean().optional().default(false),
  isRecordable: z.boolean().optional(),
  isLostTimeInjury: z.boolean().optional(),
  medicalTreatmentCase: z.boolean().optional(),
  lostWorkDays: z.number().int().min(0).max(36500).optional(),
  restrictedWorkDays: z.number().int().min(0).max(36500).optional(),
  reporterEmail: z.string().trim().email().optional().or(z.literal("")),
  reporterPhone: z.string().trim().max(30).optional(),
  reporterWhatsApp: z.string().trim().max(30).optional(),
  photoUrl: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || /^(https?:\/\/|data:|blob:)/i.test(value),
      "Photo URL must be a valid http(s), data, or blob URL",
    ),
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

export const CapaStatusSchema = z.enum([
  "Pending",
  "In Progress",
  "Completed",
  "Verified",
  "Closed",
]);
export type CapaStatus = z.infer<typeof CapaStatusSchema>;

export const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type CapaPriority = z.infer<typeof CapaPrioritySchema>;

export const CapaTypeSchema = z.enum(["Corrective", "Preventive"]);
export type CapaType = z.infer<typeof CapaTypeSchema>;

export interface CapaEvidence {
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Capa {
  id: string;
  incidentId: string;
  title: string;
  capaType: CapaType;
  rootCause: string;
  action: string;
  owner: string;
  dueDate: string;
  status: CapaStatus;
  priority: CapaPriority;
  rootCauseMethod?: string;
  rootCauseConclusion?: string;
  attachments: CapaEvidence[];
  closureEvidence: CapaEvidence[] | null;
  createdAt: string;
  updatedAt: string;
}

export const CreateCapaSchema = z.object({
  incidentId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  capaType: CapaTypeSchema,
  rootCause: z.string().min(1).max(2000),
  action: z.string().min(1).max(5000),
  owner: z.string().min(1).max(200),
  dueDate: z.string().min(1),
  priority: CapaPrioritySchema.optional().default("Medium"),
  rootCauseMethod: z.string().max(200).optional(),
  rootCauseConclusion: z.string().max(2000).optional(),
});

export type CreateCapaInput = z.infer<typeof CreateCapaSchema>;

export interface SettingsPayload {
  sites: string[];
  hazards: string[];
  severities: { name: string; slaHours: number; color: string }[];
  schedule: { enabled: boolean; freq: string; email: string };
  accessMatrix?: Record<string, Record<string, boolean>>;
  importHistory?: Array<{
    id: string;
    source: string;
    imported: number;
    skipped: number;
    at: string;
    message: string;
  }>;
  notificationLogs?: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    at: string;
  }>;
  auditLog?: Array<{
    id: string;
    at: string;
    actor: string;
    action: string;
  }>;
  integrations?: {
    googleFormId: string;
    googleApiKey: string;
    googleSheetName: string;
    googleDriveFileId: string;
    slackWebhook: string;
    teamsWebhook: string;
    zapierKey: string;
  };
  notificationContacts?: {
    email: string;
    phone: string;
    whatsapp: string;
    criticalOnly: boolean;
    frequency: string;
  };
}

export const UserRoleSchema = z.enum([
  "super-admin",
  "EHS-manager",
  "she-committee-member",
  "supervisor",
  "gm",
  "plant-manager",
  "factory-manager",
  "depot-admin",
]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  name: z.string().min(1),
  role: UserRoleSchema,
  phone: z.string().max(30).optional(),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
}

export interface Investigation {
  id: string;
  incidentId: string;
  title: string;
  description: string;
  investigator: string;
  status: InvestigationStatus;
  priority: CapaPriority;
  evidence: InvestigationEvidence[];
  rootCause?: string;
  correctiveActions?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

export const InvestigationStatusSchema = z.enum([
  "Pending",
  "In Progress",
  "Completed",
  "Closed",
]);
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;

export const InvestigationEvidenceSchema = z.object({
  name: z.string(),
  url: z.string(),
  uploadedAt: z.string(),
  uploadedBy: z.string(),
});
export type InvestigationEvidence = z.infer<typeof InvestigationEvidenceSchema>;

export const CreateInvestigationSchema = z.object({
  incidentId: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  investigator: z.string().min(1).max(200),
  priority: CapaPrioritySchema.optional().default("Medium"),
  dueDate: z.string().optional(),
});
export type CreateInvestigationInput = z.infer<
  typeof CreateInvestigationSchema
>;

export interface AuthToken {
  token: string;
  user: User;
}

export const PermitTypeSchema = z.enum([
  "Hot Work",
  "Cold Work",
  "Confined Space",
  "Electrical",
  "Excavation",
  "Height Work",
  "General",
]);
export type PermitType = z.infer<typeof PermitTypeSchema>;

export const PermitStatusSchema = z.enum([
  "applicant",
  "supervisor",
  "EHS",
  "issuer",
  "approval",
  "active",
  "closed",
]);
export type PermitStatus = z.infer<typeof PermitStatusSchema>;

export interface PermitAttachment {
  name: string;
  url: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface Permit {
  id: string;
  type: PermitType;
  status: PermitStatus;
  location: string;
  applicant: string;
  applicantContact?: string;
  supervisor?: string;
  EHSOfficer?: string;
  issuer?: string;
  approver?: string;
  description: string;
  startDate: string;
  endDate: string;
  hazards?: string;
  precautions?: string;
  ppeRequired?: string[];
  isolationRequired?: boolean;
  isolationDetails?: string;
  fireWatchRequired?: boolean;
  gasTestRequired?: boolean;
  gasTestResult?: string;
  attachments: PermitAttachment[];
  comments: { author: string; at: string; text: string }[];
  createdAt: string;
  updatedAt: string;
}

export const CreatePermitSchema = z.object({
  type: PermitTypeSchema,
  location: z.string().min(1).max(200),
  applicant: z.string().min(1).max(200),
  applicantContact: z.string().max(50).optional(),
  supervisor: z.string().max(200).optional(),
  EHSOfficer: z.string().max(200).optional(),
  issuer: z.string().max(200).optional(),
  approver: z.string().max(200).optional(),
  description: z.string().min(1).max(5000),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  hazards: z.string().max(2000).optional(),
  precautions: z.string().max(2000).optional(),
  ppeRequired: z.array(z.string().max(100)).optional(),
  isolationRequired: z.boolean().optional().default(false),
  isolationDetails: z.string().max(2000).optional(),
  fireWatchRequired: z.boolean().optional().default(false),
  gasTestRequired: z.boolean().optional().default(false),
});
export type CreatePermitInput = z.infer<typeof CreatePermitSchema>;

export const UpdatePermitSchema = z.object({
  type: PermitTypeSchema.optional(),
  location: z.string().min(1).max(200).optional(),
  applicant: z.string().min(1).max(200).optional(),
  applicantContact: z.string().max(50).optional().nullable(),
  supervisor: z.string().max(200).optional().nullable(),
  EHSOfficer: z.string().max(200).optional().nullable(),
  issuer: z.string().max(200).optional().nullable(),
  approver: z.string().max(200).optional().nullable(),
  description: z.string().min(1).max(5000).optional(),
  startDate: z.string().min(1).optional(),
  endDate: z.string().min(1).optional(),
  hazards: z.string().max(2000).optional().nullable(),
  precautions: z.string().max(2000).optional().nullable(),
  ppeRequired: z.array(z.string().max(100)).optional().nullable(),
  isolationRequired: z.boolean().optional(),
  isolationDetails: z.string().max(2000).optional().nullable(),
  fireWatchRequired: z.boolean().optional(),
  gasTestRequired: z.boolean().optional(),
  gasTestResult: z.string().max(200).optional().nullable(),
});
export type UpdatePermitInput = z.infer<typeof UpdatePermitSchema>;

export const AdvancePermitStatusSchema = z.object({
  status: PermitStatusSchema,
});
export type AdvancePermitStatusInput = z.infer<
  typeof AdvancePermitStatusSchema
>;

export const JsaStatusSchema = z.enum([
  "draft",
  "in-review",
  "active",
  "completed",
  "archived",
]);
export type JsaStatus = z.infer<typeof JsaStatusSchema>;

export const RiskLevelSchema = z.enum(["Low", "Medium", "High", "Critical"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export interface JsaStep {
  id: string;
  description: string;
  hazards: string[];
  controls: string[];
  existingRisk: RiskLevel;
  residualRisk: RiskLevel;
}

export interface Jsa {
  id: string;
  title: string;
  description?: string;
  location: string;
  department: string;
  status: JsaStatus;
  steps: JsaStep[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

export const JsaStepSchema = z.object({
  id: z.string(),
  description: z.string().min(1).max(1000),
  hazards: z.array(z.string()),
  controls: z.array(z.string()),
  existingRisk: RiskLevelSchema,
  residualRisk: RiskLevelSchema,
});
export type JsaStepInput = z.infer<typeof JsaStepSchema>;

export const CreateJsaSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  location: z.string().min(1).max(200),
  department: z.string().min(1).max(100),
  createdBy: z.string().min(1).max(200),
});
export type CreateJsaInput = z.infer<typeof CreateJsaSchema>;

export const UpdateJsaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  location: z.string().min(1).max(200).optional(),
  department: z.string().min(1).max(100).optional(),
  status: JsaStatusSchema.optional(),
  steps: z.array(JsaStepSchema).optional(),
  reviewedBy: z.string().max(200).optional().nullable(),
  reviewedAt: z.string().optional().nullable(),
});
export type UpdateJsaInput = z.infer<typeof UpdateJsaSchema>;

export interface RiskMatrixLevel {
  label: string;
  minLikelihood: number;
  maxLikelihood: number;
  minSeverity: number;
  maxSeverity: number;
  color: string;
}

export interface RiskMatrix {
  id: string;
  name: string;
  description?: string;
  likelihoodScale: Record<number, string>;
  severityScale: Record<number, string>;
  levels: RiskMatrixLevel[];
  isDefault: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const RiskMatrixLevelSchema = z.object({
  label: z.string().min(1).max(50),
  minLikelihood: z.number().min(1).max(5),
  maxLikelihood: z.number().min(1).max(5),
  minSeverity: z.number().min(1).max(5),
  maxSeverity: z.number().min(1).max(5),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type RiskMatrixLevelInput = z.infer<typeof RiskMatrixLevelSchema>;

export const CreateRiskMatrixSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  likelihoodScale: z.record(z.number(), z.string()),
  severityScale: z.record(z.number(), z.string()),
  levels: z.array(RiskMatrixLevelSchema),
  isDefault: z.boolean().optional().default(false),
  createdBy: z.string().min(1).max(200),
});
export type CreateRiskMatrixInput = z.infer<typeof CreateRiskMatrixSchema>;

export const UpdateRiskMatrixSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  likelihoodScale: z.record(z.number(), z.string()).optional(),
  severityScale: z.record(z.number(), z.string()).optional(),
  levels: z.array(RiskMatrixLevelSchema).optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateRiskMatrixInput = z.infer<typeof UpdateRiskMatrixSchema>;
