import { Pool } from "pg";
import { getEnv } from "../../../config/index.js";

const env = getEnv();

function normalizeDatabaseUrl(url: string | undefined): string | undefined {
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

const poolConfig = {
  connectionString: normalizeDatabaseUrl(env.DATABASE_URL),

  max: 10,
  idleTimeoutMillis: 30_000,
  maxLifetimeSeconds: 1_800,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,

  ssl:
    env.DATABASE_URL?.includes("render.com") ||
    env.DATABASE_URL?.includes("amazonaws.com") ||
    env.DATABASE_URL?.includes("googleapis.com") ||
    env.DATABASE_URL?.includes("xata.tech")
      ? { rejectUnauthorized: false }
      : undefined,
};


export const pgPool = new Pool(poolConfig);

export async function getDbClient(retries = 2): Promise<import("pg").PoolClient> {
  try {
    const client = await pgPool.connect();
    client.setMaxListeners(20);
    try {
      await client.query("SELECT 1");
    } catch (error) {
      client.release();
      console.error("PostgreSQL client is not queryable, releasing:", error);
      throw error;
    }
    return client;
  } catch (error) {
    if (retries > 0) {
      // A connection may have been terminated by the server between checkout
      // and use. Give the pool a moment to recover and retry.
      await new Promise((r) => setTimeout(r, 250));
      return getDbClient(retries - 1);
    }
    throw error;
  }
}

pgPool.on("error", (err) => {
  console.error("Unexpected PostgreSQL pool error:", err);
});

export async function checkDatabase(): Promise<{ name: string; ok: boolean }> {
  try {
    await pgPool.query("SELECT 1");
    return { name: "postgresql", ok: true };
  } catch {
    return { name: "postgresql", ok: false };
  }
}
