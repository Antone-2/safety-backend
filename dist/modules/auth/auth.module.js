import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createHash, randomBytes, randomInt } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { LoginSchema, CreateUserSchema, OtpRequestSchema, OtpVerifySchema, } from "./auth.types.js";
import { getEnv } from "../../config/index.js";
import { ConflictError } from "../../shared/domain/errors/index.js";
import { isFirebaseAvailable, getFirebase, sanitizeForFirestore, } from "../../shared/integrations/firebase/firebase.client.js";
import { authenticateUser, requireRole, } from "../../shared/middleware/auth.middleware.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { allRows, getDb, saveDb } from "../../lib/database.js";
import { sendOtpEmail } from "../../lib/email.js";
const OTP_TTL_MINUTES = Number(process.env.AUTH_OTP_TTL_MINUTES || 10);
const OTP_MAX_ATTEMPTS = Number(process.env.AUTH_OTP_MAX_ATTEMPTS || 5);
const PRIVILEGED_BOOTSTRAP_ROLES = ["super-admin", "EHS-manager"];
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.AUTH_OTP_RESEND_COOLDOWN_SECONDS || 60);
const OTP_REQUEST_WINDOW_MINUTES = Number(process.env.AUTH_OTP_REQUEST_WINDOW_MINUTES || 15);
const OTP_MAX_REQUESTS_PER_EMAIL = Number(process.env.AUTH_OTP_MAX_REQUESTS_PER_EMAIL || 5);
const OTP_MAX_REQUESTS_PER_IP = Number(process.env.AUTH_OTP_MAX_REQUESTS_PER_IP || 20);
const OTP_MAX_REQUESTS_PER_DEVICE = Number(process.env.AUTH_OTP_MAX_REQUESTS_PER_DEVICE || 10);
const MAX_ACTIVE_SESSIONS_PER_USER = Number(process.env.AUTH_MAX_ACTIVE_SESSIONS_PER_USER || 5);
function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
function hashOtp(email, code) {
    return createHash("sha256")
        .update(`${normalizeEmail(email)}:${code}:${process.env.JWT_SECRET || ""}`)
        .digest("hex");
}
function clientIp(req) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.length > 0) {
        return forwarded.split(",")[0].trim();
    }
    return req.ip || req.socket.remoteAddress || "unknown";
}
function deviceFingerprint(req) {
    return createHash("sha256")
        .update(`${req.get("user-agent") || "unknown"}:${clientIp(req)}`)
        .digest("hex");
}
function isPgConfigured() {
    return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}
function publicUser(user) {
    return { id: user.id, email: user.email, name: user.name, role: user.role };
}
export function createAuthRouter() {
    const router = Router();
    const env = getEnv();
    const JWT_SECRET = env.JWT_SECRET;
    function generateToken(user, sessionId = randomBytes(16).toString("hex")) {
        return jwt.sign({
            id: user.id,
            userId: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            jti: sessionId,
        }, JWT_SECRET, { expiresIn: "15m" });
    }
    async function audit(req, event, email, successful, userId, detail) {
        if (isPgConfigured()) {
            try {
                await pgPool.query(`INSERT INTO auth_login_audit (user_id, email, event, successful, ip_address, user_agent, detail)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    userId ?? null,
                    email,
                    event,
                    successful,
                    req.ip ?? "",
                    req.get("user-agent") ?? "",
                    detail ?? null,
                ]);
                return;
            }
            catch {
                // Fall through to SQLite fallback when Postgres is unavailable.
            }
        }
        const db = await getDb();
        db.prepare("INSERT INTO auth_login_audit (id, userId, email, event, successful, ipAddress, userAgent, detail, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run([
            uuidv4(),
            userId ?? null,
            email,
            event,
            successful ? 1 : 0,
            req.ip ?? "",
            req.get("user-agent") ?? "",
            detail ?? null,
            new Date().toISOString(),
        ]);
        await saveDb(db);
    }
    async function getOtpChallenge(email) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT email, code_hash AS "codeHash", user_id::text AS "userId", expires_at AS "expiresAt",
                  attempts, requested_at AS "requestedAt", request_count AS "requestCount"
           FROM auth_otp_challenges
           WHERE email = $1
           LIMIT 1`, [email]);
                return result.rows[0];
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT * FROM auth_otp_challenges WHERE email = ?", [
            email,
        ])[0];
    }
    async function saveOtpChallenge(email, codeHash, userId, expiresAt, requestedAt) {
        if (isPgConfigured()) {
            try {
                await pgPool.query(`INSERT INTO auth_otp_challenges (email, code_hash, user_id, expires_at, attempts, requested_at, request_count)
           VALUES ($1, $2, $3, $4, 0, $5, 1)
           ON CONFLICT (email) DO UPDATE SET
             code_hash = EXCLUDED.code_hash,
             user_id = EXCLUDED.user_id,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             requested_at = EXCLUDED.requested_at,
             request_count = auth_otp_challenges.request_count + 1`, [email, codeHash, userId, expiresAt, requestedAt]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("INSERT OR REPLACE INTO auth_otp_challenges (email, codeHash, userId, expiresAt, attempts, requestedAt, requestCount) VALUES (?, ?, ?, ?, 0, ?, COALESCE((SELECT requestCount + 1 FROM auth_otp_challenges WHERE email = ?), 1))").run([email, codeHash, userId, expiresAt, requestedAt, email]);
        await saveDb(db);
    }
    async function deleteOtpChallenge(email) {
        if (isPgConfigured()) {
            try {
                await pgPool.query("DELETE FROM auth_otp_challenges WHERE email = $1", [
                    email,
                ]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("DELETE FROM auth_otp_challenges WHERE email = ?").run([email]);
        await saveDb(db);
    }
    async function incrementOtpAttempts(email) {
        if (isPgConfigured()) {
            try {
                await pgPool.query("UPDATE auth_otp_challenges SET attempts = attempts + 1 WHERE email = $1", [email]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("UPDATE auth_otp_challenges SET attempts = attempts + 1 WHERE email = ?").run([email]);
        await saveDb(db);
    }
    async function enforceAuthRateLimit(input) {
        const nowDate = new Date();
        const windowMs = input.windowMinutes * 60000;
        const blockedUntil = new Date(nowDate.getTime() + windowMs).toISOString();
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT count, first_seen_at AS "firstSeenAt", blocked_until AS "blockedUntil"
           FROM auth_rate_limits
           WHERE scope = $1 AND identifier = $2 AND action = $3
           LIMIT 1`, [input.scope, input.identifier, input.action]);
                const row = result.rows[0];
                if (row?.blockedUntil && Date.parse(row.blockedUntil) > Date.now()) {
                    return {
                        allowed: false,
                        retryAfter: Math.ceil((Date.parse(row.blockedUntil) - Date.now()) / 1000),
                    };
                }
                const firstSeen = row?.firstSeenAt ? Date.parse(row.firstSeenAt) : 0;
                const shouldReset = !row || Date.now() - firstSeen > windowMs;
                const nextCount = shouldReset ? 1 : Number(row.count || 0) + 1;
                const nextBlockedUntil = nextCount > input.max ? blockedUntil : null;
                await pgPool.query(`INSERT INTO auth_rate_limits (scope, identifier, action, count, first_seen_at, last_seen_at, blocked_until)
           VALUES ($1, $2, $3, $4, NOW(), NOW(), $5)
           ON CONFLICT (scope, identifier, action) DO UPDATE SET
             count = $4,
             first_seen_at = CASE WHEN $6 THEN NOW() ELSE auth_rate_limits.first_seen_at END,
             last_seen_at = NOW(),
             blocked_until = $5`, [
                    input.scope,
                    input.identifier,
                    input.action,
                    nextCount,
                    nextBlockedUntil,
                    shouldReset,
                ]);
                return {
                    allowed: nextCount <= input.max,
                    retryAfter: nextBlockedUntil ? input.windowMinutes * 60 : 0,
                };
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        const row = allRows(db, "SELECT * FROM auth_rate_limits WHERE scope = ? AND identifier = ? AND action = ?", [input.scope, input.identifier, input.action])[0];
        if (row?.blockedUntil && Date.parse(row.blockedUntil) > Date.now()) {
            return {
                allowed: false,
                retryAfter: Math.ceil((Date.parse(row.blockedUntil) - Date.now()) / 1000),
            };
        }
        const firstSeen = row?.firstSeenAt ? Date.parse(row.firstSeenAt) : 0;
        const shouldReset = !row || Date.now() - firstSeen > windowMs;
        const nextCount = shouldReset ? 1 : Number(row.count || 0) + 1;
        const nextBlockedUntil = nextCount > input.max ? blockedUntil : null;
        db.prepare(`INSERT OR REPLACE INTO auth_rate_limits
       (id, scope, identifier, action, count, firstSeenAt, lastSeenAt, blockedUntil)
       VALUES (COALESCE((SELECT id FROM auth_rate_limits WHERE scope = ? AND identifier = ? AND action = ?), ?), ?, ?, ?, ?, ?, ?, ?)`).run([
            input.scope,
            input.identifier,
            input.action,
            uuidv4(),
            input.scope,
            input.identifier,
            input.action,
            nextCount,
            shouldReset || !row ? nowDate.toISOString() : row.firstSeenAt,
            nowDate.toISOString(),
            nextBlockedUntil,
        ]);
        await saveDb(db);
        return {
            allowed: nextCount <= input.max,
            retryAfter: nextBlockedUntil ? input.windowMinutes * 60 : 0,
        };
    }
    async function createAuthSession(input) {
        if (isPgConfigured()) {
            try {
                await pgPool.query(`INSERT INTO auth_sessions (id, user_id, email, expires_at, ip_address, user_agent, refresh_hash)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`, [
                    input.id,
                    input.userId,
                    input.email,
                    input.expiresAt,
                    input.ipAddress,
                    input.userAgent,
                    input.refreshHash,
                ]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("INSERT INTO auth_sessions (id, userId, email, createdAt, expiresAt, ipAddress, userAgent, refreshHash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run([
            input.id,
            input.userId,
            input.email,
            new Date().toISOString(),
            input.expiresAt,
            input.ipAddress,
            input.userAgent,
            input.refreshHash,
        ]);
        await saveDb(db);
    }
    async function getSessionByRefreshHash(refreshHash) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT id, user_id::text AS "userId", email
           FROM auth_sessions
           WHERE refresh_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
           LIMIT 1`, [refreshHash]);
                return result.rows[0];
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT * FROM auth_sessions WHERE refreshHash = ? AND revokedAt IS NULL AND expiresAt > ?", [refreshHash, new Date().toISOString()])[0];
    }
    async function listAuthSessions(userId) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT id, created_at AS "createdAt", expires_at AS "expiresAt", ip_address AS "ipAddress", user_agent AS "userAgent"
           FROM auth_sessions
           WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
           ORDER BY created_at DESC`, [userId]);
                return result.rows;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT id, createdAt, expiresAt, ipAddress, userAgent FROM auth_sessions WHERE userId = ? AND revokedAt IS NULL AND expiresAt > ? ORDER BY createdAt DESC", [userId, new Date().toISOString()]);
    }
    async function listLoginHistory(userId, email) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT id::text, event, successful, ip_address AS "ipAddress", user_agent AS "userAgent", detail, created_at AS "createdAt"
           FROM auth_login_audit
           WHERE user_id = $1 OR lower(email) = $2
           ORDER BY created_at DESC
           LIMIT 25`, [userId, normalizeEmail(email)]);
                return result.rows;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT id, event, successful, ipAddress, userAgent, detail, createdAt FROM auth_login_audit WHERE userId = ? OR email = ? ORDER BY createdAt DESC LIMIT 25", [userId, email]);
    }
    async function revokeSession(sessionId, userId) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            try {
                await pgPool.query("UPDATE auth_sessions SET revoked_at = $1 WHERE id = $2 AND user_id = $3", [now, sessionId, userId]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE id = ? AND userId = ?").run([now, sessionId, userId]);
        await saveDb(db);
    }
    async function revokeUserSessions(userId) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            try {
                await pgPool.query("UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [now, userId]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run([now, userId]);
        await saveDb(db);
    }
    async function enforceSessionLimit(userId) {
        const sessions = await listAuthSessions(userId);
        if (sessions.length <= MAX_ACTIVE_SESSIONS_PER_USER)
            return;
        const excess = sessions.slice(MAX_ACTIVE_SESSIONS_PER_USER);
        for (const session of excess) {
            await revokeSession(String(session.id), userId);
        }
    }
    async function requestAccountDeactivation(userId) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            try {
                await pgPool.query(`INSERT INTO user_preferences (user_id, preferences, deactivation_requested_at, updated_at)
           VALUES ($1, '{}'::jsonb, $2, $2)
           ON CONFLICT (user_id) DO UPDATE SET
             deactivation_requested_at = EXCLUDED.deactivation_requested_at,
             updated_at = EXCLUDED.updated_at`, [userId, now]);
                return now;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("INSERT INTO user_preferences (userId, preferences, deactivationRequestedAt, updatedAt) VALUES (?, '{}', ?, ?) ON CONFLICT(userId) DO UPDATE SET deactivationRequestedAt = excluded.deactivationRequestedAt, updatedAt = excluded.updatedAt").run([userId, now, now]);
        await saveDb(db);
        return now;
    }
    async function listDeactivationRequests() {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT u.id::text, u.email, u.name, u.role, p.deactivation_requested_at AS "deactivationRequestedAt"
           FROM user_preferences p
           JOIN users u ON u.id = p.user_id
           WHERE p.deactivation_requested_at IS NOT NULL AND u.active = TRUE
           ORDER BY p.deactivation_requested_at ASC`);
                return result.rows;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT u.id, u.email, u.name, u.role, p.deactivationRequestedAt FROM user_preferences p JOIN users u ON u.id = p.userId WHERE p.deactivationRequestedAt IS NOT NULL AND u.active = 1 ORDER BY p.deactivationRequestedAt ASC");
    }
    async function clearDeactivationRequest(userId) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            try {
                await pgPool.query("UPDATE user_preferences SET deactivation_requested_at = NULL, updated_at = $1 WHERE user_id = $2", [now, userId]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("UPDATE user_preferences SET deactivationRequestedAt = NULL, updatedAt = ? WHERE userId = ?").run([now, userId]);
        await saveDb(db);
    }
    async function approveDeactivationRequest(userId) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            const client = await pgPool.connect().catch(() => null);
            try {
                if (!client)
                    throw new Error("PostgreSQL unavailable");
                const request = await client.query("SELECT user_id FROM user_preferences WHERE user_id = $1 AND deactivation_requested_at IS NOT NULL", [userId]);
                if ((request.rowCount ?? 0) === 0)
                    return false;
                await client.query("BEGIN");
                await client.query("UPDATE users SET active = FALSE, updated_at = NOW() WHERE id = $1", [userId]);
                await client.query("UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [now, userId]);
                await client.query("UPDATE user_preferences SET deactivation_requested_at = NULL, updated_at = $1 WHERE user_id = $2", [now, userId]);
                await client.query("COMMIT");
                return true;
            }
            catch {
                try {
                    await client?.query("ROLLBACK");
                }
                catch {
                    // Ignore rollback failures and use SQLite fallback.
                }
            }
            finally {
                client?.release();
            }
        }
        const db = await getDb();
        const request = allRows(db, "SELECT userId FROM user_preferences WHERE userId = ? AND deactivationRequestedAt IS NOT NULL", [userId])[0];
        if (!request)
            return false;
        db.prepare("UPDATE users SET active = 0 WHERE id = ?").run([userId]);
        db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run([now, userId]);
        db.prepare("UPDATE user_preferences SET deactivationRequestedAt = NULL, updatedAt = ? WHERE userId = ?").run([now, userId]);
        await saveDb(db);
        return true;
    }
    async function getUserPreferences(userId) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT preferences, avatar_url AS "avatarUrl", deactivation_requested_at AS "deactivationRequestedAt"
           FROM user_preferences
           WHERE user_id = $1`, [userId]);
                const row = result.rows[0];
                return {
                    preferences: row?.preferences ?? {},
                    avatarUrl: row?.avatarUrl ?? null,
                    deactivationRequestedAt: row?.deactivationRequestedAt ?? null,
                };
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        const row = allRows(db, "SELECT preferences, avatarUrl, deactivationRequestedAt FROM user_preferences WHERE userId = ?", [userId])[0];
        let preferences = {};
        try {
            preferences = row?.preferences ? JSON.parse(row.preferences) : {};
        }
        catch {
            preferences = {};
        }
        return {
            preferences,
            avatarUrl: row?.avatarUrl ?? null,
            deactivationRequestedAt: row?.deactivationRequestedAt ?? null,
        };
    }
    async function saveUserPreferences(userId, preferences, avatarUrl) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`INSERT INTO user_preferences (user_id, preferences, avatar_url, updated_at)
           VALUES ($1, $2::jsonb, $3, $4)
           ON CONFLICT (user_id) DO UPDATE SET
             preferences = EXCLUDED.preferences,
             avatar_url = COALESCE(EXCLUDED.avatar_url, user_preferences.avatar_url),
             updated_at = EXCLUDED.updated_at
           RETURNING preferences, avatar_url AS "avatarUrl"`, [userId, JSON.stringify(preferences), avatarUrl, now]);
                return {
                    preferences: result.rows[0]?.preferences ?? preferences,
                    avatarUrl: result.rows[0]?.avatarUrl ?? avatarUrl,
                };
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("INSERT INTO user_preferences (userId, preferences, avatarUrl, updatedAt) VALUES (?, ?, ?, ?) ON CONFLICT(userId) DO UPDATE SET preferences = excluded.preferences, avatarUrl = COALESCE(excluded.avatarUrl, user_preferences.avatarUrl), updatedAt = excluded.updatedAt").run([userId, JSON.stringify(preferences), avatarUrl, now]);
        await saveDb(db);
        return { preferences, avatarUrl };
    }
    async function saveEmailChangeChallenge(input) {
        if (isPgConfigured()) {
            try {
                await pgPool.query(`INSERT INTO auth_email_changes (user_id, new_email, code_hash, expires_at, attempts, requested_at)
           VALUES ($1, $2, $3, $4, 0, $5)
           ON CONFLICT (user_id) DO UPDATE SET
             new_email = EXCLUDED.new_email,
             code_hash = EXCLUDED.code_hash,
             expires_at = EXCLUDED.expires_at,
             attempts = 0,
             requested_at = EXCLUDED.requested_at`, [
                    input.userId,
                    input.newEmail,
                    input.codeHash,
                    input.expiresAt,
                    input.requestedAt,
                ]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("INSERT OR REPLACE INTO auth_email_changes (userId, newEmail, codeHash, expiresAt, attempts, requestedAt) VALUES (?, ?, ?, ?, 0, ?)").run([
            input.userId,
            input.newEmail,
            input.codeHash,
            input.expiresAt,
            input.requestedAt,
        ]);
        await saveDb(db);
    }
    async function getEmailChangeChallenge(userId) {
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT user_id::text AS "userId", new_email AS "newEmail", code_hash AS "codeHash",
                  expires_at AS "expiresAt", attempts, requested_at AS "requestedAt"
           FROM auth_email_changes
           WHERE user_id = $1
           LIMIT 1`, [userId]);
                return result.rows[0];
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        return allRows(db, "SELECT * FROM auth_email_changes WHERE userId = ?", [
            userId,
        ])[0];
    }
    async function incrementEmailChangeAttempts(userId) {
        if (isPgConfigured()) {
            try {
                await pgPool.query("UPDATE auth_email_changes SET attempts = attempts + 1 WHERE user_id = $1", [userId]);
                return;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        db.prepare("UPDATE auth_email_changes SET attempts = attempts + 1 WHERE userId = ?").run([userId]);
        await saveDb(db);
    }
    async function completeEmailChange(userId, newEmail) {
        const now = new Date().toISOString();
        if (isPgConfigured()) {
            const client = await pgPool.connect().catch(() => null);
            try {
                if (!client)
                    throw new Error("PostgreSQL unavailable");
                await client.query("BEGIN");
                await client.query("UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2", [newEmail, userId]);
                await client.query("DELETE FROM auth_email_changes WHERE user_id = $1", [userId]);
                await client.query("UPDATE auth_sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [now, userId]);
                await client.query("COMMIT");
                return;
            }
            catch {
                try {
                    await client?.query("ROLLBACK");
                }
                catch {
                    // Ignore rollback failures and use SQLite fallback.
                }
            }
            finally {
                client?.release();
            }
        }
        const db = await getDb();
        db.prepare("UPDATE users SET email = ? WHERE id = ?").run([
            newEmail,
            userId,
        ]);
        db.prepare("DELETE FROM auth_email_changes WHERE userId = ?").run([userId]);
        db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run([now, userId]);
        await saveDb(db);
    }
    function getDemoUser(password) {
        if (env.ENABLE_DEMO_LOGIN !== "true" ||
            !env.DEMO_EMAIL ||
            !env.DEMO_PASSWORD)
            return null;
        if (password !== env.DEMO_PASSWORD)
            return null;
        return {
            id: "local-demo",
            email: env.DEMO_EMAIL,
            name: env.DEMO_NAME || "Demo User",
            role: env.DEMO_ROLE || "EHS-manager",
        };
    }
    async function findUserByEmail(email) {
        const normalized = normalizeEmail(email);
        if (env.ENABLE_DEMO_LOGIN === "true" &&
            env.DEMO_EMAIL &&
            normalized === normalizeEmail(env.DEMO_EMAIL)) {
            return {
                id: "local-demo",
                email: normalizeEmail(env.DEMO_EMAIL),
                name: env.DEMO_NAME || "Demo User",
                role: env.DEMO_ROLE || "EHS-manager",
            };
        }
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const snap = await db
                .collection("users")
                .where("email", "==", normalized)
                .limit(1)
                .get();
            if (snap.empty)
                return null;
            const data = snap.docs[0].data();
            return {
                id: snap.docs[0].id,
                email: data.email,
                name: data.name,
                role: data.role,
            };
        }
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query("SELECT id::text, email, name, role, phone, site, department FROM users WHERE lower(email) = $1 AND active = TRUE LIMIT 1", [normalized]);
                const row = result.rows[0];
                return row
                    ? { id: row.id, email: row.email, name: row.name, role: row.role }
                    : null;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        try {
            const db = await getDb();
            const rows = allRows(db, "SELECT id, email, name, role, phone FROM users WHERE lower(email) = ? AND active = 1 LIMIT 1", [normalized]);
            const row = rows[0];
            return row
                ? {
                    id: String(row.id),
                    email: row.email,
                    name: row.name,
                    role: row.role,
                }
                : null;
        }
        catch {
            return null;
        }
    }
    async function createManagedUser(input) {
        const email = normalizeEmail(input.email);
        const role = input.role || "depot-admin";
        const placeholderHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);
        const createdAt = new Date().toISOString();
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const existing = await db
                .collection("users")
                .where("email", "==", email)
                .limit(1)
                .get();
            if (!existing.empty)
                throw new ConflictError("Email already registered");
            const id = uuidv4();
            await db
                .collection("users")
                .doc(id)
                .set(sanitizeForFirestore({
                email,
                passwordHash: placeholderHash,
                name: input.name,
                role,
                phone: input.phone,
                createdAt,
            }));
            return {
                id,
                email,
                name: input.name,
                role,
                phone: input.phone,
                createdAt,
            };
        }
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`INSERT INTO users (email, password_hash, name, role, phone)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id::text, email, name, role, phone, created_at AS "createdAt"`, [email, placeholderHash, input.name, role, input.phone ?? null]);
                return result.rows[0];
            }
            catch (error) {
                if (typeof error === "object" &&
                    error &&
                    "code" in error &&
                    error.code === "23505") {
                    throw new ConflictError("Email already registered");
                }
                // Fall through to SQLite fallback when Postgres is configured but unavailable.
            }
        }
        const db = await getDb();
        const existing = allRows(db, "SELECT id FROM users WHERE lower(email) = ? LIMIT 1", [email]);
        if (existing[0])
            throw new ConflictError("Email already registered");
        const id = uuidv4();
        db.prepare("INSERT INTO users (id, email, passwordHash, name, role, phone, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)").run([
            id,
            email,
            placeholderHash,
            input.name,
            role,
            input.phone ?? "",
            createdAt,
        ]);
        await saveDb(db);
        return { id, email, name: input.name, role, phone: input.phone, createdAt };
    }
    async function hasPrivilegedUser() {
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const snap = await db
                .collection("users")
                .where("role", "in", PRIVILEGED_BOOTSTRAP_ROLES)
                .limit(1)
                .get();
            return !snap.empty;
        }
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query("SELECT 1 FROM users WHERE role = ANY($1::text[]) AND active = TRUE LIMIT 1", [PRIVILEGED_BOOTSTRAP_ROLES]);
                return (result.rowCount ?? 0) > 0;
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        try {
            const db = await getDb();
            const rows = allRows(db, "SELECT 1 FROM users WHERE role IN ('super-admin', 'EHS-manager') LIMIT 1");
            return rows.length > 0;
        }
        catch {
            return false;
        }
    }
    router.post("/login", async (req, res) => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors });
        }
        const demoUser = parsed.data.email === env.DEMO_EMAIL
            ? getDemoUser(parsed.data.password)
            : null;
        if (demoUser) {
            const token = generateToken(demoUser);
            return res.json({ token, user: demoUser });
        }
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const userSnap = await db
                .collection("users")
                .where("email", "==", parsed.data.email)
                .limit(1)
                .get();
            if (userSnap.empty)
                return res.status(401).json({ error: "Invalid credentials" });
            const user = userSnap.docs[0].data();
            const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
            if (!valid)
                return res.status(401).json({ error: "Invalid credentials" });
            const id = userSnap.docs[0].id;
            const token = generateToken({
                id,
                email: user.email,
                name: user.name,
                role: user.role,
            });
            return res.json({
                token,
                user: { id, email: user.email, name: user.name, role: user.role },
            });
        }
        return res
            .status(501)
            .json({ error: "Authentication backend not configured" });
    });
    router.post("/otp/request", async (req, res) => {
        const parsed = OtpRequestSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        const email = normalizeEmail(parsed.data.email);
        const checks = [
            await enforceAuthRateLimit({
                scope: "email",
                identifier: email,
                action: "otp.request",
                max: OTP_MAX_REQUESTS_PER_EMAIL,
                windowMinutes: OTP_REQUEST_WINDOW_MINUTES,
            }),
            await enforceAuthRateLimit({
                scope: "ip",
                identifier: clientIp(req),
                action: "otp.request",
                max: OTP_MAX_REQUESTS_PER_IP,
                windowMinutes: OTP_REQUEST_WINDOW_MINUTES,
            }),
            await enforceAuthRateLimit({
                scope: "device",
                identifier: deviceFingerprint(req),
                action: "otp.request",
                max: OTP_MAX_REQUESTS_PER_DEVICE,
                windowMinutes: OTP_REQUEST_WINDOW_MINUTES,
            }),
        ];
        const blocked = checks.find((check) => !check.allowed);
        if (blocked) {
            return res.status(429).json({
                error: "Too many OTP requests. Please try again later.",
                retryAfter: blocked.retryAfter,
            });
        }
        const user = await findUserByEmail(email);
        if (!user) {
            await audit(req, "otp.request", email, false, undefined, "Account not found");
            return res.status(404).json({
                error: "No active account exists for this email. Ask an admin to create your account.",
            });
        }
        const previous = await getOtpChallenge(email);
        if (previous?.requestedAt) {
            const retryAfter = OTP_RESEND_COOLDOWN_SECONDS -
                Math.floor((Date.now() - Date.parse(previous.requestedAt)) / 1000);
            if (retryAfter > 0)
                return res.status(429).json({
                    error: `Please wait ${retryAfter} seconds before requesting another code.`,
                    retryAfter,
                });
        }
        const code = String(randomInt(100000, 1000000));
        const now = new Date();
        await saveOtpChallenge(email, hashOtp(email, code), user.id, new Date(now.getTime() + OTP_TTL_MINUTES * 60000).toISOString(), now.toISOString());
        await audit(req, "otp.request", email, true, user.id);
        let delivery;
        try {
            delivery = await sendOtpEmail({
                to: email,
                code,
                expiresMinutes: OTP_TTL_MINUTES,
            });
        }
        catch {
            return res.status(502).json({
                error: "Could not send login code. Check SMTP configuration and try again.",
            });
        }
        const response = {
            ok: true,
            delivered: delivery.delivered,
            mode: delivery.mode,
            message: delivery.delivered
                ? "A login code has been sent to your email."
                : delivery.message,
            expiresMinutes: OTP_TTL_MINUTES,
        };
        if (!delivery.delivered && process.env.NODE_ENV !== "production") {
            response.devCode = code;
        }
        res.json(response);
    });
    router.post("/otp/verify", async (req, res) => {
        const parsed = OtpVerifySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        const email = normalizeEmail(parsed.data.email);
        const record = await getOtpChallenge(email);
        if (!record)
            return res.status(401).json({ error: "OTP code not found or expired" });
        if (Date.parse(record.expiresAt) < Date.now()) {
            await deleteOtpChallenge(email);
            await audit(req, "otp.verify", email, false, record.userId, "Expired code");
            return res.status(401).json({ error: "OTP code expired" });
        }
        if (record.attempts >= OTP_MAX_ATTEMPTS) {
            await deleteOtpChallenge(email);
            return res
                .status(429)
                .json({ error: "Too many OTP attempts. Request a new code." });
        }
        await incrementOtpAttempts(email);
        if (record.codeHash !== hashOtp(email, parsed.data.code)) {
            await audit(req, "otp.verify", email, false, record.userId, "Invalid code");
            return res.status(401).json({ error: "Invalid OTP code" });
        }
        await deleteOtpChallenge(email);
        const foundUser = await findUserByEmail(email);
        if (!foundUser)
            return res.status(401).json({ error: "Account is no longer active" });
        const user = publicUser(foundUser);
        const sessionId = randomBytes(16).toString("hex");
        const refreshToken = randomBytes(48).toString("base64url");
        const token = generateToken(user, sessionId);
        const decoded = jwt.decode(token);
        await createAuthSession({
            id: decoded.jti,
            userId: user.id,
            email,
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            ipAddress: req.ip ?? "",
            userAgent: req.get("user-agent") ?? "",
            refreshHash: createHash("sha256").update(refreshToken).digest("hex"),
        });
        await enforceSessionLimit(user.id);
        await audit(req, "login", email, true, user.id);
        const csrfToken = randomBytes(24).toString("base64url");
        res.cookie("ehs_csrf", csrfToken, {
            httpOnly: false,
            sameSite: "strict",
            secure: env.NODE_ENV === "production",
            maxAge: 7 * 86400000,
            path: "/",
        });
        res.cookie("ehs_refresh", refreshToken, {
            httpOnly: true,
            sameSite: "strict",
            secure: env.NODE_ENV === "production",
            maxAge: 7 * 86400000,
            path: "/api/auth",
        });
        res.json({ token, user });
    });
    router.post("/refresh", async (req, res) => {
        const cookie = req.headers.cookie
            ?.split(";")
            .map((part) => part.trim())
            .find((part) => part.startsWith("ehs_refresh="))
            ?.slice("ehs_refresh=".length);
        if (!cookie)
            return res.status(401).json({ error: "Refresh session is missing" });
        const hash = createHash("sha256")
            .update(decodeURIComponent(cookie))
            .digest("hex");
        const session = await getSessionByRefreshHash(hash);
        if (!session)
            return res
                .status(401)
                .json({ error: "Refresh session is invalid or expired" });
        const user = await findUserByEmail(session.email);
        if (!user)
            return res.status(401).json({ error: "Account is no longer active" });
        res.json({
            token: generateToken(publicUser(user), session.id),
            user: publicUser(user),
        });
    });
    router.post("/register", async (req, res) => {
        return res.status(403).json({
            error: "Self-registration is disabled. Ask an admin to create your account.",
        });
    });
    router.get("/bootstrap/status", async (_req, res) => {
        const configured = await hasPrivilegedUser();
        res.json({
            canRegisterFirstAdmin: !configured,
            message: configured
                ? "Administrator registration is closed. Ask an admin to create your account."
                : "Register the first administrator account before logging in.",
        });
    });
    router.post("/bootstrap/register", async (req, res) => {
        const configured = await hasPrivilegedUser();
        if (configured) {
            return res.status(403).json({
                error: "Administrator registration is closed. Ask an admin to create your account.",
            });
        }
        const parsed = CreateUserSchema.safeParse({
            ...req.body,
            role: "super-admin",
        });
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors });
        }
        try {
            const user = await createManagedUser(parsed.data);
            return res.status(201).json({
                user,
                message: "First administrator registered. Request an OTP code to log in.",
            });
        }
        catch (error) {
            if (error instanceof ConflictError) {
                return res.status(409).json({ error: error.message });
            }
            throw error;
        }
    });
    router.post("/users", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
        const parsed = CreateUserSchema.safeParse(req.body);
        if (!parsed.success) {
            return res.status(400).json({ error: parsed.error.errors });
        }
        try {
            const user = await createManagedUser(parsed.data);
            return res.status(201).json(user);
        }
        catch (error) {
            if (error instanceof ConflictError) {
                return res.status(409).json({ error: error.message });
            }
            throw error;
        }
    });
    router.get("/", authenticateUser, requireRole([
        "super-admin",
        "EHS-manager",
        "gm",
        "plant-manager",
        "factory-manager",
        "depot-admin",
    ]), async (req, res) => {
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const usersSnap = await db
                .collection("users")
                .orderBy("createdAt", "desc")
                .get();
            return res.json(usersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        }
        if (isPgConfigured()) {
            try {
                const result = await pgPool.query(`SELECT id::text, email, name, role, phone, created_at AS "createdAt"
           FROM users
           ORDER BY created_at DESC`);
                return res.json(result.rows);
            }
            catch {
                // Fall through to SQLite fallback.
            }
        }
        const db = await getDb();
        const users = allRows(db, "SELECT id, email, name, role, createdAt FROM users ORDER BY createdAt DESC");
        res.json(users);
    });
    router.get("/me", authenticateUser, async (req, res) => {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const user = await findUserByEmail(req.user.email);
        if (!user || user.id !== req.user.id)
            return res.status(401).json({ error: "Account is no longer active" });
        res.json({ user });
    });
    router.patch("/me", authenticateUser, async (req, res) => {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
        if (!name)
            return res.status(400).json({ error: "Name is required" });
        if (isFirebaseAvailable()) {
            const db = getFirebase();
            const ref = db.collection("users").doc(req.user.id);
            const doc = await ref.get();
            if (!doc.exists)
                return res.status(404).json({ error: "User not found" });
            await ref.update({ name, phone, updatedAt: new Date().toISOString() });
        }
        else if (isPgConfigured()) {
            try {
                const result = await pgPool.query("UPDATE users SET name = $1, phone = $2, updated_at = NOW() WHERE id = $3 AND active = TRUE RETURNING id", [name, phone || null, req.user.id]);
                if (!result.rowCount)
                    return res.status(404).json({ error: "User not found" });
            }
            catch {
                const db = await getDb();
                db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run([
                    name,
                    phone,
                    req.user.id,
                ]);
                await saveDb(db);
            }
        }
        else {
            const db = await getDb();
            db.prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run([
                name,
                phone,
                req.user.id,
            ]);
            await saveDb(db);
        }
        const user = await findUserByEmail(req.user.email);
        if (!user)
            return res.status(404).json({ error: "User not found" });
        res.json({ user });
    });
    router.get("/me/overview", authenticateUser, async (req, res) => {
        if (!req.user)
            return res.status(401).json({ error: "Unauthorized" });
        const identity = [req.user.id, req.user.email, req.user.name].filter(Boolean);
        let createdAt = null;
        let active = true;
        let raised = [];
        let assigned = [];
        let documents = [];
        if (isPgConfigured()) {
            try {
                const [accountResult, raisedResult, assignedResult] = await Promise.all([
                    pgPool.query("SELECT created_at, active FROM users WHERE id = $1", [req.user.id]),
                    pgPool.query("SELECT id::text, capa_no, title, status, updated_at FROM capa WHERE created_by = ANY($1::text[]) ORDER BY updated_at DESC LIMIT 10", [identity]),
                    pgPool.query("SELECT id::text, capa_no, title, status, updated_at FROM capa WHERE owner = ANY($1::text[]) ORDER BY updated_at DESC LIMIT 10", [identity]),
                ]);
                createdAt = accountResult.rows[0]?.created_at ?? null;
                active = accountResult.rows[0]?.active !== false;
                raised = raisedResult.rows;
                assigned = assignedResult.rows;
            }
            catch {
                // Use the SQLite data store when Postgres is unavailable.
            }
        }
        if (!createdAt && raised.length === 0 && assigned.length === 0) {
            const db = await getDb();
            const placeholders = identity.map(() => "?").join(",");
            const account = allRows(db, "SELECT createdAt FROM users WHERE id = ? LIMIT 1", [req.user.id])[0];
            createdAt = account?.createdAt ?? null;
            try {
                raised = allRows(db, `SELECT id, title, status, updatedAt FROM capa WHERE createdBy IN (${placeholders}) ORDER BY updatedAt DESC LIMIT 10`, identity);
                assigned = allRows(db, `SELECT id, title, status, updatedAt FROM capa WHERE owner IN (${placeholders}) ORDER BY updatedAt DESC LIMIT 10`, identity);
            }
            catch {
                raised = [];
                assigned = [];
            }
            try {
                documents = allRows(db, `SELECT id, title, fileName, type, status, createdAt, updatedAt FROM documents WHERE createdBy IN (${placeholders}) OR author IN (${placeholders}) ORDER BY createdAt DESC LIMIT 10`, [...identity, ...identity]);
            }
            catch {
                documents = [];
            }
        }
        const completedStatuses = new Set(["Completed", "Verified", "Closed"]);
        const completed = assigned.filter((item) => completedStatuses.has(String(item.status))).length;
        const performance = assigned.length
            ? Math.round((completed / assigned.length) * 100)
            : 0;
        const recentActions = [
            ...raised.map((item) => ({ ...item, action: "Raised CAPA" })),
            ...assigned.map((item) => ({ ...item, action: "Assigned CAPA" })),
        ]
            .sort((a, b) => String(b.updatedAt ?? b.updated_at ?? "").localeCompare(String(a.updatedAt ?? a.updated_at ?? "")))
            .slice(0, 5);
        res.json({
            activity: {
                raised: raised.length,
                assigned: assigned.length,
                completed,
                performance,
                recentActions,
            },
            documents,
            account: {
                type: req.user.role,
                active,
                createdAt,
                lastLogin: typeof req.user.iat === "number"
                    ? new Date(req.user.iat * 1000).toISOString()
                    : null,
            },
        });
    });
    router.get("/sessions", authenticateUser, async (req, res) => {
        res.json(await listAuthSessions(req.user.id));
    });
    router.get("/login-history", authenticateUser, async (req, res) => {
        res.json(await listLoginHistory(req.user.id, req.user.email));
    });
    router.delete("/sessions/:id", authenticateUser, async (req, res) => {
        await revokeSession(String(req.params.id), req.user.id);
        res.json({ ok: true });
    });
    router.post("/deactivation-request", authenticateUser, async (req, res) => {
        const requestedAt = await requestAccountDeactivation(req.user.id);
        res.json({ ok: true, requestedAt });
    });
    router.get("/deactivation-requests", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (_req, res) => {
        res.json(await listDeactivationRequests());
    });
    router.post("/deactivation-requests/:id/approve", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
        const id = String(req.params.id);
        if (id === req.user.id)
            return res
                .status(400)
                .json({ error: "You cannot deactivate your own account" });
        const approved = await approveDeactivationRequest(id);
        if (!approved)
            return res
                .status(404)
                .json({ error: "Deactivation request not found" });
        res.json({ ok: true, deactivated: id });
    });
    router.delete("/deactivation-requests/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
        await clearDeactivationRequest(String(req.params.id));
        res.json({ ok: true });
    });
    router.get("/preferences", authenticateUser, async (req, res) => {
        res.json(await getUserPreferences(req.user.id));
    });
    router.put("/preferences", authenticateUser, async (req, res) => {
        const preferences = req.body?.preferences && typeof req.body.preferences === "object"
            ? req.body.preferences
            : {};
        const avatarUrl = typeof req.body?.avatarUrl === "string" &&
            req.body.avatarUrl.length <= 2_000_000
            ? req.body.avatarUrl
            : null;
        const saved = await saveUserPreferences(req.user.id, preferences, avatarUrl);
        res.json({ ok: true, ...saved });
    });
    router.post("/email-change/request", authenticateUser, async (req, res) => {
        const newEmail = normalizeEmail(String(req.body?.email ?? ""));
        if (!/^\S+@\S+\.\S+$/.test(newEmail))
            return res.status(400).json({ error: "A valid new email is required" });
        if (await findUserByEmail(newEmail))
            return res.status(409).json({ error: "Email is already registered" });
        const code = String(randomInt(100000, 1000000));
        const now = new Date();
        await saveEmailChangeChallenge({
            userId: req.user.id,
            newEmail,
            codeHash: hashOtp(newEmail, code),
            expiresAt: new Date(now.getTime() + OTP_TTL_MINUTES * 60000).toISOString(),
            requestedAt: now.toISOString(),
        });
        const delivery = await sendOtpEmail({
            to: newEmail,
            code,
            expiresMinutes: OTP_TTL_MINUTES,
        });
        res.json({
            ok: true,
            delivered: delivery.delivered,
            message: delivery.message,
            ...(env.NODE_ENV !== "production" && !delivery.delivered
                ? { devCode: code }
                : {}),
        });
    });
    router.post("/email-change/verify", authenticateUser, async (req, res) => {
        const code = String(req.body?.code ?? "");
        const change = await getEmailChangeChallenge(req.user.id);
        if (!change || Date.parse(change.expiresAt) < Date.now())
            return res
                .status(401)
                .json({ error: "Email verification code expired" });
        if (change.attempts >= OTP_MAX_ATTEMPTS)
            return res.status(429).json({ error: "Too many attempts" });
        await incrementEmailChangeAttempts(req.user.id);
        if (change.codeHash !== hashOtp(change.newEmail, code)) {
            return res.status(401).json({ error: "Invalid verification code" });
        }
        await completeEmailChange(req.user.id, change.newEmail);
        res.clearCookie("ehs_refresh", { path: "/api/auth" });
        res.json({ ok: true, email: change.newEmail, requiresLogin: true });
    });
    router.patch("/users/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
        const id = String(req.params.id);
        const role = typeof req.body.role === "string" ? req.body.role : undefined;
        const active = typeof req.body.active === "boolean" ? req.body.active : undefined;
        const email = typeof req.body.email === "string"
            ? normalizeEmail(req.body.email)
            : undefined;
        const name = typeof req.body.name === "string" ? req.body.name.trim() : undefined;
        if (id === req.user.id && active === false)
            return res
                .status(400)
                .json({ error: "You cannot suspend your own account" });
        if (role === "super-admin" && req.user.role !== "super-admin")
            return res.status(403).json({
                error: "Only a super-admin can assign the super-admin role",
            });
        if (email && req.user.role !== "super-admin")
            return res
                .status(403)
                .json({ error: "Only a super-admin can perform email recovery" });
        const db = await getDb();
        const existing = allRows(db, "SELECT id FROM users WHERE id = ?", [
            id,
        ])[0];
        if (!existing)
            return res.status(404).json({ error: "User not found" });
        if (name)
            db.prepare("UPDATE users SET name = ? WHERE id = ?").run([name, id]);
        if (role)
            db.prepare("UPDATE users SET role = ? WHERE id = ?").run([role, id]);
        if (active !== undefined)
            db.prepare("UPDATE users SET active = ? WHERE id = ?").run([
                active ? 1 : 0,
                id,
            ]);
        if (email)
            db.prepare("UPDATE users SET email = ? WHERE id = ?").run([email, id]);
        if (role || email || active === false)
            db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run([new Date().toISOString(), id]);
        await saveDb(db);
        res.json(allRows(db, "SELECT id, email, name, role, phone, active, createdAt FROM users WHERE id = ?", [id])[0]);
    });
    router.delete("/users/:id", authenticateUser, requireRole(["super-admin", "EHS-manager"]), async (req, res) => {
        const id = String(req.params.id);
        if (id === req.user.id)
            return res
                .status(400)
                .json({ error: "You cannot suspend your own account" });
        const db = await getDb();
        const target = allRows(db, "SELECT role FROM users WHERE id = ?", [
            id,
        ])[0];
        if (!target)
            return res.status(404).json({ error: "User not found" });
        if (target.role === "super-admin" && req.user.role !== "super-admin")
            return res
                .status(403)
                .json({ error: "Only a super-admin can suspend a super-admin" });
        const now = new Date().toISOString();
        db.prepare("UPDATE users SET active = 0 WHERE id = ?").run([id]);
        db.prepare("UPDATE auth_sessions SET revokedAt = ? WHERE userId = ? AND revokedAt IS NULL").run([now, id]);
        await saveDb(db);
        res.json({ ok: true, suspended: id });
    });
    router.post("/logout", authenticateUser, async (req, res) => {
        await revokeSession(String(req.user.jti), req.user.id);
        await audit(req, "logout", req.user.email, true, req.user.id);
        res.clearCookie("ehs_refresh", { path: "/api/auth" });
        res.json({ ok: true });
    });
    return router;
}
