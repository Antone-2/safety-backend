export declare class AnalyticsGovernanceService {
    listTemplates(): Promise<any[]>;
    createTemplate(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<any>;
    listSchedules(): Promise<any[]>;
    createSchedule(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<any>;
    generateRun(data: Record<string, any>, actor?: {
        name?: string;
        email?: string;
    }): Promise<any>;
    signoff(runId: string, data: Record<string, any>, actor?: {
        id?: string;
        name?: string;
        email?: string;
    }): Promise<{
        id: string;
        runId: string;
        status: any;
        signerId: string;
        signerName: string;
        comments: any;
        signedAt: string;
    }>;
    managementPack(type: "management-review" | "board-kpi" | "regulatory", actor?: {
        name?: string;
        email?: string;
    }): Promise<{
        type: "management-review" | "board-kpi" | "regulatory";
        generatedAt: any;
        runId: any;
        kpis: {
            totalReports: number;
            openReports: number;
            closedReports: number;
            overdueReports: number;
        };
        sections: string[];
        dataQualityWarnings: any;
    }>;
    dataQualityWarnings(): Promise<string[]>;
    exportRows(format: string): Promise<{
        contentType: string;
        body: string;
        fileName: string;
    }>;
}
