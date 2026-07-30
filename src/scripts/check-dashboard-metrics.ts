import "dotenv/config";

type DashboardLatencySummary = {
  count?: number;
  averageLatencyMs?: number;
  medianLatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
  maxLatencyMs?: number;
};

type MetricsSnapshot = {
  counters?: Record<string, number>;
  latencyByMetric?: Record<string, DashboardLatencySummary>;
};

const DEFAULT_BASE_URL = process.env.DASHBOARD_METRICS_BASE_URL || "http://localhost:4000";
const DEFAULT_PATH = process.env.DASHBOARD_METRICS_PATH || "/metrics";
const DEFAULT_MIN_HIT_RATE_PERCENT = Number(
  process.env.DASHBOARD_METRICS_MIN_HIT_RATE_PERCENT || 80,
);
const DEFAULT_MAX_DEGRADED_COUNT = Number(
  process.env.DASHBOARD_METRICS_MAX_DEGRADED_COUNT || 0,
);
const DEFAULT_MAX_ERROR_COUNT = Number(
  process.env.DASHBOARD_METRICS_MAX_ERROR_COUNT || 0,
);
const DEFAULT_MAX_P95_MS = Number(process.env.DASHBOARD_METRICS_MAX_P95_MS || 750);

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function readString(name: string, fallback: string): string {
  return readArg(name)?.trim() || fallback;
}

function readNumber(name: string, fallback: number): number {
  const raw = readArg(name);
  const value = raw ? Number(raw) : fallback;
  return Number.isFinite(value) ? value : fallback;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function buildUrl(baseUrl: string, path: string): string {
  return new URL(path, baseUrl).toString();
}

function getCounter(snapshot: MetricsSnapshot, name: string) {
  return Number(snapshot.counters?.[name] || 0);
}

async function fetchSnapshot(url: string): Promise<MetricsSnapshot> {
  const token = process.env.DASHBOARD_BENCH_TOKEN?.trim();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Metrics request failed with status ${response.status}.`);
  }

  return (await response.json()) as MetricsSnapshot;
}

async function main() {
  const baseUrl = readString("base-url", DEFAULT_BASE_URL);
  const path = readString("path", DEFAULT_PATH);
  const minHitRatePercent = readNumber("min-hit-rate", DEFAULT_MIN_HIT_RATE_PERCENT);
  const maxDegradedCount = readNumber("max-degraded", DEFAULT_MAX_DEGRADED_COUNT);
  const maxErrorCount = readNumber("max-errors", DEFAULT_MAX_ERROR_COUNT);
  const maxP95Ms = readNumber("max-p95-ms", DEFAULT_MAX_P95_MS);
  const url = buildUrl(baseUrl, path);

  const snapshot = await fetchSnapshot(url);
  const hits = getCounter(snapshot, "cache.reports-dashboard.hit");
  const misses = getCounter(snapshot, "cache.reports-dashboard.miss");
  const coalesced = getCounter(snapshot, "cache.reports-dashboard.coalesced");
  const degraded = getCounter(snapshot, "cache.reports-dashboard.degraded");
  const errors = getCounter(snapshot, "reports-dashboard.errors");
  const totalCacheEvents = hits + misses + coalesced + degraded;
  const hitRatePercent =
    totalCacheEvents > 0 ? ((hits + coalesced) / totalCacheEvents) * 100 : 0;
  const latencySummary = snapshot.latencyByMetric?.["reports-dashboard"] || {};
  const p95LatencyMs = Number(latencySummary.p95LatencyMs || 0);

  const checks = [
    {
      label: "hitRatePercent",
      passed: hitRatePercent >= minHitRatePercent,
      actual: round(hitRatePercent),
      expected: `>= ${minHitRatePercent}`,
    },
    {
      label: "degradedCount",
      passed: degraded <= maxDegradedCount,
      actual: degraded,
      expected: `<= ${maxDegradedCount}`,
    },
    {
      label: "errorCount",
      passed: errors <= maxErrorCount,
      actual: errors,
      expected: `<= ${maxErrorCount}`,
    },
    {
      label: "p95LatencyMs",
      passed: p95LatencyMs <= maxP95Ms,
      actual: round(p95LatencyMs),
      expected: `<= ${maxP95Ms}`,
    },
  ];

  const passed = checks.every((check) => check.passed);

  console.log(
    JSON.stringify(
      {
        stage: "dashboard-metrics",
        target: url,
        totals: {
          hits,
          misses,
          coalesced,
          degraded,
          errors,
          totalCacheEvents,
          hitRatePercent: round(hitRatePercent),
        },
        latency: latencySummary,
        gate: {
          passed,
          results: checks,
        },
      },
      null,
      2,
    ),
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        stage: "error",
        message: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
