import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "../../config/index.js";
import { logger } from "../utils/logger.js";
import { hasPermission, recordAuthFailure } from "./rbac.middleware.js";
import { allRows, getDb } from "../../lib/database.js";
import { pgPool } from "../infrastructure/database/postgres.client.js";
import { isJwtDenylisted } from "./jwt-denylist.middleware.js";

export function normalizeRole(role: string | undefined | null): string {
  const normalized = String(role ?? "").trim().toLowerCase();

  switch (normalized) {
    case "super-admin":
    case "super admin":
    case "superadmin":
      return "super-admin";
    case "ehs-manager":
    case "ehs manager":
    case "admin":
      return "EHS-manager";
    case "ehs-officer":
    case "ehs officer":
      return "EHS-officer";
    case "gm":
    case "general manager":
      return "gm";
    case "plant-manager":
    case "plant manager":
      return "plant-manager";
    case "factory-manager":
    case "factory manager":
      return "factory-manager";
    case "supervisor":
      return "supervisor";
    case "depot-admin":
    case "depot admin":
    case "user":
      return "depot-admin";
    case "she-committee-member":
    case "she committee member":
    case "committee":
      return "she-committee-member";
    case "maintenance-manager":
    case "maintenance manager":
      return "maintenance-manager";
    case "issuer":
      return "issuer";
    default:
      return "depot-admin";
  }
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    iat?: number;
    jti?: string;
  };
}

export function getCookieValue(req: Request, name: string) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return "";
  const cookie = cookieHeader
    .split(";")
    .map((part: string) => part.trim())
    .find((part: string) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

const JWT_SECRET = getEnv().JWT_SECRET;
const SESSION_TOUCH_INTERVAL_MS = 60_000;
const sessionLastTouchedAt = new Map<string, number>();

function isPgConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function legacySessionFingerprint(req: Request) {
  return createHash("sha256")
    .update(`${req.get("user-agent") || "unknown"}:${req.ip || req.socket.remoteAddress || "unknown"}`)
    .digest("hex");
}

function sessionFingerprint(req: Request) {
  const userAgent = req.get("user-agent") || "unknown";
  const language = req.get("accept-language") || "unknown";
  const platform = req.get("sec-ch-ua-platform") || "unknown";
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return createHash("sha256")
    .update(`${userAgent}:${language}:${platform}:${ip}`)
    .digest("hex");
}

function shouldTouchSession(sessionId: string, now = Date.now()): boolean {
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
  if (process.env.ENABLE_DEMO_LOGIN !== "true") return null;

  const email = (process.env.DEMO_EMAIL || "").trim().toLowerCase();
  if (!email) return null;

  return {
    id: "demo-user",
    email,
    name: process.env.DEMO_NAME?.trim() || "Demo User",
    role: process.env.DEMO_ROLE?.trim() || "EHS-manager",
    jti: "demo-session",
  };
}

type SessionRow = {
  id: string;
  device_fingerprint?: string | null;
  user_agent?: string | null;
  deviceFingerprint?: string | null;
  userAgent?: string | null;
  ip_address?: string | null;
  ipAddress?: string | null;
};

export async function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.id && req.user?.jti) return next();
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
    req.user = { ...demoIdentity, role: normalizeRole(demoIdentity.role) };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"] & {
      userId?: string;
      type?: string;
      exp?: number;
    };
    req.user = decoded
      ? { ...decoded, id: decoded.id || decoded.userId || "", role: normalizeRole(decoded.role) }
      : decoded;
    if (!decoded?.jti)
      return res.status(401).json({ error: "Session is invalid" });
    if (decoded.exp && await isJwtDenylisted(decoded.jti)) {
      return res.status(401).json({ error: "Session has been revoked" });
    }
    if (
      decoded.type === "offline-dev-session" &&
      getEnv().NODE_ENV !== "production"
    ) {
      return next();
    }
    let session: SessionRow | undefined;
    if (isPgConfigured()) {
      try {
        const result = await pgPool.query<SessionRow>(
          `SELECT id, device_fingerprint, user_agent, ip_address
           FROM auth_sessions
           WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()
           LIMIT 1`,
          [decoded.jti],
        );
        session = result.rows[0];
      } catch {
        // Fall through to the local SQLite store when Postgres is unavailable.
      }
    }

    if (!session) {
      const db = await getDb();
      session = allRows(
        db,
        "SELECT id, deviceFingerprint AS deviceFingerprint, userAgent AS userAgent, ipAddress AS ipAddress FROM auth_sessions WHERE id = ? AND revokedAt IS NULL AND expiresAt > ?",
        [decoded.jti, new Date().toISOString()],
      )[0] as SessionRow | undefined;
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

    if (
      storedFingerprint &&
      storedFingerprint !== fingerprint &&
      storedFingerprint !== legacyFingerprint &&
      storedUserAgent !== (req.get("user-agent") || "")
    ) {
      return res.status(401).json({ error: "Session device changed. Please sign in again." });
    }

    if (storedIp && storedIp !== currentIp) {
      logger.warn(
        {
          sessionId: decoded.jti,
          storedIp,
          currentIp,
        },
        "Authenticated session IP changed",
      );
    }

    const touchSession = shouldTouchSession(decoded.jti);

    if (touchSession && isPgConfigured()) {
      await pgPool
        .query(
          `UPDATE auth_sessions
           SET last_seen_at = NOW()
           WHERE id = $1 AND revoked_at IS NULL`,
          [decoded.jti],
        )
        .catch(() => undefined);
    } else if (touchSession) {
      const db = await getDb();
      db.prepare(
        "UPDATE auth_sessions SET lastSeenAt = ? WHERE id = ? AND revokedAt IS NULL",
      ).run([new Date().toISOString(), decoded.jti]);
    }

    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requirePermission(permission: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
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

export function requireRole(allowedRoles: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
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
