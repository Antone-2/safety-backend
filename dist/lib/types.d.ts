import { z } from "zod";
export declare const SeveritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type Severity = z.infer<typeof SeveritySchema>;
export declare const REPORT_SOURCE_GOOGLE_SHEETS = "google-sheets";
export declare const REPORT_SOURCE_MANUAL = "manual";
export declare const StatusSchema: z.ZodEnum<["Open", "In Progress", "Closed"]>;
export type Status = z.infer<typeof StatusSchema>;
export declare const ReportTypeSchema: z.ZodEnum<["Unsafe Act", "Unsafe Condition"]>;
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
    comments: {
        author: string;
        at: string;
        text: string;
    }[];
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
export declare const CreateReportSchema: z.ZodObject<{
    location: z.ZodString;
    reporter: z.ZodString;
    description: z.ZodString;
    severity: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    category: z.ZodString;
    type: z.ZodEnum<["Unsafe Act", "Unsafe Condition"]>;
    department: z.ZodString;
    shift: z.ZodString;
    anonymous: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    complianceRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    isRecordable: z.ZodOptional<z.ZodBoolean>;
    isLostTimeInjury: z.ZodOptional<z.ZodBoolean>;
    medicalTreatmentCase: z.ZodOptional<z.ZodBoolean>;
    lostWorkDays: z.ZodOptional<z.ZodNumber>;
    restrictedWorkDays: z.ZodOptional<z.ZodNumber>;
    reporterEmail: z.ZodUnion<[z.ZodOptional<z.ZodString>, z.ZodLiteral<"">]>;
    reporterPhone: z.ZodOptional<z.ZodString>;
    reporterWhatsApp: z.ZodOptional<z.ZodString>;
    photoUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    department: string;
    description: string;
    anonymous: boolean;
    reporter: string;
    severity: "Critical" | "Low" | "Medium" | "High";
    location: string;
    complianceRequired: boolean;
    category: string;
    reporterEmail?: string | undefined;
    reporterPhone?: string | undefined;
    photoUrl?: string | undefined;
    isRecordable?: boolean | undefined;
    isLostTimeInjury?: boolean | undefined;
    medicalTreatmentCase?: boolean | undefined;
    lostWorkDays?: number | undefined;
    restrictedWorkDays?: number | undefined;
    reporterWhatsApp?: string | undefined;
}, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    department: string;
    description: string;
    reporter: string;
    severity: "Critical" | "Low" | "Medium" | "High";
    location: string;
    category: string;
    anonymous?: boolean | undefined;
    reporterEmail?: string | undefined;
    reporterPhone?: string | undefined;
    photoUrl?: string | undefined;
    complianceRequired?: boolean | undefined;
    isRecordable?: boolean | undefined;
    isLostTimeInjury?: boolean | undefined;
    medicalTreatmentCase?: boolean | undefined;
    lostWorkDays?: number | undefined;
    restrictedWorkDays?: number | undefined;
    reporterWhatsApp?: string | undefined;
}>;
export type CreateReportInput = z.infer<typeof CreateReportSchema>;
export declare const CapaStatusSchema: z.ZodEnum<["Pending", "In Progress", "Completed", "Verified", "Closed"]>;
export type CapaStatus = z.infer<typeof CapaStatusSchema>;
export declare const CapaPrioritySchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
export type CapaPriority = z.infer<typeof CapaPrioritySchema>;
export declare const CapaTypeSchema: z.ZodEnum<["Corrective", "Preventive"]>;
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
export declare const CreateCapaSchema: z.ZodObject<{
    incidentId: z.ZodString;
    title: z.ZodString;
    capaType: z.ZodEnum<["Corrective", "Preventive"]>;
    rootCause: z.ZodString;
    action: z.ZodString;
    owner: z.ZodString;
    dueDate: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>>;
    rootCauseMethod: z.ZodOptional<z.ZodString>;
    rootCauseConclusion: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: string;
    dueDate: string;
    owner: string;
    title: string;
    priority: "Critical" | "Low" | "Medium" | "High";
    rootCause: string;
    incidentId: string;
    capaType: "Corrective" | "Preventive";
    rootCauseMethod?: string | undefined;
    rootCauseConclusion?: string | undefined;
}, {
    action: string;
    dueDate: string;
    owner: string;
    title: string;
    rootCause: string;
    incidentId: string;
    capaType: "Corrective" | "Preventive";
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
    rootCauseMethod?: string | undefined;
    rootCauseConclusion?: string | undefined;
}>;
export type CreateCapaInput = z.infer<typeof CreateCapaSchema>;
export interface SettingsPayload {
    sites: string[];
    hazards: string[];
    severities: {
        name: string;
        slaHours: number;
        color: string;
    }[];
    schedule: {
        enabled: boolean;
        freq: string;
        email: string;
    };
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
    integrationStatus?: Record<string, {
        configured?: boolean;
        lastTestAt?: string;
        lastTestStatus?: "success" | "failed";
        lastTestMessage?: string;
        lastSyncAt?: string;
        lastSyncStatus?: "idle" | "success" | "failed";
        lastSyncMessage?: string;
        secretUpdatedAt?: string;
        updatedBy?: string;
    }>;
    integrationHistory?: Array<{
        id: string;
        integration: string;
        event: "config.updated" | "config.cleared" | "test.success" | "test.failed" | "sync.recorded";
        status: "success" | "failed" | "info";
        at: string;
        actor: string;
        message: string;
    }>;
    notificationContacts?: {
        email: string;
        phone: string;
        whatsapp: string;
        criticalOnly: boolean;
        frequency: string;
    };
}
export declare const UserRoleSchema: z.ZodEnum<["super-admin", "EHS-manager", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin"]>;
export type UserRole = z.infer<typeof UserRoleSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    password: string;
    email: string;
}, {
    password: string;
    email: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export declare const CreateUserSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    name: z.ZodString;
    role: z.ZodEnum<["super-admin", "EHS-manager", "she-committee-member", "supervisor", "gm", "plant-manager", "factory-manager", "depot-admin"]>;
    phone: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    password: string;
    role: "super-admin" | "EHS-manager" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm";
    email: string;
    phone?: string | undefined;
}, {
    name: string;
    password: string;
    role: "super-admin" | "EHS-manager" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm";
    email: string;
    phone?: string | undefined;
}>;
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
export declare const InvestigationStatusSchema: z.ZodEnum<["Pending", "In Progress", "Completed", "Closed"]>;
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;
export declare const InvestigationEvidenceSchema: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodString;
    uploadedAt: z.ZodString;
    uploadedBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy: string;
}, {
    name: string;
    url: string;
    uploadedAt: string;
    uploadedBy: string;
}>;
export type InvestigationEvidence = z.infer<typeof InvestigationEvidenceSchema>;
export declare const CreateInvestigationSchema: z.ZodObject<{
    incidentId: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    investigator: z.ZodString;
    priority: z.ZodDefault<z.ZodOptional<z.ZodEnum<["Low", "Medium", "High", "Critical"]>>>;
    dueDate: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    priority: "Critical" | "Low" | "Medium" | "High";
    incidentId: string;
    investigator: string;
    dueDate?: string | undefined;
}, {
    title: string;
    description: string;
    incidentId: string;
    investigator: string;
    dueDate?: string | undefined;
    priority?: "Critical" | "Low" | "Medium" | "High" | undefined;
}>;
export type CreateInvestigationInput = z.infer<typeof CreateInvestigationSchema>;
export interface AuthToken {
    token: string;
    user: User;
}
export declare const PermitTypeSchema: z.ZodEnum<["Hot Work", "Cold Work", "Confined Space", "Electrical", "Excavation", "Height Work", "General"]>;
export type PermitType = z.infer<typeof PermitTypeSchema>;
export declare const PermitStatusSchema: z.ZodEnum<["applicant", "supervisor", "EHS", "issuer", "approval", "active", "closed"]>;
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
    comments: {
        author: string;
        at: string;
        text: string;
    }[];
    createdAt: string;
    updatedAt: string;
}
export declare const CreatePermitSchema: z.ZodObject<{
    type: z.ZodEnum<["Hot Work", "Cold Work", "Confined Space", "Electrical", "Excavation", "Height Work", "General"]>;
    location: z.ZodString;
    applicant: z.ZodString;
    applicantContact: z.ZodOptional<z.ZodString>;
    supervisor: z.ZodOptional<z.ZodString>;
    EHSOfficer: z.ZodOptional<z.ZodString>;
    issuer: z.ZodOptional<z.ZodString>;
    approver: z.ZodOptional<z.ZodString>;
    description: z.ZodString;
    startDate: z.ZodString;
    endDate: z.ZodString;
    hazards: z.ZodOptional<z.ZodString>;
    precautions: z.ZodOptional<z.ZodString>;
    ppeRequired: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    isolationRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    isolationDetails: z.ZodOptional<z.ZodString>;
    fireWatchRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    gasTestRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    type: "Hot Work" | "Cold Work" | "Confined Space" | "Electrical" | "Excavation" | "Height Work" | "General";
    description: string;
    location: string;
    applicant: string;
    startDate: string;
    endDate: string;
    isolationRequired: boolean;
    fireWatchRequired: boolean;
    gasTestRequired: boolean;
    supervisor?: string | undefined;
    issuer?: string | undefined;
    applicantContact?: string | undefined;
    approver?: string | undefined;
    hazards?: string | undefined;
    precautions?: string | undefined;
    ppeRequired?: string[] | undefined;
    isolationDetails?: string | undefined;
    EHSOfficer?: string | undefined;
}, {
    type: "Hot Work" | "Cold Work" | "Confined Space" | "Electrical" | "Excavation" | "Height Work" | "General";
    description: string;
    location: string;
    applicant: string;
    startDate: string;
    endDate: string;
    supervisor?: string | undefined;
    issuer?: string | undefined;
    applicantContact?: string | undefined;
    approver?: string | undefined;
    hazards?: string | undefined;
    precautions?: string | undefined;
    ppeRequired?: string[] | undefined;
    isolationRequired?: boolean | undefined;
    isolationDetails?: string | undefined;
    fireWatchRequired?: boolean | undefined;
    gasTestRequired?: boolean | undefined;
    EHSOfficer?: string | undefined;
}>;
export type CreatePermitInput = z.infer<typeof CreatePermitSchema>;
export declare const UpdatePermitSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["Hot Work", "Cold Work", "Confined Space", "Electrical", "Excavation", "Height Work", "General"]>>;
    location: z.ZodOptional<z.ZodString>;
    applicant: z.ZodOptional<z.ZodString>;
    applicantContact: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    supervisor: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    EHSOfficer: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    issuer: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    approver: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    description: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    hazards: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    precautions: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    ppeRequired: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    isolationRequired: z.ZodOptional<z.ZodBoolean>;
    isolationDetails: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    fireWatchRequired: z.ZodOptional<z.ZodBoolean>;
    gasTestRequired: z.ZodOptional<z.ZodBoolean>;
    gasTestResult: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    type?: "Hot Work" | "Cold Work" | "Confined Space" | "Electrical" | "Excavation" | "Height Work" | "General" | undefined;
    supervisor?: string | null | undefined;
    issuer?: string | null | undefined;
    description?: string | undefined;
    location?: string | undefined;
    applicant?: string | undefined;
    applicantContact?: string | null | undefined;
    approver?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    hazards?: string | null | undefined;
    precautions?: string | null | undefined;
    ppeRequired?: string[] | null | undefined;
    isolationRequired?: boolean | undefined;
    isolationDetails?: string | null | undefined;
    fireWatchRequired?: boolean | undefined;
    gasTestRequired?: boolean | undefined;
    gasTestResult?: string | null | undefined;
    EHSOfficer?: string | null | undefined;
}, {
    type?: "Hot Work" | "Cold Work" | "Confined Space" | "Electrical" | "Excavation" | "Height Work" | "General" | undefined;
    supervisor?: string | null | undefined;
    issuer?: string | null | undefined;
    description?: string | undefined;
    location?: string | undefined;
    applicant?: string | undefined;
    applicantContact?: string | null | undefined;
    approver?: string | null | undefined;
    startDate?: string | undefined;
    endDate?: string | undefined;
    hazards?: string | null | undefined;
    precautions?: string | null | undefined;
    ppeRequired?: string[] | null | undefined;
    isolationRequired?: boolean | undefined;
    isolationDetails?: string | null | undefined;
    fireWatchRequired?: boolean | undefined;
    gasTestRequired?: boolean | undefined;
    gasTestResult?: string | null | undefined;
    EHSOfficer?: string | null | undefined;
}>;
export type UpdatePermitInput = z.infer<typeof UpdatePermitSchema>;
export declare const AdvancePermitStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["applicant", "supervisor", "EHS", "issuer", "approval", "active", "closed"]>;
}, "strip", z.ZodTypeAny, {
    status: "supervisor" | "issuer" | "active" | "approval" | "closed" | "applicant" | "EHS";
}, {
    status: "supervisor" | "issuer" | "active" | "approval" | "closed" | "applicant" | "EHS";
}>;
export type AdvancePermitStatusInput = z.infer<typeof AdvancePermitStatusSchema>;
export declare const JsaStatusSchema: z.ZodEnum<["draft", "in-review", "active", "completed", "archived"]>;
export type JsaStatus = z.infer<typeof JsaStatusSchema>;
export declare const RiskLevelSchema: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
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
export declare const JsaStepSchema: z.ZodObject<{
    id: z.ZodString;
    description: z.ZodString;
    hazards: z.ZodArray<z.ZodString, "many">;
    controls: z.ZodArray<z.ZodString, "many">;
    existingRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    residualRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
}, "strip", z.ZodTypeAny, {
    id: string;
    description: string;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    hazards: string[];
    controls: string[];
    existingRisk: "Critical" | "Low" | "Medium" | "High";
}, {
    id: string;
    description: string;
    residualRisk: "Critical" | "Low" | "Medium" | "High";
    hazards: string[];
    controls: string[];
    existingRisk: "Critical" | "Low" | "Medium" | "High";
}>;
export type JsaStepInput = z.infer<typeof JsaStepSchema>;
export declare const CreateJsaSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodString;
    department: z.ZodString;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    title: string;
    department: string;
    createdBy: string;
    location: string;
    description?: string | undefined;
}, {
    title: string;
    department: string;
    createdBy: string;
    location: string;
    description?: string | undefined;
}>;
export type CreateJsaInput = z.infer<typeof CreateJsaSchema>;
export declare const UpdateJsaSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    location: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["draft", "in-review", "active", "completed", "archived"]>>;
    steps: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        description: z.ZodString;
        hazards: z.ZodArray<z.ZodString, "many">;
        controls: z.ZodArray<z.ZodString, "many">;
        existingRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
        residualRisk: z.ZodEnum<["Low", "Medium", "High", "Critical"]>;
    }, "strip", z.ZodTypeAny, {
        id: string;
        description: string;
        residualRisk: "Critical" | "Low" | "Medium" | "High";
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
    }, {
        id: string;
        description: string;
        residualRisk: "Critical" | "Low" | "Medium" | "High";
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
    }>, "many">>;
    reviewedBy: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reviewedAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "active" | "completed" | "draft" | "in-review" | "archived" | undefined;
    title?: string | undefined;
    department?: string | undefined;
    description?: string | null | undefined;
    location?: string | undefined;
    reviewedBy?: string | null | undefined;
    reviewedAt?: string | null | undefined;
    steps?: {
        id: string;
        description: string;
        residualRisk: "Critical" | "Low" | "Medium" | "High";
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
    }[] | undefined;
}, {
    status?: "active" | "completed" | "draft" | "in-review" | "archived" | undefined;
    title?: string | undefined;
    department?: string | undefined;
    description?: string | null | undefined;
    location?: string | undefined;
    reviewedBy?: string | null | undefined;
    reviewedAt?: string | null | undefined;
    steps?: {
        id: string;
        description: string;
        residualRisk: "Critical" | "Low" | "Medium" | "High";
        hazards: string[];
        controls: string[];
        existingRisk: "Critical" | "Low" | "Medium" | "High";
    }[] | undefined;
}>;
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
export declare const RiskMatrixLevelSchema: z.ZodObject<{
    label: z.ZodString;
    minLikelihood: z.ZodNumber;
    maxLikelihood: z.ZodNumber;
    minSeverity: z.ZodNumber;
    maxSeverity: z.ZodNumber;
    color: z.ZodString;
}, "strip", z.ZodTypeAny, {
    label: string;
    minLikelihood: number;
    maxLikelihood: number;
    minSeverity: number;
    maxSeverity: number;
    color: string;
}, {
    label: string;
    minLikelihood: number;
    maxLikelihood: number;
    minSeverity: number;
    maxSeverity: number;
    color: string;
}>;
export type RiskMatrixLevelInput = z.infer<typeof RiskMatrixLevelSchema>;
export declare const CreateRiskMatrixSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    likelihoodScale: z.ZodRecord<z.ZodNumber, z.ZodString>;
    severityScale: z.ZodRecord<z.ZodNumber, z.ZodString>;
    levels: z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        minLikelihood: z.ZodNumber;
        maxLikelihood: z.ZodNumber;
        minSeverity: z.ZodNumber;
        maxSeverity: z.ZodNumber;
        color: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }>, "many">;
    isDefault: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    isDefault: boolean;
    description?: string | undefined;
}, {
    name: string;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    description?: string | undefined;
    isDefault?: boolean | undefined;
}>;
export type CreateRiskMatrixInput = z.infer<typeof CreateRiskMatrixSchema>;
export declare const UpdateRiskMatrixSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    likelihoodScale: z.ZodOptional<z.ZodRecord<z.ZodNumber, z.ZodString>>;
    severityScale: z.ZodOptional<z.ZodRecord<z.ZodNumber, z.ZodString>>;
    levels: z.ZodOptional<z.ZodArray<z.ZodObject<{
        label: z.ZodString;
        minLikelihood: z.ZodNumber;
        maxLikelihood: z.ZodNumber;
        minSeverity: z.ZodNumber;
        maxSeverity: z.ZodNumber;
        color: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }, {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }>, "many">>;
    isDefault: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
    levels?: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[] | undefined;
    likelihoodScale?: Record<number, string> | undefined;
    severityScale?: Record<number, string> | undefined;
    isDefault?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    levels?: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[] | undefined;
    likelihoodScale?: Record<number, string> | undefined;
    severityScale?: Record<number, string> | undefined;
    isDefault?: boolean | undefined;
}>;
export type UpdateRiskMatrixInput = z.infer<typeof UpdateRiskMatrixSchema>;
