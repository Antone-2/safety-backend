export declare class MetricsService {
    private startedAt;
    private requestsTotal;
    private errorsTotal;
    private latencyMsValues;
    private requestsByMethod;
    private requestsByStatus;
    private requestsByPath;
    private counters;
    private latencyByMetric;
    private trimLatencySeries;
    private summarizeLatencies;
    recordRequest(method: string, path: string, statusCode: number, durationMs: number): void;
    incrementCounter(name: string, value?: number): void;
    recordLatency(name: string, durationMs: number): void;
    recordCacheEvent(scope: string, outcome: string): void;
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
        p99LatencyMs: number;
        counters: Record<string, number>;
        latencyByMetric: {
            [k: string]: {
                count: number;
                averageLatencyMs: number;
                medianLatencyMs: number;
                p95LatencyMs: number;
                p99LatencyMs: number;
                maxLatencyMs: number;
            };
        };
    };
    reset(): void;
}
export declare const metricsService: MetricsService;
