export type ClosureRequestStatus = "pending" | "approved" | "rejected";
export interface ReportClosureRequest {
    id: string;
    reportId: string;
    submittedBy: string;
    submittedByEmail: string;
    resolutionNotes: string;
    photos: string[];
    status: ClosureRequestStatus;
    reviewedBy?: string;
    reviewedByEmail?: string;
    reviewNotes?: string;
    createdAt: string;
    updatedAt: string;
}
export declare function createClosureRequest(input: {
    reportId: string;
    submittedBy: string;
    submittedByEmail: string;
    resolutionNotes: string;
    photos: string[];
}): Promise<ReportClosureRequest>;
export declare function approveClosureRequest(input: {
    requestId: string;
    reportId: string;
    reviewedBy: string;
    reviewedByEmail: string;
    reviewNotes?: string;
}): Promise<ReportClosureRequest>;
export declare function rejectClosureRequest(input: {
    requestId: string;
    reportId: string;
    reviewedBy: string;
    reviewedByEmail: string;
    reviewNotes: string;
}): Promise<ReportClosureRequest>;
export declare function getClosureRequest(requestId: string, reportId: string): Promise<ReportClosureRequest | null>;
export declare function listClosureRequests(reportId?: string): Promise<ReportClosureRequest[]>;
