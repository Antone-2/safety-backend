import { BaseService } from "./base.service.js";
import { z } from "zod";
import { allRows, getDb, saveDb } from "../lib/database.js";
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
export const DocumentSchema = z.object({
    id: z.string().optional(),
    documentNo: z.string().optional(),
    owner: z.string().max(200).optional(),
    reviewCycleDays: z.number().optional(),
    nextReviewDate: z.string().optional(),
    obsoleteReason: z.string().optional(),
    classification: z.string().max(100).optional(),
    title: z.string().min(1).max(300),
    code: z.string().max(50).optional(),
    category: z.string().min(1).max(100),
    type: DocumentTypeSchema,
    version: z.string().min(1).max(20),
    status: DocumentStatusSchema.default("Draft"),
    content: z.string().max(20000).optional(),
    fileUrl: z.string().optional(),
    fileName: z.string().max(200).optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().max(100).optional(),
    author: z.string().min(1).max(200),
    reviewer: z.string().max(200).optional(),
    approver: z.string().max(200).optional(),
    reviewDate: z.string().optional(),
    approvalDate: z.string().optional(),
    effectiveDate: z.string().min(1),
    expiryDate: z.string().optional(),
    site: z.string().min(1).max(200),
    department: z.string().min(1).max(100),
    tags: z.string().max(500).optional(),
    parentId: z.string().optional(),
    createdBy: z.string().min(1).max(200),
});
export class DocumentService extends BaseService {
    constructor() {
        super("documents", DocumentSchema);
    }
    async createDocument(data) {
        const record = await this.create({
            ...data,
            documentNo: `DOC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        });
        return record;
    }
    async getDocuments(filters) {
        return this.getAll(filters);
    }
    async getDocumentById(id) {
        return this.getById(id);
    }
    async getStats() {
        const db = await getDb();
        const all = allRows(db, `SELECT * FROM documents`);
        const total = all.length;
        const approved = all.filter((r) => r.status === "Approved").length;
        const draft = all.filter((r) => r.status === "Draft").length;
        const obsolete = all.filter((r) => r.status === "Obsolete").length;
        const underReview = all.filter((r) => r.status === "Under Review").length;
        const dueForReview = all.filter((r) => r.nextReviewDate && new Date(r.nextReviewDate) <= new Date()).length;
        await saveDb(db);
        return { total, approved, draft, underReview, obsolete, dueForReview };
    }
}
