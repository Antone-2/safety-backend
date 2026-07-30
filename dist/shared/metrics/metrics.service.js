export class MetricsService {
    startedAt = Date.now();
    requestsTotal = 0;
    errorsTotal = 0;
    latencyMsValues = [];
    requestsByMethod = {};
    requestsByStatus = {};
    requestsByPath = {};
    counters = {};
    latencyByMetric = {};
    trimLatencySeries(values) {
        if (values.length > 1000) {
            return values.slice(-1000);
        }
        return values;
    }
    summarizeLatencies(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
        const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0;
        const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0;
        const max = sorted[sorted.length - 1] ?? 0;
        return {
            count: values.length,
            averageLatencyMs: values.length
                ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2))
                : 0,
            medianLatencyMs: Number(median.toFixed(2)),
            p95LatencyMs: Number(p95.toFixed(2)),
            p99LatencyMs: Number(p99.toFixed(2)),
            maxLatencyMs: Number(max.toFixed(2)),
        };
    }
    recordRequest(method, path, statusCode, durationMs) {
        this.requestsTotal += 1;
        this.requestsByMethod[method] = (this.requestsByMethod[method] || 0) + 1;
        this.requestsByStatus[String(statusCode)] = (this.requestsByStatus[String(statusCode)] || 0) + 1;
        this.requestsByPath[path] = (this.requestsByPath[path] || 0) + 1;
        this.latencyMsValues.push(durationMs);
        if (statusCode >= 500) {
            this.errorsTotal += 1;
        }
        this.latencyMsValues = this.trimLatencySeries(this.latencyMsValues);
    }
    incrementCounter(name, value = 1) {
        this.counters[name] = (this.counters[name] || 0) + value;
    }
    recordLatency(name, durationMs) {
        const values = this.latencyByMetric[name] || [];
        values.push(durationMs);
        this.latencyByMetric[name] = this.trimLatencySeries(values);
    }
    recordCacheEvent(scope, outcome) {
        this.incrementCounter(`cache.${scope}.${outcome}`);
    }
    getSnapshot() {
        const latencySummary = this.summarizeLatencies(this.latencyMsValues);
        return {
            startedAt: new Date(this.startedAt).toISOString(),
            uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
            requestsTotal: this.requestsTotal,
            errorsTotal: this.errorsTotal,
            requestsByMethod: this.requestsByMethod,
            requestsByStatus: this.requestsByStatus,
            requestsByPath: this.requestsByPath,
            averageLatencyMs: latencySummary.averageLatencyMs,
            medianLatencyMs: latencySummary.medianLatencyMs,
            p95LatencyMs: latencySummary.p95LatencyMs,
            p99LatencyMs: latencySummary.p99LatencyMs,
            counters: this.counters,
            latencyByMetric: Object.fromEntries(Object.entries(this.latencyByMetric).map(([name, values]) => [
                name,
                this.summarizeLatencies(values),
            ])),
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
        this.counters = {};
        this.latencyByMetric = {};
    }
}
export const metricsService = new MetricsService();
