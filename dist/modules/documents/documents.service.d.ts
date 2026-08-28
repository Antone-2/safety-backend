import type { Document, DocumentVersion, DocumentAcknowledgement, CreateDocumentInput, UpdateDocumentInput, CreateDocumentVersionInput, SubmitForReviewInput, ApproveDocumentInput, MarkObsoleteInput, CreateAccessLinkInput, DocumentStats } from "./documents.types.js";
import { DocumentsRepository } from "./documents.repository.js";
export declare class DocumentsService {
    private repository;
    constructor(repository: DocumentsRepository);
    getDocuments(filters?: Record<string, unknown>): Promise<Document[]>;
    getDocumentById(id: string): Promise<Document | null>;
    createDocument(data: CreateDocumentInput): Promise<Document>;
    updateDocument(id: string, data: UpdateDocumentInput): Promise<Document | null>;
    deleteDocument(id: string): Promise<boolean>;
    createVersion(documentId: string, data: CreateDocumentVersionInput, createdBy: string): Promise<DocumentVersion>;
    getVersions(documentId: string): Promise<DocumentVersion[]>;
    submitForReview(documentId: string, data: SubmitForReviewInput, actor?: {
        name?: string;
        email?: string;
    }): Promise<Document | null>;
    approve(documentId: string, data: ApproveDocumentInput, actor?: {
        id?: string;
        name?: string;
        email?: string;
    }): Promise<Document | null>;
    markObsolete(documentId: string, data: MarkObsoleteInput, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        documentId: string;
        status: string;
        obsoleteReason: string | undefined;
    }>;
    acknowledge(documentId: string, documentVersion: string, actor: {
        id?: string;
        email?: string;
        name?: string;
    }, requestMeta?: {
        ip?: string;
        userAgent?: string;
    }): Promise<DocumentAcknowledgement>;
    getAcknowledgements(documentId: string): Promise<DocumentAcknowledgement[]>;
    getAcknowledgementReport(): Promise<{
        acknowledgements: number;
        lastAcknowledgedAt: string | undefined;
        id: string;
        title: string;
        code?: string;
        category: string;
        type: import("./documents.types.js").DocumentType;
        version: string;
        status: import("./documents.types.js").DocumentStatus;
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
    }[]>;
    createAccessLink(documentId: string, data: CreateAccessLinkInput, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        signedUrl: string;
        id: string;
        documentId: string;
        tokenHash: string;
        purpose: string;
        createdBy: string;
        expiresAt: string;
        downloadCount: number;
        createdAt: string;
    }>;
    getStats(): Promise<DocumentStats>;
}
