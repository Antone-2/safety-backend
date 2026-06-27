export type SeverityPoints = {
    Low: number;
    Medium: number;
    High: number;
    Critical: number;
};
export declare function pointsForSeverity(severity: string, weights?: SeverityPoints): number;
export declare function monthKeyFromIso(iso: string): string;
export declare function awardPointsForReport(db: any, report: {
    date: string;
    reporter: string;
    severity: string;
}): Promise<void>;
export type MonthlyAwardOptions = {
    topN?: number;
    /** ISO date time range reference; used only for choosing previous month */
    now?: Date;
};
export declare function runMonthlyLeaderboardJob(db: any, options?: MonthlyAwardOptions): Promise<void>;
export declare function maybeRunMonthlyLeaderboardJob(db: any, settingsRow?: {
    value?: string;
}): Promise<{
    ran: boolean;
    reason: string;
} | {
    ran: boolean;
    reason?: undefined;
}>;
