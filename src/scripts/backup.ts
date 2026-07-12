import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createCipheriv, createHash, randomBytes } from "crypto";
import { getEnv } from "../config/index.js";
import { logger } from "../shared/utils/logger.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

async function main() {
  const env = getEnv();
  const dbUrl = env.DATABASE_URL;
  if (!dbUrl) {
    logger.error("DATABASE_URL is not set. Aborting backup.");
    process.exit(1);
  }

  const outDir =
    process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const encryptBackups = Boolean(process.env.BACKUP_ENCRYPTION_KEY);
  const filename = `backup-${timestamp}.sql.gz${encryptBackups ? ".enc" : ""}`;
  const filePath = path.join(outDir, filename);

  logger.info({ file: filePath }, "Starting pg_dump");

  const res = spawnSync("pg_dump", ["--dbname", dbUrl], {
    encoding: "buffer",
    maxBuffer: 1024 * 1024 * 200,
  });
  if (res.status !== 0) {
    logger.error(
      { code: res.status, stderr: res.stderr?.toString() },
      "pg_dump failed",
    );
    process.exit(2);
  }

  const gz = zlib.gzipSync(res.stdout);
  const output = encryptBackups
    ? encryptBackup(gz, process.env.BACKUP_ENCRYPTION_KEY || "")
    : gz;
  fs.writeFileSync(filePath, output);
  logger.info({ file: filePath, encrypted: encryptBackups }, "Backup written");

  if (env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
    logger.info("Uploading backup to S3...");
    const client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID!,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
      },
    });

    const key = `backups/${filename}`;
    await client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: fs.createReadStream(filePath),
      }),
    );
    logger.info({ bucket: env.S3_BUCKET, key }, "Backup uploaded to S3");
  }

  logger.info("Backup completed successfully");
}

function encryptBackup(buffer: Buffer, secret: string) {
  if (secret.length < 16) {
    throw new Error("BACKUP_ENCRYPTION_KEY must be at least 16 characters");
  }
  const key = createHash("sha256").update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("EHSBKP1"), iv, tag, encrypted]);
}

main().catch((err) => {
  logger.error({ err }, "Backup failed");
  process.exit(10);
});
