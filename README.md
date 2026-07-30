# Crown Safety Backend

## Quick start

1. Copy .env.example to .env and adjust values.
2. Install dependencies with `npm ci`.
3. Start the API with `npm run dev`.
4. For containerized setup, run `docker compose up --build`.

## Production readiness features

- Security headers and rate limiting middleware
- Health endpoint at `/health`
- Docker and Compose support
- CI workflow for automated testing and build verification

## Dashboard load benchmark

Run the cached reports dashboard benchmark with either an existing bearer token or a non-MFA service account:

```bash
set DASHBOARD_BENCH_TOKEN=your-token
npm run bench:reports-dashboard -- --base-url=http://localhost:4000 --requests=5000 --concurrency=100 --warmup=200
```

Or:

```bash
set DASHBOARD_BENCH_EMAIL=loadtest@example.com
set DASHBOARD_BENCH_PASSWORD=your-password
npm run bench:reports-dashboard -- --base-url=http://localhost:4000
```

Useful inputs:

- `--concurrency=100` controls parallel clients.
- `--requests=5000` controls total measured requests.
- `--warmup=200` primes Redis and PostgreSQL caches before measurement.
- `--query=limit=50&days=30` benchmarks the exact dashboard filter mix you care about.
- `--min-success-rate=99.5 --max-p95-ms=750 --max-p99-ms=1500 --min-rps=100` turns the run into a pass/fail release gate.

The script prints JSON with success rate, requests/sec, throughput, and `p50`/`p95`/`p99` latency so we can compare environments consistently. It exits non-zero when the configured thresholds fail, which makes it suitable for staging sign-off or a protected deploy step.

Recommended release gate for the cached dashboard:

- `success rate >= 99.5%`
- `p95 <= 750ms`
- `p99 <= 1500ms`
- `throughput >= 100 req/s`

Example staging gate:

```bash
set DASHBOARD_BENCH_TOKEN=your-token
npm run bench:reports-dashboard -- --base-url=https://staging-api.example.com --requests=5000 --concurrency=100 --warmup=200 --min-success-rate=99.5 --max-p95-ms=750 --max-p99-ms=1500 --min-rps=100
```

## Dashboard runtime metrics

The backend `/metrics` endpoint now exposes dashboard-specific observability for the cached snapshot route:

- `counters.cache.reports-dashboard.hit`
- `counters.cache.reports-dashboard.miss`
- `counters.cache.reports-dashboard.coalesced`
- `counters.cache.reports-dashboard.degraded`
- `counters.reports-dashboard.errors`
- `latencyByMetric["reports-dashboard"]`

This makes it easy to detect cache regressions, latency drift, or degraded Redis behavior in production without waiting for a manual benchmark run.

You can also gate staging directly from the live metrics snapshot:

```bash
npm run ops:check-dashboard-metrics -- --base-url=https://staging-api.example.com --min-hit-rate=80 --max-degraded=0 --max-errors=0 --max-p95-ms=750
```

This script reads `/metrics`, calculates the effective dashboard cache-hit rate from `hit + coalesced` versus `hit + miss + coalesced + degraded`, and exits non-zero if the live cache behavior is outside threshold.

## Deploy workflow gate

The deploy workflow now includes an optional `verify-dashboard` job after image push. It runs only when both of these are configured in GitHub Actions:

- secret: `DASHBOARD_BENCH_TOKEN`
- variable: `STAGING_API_BASE_URL`

Optional Actions variables let you tune the gate without editing code:

- `DASHBOARD_METRICS_MIN_HIT_RATE`
- `DASHBOARD_METRICS_MAX_DEGRADED`
- `DASHBOARD_METRICS_MAX_ERRORS`
- `DASHBOARD_METRICS_MAX_P95_MS`

With that in place, every deploy can automatically verify that the cached dashboard path is still healthy and not regressing into low hit-rate or high-latency behavior.

There is also an optional active benchmark job, `benchmark-dashboard`, which runs only when this Actions variable is set:

- `ENABLE_DASHBOARD_POST_DEPLOY_BENCHMARK=true`

Optional Actions variables for the benchmark gate:

- `DASHBOARD_BENCH_REQUESTS`
- `DASHBOARD_BENCH_CONCURRENCY`
- `DASHBOARD_BENCH_WARMUP`
- `DASHBOARD_BENCH_QUERY`
- `DASHBOARD_BENCH_MIN_SUCCESS_RATE`
- `DASHBOARD_BENCH_MAX_P95_MS`
- `DASHBOARD_BENCH_MAX_P99_MS`
- `DASHBOARD_BENCH_MIN_RPS`

This gives you two layers after deploy:

- a lightweight live metrics smoke check
- an opt-in active load gate for the dashboard snapshot endpoint
