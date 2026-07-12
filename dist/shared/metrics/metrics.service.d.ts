export declare class MetricsService {
    private startedAt;
    private requestsTotal;
    private errorsTotal;
    private latencyMsValues;
    private requestsByMethod;
    private requestsByStatus;
    private requestsByPath;
    recordRequest(method: string, path: string, statusCode: number, durationMs: number): void;
    getSnapshot(): {
        startedAt: string;
        uptimeSeconds: number;
        requestsTotal: number;
        errorsTotal: number;
        requestsByMethod: Record<string, number>;
        requestsByStatus: Record<string, number>;
        requestsByPath: Record<string, number>;
        averageLatencyMs: number;
        medianLatencyMs: number;
        p95LatencyMs: number;
    };
    reset(): void;
}
export declare const metricsService: MetricsService;
