import { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "../../config/index.js";
import { logger } from "../utils/logger.js";
import { hasPermission, recordAuthFailure } from "./rbac.middleware.js";
import { allRows, getDb } from "../../lib/database.js";
import { pgPool } from "../infrastructure/database/postgres.client.js";

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
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

const JWT_SECRET = getEnv().JWT_SECRET;

function isPgConfigured() {
  return Boolean(process.env.DATABASE_URL || process.env.DB_HOST);
}

function deviceFingerprint(req: Request) {
  return createHash("sha256")
    .update(`${req.get("user-agent") || "unknown"}:${req.ip || req.socket.remoteAddress || "unknown"}`)
    .digest("hex");
}

export async function authenticateUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (req.user?.id && req.user?.jti) return next();
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : getCookieValue(req, "ehs_access");
  if (!token) {
    return res
      .status(401)
      .json({ error: "Missing or invalid authorization header" });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"] & {
      userId?: string;
    };
    req.user = decoded
      ? { ...decoded, id: decoded.id || decoded.userId || "" }
      : decoded;
    if (!decoded?.jti)
      return res.status(401).json({ error: "Session is invalid" });
    let session: unknown;
    if (isPgConfigured()) {
      try {
        const result = await pgPool.query(
          "SELECT id FROM auth_sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW() LIMIT 1",
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
        "SELECT id FROM auth_sessions WHERE id = ? AND revokedAt IS NULL AND expiresAt > ?",
        [decoded.jti, new Date().toISOString()],
      )[0];
    }
    if (!session)
      return res
        .status(401)
        .json({ error: "Session has expired or was revoked" });

    const fingerprint = deviceFingerprint(req);
    const storedFingerprint = isPgConfigured()
      ? (
          await pgPool
            .query(
              "SELECT device_fingerprint FROM auth_sessions WHERE id = $1 LIMIT 1",
              [decoded.jti],
            )
            .catch(() => ({ rows: [] }))
        ).rows[0]?.device_fingerprint
      : (allRows(
          await getDb(),
          "SELECT deviceFingerprint AS deviceFingerprint FROM auth_sessions WHERE id = ?",
          [decoded.jti],
        )[0] as { deviceFingerprint?: string } | undefined)?.deviceFingerprint;

    if (storedFingerprint && storedFingerprint !== fingerprint) {
      return res.status(401).json({ error: "Session device changed. Please sign in again." });
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
