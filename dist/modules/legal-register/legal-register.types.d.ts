import { z } from "zod";
export declare const ObligationLifecycleSchema: z.ZodEnum<["Draft", "Active", "Under Review", "Action Required", "Implemented", "Closed"]>;
export type ObligationLifecycle = z.infer<typeof ObligationLifecycleSchema>;
export declare const ReviewStatusSchema: z.ZodEnum<["Planned", "In Progress", "Completed", "Verified", "Overdue"]>;
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;
export declare const EvidenceTypeSchema: z.ZodEnum<["Document", "Certificate", "Inspection", "Audit", "Photo", "Other"]>;
export type EvidenceType = z.infer<typeof EvidenceTypeSchema>;
export declare const ActionStatusSchema: z.ZodEnum<["Open", "In Progress", "Completed", "Verified", "Closed"]>;
export type ActionStatus = z.infer<typeof ActionStatusSchema>;
export interface LegalRegisterEntry {
    id: string;
    title: string;
    legislation: string;
    jurisdiction: string;
    authority: string;
    effectiveDate: string;
    reviewDate?: string;
    summary: string;
    scope: string[];
    status: "Active" | "Superseded" | "Archived";
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export declare const CreateLegalRegisterEntrySchema: z.ZodObject<{
    title: z.ZodString;
    legislation: z.ZodString;
    jurisdiction: z.ZodString;
    authority: z.ZodString;
    effectiveDate: z.ZodString;
    reviewDate: z.ZodOptional<z.ZodString>;
    summary: z.ZodString;
    scope: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    status: z.ZodDefault<z.ZodEnum<["Active", "Superseded", "Archived"]>>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "Active" | "Archived" | "Superseded";
    title: string;
    summary: string;
    legislation: string;
    scope: string[];
    jurisdiction: string;
    effectiveDate: string;
    authority: string;
    createdBy?: string | undefined;
    reviewDate?: string | undefined;
}, {
    title: string;
    summary: string;
    legislation: string;
    jurisdiction: string;
    effectiveDate: string;
    authority: string;
    status?: "Active" | "Archived" | "Superseded" | undefined;
    createdBy?: string | undefined;
    scope?: string[] | undefined;
    reviewDate?: string | undefined;
}>;
export type CreateLegalRegisterEntryInput = z.infer<typeof CreateLegalRegisterEntrySchema> & {
    createdBy: string;
};
export declare const UpdateLegalRegisterEntrySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    legislation: z.ZodOptional<z.ZodString>;
    jurisdiction: z.ZodOptional<z.ZodString>;
    authority: z.ZodOptional<z.ZodString>;
    effectiveDate: z.ZodOptional<z.ZodString>;
    reviewDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    summary: z.ZodOptional<z.ZodString>;
    scope: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
    status: z.ZodOptional<z.ZodEnum<["Active", "Superseded", "Archived"]>>;
}, "strip", z.ZodTypeAny, {
    status?: "Active" | "Archived" | "Superseded" | undefined;
    title?: string | undefined;
    summary?: string | undefined;
    legislation?: string | undefined;
    scope?: string[] | null | undefined;
    jurisdiction?: string | undefined;
    effectiveDate?: string | undefined;
    reviewDate?: string | null | undefined;
    authority?: string | undefined;
}, {
    status?: "Active" | "Archived" | "Superseded" | undefined;
    title?: string | undefined;
    summary?: string | undefined;
    legislation?: string | undefined;
    scope?: string[] | null | undefined;
    jurisdiction?: string | undefined;
    effectiveDate?: string | undefined;
    reviewDate?: string | null | undefined;
    authority?: string | undefined;
}>;
export type UpdateLegalRegisterEntryInput = z.infer<typeof UpdateLegalRegisterEntrySchema>;
export interface LegalObligation {
    id: string;
    registerEntryId: string;
    title: string;
    requirement: string;
    frequency: string;
    responsibility: string;
    site: string;
    department: string;
    dueDate?: string;
    lifecycle: ObligationLifecycle;
    lastReviewDate?: string;
    nextReviewDate?: string;
    evidenceCount: number;
    openActionsCount: number;
    notes?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export declare const CreateLegalObligationSchema: z.ZodObject<{
    registerEntryId: z.ZodString;
    title: z.ZodString;
    requirement: z.ZodString;
    frequency: z.ZodString;
    responsibility: z.ZodString;
    site: z.ZodString;
    department: z.ZodString;
    dueDate: z.ZodOptional<z.ZodString>;
    lifecycle: z.ZodDefault<z.ZodEnum<["Draft", "Active", "Under Review", "Action Required", "Implemented", "Closed"]>>;
    lastReviewDate: z.ZodOptional<z.ZodString>;
    nextReviewDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    title: string;
    site: string;
    department: string;
    requirement: string;
    frequency: string;
    responsibility: string;
    registerEntryId: string;
    lifecycle: "Draft" | "Under Review" | "Closed" | "Active" | "Action Required" | "Implemented";
    dueDate?: string | undefined;
    notes?: string | undefined;
    createdBy?: string | undefined;
    nextReviewDate?: string | undefined;
    lastReviewDate?: string | undefined;
}, {
    title: string;
    site: string;
    department: string;
    requirement: string;
    frequency: string;
    responsibility: string;
    registerEntryId: string;
    dueDate?: string | undefined;
    notes?: string | undefined;
    createdBy?: string | undefined;
    nextReviewDate?: string | undefined;
    lifecycle?: "Draft" | "Under Review" | "Closed" | "Active" | "Action Required" | "Implemented" | undefined;
    lastReviewDate?: string | undefined;
}>;
export type CreateLegalObligationInput = z.infer<typeof CreateLegalObligationSchema> & {
    createdBy: string;
};
export declare const UpdateLegalObligationSchema: z.ZodObject<{
    registerEntryId: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    requirement: z.ZodOptional<z.ZodString>;
    frequency: z.ZodOptional<z.ZodString>;
    responsibility: z.ZodOptional<z.ZodString>;
    site: z.ZodOptional<z.ZodString>;
    department: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    lifecycle: z.ZodOptional<z.ZodEnum<["Draft", "Active", "Under Review", "Action Required", "Implemented", "Closed"]>>;
    lastReviewDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    nextReviewDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    evidenceCount: z.ZodOptional<z.ZodNumber>;
    openActionsCount: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    dueDate?: string | null | undefined;
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    notes?: string | null | undefined;
    requirement?: string | undefined;
    frequency?: string | undefined;
    responsibility?: string | undefined;
    nextReviewDate?: string | null | undefined;
    registerEntryId?: string | undefined;
    lifecycle?: "Draft" | "Under Review" | "Closed" | "Active" | "Action Required" | "Implemented" | undefined;
    lastReviewDate?: string | null | undefined;
    evidenceCount?: number | undefined;
    openActionsCount?: number | undefined;
}, {
    dueDate?: string | null | undefined;
    title?: string | undefined;
    site?: string | undefined;
    department?: string | undefined;
    notes?: string | null | undefined;
    requirement?: string | undefined;
    frequency?: string | undefined;
    responsibility?: string | undefined;
    nextReviewDate?: string | null | undefined;
    registerEntryId?: string | undefined;
    lifecycle?: "Draft" | "Under Review" | "Closed" | "Active" | "Action Required" | "Implemented" | undefined;
    lastReviewDate?: string | null | undefined;
    evidenceCount?: number | undefined;
    openActionsCount?: number | undefined;
}>;
export type UpdateLegalObligationInput = z.infer<typeof UpdateLegalObligationSchema>;
export interface ObligationReview {
    id: string;
    obligationId: string;
    title: string;
    status: ReviewStatus;
    reviewDate: string;
    reviewer: string;
    findings: string;
    conclusion: string;
    followUpRequired: boolean;
    followUpDate?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export declare const CreateObligationReviewSchema: z.ZodObject<{
    obligationId: z.ZodString;
    title: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["Planned", "In Progress", "Completed", "Verified", "Overdue"]>>;
    reviewDate: z.ZodString;
    reviewer: z.ZodString;
    findings: z.ZodString;
    conclusion: z.ZodString;
    followUpRequired: z.ZodDefault<z.ZodBoolean>;
    followUpDate: z.ZodOptional<z.ZodString>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "Planned" | "In Progress" | "Completed" | "Verified" | "Overdue";
    title: string;
    reviewer: string;
    findings: string;
    followUpRequired: boolean;
    reviewDate: string;
    obligationId: string;
    conclusion: string;
    createdBy?: string | undefined;
    followUpDate?: string | undefined;
}, {
    title: string;
    reviewer: string;
    findings: string;
    reviewDate: string;
    obligationId: string;
    conclusion: string;
    status?: "Planned" | "In Progress" | "Completed" | "Verified" | "Overdue" | undefined;
    createdBy?: string | undefined;
    followUpRequired?: boolean | undefined;
    followUpDate?: string | undefined;
}>;
export type CreateObligationReviewInput = z.infer<typeof CreateObligationReviewSchema> & {
    createdBy: string;
};
export declare const UpdateObligationReviewSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["Planned", "In Progress", "Completed", "Verified", "Overdue"]>>;
    reviewDate: z.ZodOptional<z.ZodString>;
    reviewer: z.ZodOptional<z.ZodString>;
    findings: z.ZodOptional<z.ZodString>;
    conclusion: z.ZodOptional<z.ZodString>;
    followUpRequired: z.ZodOptional<z.ZodBoolean>;
    followUpDate: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "Planned" | "In Progress" | "Completed" | "Verified" | "Overdue" | undefined;
    title?: string | undefined;
    reviewer?: string | undefined;
    findings?: string | undefined;
    followUpRequired?: boolean | undefined;
    reviewDate?: string | undefined;
    conclusion?: string | undefined;
    followUpDate?: string | null | undefined;
}, {
    status?: "Planned" | "In Progress" | "Completed" | "Verified" | "Overdue" | undefined;
    title?: string | undefined;
    reviewer?: string | undefined;
    findings?: string | undefined;
    followUpRequired?: boolean | undefined;
    reviewDate?: string | undefined;
    conclusion?: string | undefined;
    followUpDate?: string | null | undefined;
}>;
export type UpdateObligationReviewInput = z.infer<typeof UpdateObligationReviewSchema>;
export interface ObligationEvidence {
    id: string;
    obligationId: string;
    reviewId?: string;
    type: EvidenceType;
    name: string;
    url: string;
    description?: string;
    uploadedBy: string;
    uploadedAt: string;
}
export declare const CreateObligationEvidenceSchema: z.ZodObject<{
    obligationId: z.ZodString;
    reviewId: z.ZodOptional<z.ZodString>;
    type: z.ZodEnum<["Document", "Certificate", "Inspection", "Audit", "Photo", "Other"]>;
    name: z.ZodString;
    url: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    uploadedBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "Document" | "Certificate" | "Inspection" | "Other" | "Audit" | "Photo";
    name: string;
    url: string;
    obligationId: string;
    description?: string | undefined;
    reviewId?: string | undefined;
    uploadedBy?: string | undefined;
}, {
    type: "Document" | "Certificate" | "Inspection" | "Other" | "Audit" | "Photo";
    name: string;
    url: string;
    obligationId: string;
    description?: string | undefined;
    reviewId?: string | undefined;
    uploadedBy?: string | undefined;
}>;
export type CreateObligationEvidenceInput = z.infer<typeof CreateObligationEvidenceSchema> & {
    uploadedBy: string;
};
export interface ObligationAction {
    id: string;
    obligationId: string;
    reviewId?: string;
    title: string;
    description: string;
    owner: string;
    dueDate: string;
    status: ActionStatus;
    completedAt?: string;
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}
export declare const CreateObligationActionSchema: z.ZodObject<{
    obligationId: z.ZodString;
    reviewId: z.ZodOptional<z.ZodString>;
    title: z.ZodString;
    description: z.ZodString;
    owner: z.ZodString;
    dueDate: z.ZodString;
    status: z.ZodDefault<z.ZodEnum<["Open", "In Progress", "Completed", "Verified", "Closed"]>>;
    createdBy: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    status: "In Progress" | "Completed" | "Verified" | "Closed" | "Open";
    dueDate: string;
    owner: string;
    title: string;
    description: string;
    obligationId: string;
    reviewId?: string | undefined;
    createdBy?: string | undefined;
}, {
    dueDate: string;
    owner: string;
    title: string;
    description: string;
    obligationId: string;
    status?: "In Progress" | "Completed" | "Verified" | "Closed" | "Open" | undefined;
    reviewId?: string | undefined;
    createdBy?: string | undefined;
}>;
export type CreateObligationActionInput = z.infer<typeof CreateObligationActionSchema> & {
    createdBy: string;
};
export declare const UpdateObligationActionSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    owner: z.ZodOptional<z.ZodString>;
    dueDate: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["Open", "In Progress", "Completed", "Verified", "Closed"]>>;
    completedAt: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    status?: "In Progress" | "Completed" | "Verified" | "Closed" | "Open" | undefined;
    dueDate?: string | undefined;
    owner?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    completedAt?: string | null | undefined;
}, {
    status?: "In Progress" | "Completed" | "Verified" | "Closed" | "Open" | undefined;
    dueDate?: string | undefined;
    owner?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    completedAt?: string | null | undefined;
}>;
export type UpdateObligationActionInput = z.infer<typeof UpdateObligationActionSchema>;
export interface LegalRegisterDashboard {
    totalEntries: number;
    activeEntries: number;
    totalObligations: number;
    obligationsByLifecycle: Record<string, number>;
    overdueObligations: number;
    openReviews: number;
    openActions: number;
}
