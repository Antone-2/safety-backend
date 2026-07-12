import fs from "fs";
import path from "path";
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getEnv } from "../config/index.js";
import { logger } from "../shared/utils/logger.js";
async function pruneLocal(dir, days) {
    if (!fs.existsSync(dir))
        return;
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fp = path.join(dir, file);
        const stat = fs.statSync(fp);
        if (stat.mtimeMs < cutoff) {
            fs.unlinkSync(fp);
            logger.info({ file: fp }, "Deleted old local backup");
        }
    }
}
async function pruneS3(bucket, prefix, days) {
    const env = getEnv();
    const client = new S3Client({
        region: env.S3_REGION,
        endpoint: env.S3_ENDPOINT || undefined,
        credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
    });
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
    const toDelete = [];
    for (const obj of listed.Contents || []) {
        const last = obj.LastModified?.getTime() || 0;
        if (last < cutoff && obj.Key) {
            toDelete.push({ Key: obj.Key });
        }
    }
    if (toDelete.length === 0)
        return;
    await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: toDelete } }));
    logger.info({ deleted: toDelete.length }, "Deleted old S3 backups");
}
async function main() {
    const env = getEnv();
    const days = Number(process.env.RETENTION_DAYS || 30);
    const dir = process.env.BACKUP_DIR || path.resolve(process.cwd(), "backups");
    await pruneLocal(dir, days);
    if (env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY) {
        await pruneS3(env.S3_BUCKET, "backups/", days);
    }
    logger.info({ days }, "Prune complete");
}
main().catch((err) => {
    logger.error({ err }, "Prune failed");
    process.exit(1);
});
