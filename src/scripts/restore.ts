import { spawnSync } from "child_process";
import fs from "fs";
import zlib from "zlib";
import path from "path";
import { getEnv } from "../config/index.js";
import { logger } from "../shared/utils/logger.js";

function usage() {
  console.log("Usage: npm run db:restore -- <path-to-sql.gz>");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    usage();
    process.exit(1);
  }

  const file = args[0];
  if (!fs.existsSync(file)) {
    logger.error({ file }, "Restore file not found");
    process.exit(2);
  }

  const env = getEnv();
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL is not set. Aborting restore.");
    process.exit(1);
  }

  const buffer = fs.readFileSync(file);
  let sql: Buffer;
  try {
    sql = zlib.gunzipSync(buffer);
  } catch (err) {
    logger.error({ err }, "Failed to gunzip backup; ensure it's a .gz file");
    process.exit(3);
  }

  logger.info({ file }, "Restoring database");
  const res = spawnSync("psql", ["--dbname", dbUrl, "-v", "ON_ERROR_STOP=1"], { input: sql, maxBuffer: 1024 * 1024 * 200 });
  if (res.status !== 0) {
    logger.error({ code: res.status, stderr: res.stderr?.toString() }, "psql restore failed");
    process.exit(4);
  }

  logger.info("Restore completed successfully");
}

main().catch((err) => {
  logger.error({ err }, "Restore failed");
  process.exit(10);
});
