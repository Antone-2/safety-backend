export type ReportTimestampAuditSample = {
    id: string;
    source: string | null;
    storedDate: string | null;
    normalizedDate: string | null;
    storedDueAt: string | null;
    normalizedDueAt: string | null;
    storedComplianceDueAt: string | null;
    normalizedComplianceDueAt: string | null;
};
export type ReportTimestampAuditSummary = {
    scanned: number;
    valid: number;
    repairable: number;
    unrecoverable: number;
    repairableSamples: ReportTimestampAuditSample[];
    unrecoverableSamples: ReportTimestampAuditSample[];
};
export declare function auditReportTimestamps(sampleLimit?: number): Promise<ReportTimestampAuditSummary>;
