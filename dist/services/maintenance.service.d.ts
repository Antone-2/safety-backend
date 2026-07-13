export declare function runDatabaseMaintenance(): Promise<{
    expiredOtps: number;
    expiredSessions: number;
    oldRateLimits: number;
}>;
export declare function startDatabaseMaintenanceScheduler(): void;
