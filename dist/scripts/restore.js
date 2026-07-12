import { spawnSync } from "child_process";
import { createDecipheriv, createHash } from "crypto";
import fs from "fs";
import zlib from "zlib";
import { getEnv } from "../config/index.js";
import { logger } from "../shared/utils/logger.js";
function usage() {
    console.log("Usage: npm run db:restore -- <path-to-sql.gz|path-to-sql.gz.enc>");
}
function decryptBackup(buffer, secret) {
    if (!buffer.subarray(0, 7).equals(Buffer.from("EHSBKP1"))) {
        throw new Error("Encrypted backup magic header is invalid");
    }
    if (secret.length < 16) {
        throw new Error("BACKUP_ENCRYPTION_KEY must be at least 16 characters");
    }
    const key = createHash("sha256").update(secret).digest();
    const iv = buffer.subarray(7, 19);
    const tag = buffer.subarray(19, 35);
    const encrypted = buffer.subarray(35);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
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
    const raw = fs.readFileSync(file);
    const buffer = file.endsWith(".enc")
        ? decryptBackup(raw, process.env.BACKUP_ENCRYPTION_KEY || "")
        : raw;
    let sql;
    try {
        sql = zlib.gunzipSync(buffer);
    }
    catch (err) {
        logger.error({ err }, "Failed to gunzip backup; ensure it's a .gz file");
        process.exit(3);
    }
    logger.info({ file }, "Restoring database");
    const res = spawnSync("psql", ["--dbname", dbUrl, "-v", "ON_ERROR_STOP=1"], {
        input: sql,
        maxBuffer: 1024 * 1024 * 200,
    });
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
