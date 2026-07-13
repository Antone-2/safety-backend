export declare class OperationalMonitoringService {
    recordEvent(input: {
        type: string;
        source: string;
        status: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    recordSchedulerRun(input: {
        jobName: string;
        status: string;
        startedAt: string;
        finishedAt?: string;
        durationMs?: number;
        error?: string;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    recordSlowQuery(input: {
        operation: string;
        durationMs: number;
        thresholdMs: number;
        metadata?: Record<string, unknown>;
    }): Promise<any>;
    dashboard(): Promise<{
        events: any[];
        scheduler: any[];
        slowRequests: any[];
        recentEvents: any[];
    }>;
}
export declare const operationalMonitoringService: OperationalMonitoringService;
