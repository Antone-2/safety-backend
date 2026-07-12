import { metricsService } from "../metrics/metrics.service.js";
import { operationalMonitoringService } from "../../services/operational-monitoring.service.js";
const slowRequestThresholdMs = Number(process.env.SLOW_REQUEST_THRESHOLD_MS || 1500);
export function metricsMiddleware(req, res, next) {
    const start = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = ((chunk, encoding, cb) => {
        const durationMs = Date.now() - start;
        metricsService.recordRequest(req.method, req.route?.path || req.path || "unknown", res.statusCode, durationMs);
        if (durationMs >= slowRequestThresholdMs) {
            void operationalMonitoringService.recordSlowQuery({
                operation: `${req.method} ${req.route?.path || req.path || "unknown"}`,
                durationMs,
                thresholdMs: slowRequestThresholdMs,
                metadata: {
                    statusCode: res.statusCode,
                    requestId: req.requestId || req.correlationId,
                },
            });
        }
        return originalEnd(chunk, encoding, cb);
    });
    next();
}
