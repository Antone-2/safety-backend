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
    anonymous: boolean;
    department: string;
    shift: string;
    complianceRequired: boolean;
    complianceDueAt?: string;
    photoUrl: string;
    photos?: string[];
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
    photoUrl: z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined, string | undefined>;
}, "strip", z.ZodTypeAny, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    severity: "Low" | "Medium" | "High" | "Critical";
    location: string;
    department: string;
    description: string;
    reporter: string;
    anonymous: boolean;
    complianceRequired: boolean;
    category: string;
    photoUrl?: string | undefined;
}, {
    shift: string;
    type: "Unsafe Act" | "Unsafe Condition";
    severity: "Low" | "Medium" | "High" | "Critical";
    location: string;
    department: string;
    description: string;
    reporter: string;
    category: string;
    anonymous?: boolean | undefined;
    photoUrl?: string | undefined;
    complianceRequired?: boolean | undefined;
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
    priority: "Low" | "Medium" | "High" | "Critical";
    rootCause: string;
    title: string;
    owner: string;
    incidentId: string;
    capaType: "Corrective" | "Preventive";
    rootCauseMethod?: string | undefined;
    rootCauseConclusion?: string | undefined;
}, {
    action: string;
    dueDate: string;
    rootCause: string;
    title: string;
    owner: string;
    incidentId: string;
    capaType: "Corrective" | "Preventive";
    priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
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
    password: string;
    role: "super-admin" | "EHS-manager" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm";
    name: string;
    email: string;
    phone?: string | undefined;
}, {
    password: string;
    role: "super-admin" | "EHS-manager" | "plant-manager" | "factory-manager" | "supervisor" | "depot-admin" | "she-committee-member" | "gm";
    name: string;
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
    priority: "Low" | "Medium" | "High" | "Critical";
    description: string;
    title: string;
    incidentId: string;
    investigator: string;
    dueDate?: string | undefined;
}, {
    description: string;
    title: string;
    incidentId: string;
    investigator: string;
    dueDate?: string | undefined;
    priority?: "Low" | "Medium" | "High" | "Critical" | undefined;
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
    location: string;
    description: string;
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
    location: string;
    description: string;
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
    location?: string | undefined;
    description?: string | undefined;
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
    location?: string | undefined;
    description?: string | undefined;
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
    status: "supervisor" | "issuer" | "closed" | "active" | "applicant" | "approval" | "EHS";
}, {
    status: "supervisor" | "issuer" | "closed" | "active" | "applicant" | "approval" | "EHS";
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
    hazards: string[];
    controls: string[];
    existingRisk: "Low" | "Medium" | "High" | "Critical";
    residualRisk: "Low" | "Medium" | "High" | "Critical";
}, {
    id: string;
    description: string;
    hazards: string[];
    controls: string[];
    existingRisk: "Low" | "Medium" | "High" | "Critical";
    residualRisk: "Low" | "Medium" | "High" | "Critical";
}>;
export type JsaStepInput = z.infer<typeof JsaStepSchema>;
export declare const CreateJsaSchema: z.ZodObject<{
    title: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    location: z.ZodString;
    department: z.ZodString;
    createdBy: z.ZodString;
}, "strip", z.ZodTypeAny, {
    location: string;
    department: string;
    createdBy: string;
    title: string;
    description?: string | undefined;
}, {
    location: string;
    department: string;
    createdBy: string;
    title: string;
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
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }, {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }>, "many">>;
    reviewedBy: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    reviewedAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "draft" | "active" | "completed" | "in-review" | "archived" | undefined;
    location?: string | undefined;
    department?: string | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    reviewedBy?: string | null | undefined;
    reviewedAt?: string | null | undefined;
    steps?: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
    }[] | undefined;
}, {
    status?: "draft" | "active" | "completed" | "in-review" | "archived" | undefined;
    location?: string | undefined;
    department?: string | undefined;
    description?: string | null | undefined;
    title?: string | undefined;
    reviewedBy?: string | null | undefined;
    reviewedAt?: string | null | undefined;
    steps?: {
        id: string;
        description: string;
        hazards: string[];
        controls: string[];
        existingRisk: "Low" | "Medium" | "High" | "Critical";
        residualRisk: "Low" | "Medium" | "High" | "Critical";
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
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
    isDefault: boolean;
    description?: string | undefined;
}, {
    name: string;
    createdBy: string;
    likelihoodScale: Record<number, string>;
    severityScale: Record<number, string>;
    levels: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[];
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
    likelihoodScale?: Record<number, string> | undefined;
    severityScale?: Record<number, string> | undefined;
    levels?: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[] | undefined;
    isDefault?: boolean | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
    likelihoodScale?: Record<number, string> | undefined;
    severityScale?: Record<number, string> | undefined;
    levels?: {
        label: string;
        minLikelihood: number;
        maxLikelihood: number;
        minSeverity: number;
        maxSeverity: number;
        color: string;
    }[] | undefined;
    isDefault?: boolean | undefined;
}>;
export type UpdateRiskMatrixInput = z.infer<typeof UpdateRiskMatrixSchema>;
