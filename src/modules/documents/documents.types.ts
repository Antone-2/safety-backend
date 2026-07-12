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
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DocumentStatusSchema = z.enum([
  "Draft",
  "Under Review",
  "Approved",
  "Obsolete",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

export const ApprovalStepSchema = z.enum(["review", "approval", "obsolete"]);
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;

export const ApprovalStatusSchema = z.enum(["Pending", "Approved", "Rejected"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export interface Document {
  id: string;
  title: string;
  code?: string;
  category: string;
  type: DocumentType;
  version: string;
  status: DocumentStatus;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  author: string;
  reviewer?: string;
  approver?: string;
  reviewDate?: string;
  approvalDate?: string;
  effectiveDate: string;
  expiryDate?: string;
  site: string;
  department: string;
  tags: string[];
  parentId?: string;
  createdBy: string;
  documentNo?: string;
  owner?: string;
  reviewCycleDays?: number;
  nextReviewDate?: string;
  obsoleteReason?: string;
  classification: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: string;
  changeSummary: string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  checksum: string;
  createdBy: string;
  createdAt: string;
}

export interface DocumentApproval {
  id: string;
  documentId: string;
  version: string;
  step: ApprovalStep;
  status: ApprovalStatus;
  approverId?: string;
  approverName?: string;
  comments?: string;
  decidedAt?: string;
  createdAt: string;
}

export interface DocumentAcknowledgement {
  id: string;
  documentId: string;
  documentVersion: string;
  userId: string;
  userEmail: string;
  userName: string;
  acknowledgedAt: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DocumentAccessLink {
  id: string;
  documentId: string;
  tokenHash: string;
  purpose: string;
  createdBy: string;
  expiresAt: string;
  downloadCount: number;
  createdAt: string;
  signedUrl?: string;
}

export interface DocumentStats {
  total: number;
  approved: number;
  draft: number;
  underReview: number;
  obsolete: number;
  dueForReview: number;
}

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
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

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
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>;

export const CreateDocumentVersionSchema = z.object({
  version: z.string().min(1).max(20),
  changeSummary: z.string().min(1).max(500),
  content: z.string().max(20000).optional(),
  fileUrl: z.string().optional(),
  fileName: z.string().max(200).optional(),
  fileSize: z.number().optional(),
  checksum: z.string().optional(),
});
export type CreateDocumentVersionInput = z.infer<
  typeof CreateDocumentVersionSchema
>;

export const SubmitForReviewSchema = z.object({
  version: z.string().min(1).max(20).optional(),
  reviewer: z.string().max(200).optional(),
  reviewerName: z.string().max(200).optional(),
  comments: z.string().max(2000).optional(),
});
export type SubmitForReviewInput = z.infer<typeof SubmitForReviewSchema>;

export const ApproveDocumentSchema = z.object({
  version: z.string().min(1).max(20).optional(),
  status: ApprovalStatusSchema.default("Approved"),
  comments: z.string().max(2000).optional(),
  effectiveDate: z.string().optional(),
  reviewCycleDays: z.number().optional(),
});
export type ApproveDocumentInput = z.infer<typeof ApproveDocumentSchema>;

export const MarkObsoleteSchema = z.object({
  version: z.string().min(1).max(20).optional(),
  reason: z.string().max(2000).optional(),
});
export type MarkObsoleteInput = z.infer<typeof MarkObsoleteSchema>;

export const CreateAccessLinkSchema = z.object({
  purpose: z.string().max(100).default("download"),
  ttlHours: z.number().min(1).max(8760).default(24),
  expiresAt: z.string().optional(),
});
export type CreateAccessLinkInput = z.infer<typeof CreateAccessLinkSchema>;
