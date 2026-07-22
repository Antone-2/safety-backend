import { Redis } from "ioredis";
import { getEnv } from "../../../config/index.js";

const env = getEnv();
const MINIMUM_BULLMQ_REDIS_MAJOR = 5;

let bullMqSupportChecked = false;
let bullMqSupported = false;
let bullMqRedisVersion: string | null = null;

function isLocalhostRedisUrl(url: string): boolean {
  const normalized = url.replace(/^redis(s?):\/\//i, "").split("/")[0]?.split("?")[0]?.split("@").pop()?.trim() || "";
  if (!normalized) return true;
  const [host] = normalized.split(":");
  if (!host) return true;
  return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(host.toLowerCase());
}

export const redisClient = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy(times: number) {
        if (times > 1) return null;
        return 200;
      },
    })
  : null;

if (redisClient && env.REDIS_URL && isLocalhostRedisUrl(env.REDIS_URL)) {
  console.warn(`REDIS_URL points to ${env.REDIS_URL}; Redis on localhost is not available in this environment. Redis-backed features will remain disabled.`);
}

if (redisClient) {
  let redisErrorLogged = false;

  redisClient.on("error", () => {
    if (!redisErrorLogged) {
      redisErrorLogged = true;
      console.warn("Redis unavailable. Background jobs and rate-limiting will be disabled until Redis is reachable.");
    }
  });

  redisClient.on("connect", () => {
    console.log("Redis client connected");
  });

  redisClient.on("ready", () => {
    redisErrorLogged = false;
  });
}

export async function connectRedis() {
  if (!env.REDIS_URL || !redisClient) {
    console.warn("Redis not configured; rate-limiting and background jobs are disabled.");
    return false;
  }
  if (isLocalhostRedisUrl(env.REDIS_URL)) {
    console.warn("Skipping Redis connection because REDIS_URL points to localhost.");
    return false;
  }
  try {
    if (redisClient.status !== "ready" && redisClient.status !== "connect") {
      await redisClient.connect();
    }
    await redisClient.ping();
    return true;
  } catch {
    return false;
  }
}

function parseRedisVersion(info: string): string | null {
  const match = info.match(/(?:^|\r?\n)redis_version:([^\r\n]+)/);
  return match?.[1]?.trim() || null;
}

function isBullMqCompatibleVersion(version: string | null): boolean {
  if (!version) return false;
  const major = Number.parseInt(version.split(".")[0] || "", 10);
  return Number.isFinite(major) && major >= MINIMUM_BULLMQ_REDIS_MAJOR;
}

export async function supportsBullMq() {
  if (!env.REDIS_URL || !redisClient) {
    bullMqSupportChecked = true;
    bullMqSupported = false;
    bullMqRedisVersion = null;
    return false;
  }

  if (bullMqSupportChecked) {
    return bullMqSupported;
  }

  const connected = await connectRedis();
  if (!connected) {
    bullMqSupportChecked = true;
    bullMqSupported = false;
    return false;
  }

  try {
    const serverInfo = await redisClient.info("server");
    bullMqRedisVersion = parseRedisVersion(serverInfo);
    bullMqSupported = isBullMqCompatibleVersion(bullMqRedisVersion);
    bullMqSupportChecked = true;

    if (!bullMqSupported) {
      console.warn(
        `Redis ${bullMqRedisVersion || "unknown"} detected. BullMQ requires Redis ${MINIMUM_BULLMQ_REDIS_MAJOR}.0.0 or newer; background jobs will stay disabled.`,
      );
    }

    return bullMqSupported;
  } catch {
    bullMqSupportChecked = true;
    bullMqSupported = false;
    return false;
  }
}

export function getBullMqRedisVersion() {
  return bullMqRedisVersion;
}

export async function checkRedis() {
  if (!redisClient) {
    return { name: "redis", ok: false };
  }
  try {
    await redisClient.ping();
    return { name: "redis", ok: true };
  } catch {
    return { name: "redis", ok: false };
  }
}
