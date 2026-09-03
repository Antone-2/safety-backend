import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "../../config/index.js";
import { logger } from "../utils/logger.js";
import { hasPermission, recordAuthFailure } from "./rbac.middleware.js";
import { allRows, getDb } from "../../lib/database.js";
import { pgPool } from "../infrastructure/database/postgres.client.js";
import { isJwtDenylisted } from "./jwt-denylist.middleware.js";
export function getCookieValue(req, name) {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader)
        return "";
    const cookie = cookieHeader
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}
const JWT_SECRET = getEnv().JWT_SECRET;
const SESSION_TOUCH_INTERVAL_MS = 60_000;
const sessionLastTouchedAt = new Map();
function isPgConfigured() {
    return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}
function legacySessionFingerprint(req) {
    return createHash("sha256")
        .update(`${req.get("user-agent") || "unknown"}:${req.ip || req.socket.remoteAddress || "unknown"}`)
        .digest("hex");
}
function sessionFingerprint(req) {
    const userAgent = req.get("user-agent") || "unknown";
    const language = req.get("accept-language") || "unknown";
    const platform = req.get("sec-ch-ua-platform") || "unknown";
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    return createHash("sha256")
        .update(`${userAgent}:${language}:${platform}:${ip}`)
        .digest("hex");
}
function shouldTouchSession(sessionId, now = Date.now()) {
    const lastTouchedAt = sessionLastTouchedAt.get(sessionId) ?? 0;
    if (now - lastTouchedAt < SESSION_TOUCH_INTERVAL_MS) {
        return false;
    }
    sessionLastTouchedAt.set(sessionId, now);
    if (sessionLastTouchedAt.size > 20_000) {
        const staleBefore = now - SESSION_TOUCH_INTERVAL_MS * 5;
        for (const [key, touchedAt] of sessionLastTouchedAt.entries()) {
            if (touchedAt < staleBefore) {
                sessionLastTouchedAt.delete(key);
            }
        }
    }
    return true;
}
function getConfiguredDemoIdentity() {
    if (process.env.ENABLE_DEMO_LOGIN !== "true")
        return null;
    const email = (process.env.DEMO_EMAIL || "").trim().toLowerCase();
    if (!email)
        return null;
    return {
        id: "demo-user",
        email,
        name: process.env.DEMO_NAME?.trim() || "Demo User",
        role: process.env.DEMO_ROLE?.trim() || "EHS-manager",
        jti: "demo-session",
    };
}
export async function authenticateUser(req, res, next) {
    if (req.user?.id && req.user?.jti)
        return next();
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : getCookieValue(req, "ehs_access") || (typeof req.query.token === "string" ? req.query.token : "");
    if (!token) {
        return res
            .status(401)
            .json({ error: "Missing or invalid authorization header" });
    }
    const demoIdentity = getConfiguredDemoIdentity();
    if (token === "demo-token" && demoIdentity) {
        req.user = demoIdentity;
        return next();
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded
            ? { ...decoded, id: decoded.id || decoded.userId || "" }
            : decoded;
        if (!decoded?.jti)
            return res.status(401).json({ error: "Session is invalid" });
        if (decoded.exp && await isJwtDenylisted(decoded.jti)) {
            return res.status(401).json({ error: "Session has been revoked" });
        }
        if (decoded.type === "offline-dev-session" &&
            getEnv().NODE_ENV !== "production") {
            return next();
        }
        let session;
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT id, device_fingerprint, user_agent, ip_address
           FROM auth_sessions
           WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()
           LIMIT 1`, [decoded.jti]);
                session = result.rows[0];
            }
            catch {
                // Fall through to the local SQLite store when Postgres is unavailable.
            }
        }
        if (!session) {
            const db = await getDb();
            session = allRows(db, "SELECT id, deviceFingerprint AS deviceFingerprint, userAgent AS userAgent, ipAddress AS ipAddress FROM auth_sessions WHERE id = ? AND revokedAt IS NULL AND expiresAt > ?", [decoded.jti, new Date().toISOString()])[0];
        }
        if (!session)
            return res
                .status(401)
                .json({ error: "Session has expired or was revoked" });
        const fingerprint = sessionFingerprint(req);
        const legacyFingerprint = legacySessionFingerprint(req);
        const storedFingerprint = session.device_fingerprint ?? session.deviceFingerprint;
        const storedUserAgent = session.user_agent ?? session.userAgent;
        const storedIp = session.ip_address ?? session.ipAddress;
        const currentIp = req.ip || req.socket.remoteAddress || "unknown";
        if (storedFingerprint &&
            storedFingerprint !== fingerprint &&
            storedFingerprint !== legacyFingerprint &&
            storedUserAgent !== (req.get("user-agent") || "")) {
            return res.status(401).json({ error: "Session device changed. Please sign in again." });
        }
        if (storedIp && storedIp !== currentIp) {
            logger.warn({
                sessionId: decoded.jti,
                storedIp,
                currentIp,
            }, "Authenticated session IP changed");
        }
        const touchSession = shouldTouchSession(decoded.jti);
        if (touchSession && isPgConfigured()) {
            await pgPool
                .query(`UPDATE auth_sessions
           SET last_seen_at = NOW()
           WHERE id = $1 AND revoked_at IS NULL`, [decoded.jti])
                .catch(() => undefined);
        }
        else if (touchSession) {
            const db = await getDb();
            db.prepare("UPDATE auth_sessions SET lastSeenAt = ? WHERE id = ? AND revokedAt IS NULL").run([new Date().toISOString(), decoded.jti]);
        }
        next();
    }
    catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}
export function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (hasPermission(req.user.role, permission)) {
            return next();
        }
        await recordAuthFailure(req, permission, 403);
        return res.status(403).json({
            error: "Forbidden: insufficient permissions",
            permission,
        });
    };
}
export function requireRole(allowedRoles) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        if (allowedRoles.includes(req.user.role)) {
            return next();
        }
        await recordAuthFailure(req, `role:${req.user.role}`, 403);
        return res.status(403).json({
            error: "Forbidden: insufficient permissions",
        });
    };
}
