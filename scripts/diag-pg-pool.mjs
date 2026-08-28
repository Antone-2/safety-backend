import "dotenv/config";
import { pgPool } from "../dist/shared/infrastructure/database/postgres.client.js";

function log(step, extra = "") {
  const stamp = new Date().toISOString();
  console.log(`[diag-pool] ${stamp} ${step}${extra ? ` ${extra}` : ""}`);
}

const startedAt = Date.now();

try {
  log("querying", "SELECT 1");
  const result = await pgPool.query("SELECT 1 AS ok");
  log("query ok", `${Date.now() - startedAt}ms rows=${result.rowCount ?? 0}`);
} catch (error) {
  console.error("[diag-pool] failure:", error);
  process.exitCode = 1;
} finally {
  try {
    log("closing");
    await pgPool.end();
    log("closed");
  } catch (error) {
    console.error("[diag-pool] close failure:", error);
  }
}
