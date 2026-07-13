import jwt from "jsonwebtoken";
import { getEnv } from "../../config/index.js";
import { hasPermission, recordAuthFailure } from "./rbac.middleware.js";
import { allRows, getDb } from "../../lib/database.js";
import { pgPool } from "../infrastructure/database/postgres.client.js";
const JWT_SECRET = getEnv().JWT_SECRET;
function isPgConfigured() {
    return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}
export async function authenticateUser(req, res, next) {
    if (req.user?.id && req.user?.jti)
        return next();
    const authHeader = req.headers.authorization;
    const queryToken = typeof req.query.access_token === "string" ? req.query.access_token : "";
    if (!authHeader?.startsWith("Bearer ") && !queryToken) {
        return res
            .status(401)
            .json({ error: "Missing or invalid authorization header" });
    }
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : queryToken;
    if (!token) {
        return res
            .status(401)
            .json({ error: "Missing or invalid authorization header" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded
            ? { ...decoded, id: decoded.id || decoded.userId || "" }
            : decoded;
        if (!decoded?.jti)
            return res.status(401).json({ error: "Session is invalid" });
        let session;
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query("SELECT id FROM auth_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1", [decoded.jti]);
                session = result.rows[0];
            }
            catch {
                // Fall through to the local SQLite store when Postgres is unavailable.
            }
        }
        if (!session) {
            const db = await getDb();
            session = allRows(db, "SELECT id FROM auth_sessions WHERE id = ? AND revokedAt IS NULL AND expiresAt > ?", [decoded.jti, new Date().toISOString()])[0];
        }
        if (!session)
            return res
                .status(401)
                .json({ error: "Session has expired or was revoked" });
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
