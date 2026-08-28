import { Pool } from "pg";
import { getEnv } from "../../../config/index.js";
const env = getEnv();
function normalizeDatabaseUrl(url) {
    if (!url)
        return url;
    if (url.includes("render.com") ||
        url.includes("amazonaws.com") ||
        url.includes("googleapis.com") ||
        url.includes("xata.tech")) {
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
        }
        catch {
            return url;
        }
    }
    return url;
}
const poolConfig = {
    connectionString: normalizeDatabaseUrl(env.DATABASE_URL),
    max: 25,
    idleTimeoutMillis: 30_000,
    maxLifetimeSeconds: 1_800,
    connectionTimeoutMillis: 10_000,
    query_timeout: 10_000,
    statement_timeout: 10_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ssl: env.DATABASE_URL?.includes("render.com") ||
        env.DATABASE_URL?.includes("amazonaws.com") ||
        env.DATABASE_URL?.includes("googleapis.com") ||
        env.DATABASE_URL?.includes("xata.tech")
        ? { rejectUnauthorized: false }
        : undefined,
};
export const pgPool = new Pool(poolConfig);
export function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Detect connection-level failures that are safe to retry. These are transient
 * conditions (server restart, idle timeout, network blip, pool exhaustion) and
 * not deterministic application errors.
 */
export function isTransientConnectionError(error) {
    const message = error instanceof Error
        ? error.message
        : typeof error === "string"
            ? error
            : String(error?.detail ?? "");
    const code = typeof error === "object" && error !== null && "code" in error
        ? String(error.code ?? "")
        : "";
    // PostgreSQL server error codes for connection/session issues.
    const transientCodes = new Set([
        "57P01", // admin_shutdown
        "57P02", // crash_shutdown
        "57P03", // cannot_connect_now
        "08006", // connection_failure
        "08001", // sqlclient_unable_to_establish_sqlconnection
        "08003", // connection_does_not_exist
        "08004", // sqlserver_rejected_establishment_of_sqlconnection
        "53300", // too_many_connections
        "53301", // too_many_segments
        "53302", // too_many_sessions
        "53P03", // database_dropped
    ]);
    if (transientCodes.has(code))
        return true;
    return (/connection terminated unexpectedly/i.test(message) ||
        /client has encountered a connection error and is not queryable/i.test(message) ||
        /connection.*(refused|closed|reset|lost|failed|aborted)/i.test(message) ||
        /ECONNRESET|ECONNREFUSED|EPIPE|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up/i.test(message) ||
        /timeout.*(connection|pool|client|terminat)/i.test(message) ||
        /terminat(ed|ing) connection/i.test(message) ||
        /idle client timeout/i.test(message));
}
/**
 * Run a query with bounded exponential backoff on transient connection errors.
 */
export async function queryWithRetry(query, opts = {}) {
    const retries = opts.retries ?? 2;
    const baseDelayMs = opts.baseDelayMs ?? 500;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await query();
        }
        catch (err) {
            lastErr = err;
            const shouldRetry = isTransientConnectionError(err);
            const isLast = attempt === retries;
            if (!shouldRetry || isLast)
                throw err;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
        }
    }
    throw lastErr;
}
/**
 * Run a transaction with bounded retry. On a transient connection failure the
 * current client is released and a fresh one is checked out so the whole
 * transaction can be replayed cleanly.
 */
export async function withTransactionRetry(fn, opts = {}) {
    const retries = opts.retries ?? 2;
    const baseDelayMs = opts.baseDelayMs ?? 500;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const client = await getDbClient();
        try {
            await client.query("BEGIN");
            const result = await fn(client);
            await client.query("COMMIT");
            return result;
        }
        catch (err) {
            lastErr = err;
            try {
                await client.query("ROLLBACK");
            }
            catch {
                // The connection may already be dead; ignore rollback errors.
            }
            const shouldRetry = isTransientConnectionError(err);
            const isLast = attempt === retries;
            if (!shouldRetry || isLast)
                throw err;
            const delay = baseDelayMs * Math.pow(2, attempt);
            await sleep(delay);
        }
        finally {
            client.release();
        }
    }
    throw lastErr;
}
export async function getDbClient(retries = 2) {
    try {
        const client = await pgPool.connect();
        client.setMaxListeners(20);
        // Attach an error listener so a socket error on a checked-out client does
        // not become an unhandled "Uncaught exception" that crashes the process.
        client.on("error", (err) => {
            console.error("PostgreSQL client socket error:", err.message);
        });
        try {
            await client.query("SELECT 1");
        }
        catch (error) {
            client.release();
            console.error("PostgreSQL client is not queryable, releasing:", error);
            throw error;
        }
        return client;
    }
    catch (error) {
        if (retries > 0) {
            // A connection may have been terminated by the server between checkout
            // and use. Give the pool a moment to recover and retry.
            await sleep(250);
            return getDbClient(retries - 1);
        }
        throw error;
    }
}
pgPool.on("error", (err) => {
    console.error("Unexpected PostgreSQL pool error:", err);
});
export async function checkDatabase() {
    try {
        await pgPool.query("SELECT 1");
        return { name: "postgresql", ok: true };
    }
    catch {
        return { name: "postgresql", ok: false };
    }
}
