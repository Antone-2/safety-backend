import "dotenv/config";
import { performance } from "node:perf_hooks";
const DEFAULT_BASE_URL = process.env.DASHBOARD_BENCH_BASE_URL || "http://localhost:4000";
const DEFAULT_PATH = process.env.DASHBOARD_BENCH_PATH || "/api/reports/dashboard";
const DEFAULT_CONCURRENCY = Number(process.env.DASHBOARD_BENCH_CONCURRENCY || 50);
const DEFAULT_TOTAL_REQUESTS = Number(process.env.DASHBOARD_BENCH_TOTAL_REQUESTS || 2000);
const DEFAULT_WARMUP_REQUESTS = Number(process.env.DASHBOARD_BENCH_WARMUP_REQUESTS || 100);
const DEFAULT_TIMEOUT_MS = Number(process.env.DASHBOARD_BENCH_TIMEOUT_MS || 15000);
const DEFAULT_QUERY = process.env.DASHBOARD_BENCH_QUERY || "limit=50";
const DEFAULT_MIN_SUCCESS_RATE_PERCENT = Number(process.env.DASHBOARD_BENCH_MIN_SUCCESS_RATE_PERCENT || 99.5);
const DEFAULT_MAX_P95_MS = Number(process.env.DASHBOARD_BENCH_MAX_P95_MS || 750);
const DEFAULT_MAX_P99_MS = Number(process.env.DASHBOARD_BENCH_MAX_P99_MS || 1500);
const DEFAULT_MIN_REQUESTS_PER_SECOND = Number(process.env.DASHBOARD_BENCH_MIN_RPS || 100);
function readArg(name) {
    const prefix = `--${name}=`;
    const match = process.argv.find((arg) => arg.startsWith(prefix));
    return match ? match.slice(prefix.length) : undefined;
}
function readNumber(name, fallback) {
    const raw = readArg(name);
    const value = raw ? Number(raw) : fallback;
    return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
}
function readString(name, fallback) {
    return readArg(name)?.trim() || fallback;
}
function percentile(sorted, fraction) {
    if (sorted.length === 0)
        return 0;
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1));
    return sorted[index] || 0;
}
function average(values) {
    if (values.length === 0)
        return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function round(value) {
    return Math.round(value * 100) / 100;
}
function buildUrl(baseUrl, path, query) {
    const url = new URL(path, baseUrl);
    const trimmedQuery = query.trim().replace(/^\?/, "");
    if (trimmedQuery) {
        url.search = trimmedQuery;
    }
    return url.toString();
}
function readOptionalNumber(name, fallback) {
    const raw = readArg(name);
    if (!raw)
        return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}
function formatThresholdResult(label, passed, actual, expected) {
    return {
        label,
        passed,
        actual: round(actual),
        expected,
    };
}
async function resolveToken(baseUrl) {
    const directToken = process.env.DASHBOARD_BENCH_TOKEN?.trim();
    if (directToken)
        return directToken;
    const email = process.env.DASHBOARD_BENCH_EMAIL?.trim();
    const password = process.env.DASHBOARD_BENCH_PASSWORD?.trim();
    if (!email || !password) {
        throw new Error("Provide DASHBOARD_BENCH_TOKEN or DASHBOARD_BENCH_EMAIL and DASHBOARD_BENCH_PASSWORD.");
    }
    const loginUrl = new URL("/api/auth/login", baseUrl).toString();
    const response = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    const payload = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new Error(payload.error || `Login failed with status ${response.status}.`);
    }
    if (payload.requiresMfa || payload.mfaRequired) {
        throw new Error("Login requires MFA. Use DASHBOARD_BENCH_TOKEN from an authenticated session.");
    }
    if (!payload.token) {
        throw new Error("Login succeeded but no bearer token was returned.");
    }
    return payload.token;
}
async function issueRequest(url, token, timeoutMs) {
    const startedAt = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/json",
            },
            signal: controller.signal,
        });
        const body = await response.text();
        return {
            latencyMs: performance.now() - startedAt,
            ok: response.ok,
            status: response.status,
            bytes: Buffer.byteLength(body, "utf8"),
        };
    }
    catch {
        return {
            latencyMs: performance.now() - startedAt,
            ok: false,
            status: 0,
            bytes: 0,
        };
    }
    finally {
        clearTimeout(timer);
    }
}
async function warmCache(url, token, warmupRequests, timeoutMs) {
    for (let index = 0; index < warmupRequests; index += 1) {
        await issueRequest(url, token, timeoutMs);
    }
}
async function main() {
    const baseUrl = readString("base-url", DEFAULT_BASE_URL);
    const path = readString("path", DEFAULT_PATH);
    const query = readString("query", DEFAULT_QUERY);
    const concurrency = readNumber("concurrency", DEFAULT_CONCURRENCY);
    const totalRequests = readNumber("requests", DEFAULT_TOTAL_REQUESTS);
    const warmupRequests = readNumber("warmup", DEFAULT_WARMUP_REQUESTS);
    const timeoutMs = readNumber("timeout-ms", DEFAULT_TIMEOUT_MS);
    const thresholds = {
        minSuccessRatePercent: readOptionalNumber("min-success-rate", DEFAULT_MIN_SUCCESS_RATE_PERCENT),
        maxP95Ms: readOptionalNumber("max-p95-ms", DEFAULT_MAX_P95_MS),
        maxP99Ms: readOptionalNumber("max-p99-ms", DEFAULT_MAX_P99_MS),
        minRequestsPerSecond: readOptionalNumber("min-rps", DEFAULT_MIN_REQUESTS_PER_SECOND),
    };
    const url = buildUrl(baseUrl, path, query);
    console.log(JSON.stringify({
        stage: "config",
        baseUrl,
        path,
        query,
        concurrency,
        totalRequests,
        warmupRequests,
        timeoutMs,
        thresholds,
    }, null, 2));
    const token = await resolveToken(baseUrl);
    console.log(JSON.stringify({ stage: "auth", mode: "bearer", tokenResolved: true }));
    if (warmupRequests > 0) {
        console.log(JSON.stringify({ stage: "warmup", requests: warmupRequests }));
        await warmCache(url, token, warmupRequests, timeoutMs);
    }
    let nextRequest = 0;
    const samples = [];
    const startedAt = performance.now();
    async function worker() {
        while (true) {
            const current = nextRequest;
            nextRequest += 1;
            if (current >= totalRequests)
                return;
            samples.push(await issueRequest(url, token, timeoutMs));
        }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const durationMs = performance.now() - startedAt;
    const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);
    const successCount = samples.filter((sample) => sample.ok).length;
    const statusCounts = samples.reduce((accumulator, sample) => {
        const key = String(sample.status);
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
    }, {});
    const totalBytes = samples.reduce((sum, sample) => sum + sample.bytes, 0);
    const summary = {
        target: url,
        totals: {
            requests: totalRequests,
            succeeded: successCount,
            failed: totalRequests - successCount,
            successRatePercent: round((successCount / Math.max(totalRequests, 1)) * 100),
            durationMs: round(durationMs),
            requestsPerSecond: round((totalRequests / Math.max(durationMs, 1)) * 1000),
            throughputMbps: round(((totalBytes * 8) / Math.max(durationMs, 1) / 1000)),
        },
        latencyMs: {
            min: round(latencies[0] || 0),
            avg: round(average(latencies)),
            p50: round(percentile(latencies, 0.5)),
            p95: round(percentile(latencies, 0.95)),
            p99: round(percentile(latencies, 0.99)),
            max: round(latencies[latencies.length - 1] || 0),
        },
        payload: {
            totalBytes,
            averageBytes: round(totalBytes / Math.max(samples.length, 1)),
        },
        statusCounts,
    };
    const gateResults = [
        thresholds.minSuccessRatePercent == null
            ? null
            : formatThresholdResult("successRatePercent", summary.totals.successRatePercent >= thresholds.minSuccessRatePercent, summary.totals.successRatePercent, `>= ${thresholds.minSuccessRatePercent}`),
        thresholds.maxP95Ms == null
            ? null
            : formatThresholdResult("p95LatencyMs", summary.latencyMs.p95 <= thresholds.maxP95Ms, summary.latencyMs.p95, `<= ${thresholds.maxP95Ms}`),
        thresholds.maxP99Ms == null
            ? null
            : formatThresholdResult("p99LatencyMs", summary.latencyMs.p99 <= thresholds.maxP99Ms, summary.latencyMs.p99, `<= ${thresholds.maxP99Ms}`),
        thresholds.minRequestsPerSecond == null
            ? null
            : formatThresholdResult("requestsPerSecond", summary.totals.requestsPerSecond >= thresholds.minRequestsPerSecond, summary.totals.requestsPerSecond, `>= ${thresholds.minRequestsPerSecond}`),
    ].filter(Boolean);
    const passed = gateResults.every((result) => result?.passed !== false);
    console.log(JSON.stringify({
        stage: "results",
        ...summary,
        thresholds,
        gate: {
            passed,
            results: gateResults,
        },
    }, null, 2));
    if (!passed || successCount !== totalRequests) {
        process.exitCode = 1;
    }
}
main().catch((error) => {
    console.error(JSON.stringify({
        stage: "error",
        message: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
});
