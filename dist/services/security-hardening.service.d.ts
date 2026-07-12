export declare class SecurityHardeningService {
    upsertPolicy(policyKey: string, policyValue: Record<string, unknown>, description: string, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        policyValue: Record<string, unknown>;
        id: string;
        policyKey: string;
        description: string;
        updatedBy: string;
        updatedAt: string;
    }>;
    listPolicies(): Promise<any[]>;
    recordFileScan(input: {
        fileKey: string;
        fileName?: string;
        mimeType?: string;
        sizeBytes?: number;
        uploadedBy?: string;
        content?: Buffer | string;
    }): Promise<{
        findings: string[];
        id: string;
        fileKey: string;
        fileName: string | null;
        mimeType: string | null;
        sizeBytes: number | null;
        checksum: string;
        status: string;
        scanner: string;
        scannedAt: string;
        uploadedBy: string | null;
        createdAt: string;
    }>;
    listFileScans(status?: string): Promise<any[]>;
    upsertRetentionPolicy(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        legalHold: boolean;
        id: any;
        resourceType: any;
        retentionDays: number;
        disposalAction: any;
        updatedBy: string;
        updatedAt: string;
    }>;
    listRetentionPolicies(): Promise<any[]>;
    recordSecretRotation(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        id: any;
        secretName: any;
        owner: any;
        rotationFrequencyDays: number;
        lastRotatedAt: any;
        nextRotationDueAt: any;
        status: any;
        evidence: any;
        updatedBy: string;
        updatedAt: string;
    }>;
    listSecretRotations(): Promise<any[]>;
    dashboard(): Promise<{
        policies: any[];
        retention: any[];
        secretRotationsDue: any[];
        blockedFiles: any[];
        owaspChecklist: {
            item: string;
            status: string;
            evidence: string;
        }[];
    }>;
}
export declare const securityHardeningService: SecurityHardeningService;
