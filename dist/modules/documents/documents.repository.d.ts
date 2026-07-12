import { Pool } from "pg";
import type { Document, DocumentVersion, DocumentApproval, DocumentAcknowledgement, DocumentAccessLink, CreateDocumentInput, UpdateDocumentInput, CreateDocumentVersionInput, DocumentStats } from "./documents.types.js";
export declare class DocumentsRepository {
    private pool;
    constructor(pool: Pool);
    findAll(filters?: Record<string, unknown>): Promise<Document[]>;
    findById(id: string): Promise<Document | null>;
    create(data: CreateDocumentInput): Promise<Document>;
    update(id: string, data: UpdateDocumentInput): Promise<Document | null>;
    delete(id: string): Promise<boolean>;
    createVersion(data: CreateDocumentVersionInput, documentId: string, createdBy: string): Promise<DocumentVersion>;
    findVersions(documentId: string): Promise<DocumentVersion[]>;
    createApproval(approval: Omit<DocumentApproval, "id" | "createdAt">): Promise<DocumentApproval>;
    findApprovals(documentId: string): Promise<DocumentApproval[]>;
    createAcknowledgement(ack: Omit<DocumentAcknowledgement, "id" | "acknowledgedAt">): Promise<DocumentAcknowledgement>;
    findAcknowledgements(documentId: string): Promise<DocumentAcknowledgement[]>;
    createAccessLink(link: Omit<DocumentAccessLink, "id" | "createdAt" | "downloadCount">): Promise<DocumentAccessLink>;
    getStats(): Promise<DocumentStats>;
}
