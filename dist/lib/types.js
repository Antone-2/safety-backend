import { z } from "zod";
export const SeveritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export const REPORT_SOURCE_MANUAL = "manual";
export const StatusSchema = z.enum(["Open", "In Progress", "Closed"]);
export const ReportTypeSchema = z.enum(["Unsafe Act", "Unsafe Condition"]);
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
    photoUrl: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^(https?:\/\/|data:|blob:)/i.test(value), "Photo URL must be a valid http(s), data, or blob URL"),
});
export const CapaStatusSchema = z.enum([
    "Pending",
    "In Progress",
    "Completed",
    "Verified",
    "Closed",
]);
export const CapaPrioritySchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const CapaTypeSchema = z.enum(["Corrective", "Preventive"]);
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
export const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});
export const CreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(1),
    role: UserRoleSchema,
    phone: z.string().max(30).optional(),
});
export const InvestigationStatusSchema = z.enum([
    "Pending",
    "In Progress",
    "Completed",
    "Closed",
]);
export const InvestigationEvidenceSchema = z.object({
    name: z.string(),
    url: z.string(),
    uploadedAt: z.string(),
    uploadedBy: z.string(),
});
export const CreateInvestigationSchema = z.object({
    incidentId: z.string().min(1).max(50),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(5000),
    investigator: z.string().min(1).max(200),
    priority: CapaPrioritySchema.optional().default("Medium"),
    dueDate: z.string().optional(),
});
export const PermitTypeSchema = z.enum([
    "Hot Work",
    "Cold Work",
    "Confined Space",
    "Electrical",
    "Excavation",
    "Height Work",
    "General",
]);
export const PermitStatusSchema = z.enum([
    "applicant",
    "supervisor",
    "EHS",
    "issuer",
    "approval",
    "active",
    "closed",
]);
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
export const AdvancePermitStatusSchema = z.object({
    status: PermitStatusSchema,
});
export const JsaStatusSchema = z.enum(["draft", "in-review", "active", "completed", "archived"]);
export const RiskLevelSchema = z.enum(["Low", "Medium", "High", "Critical"]);
export const JsaStepSchema = z.object({
    id: z.string(),
    description: z.string().min(1).max(1000),
    hazards: z.array(z.string()),
    controls: z.array(z.string()),
    existingRisk: RiskLevelSchema,
    residualRisk: RiskLevelSchema,
});
export const CreateJsaSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().max(5000).optional(),
    location: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    createdBy: z.string().min(1).max(200),
});
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
export const RiskMatrixLevelSchema = z.object({
    label: z.string().min(1).max(50),
    minLikelihood: z.number().min(1).max(5),
    maxLikelihood: z.number().min(1).max(5),
    minSeverity: z.number().min(1).max(5),
    maxSeverity: z.number().min(1).max(5),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export const CreateRiskMatrixSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    likelihoodScale: z.record(z.number(), z.string()),
    severityScale: z.record(z.number(), z.string()),
    levels: z.array(RiskMatrixLevelSchema),
    isDefault: z.boolean().optional().default(false),
    createdBy: z.string().min(1).max(200),
});
export const UpdateRiskMatrixSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    likelihoodScale: z.record(z.number(), z.string()).optional(),
    severityScale: z.record(z.number(), z.string()).optional(),
    levels: z.array(RiskMatrixLevelSchema).optional(),
    isDefault: z.boolean().optional(),
});
