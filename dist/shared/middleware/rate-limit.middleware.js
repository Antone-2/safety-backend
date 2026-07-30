import { createHash } from "crypto";
import { redisClient } from "../infrastructure/redis/redis.client.js";
import { RATE_LIMIT } from "../../config/constants.js";
import { getEnv } from "../../config/index.js";
import { logger } from "../utils/logger.js";
let rateLimitRedisUnavailableLogged = false;
const env = getEnv();
let consecutiveRedisFailures = 0;
const REDIS_FAILURE_THRESHOLD = 3;
function isLocalhost(ip) {
    if (!ip)
        return false;
    return (ip === "127.0.0.1" ||
        ip === "::1" ||
        ip === "[::1]" ||
        ip === "::ffff:127.0.0.1" ||
        ip.startsWith("127.") ||
        ip.startsWith("::ffff:127.") ||
        ip.startsWith("10.") ||
        ip.startsWith("192.168.") ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
        ip.startsWith("::ffff:10.") ||
        ip.startsWith("::ffff:192.168.") ||
        /^::ffff:172\.(1[6-9]|2\d|3[01])\./.test(ip));
}
function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
}
function getCookieValue(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return "";
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}
function authIdentityHash(req) {
    const authHeader = req.headers.authorization;
    const bearerToken = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
        ? authHeader.slice("Bearer ".length).trim()
        : "";
    const cookieToken = getCookieValue(req, "ehs_access");
    const raw = bearerToken || cookieToken;
    if (!raw)
        return null;
    return createHash("sha256").update(raw).digest("hex").slice(0, 24);
}
function rateLimitIdentity(req) {
    const authHash = authIdentityHash(req);
    if (authHash) {
        return { scope: "user", value: authHash };
    }
    return { scope: "ip", value: clientIp(req) };
}
export async function rateLimitMiddleware(req, res, next) {
    // In development, honor SKIP_LOCALHOST so local/frontend traffic is never
    // throttled. This avoids the dashboard blowing past the limit during active dev.
    if (env.NODE_ENV === "development" && RATE_LIMIT.SKIP_LOCALHOST) {
        const ip = clientIp(req);
        const origin = req.headers.origin;
        const isLocalOrigin = typeof origin === "string" && /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(origin);
        if (isLocalhost(ip) || isLocalOrigin) {
            return next();
        }
    }
    else if (env.NODE_ENV !== "development" && RATE_LIMIT.SKIP_LOCALHOST) {
        const ip = clientIp(req);
        if (isLocalhost(ip)) {
            return next();
        }
    }
    const identity = rateLimitIdentity(req);
    const routeKey = req.baseUrl || req.path || req.originalUrl || "global";
    const key = `rate-limit:${identity.scope}:${identity.value}:${routeKey}`;
    const windowMs = RATE_LIMIT.WINDOW_MS;
    const maxRequests = RATE_LIMIT.MAX_REQUESTS;
    const ttlSeconds = Math.ceil(windowMs / 1000);
    if (!redisClient || redisClient.status !== "ready") {
        if (!rateLimitRedisUnavailableLogged) {
            rateLimitRedisUnavailableLogged = true;
            logger.warn("Redis unavailable; rate limiting disabled until Redis is reachable.");
        }
        return next();
    }
    try {
        if (consecutiveRedisFailures >= REDIS_FAILURE_THRESHOLD) {
            return next();
        }
        const count = await redisClient.incr(key);
        if (count === 1) {
            await redisClient.expire(key, ttlSeconds);
        }
        consecutiveRedisFailures = 0;
        const remaining = Math.max(0, maxRequests - count);
        res.setHeader("X-RateLimit-Limit", String(maxRequests));
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        res.setHeader("X-RateLimit-Scope", identity.scope);
        if (count > maxRequests) {
            res.setHeader("Retry-After", String(ttlSeconds));
            return res.status(429).json({ error: "Too many requests. Please try again later." });
        }
        next();
    }
    catch {
        consecutiveRedisFailures++;
        if (consecutiveRedisFailures === 1 || consecutiveRedisFailures === REDIS_FAILURE_THRESHOLD) {
            logger.warn({ consecutiveRedisFailures, err: undefined }, "Rate limit check failed, allowing request");
        }
        next();
    }
}
