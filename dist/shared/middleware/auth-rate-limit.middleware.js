import { redisClient } from "../infrastructure/redis/redis.client.js";
import { getEnv } from "../../config/index.js";
import { logger } from "../utils/logger.js";
import { pgPool } from "../infrastructure/database/postgres.client.js";
const env = getEnv();
const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_RATE_LIMIT_MAX = 10;
const AUTH_RATE_LIMIT_LOCKOUT_MS = 30 * 60 * 1000;
function getEmailFromRequest(req) {
    if (req.body && typeof req.body === "object" && "email" in req.body) {
        const value = req.body.email;
        if (typeof value === "string")
            return value.trim().toLowerCase();
    }
    return undefined;
}
function getAuthRateLimitKey(email) {
    return `auth-rate-limit:${email}`;
}
function getAuthLockoutKey(email) {
    return `auth-lockout:${email}`;
}
async function isLockedOut(email) {
    const lockoutKey = getAuthLockoutKey(email);
    if (redisClient && redisClient.status === "ready") {
        const locked = await redisClient.get(lockoutKey);
        if (locked === "1")
            return true;
    }
    else {
        try {
            const result = await pgPool.query("SELECT locked_until FROM auth_rate_limits WHERE email = $1 AND locked_until > NOW()", [email]);
            if (result.rows[0])
                return true;
        }
        catch {
            // Ignore DB fallback errors
        }
    }
    return false;
}
async function recordFailedAttempt(email) {
    const rateKey = getAuthRateLimitKey(email);
    const lockoutKey = getAuthLockoutKey(email);
    const windowSeconds = Math.ceil(AUTH_RATE_LIMIT_WINDOW_MS / 1000);
    if (redisClient && redisClient.status === "ready") {
        const count = await redisClient.incr(rateKey);
        if (count === 1) {
            await redisClient.expire(rateKey, windowSeconds);
        }
        if (count >= AUTH_RATE_LIMIT_MAX) {
            await redisClient.setex(lockoutKey, AUTH_RATE_LIMIT_LOCKOUT_MS / 1000, "1");
            await redisClient.del(rateKey);
        }
    }
    else {
        try {
            await pgPool.query(`INSERT INTO auth_rate_limits (email, attempts, locked_until, last_attempt_at)
         VALUES ($1, 1, NOW() + INTERVAL '30 minutes', NOW())
         ON CONFLICT (email) DO UPDATE SET
           attempts = auth_rate_limits.attempts + 1,
           last_attempt_at = NOW(),
           locked_until = CASE
             WHEN auth_rate_limits.attempts + 1 >= $2 THEN NOW() + INTERVAL '30 minutes'
             ELSE auth_rate_limits.locked_until
           END`, [email, AUTH_RATE_LIMIT_MAX]);
        }
        catch (error) {
            logger.warn({ err: error }, "Failed to record auth rate limit in DB");
        }
    }
}
export async function authRateLimitMiddleware(req, res, next) {
    const email = getEmailFromRequest(req);
    if (!email)
        return next();
    if (await isLockedOut(email)) {
        return res.status(429).json({
            error: "Too many failed attempts. Try again later.",
            code: "AUTH_LOCKOUT",
        });
    }
    res.setHeader("X-Auth-RateLimit-Max", String(AUTH_RATE_LIMIT_MAX));
    res.setHeader("X-Auth-RateLimit-Window-Minutes", String(AUTH_RATE_LIMIT_WINDOW_MS / 60000));
    next();
}
export async function recordAuthFailure(req) {
    const email = getEmailFromRequest(req);
    if (!email)
        return;
    await recordFailedAttempt(email);
}
export function clearAuthRateLimit(email) {
    const rateKey = getAuthRateLimitKey(email);
    const lockoutKey = getAuthLockoutKey(email);
    if (redisClient && redisClient.status === "ready") {
        void redisClient.del(rateKey, lockoutKey);
    }
    else {
        void pgPool.query("DELETE FROM auth_rate_limits WHERE email = $1", [email]).catch(() => undefined);
    }
}
