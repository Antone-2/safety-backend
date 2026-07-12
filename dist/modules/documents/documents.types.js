import { z } from "zod";
export const DocumentTypeSchema = z.enum([
    "Policy",
    "Procedure",
    "Guideline",
    "Form",
    "SDS",
    "Permit",
    "Other",
]);
export const DocumentStatusSchema = z.enum([
    "Draft",
    "Under Review",
    "Approved",
    "Obsolete",
]);
export const ApprovalStepSchema = z.enum(["review", "approval", "obsolete"]);
export const ApprovalStatusSchema = z.enum(["Pending", "Approved", "Rejected"]);
export const CreateDocumentSchema = z.object({
    documentNo: z.string().optional(),
    title: z.string().min(1).max(300),
    code: z.string().max(50).optional(),
    category: z.string().min(1).max(100),
    type: DocumentTypeSchema,
    version: z.string().min(1).max(20).default("1.0"),
    content: z.string().max(20000).optional(),
    fileUrl: z.string().optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().max(100).optional(),
    author: z.string().min(1).max(200),
    reviewer: z.string().max(200).optional(),
    approver: z.string().max(200).optional(),
    effectiveDate: z.string().min(1),
    expiryDate: z.string().optional(),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    tags: z.array(z.string()).optional().default([]),
    parentId: z.string().optional(),
    owner: z.string().max(200).optional(),
    reviewCycleDays: z.number().optional(),
    nextReviewDate: z.string().optional(),
    classification: z.string().max(100).optional().default("Internal"),
    createdBy: z.string().min(1).max(200),
});
export const UpdateDocumentSchema = z.object({
    title: z.string().min(1).max(300).optional(),
    code: z.string().max(50).optional().nullable(),
    category: z.string().min(1).max(100).optional(),
    type: DocumentTypeSchema.optional(),
    content: z.string().max(20000).optional().nullable(),
    fileUrl: z.string().optional().nullable(),
    fileName: z.string().max(200).optional().nullable(),
    fileSize: z.number().optional().nullable(),
    mimeType: z.string().max(100).optional().nullable(),
    reviewer: z.string().max(200).optional().nullable(),
    approver: z.string().max(200).optional().nullable(),
    reviewDate: z.string().optional().nullable(),
    approvalDate: z.string().optional().nullable(),
    effectiveDate: z.string().min(1).optional(),
    expiryDate: z.string().optional().nullable(),
    site: z.string().min(1).max(200).optional(),
    department: z.string().min(1).max(100).optional(),
    tags: z.array(z.string()).optional().nullable(),
    status: DocumentStatusSchema.optional(),
    owner: z.string().max(200).optional().nullable(),
    reviewCycleDays: z.number().optional().nullable(),
    nextReviewDate: z.string().optional().nullable(),
    obsoleteReason: z.string().optional().nullable(),
    classification: z.string().max(100).optional().nullable(),
});
export const CreateDocumentVersionSchema = z.object({
    version: z.string().min(1).max(20),
    changeSummary: z.string().min(1).max(500),
    content: z.string().max(20000).optional(),
    fileUrl: z.string().optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
    checksum: z.string().optional(),
});
export const SubmitForReviewSchema = z.object({
    version: z.string().min(1).max(20).optional(),
    reviewer: z.string().max(200).optional(),
    reviewerName: z.string().max(200).optional(),
    comments: z.string().max(2000).optional(),
});
export const ApproveDocumentSchema = z.object({
    version: z.string().min(1).max(20).optional(),
    status: ApprovalStatusSchema.default("Approved"),
    comments: z.string().max(2000).optional(),
    effectiveDate: z.string().optional(),
    reviewCycleDays: z.number().optional(),
});
export const MarkObsoleteSchema = z.object({
    version: z.string().min(1).max(20).optional(),
    reason: z.string().max(2000).optional(),
});
export const CreateAccessLinkSchema = z.object({
    purpose: z.string().max(100).default("download"),
    ttlHours: z.number().min(1).max(8760).default(24),
    expiresAt: z.string().optional(),
});
