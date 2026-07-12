export declare class OperationalMonitoringService {
    recordEvent(input: {
        type: string;
        source: string;
        status: string;
        message: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        metadata: Record<string, unknown>;
        id: string;
        type: string;
        source: string;
        status: string;
        message: string;
        createdAt: string;
    }>;
    recordSchedulerRun(input: {
        jobName: string;
        status: string;
        startedAt: string;
        finishedAt?: string;
        durationMs?: number;
        error?: string;
        metadata?: Record<string, unknown>;
    }): Promise<{
        metadata: Record<string, unknown>;
        id: string;
        jobName: string;
        status: string;
        startedAt: string;
        finishedAt: string | null;
        durationMs: number | null;
        error: string | null;
    }>;
    recordSlowQuery(input: {
        operation: string;
        durationMs: number;
        thresholdMs: number;
        metadata?: Record<string, unknown>;
    }): Promise<{
        metadata: Record<string, unknown>;
        id: string;
        operation: string;
        durationMs: number;
        thresholdMs: number;
        createdAt: string;
    }>;
    dashboard(): Promise<{
        events: any[];
        scheduler: any[];
        slowRequests: any[];
        recentEvents: any[];
    }>;
}
export declare const operationalMonitoringService: OperationalMonitoringService;
