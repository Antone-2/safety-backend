import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3.service.js";
import { getEnv } from "../../../config/index.js";
const env = getEnv();
const bucket = env.S3_BUCKET || "safety-uploads";
export async function generatePresignedUploadUrl(key, contentType, expiresIn = 300) {
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}
export async function generatePresignedDownloadUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
    });
    return getSignedUrl(s3Client, command, { expiresIn });
}
import { GetObjectCommand } from "@aws-sdk/client-s3";
