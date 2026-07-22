export type FollowupStage = "reminder" | "urgent" | "overdue";
export interface ReportFollowup {
    reportId: string;
    stage: FollowupStage;
    dueAt: string;
    assignedTo: string;
    assignedToCopy: string[];
    location: string;
    description: string;
    severity: string;
    status: string;
    slaHours: number;
}
export declare function findReportsNeedingFollowup(limit?: number): Promise<ReportFollowup[]>;
export declare function enqueueFollowup(report: ReportFollowup): Promise<void>;
export declare function scheduleFollowupsForReport(reportId: string): Promise<void>;
