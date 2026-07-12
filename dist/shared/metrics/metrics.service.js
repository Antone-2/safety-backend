export class MetricsService {
    startedAt = Date.now();
    requestsTotal = 0;
    errorsTotal = 0;
    latencyMsValues = [];
    requestsByMethod = {};
    requestsByStatus = {};
    requestsByPath = {};
    recordRequest(method, path, statusCode, durationMs) {
        this.requestsTotal += 1;
        this.requestsByMethod[method] = (this.requestsByMethod[method] || 0) + 1;
        this.requestsByStatus[String(statusCode)] = (this.requestsByStatus[String(statusCode)] || 0) + 1;
        this.requestsByPath[path] = (this.requestsByPath[path] || 0) + 1;
        this.latencyMsValues.push(durationMs);
        if (statusCode >= 500) {
            this.errorsTotal += 1;
        }
        if (this.latencyMsValues.length > 1000) {
            this.latencyMsValues = this.latencyMsValues.slice(-1000);
        }
    }
    getSnapshot() {
        const latencies = [...this.latencyMsValues].sort((a, b) => a - b);
        const median = latencies[Math.floor(latencies.length / 2)] ?? 0;
        const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
        return {
            startedAt: new Date(this.startedAt).toISOString(),
            uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
            requestsTotal: this.requestsTotal,
            errorsTotal: this.errorsTotal,
            requestsByMethod: this.requestsByMethod,
            requestsByStatus: this.requestsByStatus,
            requestsByPath: this.requestsByPath,
            averageLatencyMs: this.latencyMsValues.length
                ? Number((this.latencyMsValues.reduce((sum, value) => sum + value, 0) / this.latencyMsValues.length).toFixed(2))
                : 0,
            medianLatencyMs: Number(median.toFixed(2)),
            p95LatencyMs: Number(p95.toFixed(2)),
        };
    }
    reset() {
        this.startedAt = Date.now();
        this.requestsTotal = 0;
        this.errorsTotal = 0;
        this.latencyMsValues = [];
        this.requestsByMethod = {};
        this.requestsByStatus = {};
        this.requestsByPath = {};
    }
}
export const metricsService = new MetricsService();
