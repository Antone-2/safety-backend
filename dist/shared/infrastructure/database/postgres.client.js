import { Pool } from "pg";
import { getEnv } from "../../../config/index.js";
const env = getEnv();
const poolConfig = {
    connectionString: env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
};
export const pgPool = new Pool(poolConfig);
export async function getDbClient() {
    return pgPool.connect();
}
pgPool.on("error", (err) => {
    console.error("Unexpected PostgreSQL client error:", err);
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
