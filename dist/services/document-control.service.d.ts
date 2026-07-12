export declare class DocumentControlService {
    createVersion(documentId: string, data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        id: string;
        documentId: string;
        version: string;
        createdAt: string;
    }>;
    listVersions(documentId: string): Promise<any[]>;
    submitForReview(documentId: string, data: Record<string, any>, actor?: {
        id?: string;
        name?: string;
        email?: string;
    }): Promise<{
        id: string;
        documentId: string;
        version: string;
        step: string;
        status: string;
        approverId: any;
        approverName: any;
        comments: any;
        decidedAt: null;
        createdAt: string;
    }>;
    approve(documentId: string, data: Record<string, any>, actor?: {
        id?: string;
        name?: string;
        email?: string;
    }): Promise<{
        id: string;
        documentId: string;
        version: string;
        step: string;
        status: any;
        approverId: any;
        approverName: string;
        comments: any;
        decidedAt: string;
        createdAt: string;
    }>;
    markObsolete(documentId: string, data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        documentId: string;
        status: string;
        obsoleteReason: any;
    }>;
    acknowledge(documentId: string, documentVersion: string, actor: {
        id?: string;
        email?: string;
        name?: string;
    }, requestMeta?: {
        ip?: string;
        userAgent?: string;
    }): Promise<{
        id: string;
        documentId: string;
        documentVersion: string;
        userId: string;
        userEmail: string;
        userName: string;
        acknowledgedAt: string;
        ipAddress: string | null;
        userAgent: string | null;
    }>;
    listAcknowledgements(documentId: string): Promise<any[]>;
    acknowledgementReport(): Promise<any[]>;
    createAccessLink(documentId: string, data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        token: undefined;
        signedUrl: string;
        id: string;
        documentId: string;
        tokenHash: string;
        purpose: any;
        createdBy: string;
        expiresAt: any;
        downloadCount: number;
        createdAt: string;
    }>;
    private getDocument;
    private updateDocument;
}
