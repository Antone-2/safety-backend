import type { NextFunction, Response } from "express";

import { authenticateUser, type AuthRequest } from "./auth.middleware.js";
import { recordAuthFailure } from "./rbac.middleware.js";

export const PRIVILEGED_WRITE_ROLES = ["super-admin", "EHS-manager"] as const;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const AUTH_WRITE_EXEMPTIONS = new Set([
  "/auth/login",
  "/auth/otp/request",
  "/auth/otp/verify",
  "/auth/refresh",
  "/auth/bootstrap/register",
  "/auth/logout",
]);

export function normalizeApiPath(path: string): string {
  const normalized = `/${String(path || "").replace(/^\/+/, "")}`
    .replace(/^\/api(?:\/v1)?(?=\/)/, "")
    .replace(/\/$/, "");
  return normalized || "/";
}

export function isWriteExemptPath(path: string): boolean {
  return AUTH_WRITE_EXEMPTIONS.has(normalizeApiPath(path));
}

export function canRoleMutate(role: string | undefined): boolean {
  return PRIVILEGED_WRITE_ROLES.includes(role as (typeof PRIVILEGED_WRITE_ROLES)[number]);
}

export async function enforcePrivilegedMutations(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (SAFE_METHODS.has(req.method.toUpperCase()) || isWriteExemptPath(req.path)) {
    return next();
  }

  return authenticateUser(req, res, async () => {
    if (canRoleMutate(req.user?.role)) return next();

    await recordAuthFailure(req, "system:mutate", 403);
    return res.status(403).json({
      error: "Read-only account: only Super Admins and EHS Managers can perform actions",
      code: "WRITE_ACCESS_DENIED",
    });
  });
}
