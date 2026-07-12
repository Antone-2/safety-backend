import { S3Client } from "@aws-sdk/client-s3";
export declare const s3Client: S3Client;
export declare function uploadToS3(key: string, body: Buffer, contentType: string): Promise<string>;
export declare function getFromS3(key: string): Promise<Buffer>;
export declare function deleteFromS3(key: string): Promise<void>;
