export const APP_NAME = "Crown Safety Backend";
export const APP_VERSION = "2.0.0";
export const API_PREFIX = "/api/v1";

export const JWT = {
  ACCESS_EXPIRES: "15m",
  REFRESH_EXPIRES: "7d",
} as const;

import { getEnv } from "./index.js";

const env = getEnv();

export const RATE_LIMIT = {
  WINDOW_MS: env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000,
  MAX_REQUESTS: env.RATE_LIMIT_MAX_REQUESTS ?? 100,
  SKIP_LOCALHOST: (env.RATE_LIMIT_SKIP_LOCALHOST || "true").toLowerCase() !== "false",
} as const;

export const FILE_UPLOAD = {
  MAX_SIZE: 50 * 1024 * 1024,
  ALLOWED_TYPES: ["application/pdf", "image/*", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  URL_EXPIRY: 300,
} as const;

export const IMAGE_PROCESSING = {
  MAX_WIDTH: 1920,
  QUALITY: 80,
  THUMB_SIZES: [200, 400, 800],
} as const;

export const QUEUES = {
  EMAIL_CONCURRENCY: 10,
  SMS_CONCURRENCY: 5,
  FILE_CONCURRENCY: 3,
  REPORT_CONCURRENCY: 2,
} as const;
