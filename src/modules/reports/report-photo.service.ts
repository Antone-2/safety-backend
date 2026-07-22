import { randomUUID } from "crypto";

import { getDbClient } from "../../shared/infrastructure/database/postgres.client.js";
import { uploadToS3 } from "../../shared/infrastructure/storage/s3.service.js";
import { logger } from "../../shared/utils/logger.js";

const DRIVE_FILE_RE =
  /drive\.google\.com\/(?:file\/d\/|open\?id=)([A-Za-z0-9_-]{10,})/i;

function extractDriveFileId(value: string): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const candidates = raw.split(",").map((part) => part.trim()).filter(Boolean);
  for (const candidate of candidates) {
    const match =
      candidate.match(DRIVE_FILE_RE) ||
      candidate.match(/drive\.google\.com\/uc\?export=(?:view|download)&id=([^&]+)/i) ||
      candidate.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function buildDriveFetchCandidates(fileId: string): string[] {
  const id = String(fileId ?? "").trim();
  if (!id) return [];

  return [
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}&confirm=t`,
    `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`,
    `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`,
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w1000`,
  ];
}

export function buildReportPhotoStorageKey(
  reportId: string,
  contentType: string,
  originalName?: string,
): string {
  const safeReportId = String(reportId ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-") || "report";

  const extension = (() => {
    const name = String(originalName ?? "").trim().toLowerCase();
    if (name.includes(".")) {
      const suffix = name.slice(name.lastIndexOf(".")).replace(/[^a-z0-9]/g, "");
      if (suffix) return `.${suffix}`;
    }

    const normalized = String(contentType ?? "").toLowerCase();
    if (normalized.includes("png")) return ".png";
    if (normalized.includes("webp")) return ".webp";
    if (normalized.includes("jpeg") || normalized.includes("jpg")) return ".jpg";
    return ".bin";
  })();

  return `reports/photos/${safeReportId}/${randomUUID()}${extension}`;
}

interface FetchedPhoto {
  data: Buffer;
  contentType: string;
  width?: number;
  height?: number;
}

async function fetchImageFromUrl(url: string): Promise<FetchedPhoto | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 100) return null;
    return { data: buffer, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDriveImage(fileId: string): Promise<FetchedPhoto | null> {
  const urls = buildDriveFetchCandidates(fileId);
  for (const url of urls) {
    const fetched = await fetchImageFromUrl(url);
    if (fetched) return fetched;
  }
  return null;
}

export async function storeReportPhotoFromDrive(
  reportId: string,
  sourceUrl: string,
  originalName?: string,
): Promise<boolean> {
  const rawUrl = String(sourceUrl ?? "").trim();
  const fileId = extractDriveFileId(rawUrl);
  const fetched = fileId
    ? await fetchDriveImage(fileId)
    : rawUrl.startsWith("http")
      ? await fetchImageFromUrl(rawUrl)
      : null;

  if (!fetched) {
    logger.debug({ reportId, sourceUrl: rawUrl, fileId }, "Could not fetch report photo from Drive; skipping storage");
    return false;
  }

  let storageKey: string | null = null;
  let storageUrl: string | null = null;
  let photoData: Buffer | null = null;
  try {
    storageKey = buildReportPhotoStorageKey(reportId, fetched.contentType, originalName);
    storageUrl = await uploadToS3(storageKey, fetched.data, fetched.contentType);
  } catch (error) {
    logger.warn({ err: error as Error, reportId, sourceUrl: rawUrl }, "Failed to upload report photo to object storage");
  }

  if (!storageKey || !storageUrl) {
    photoData = fetched.data;
  }

  const client = await getDbClient();
  try {
    await client.query(
      `INSERT INTO report_photos (report_id, drive_file_id, original_name, content_type, data, source_url, storage_key, storage_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (report_id) DO UPDATE SET
         drive_file_id = EXCLUDED.drive_file_id,
         original_name = EXCLUDED.original_name,
         content_type = EXCLUDED.content_type,
         data = EXCLUDED.data,
         source_url = EXCLUDED.source_url,
         storage_key = EXCLUDED.storage_key,
         storage_url = EXCLUDED.storage_url,
         fetched_at = NOW()`,
      [
        reportId,
        fileId ?? null,
        originalName ?? null,
        fetched.contentType,
        photoData,
        rawUrl,
        storageKey,
        storageUrl,
      ],
    );
    return true;
  } catch (error) {
    logger.warn({ err: error as Error, reportId }, "Failed to store report photo");
    return false;
  } finally {
    client.release();
  }
}

export async function getStoredReportPhoto(
  reportId: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  const client = await getDbClient();
  try {
    const result = await client.query(
      "SELECT data, content_type, storage_key FROM report_photos WHERE report_id = $1",
      [reportId],
    );
    const row = result.rows[0];
    if (!row) return null;

    if (row.data) {
      return {
        data: Buffer.from(row.data),
        contentType: String(row.content_type || "image/jpeg"),
      };
    }

    if (row.storage_key) {
      const { getFromS3 } = await import("../../shared/infrastructure/storage/s3.service.js");
      const data = await getFromS3(row.storage_key);
      return {
        data,
        contentType: String(row.content_type || "image/jpeg"),
      };
    }

    return null;
  } catch {
    return null;
  } finally {
    client.release();
  }
}
