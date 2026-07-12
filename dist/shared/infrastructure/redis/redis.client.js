import { createClient } from "redis";
import { getEnv } from "../../../config/index.js";
import { logger } from "../../utils/logger.js";
const env = getEnv();
export const redisClient = createClient({
    url: env.REDIS_URL,
});
let redisErrorLogged = false;
redisClient.on("error", (err) => {
    // Only log the first connection error to avoid spamming the console
    // when Redis is not running. The server runs in degraded mode without it.
    if (!redisErrorLogged) {
        redisErrorLogged = true;
        logger.warn({ err }, "Redis unavailable. Background jobs/rate-limiting will be disabled until Redis is reachable.");
    }
});
redisClient.on("connect", () => {
    logger.info("Redis client connected");
});
export async function connectRedis() {
    if (!env.REDIS_URL) {
        logger.warn("Redis not configured; set REDIS_URL to enable Redis-backed features.");
        return;
    }
    if (!redisClient.isOpen) {
        try {
            await redisClient.connect();
        }
        catch {
            // Non-fatal: the API can run without Redis (degraded mode).
        }
    }
}
export async function checkRedis() {
    try {
        await redisClient.ping();
        return { name: "redis", ok: true };
    }
    catch {
        return { name: "redis", ok: false };
    }
}
