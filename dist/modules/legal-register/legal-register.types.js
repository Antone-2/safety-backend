import { z } from "zod";
export const ObligationLifecycleSchema = z.enum([
    "Draft",
    "Active",
    "Under Review",
    "Action Required",
    "Implemented",
    "Closed",
]);
export const ReviewStatusSchema = z.enum(["Planned", "In Progress", "Completed", "Verified", "Overdue"]);
export const EvidenceTypeSchema = z.enum(["Document", "Certificate", "Inspection", "Audit", "Photo", "Other"]);
export const ActionStatusSchema = z.enum(["Open", "In Progress", "Completed", "Verified", "Closed"]);
export const CreateLegalRegisterEntrySchema = z.object({
    title: z.string().min(1).max(200),
    legislation: z.string().min(1).max(200),
    jurisdiction: z.string().min(1).max(100),
    authority: z.string().min(1).max(200),
    effectiveDate: z.string().min(1),
    reviewDate: z.string().optional(),
    summary: z.string().min(1).max(2000),
    scope: z.array(z.string().max(200)).optional().default([]),
    status: z.enum(["Active", "Superseded", "Archived"]).default("Active"),
    createdBy: z.string().min(1).max(200).optional(),
});
export const UpdateLegalRegisterEntrySchema = z.object({
    title: z.string().min(1).max(200).optional(),
    legislation: z.string().min(1).max(200).optional(),
    jurisdiction: z.string().min(1).max(100).optional(),
    authority: z.string().min(1).max(200).optional(),
    effectiveDate: z.string().min(1).optional(),
    reviewDate: z.string().optional().nullable(),
    summary: z.string().min(1).max(2000).optional(),
    scope: z.array(z.string().max(200)).optional().nullable(),
    status: z.enum(["Active", "Superseded", "Archived"]).optional(),
});
export const CreateLegalObligationSchema = z.object({
    registerEntryId: z.string().min(1),
    title: z.string().min(1).max(200),
    requirement: z.string().min(1).max(2000),
    frequency: z.string().min(1).max(100),
    responsibility: z.string().min(1).max(200),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    dueDate: z.string().optional(),
    lifecycle: ObligationLifecycleSchema.default("Draft"),
    lastReviewDate: z.string().optional(),
    nextReviewDate: z.string().optional(),
    notes: z.string().max(1000).optional(),
    createdBy: z.string().min(1).max(200).optional(),
});
export const UpdateLegalObligationSchema = z.object({
    registerEntryId: z.string().min(1).optional(),
    title: z.string().min(1).max(200).optional(),
    requirement: z.string().min(1).max(2000).optional(),
    frequency: z.string().min(1).max(100).optional(),
    responsibility: z.string().min(1).max(200).optional(),
    site: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    dueDate: z.string().optional().nullable(),
    lifecycle: ObligationLifecycleSchema.optional(),
    lastReviewDate: z.string().optional().nullable(),
    nextReviewDate: z.string().optional().nullable(),
    evidenceCount: z.number().int().nonnegative().optional(),
    openActionsCount: z.number().int().nonnegative().optional(),
    notes: z.string().max(1000).optional().nullable(),
});
export const CreateObligationReviewSchema = z.object({
    obligationId: z.string().min(1),
    title: z.string().min(1).max(200),
    status: ReviewStatusSchema.default("Planned"),
    reviewDate: z.string().min(1),
    reviewer: z.string().min(1).max(200),
    findings: z.string().min(1).max(5000),
    conclusion: z.string().min(1).max(2000),
    followUpRequired: z.boolean().default(false),
    followUpDate: z.string().optional(),
    createdBy: z.string().min(1).max(200).optional(),
});
export const UpdateObligationReviewSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    status: ReviewStatusSchema.optional(),
    reviewDate: z.string().min(1).optional(),
    reviewer: z.string().min(1).max(200).optional(),
    findings: z.string().min(1).max(5000).optional(),
    conclusion: z.string().min(1).max(2000).optional(),
    followUpRequired: z.boolean().optional(),
    followUpDate: z.string().optional().nullable(),
});
export const CreateObligationEvidenceSchema = z.object({
    obligationId: z.string().min(1),
    reviewId: z.string().optional(),
    type: EvidenceTypeSchema,
    name: z.string().min(1).max(200),
    url: z.string().min(1).max(500),
    description: z.string().max(1000).optional(),
    uploadedBy: z.string().min(1).max(200).optional(),
});
export const CreateObligationActionSchema = z.object({
    obligationId: z.string().min(1),
    reviewId: z.string().optional(),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    owner: z.string().min(1).max(200),
    dueDate: z.string().min(1),
    status: ActionStatusSchema.default("Open"),
    createdBy: z.string().min(1).max(200).optional(),
});
export const UpdateObligationActionSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    owner: z.string().min(1).max(200).optional(),
    dueDate: z.string().min(1).optional(),
    status: ActionStatusSchema.optional(),
    completedAt: z.string().optional().nullable(),
});
