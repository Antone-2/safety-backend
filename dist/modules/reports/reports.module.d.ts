export declare function dedupeDashboardReports<T extends {
    id?: string;
    updatedAt?: string;
    createdAt?: string;
    date?: string;
}>(rows: T[]): T[];
declare function broadcastReport(report: unknown): void;
declare function broadcastStats(stats: unknown): void;
export declare function createReportsRouter(): import("express-serve-static-core").Router;
export { broadcastReport, broadcastStats };
