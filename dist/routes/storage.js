import { randomUUID } from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Router } from "express";
import { getEnv } from "../config/index.js";
import { s3Client } from "../shared/infrastructure/storage/s3.service.js";
import { authenticateUser } from "../shared/middleware/auth.middleware.js";
const router = Router();
const allowedTypes = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);
router.post("/upload-url", authenticateUser, async (req, res) => {
    const env = getEnv();
    if (!env.S3_BUCKET || !env.S3_PUBLIC_URL) {
        return res.status(503).json({ error: "Persistent document storage is not configured" });
    }
    const contentType = String(req.body?.contentType ?? "").toLowerCase();
    const originalName = String(req.body?.fileName ?? "upload");
    const scope = String(req.body?.scope ?? "documents")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "") || "documents";
    if (!allowedTypes.has(contentType)) {
        return res.status(400).json({ error: "This file type is not allowed" });
    }
    const extension = originalName.includes(".")
        ? originalName.slice(originalName.lastIndexOf(".")).replace(/[^a-zA-Z0-9.]/g, "")
        : "";
    const key = `${scope}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`;
    const command = new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 10 * 60 });
    const publicUrl = `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    res.json({ uploadUrl, publicUrl, key, expiresInSeconds: 600 });
});
export default router;
