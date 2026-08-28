import "dotenv/config";
import { Client } from "pg";

function normalizeDatabaseUrl(url) {
  if (!url) return url;
  if (
    url.includes("render.com") ||
    url.includes("amazonaws.com") ||
    url.includes("googleapis.com") ||
    url.includes("xata.tech")
  ) {
    try {
      const parsed = new URL(url);
      const searchParams = new URLSearchParams(parsed.search);
      if (!searchParams.has("sslmode")) {
        searchParams.set("sslmode", "require");
      }
      if (!searchParams.has("uselibpqcompat")) {
        searchParams.set("uselibpqcompat", "true");
      }
      parsed.search = searchParams.toString();
      return parsed.toString();
    } catch {
      return url;
    }
  }
  return url;
}

function log(step, extra = "") {
  const stamp = new Date().toISOString();
  console.log(`[diag-xata] ${stamp} ${step}${extra ? ` ${extra}` : ""}`);
}

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);

if (!connectionString) {
  console.error("[diag-xata] DATABASE_URL is not set");
  process.exit(1);
}

const client = new Client({
  connectionString,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  query_timeout: 10000,
  statement_timeout: 10000,
  ssl:
    connectionString.includes("render.com") ||
    connectionString.includes("amazonaws.com") ||
    connectionString.includes("googleapis.com") ||
    connectionString.includes("xata.tech")
      ? { rejectUnauthorized: false }
      : undefined,
});

client.on("error", (error) => {
  console.error("[diag-xata] client error:", error);
});

const startedAt = Date.now();

try {
  log("connecting");
  await client.connect();
  log("connected", `${Date.now() - startedAt}ms`);

  const queryStartedAt = Date.now();
  log("querying", "SELECT 1");
  const result = await client.query("SELECT 1 AS ok");
  log("query ok", `${Date.now() - queryStartedAt}ms rows=${result.rowCount ?? 0}`);

  const versionStartedAt = Date.now();
  log("querying", "SELECT version()");
  const versionResult = await client.query("SELECT version()");
  log(
    "version ok",
    `${Date.now() - versionStartedAt}ms ${String(versionResult.rows?.[0]?.version || "").slice(0, 120)}`,
  );
} catch (error) {
  console.error("[diag-xata] failure:", error);
  process.exitCode = 1;
} finally {
  try {
    log("closing");
    await client.end();
    log("closed");
  } catch (error) {
    console.error("[diag-xata] close failure:", error);
  }
}
