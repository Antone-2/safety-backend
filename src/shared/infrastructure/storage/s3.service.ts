import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getEnv } from "../../../config/index.js";

const env = getEnv();

function requireStorageConfig(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required for S3 storage operations`);
  }
  return value;
}

export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  credentials:
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: !!env.S3_ENDPOINT,
});

export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string> {
  const bucket = requireStorageConfig(env.S3_BUCKET, "S3_BUCKET");
  const publicUrl = requireStorageConfig(env.S3_PUBLIC_URL, "S3_PUBLIC_URL");
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

export async function getFromS3(key: string): Promise<Buffer> {
  const bucket = requireStorageConfig(env.S3_BUCKET, "S3_BUCKET");
  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function deleteFromS3(key: string): Promise<void> {
  const bucket = requireStorageConfig(env.S3_BUCKET, "S3_BUCKET");
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}
