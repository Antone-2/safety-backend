import { Redis } from "ioredis";
import { getEnv } from "../../../config/index.js";
const env = getEnv();
export const MINIMUM_BULLMQ_REDIS_MAJOR = 5;
let bullMqSupportChecked = false;
let bullMqSupported = false;
let bullMqRedisVersion = null;
export class RedisRequiredError extends Error {
    constructor(message) {
        super(message);
        this.name = "RedisRequiredError";
    }
}
export class RedisVersionUnsupportedError extends Error {
    constructor(message) {
        super(message);
        this.name = "RedisVersionUnsupportedError";
    }
}
export function isRedisRequired() {
    return env.REQUIRE_REDIS === "true" && env.NODE_ENV === "production";
}
export const redisClient = env.REDIS_URL
    ? new Redis(env.REDIS_URL, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
        retryStrategy(times) {
            if (times > 1)
                return null;
            return 200;
        },
    })
    : null;
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
    try {
        if (redisClient.status !== "ready" && redisClient.status !== "connect") {
            await redisClient.connect();
        }
        await redisClient.ping();
        return true;
    }
    catch {
        return false;
    }
}
function parseRedisVersion(info) {
    const match = info.match(/(?:^|\r?\n)redis_version:([^\r\n]+)/);
    return match?.[1]?.trim() || null;
}
function isBullMqCompatibleVersion(version) {
    if (!version)
        return false;
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
            console.warn(`Redis ${bullMqRedisVersion || "unknown"} detected. BullMQ requires Redis ${MINIMUM_BULLMQ_REDIS_MAJOR}.0.0 or newer; background jobs will stay disabled.`);
        }
        return bullMqSupported;
    }
    catch {
        bullMqSupportChecked = true;
        bullMqSupported = false;
        return false;
    }
}
export function getBullMqRedisVersion() {
    return bullMqRedisVersion;
}
export async function ensureRedisProductionReady() {
    if (!isRedisRequired()) {
        return { connected: false, bullMqReady: false };
    }
    if (!env.REDIS_URL || !redisClient) {
        throw new RedisRequiredError("REDIS_URL is required when REQUIRE_REDIS=true");
    }
    const connected = await connectRedis();
    if (!connected) {
        throw new RedisRequiredError("Redis is required but could not be reached at the configured REDIS_URL.");
    }
    const bullMqReady = await supportsBullMq();
    if (!bullMqReady) {
        throw new RedisVersionUnsupportedError(`Redis ${bullMqRedisVersion || "unknown"} detected. BullMQ requires Redis ${MINIMUM_BULLMQ_REDIS_MAJOR}.0.0 or newer.`);
    }
    return { connected: true, bullMqReady: true };
}
export async function checkRedis() {
    if (!redisClient) {
        return { name: "redis", ok: false };
    }
    try {
        await redisClient.ping();
        return { name: "redis", ok: true };
    }
    catch {
        return { name: "redis", ok: false };
    }
}
