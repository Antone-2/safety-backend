import type { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const CSRF_EXEMPT_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/otp/request",
  "/api/auth/otp/verify",
  "/api/auth/bootstrap/register",
  "/api/auth/mfa/enroll",
  "/api/auth/mfa/verify-enrollment",
  "/api/auth/mfa/verify-token",
  "/api/auth/mfa/recovery-code",
  "/api/auth/login/mfa-complete",
]);

function hasRefreshCookie(req: Request) {
  return Boolean(
    req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .some((part) => part.startsWith("ehs_refresh=")),
  );
}

function normalizePath(req: Request): string {
  return `/${String(req.path || "").replace(/^\/+/, "")}`;
}

export function csrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.CSRF_PROTECTION_ENABLED === "false") return next();
  if (!unsafeMethods.has(req.method)) return next();
  if (!hasRefreshCookie(req)) return next();
  if (CSRF_EXEMPT_PATHS.has(normalizePath(req))) return next();

  const header = req.get("x-csrf-token");
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("ehs_csrf="))
    ?.slice("ehs_csrf=".length);

  if (!header || !cookieToken || header !== decodeURIComponent(cookieToken)) {
    return res.status(403).json({
      error: "CSRF validation failed",
      strategy:
        "Send x-csrf-token matching the ehs_csrf cookie on unsafe cookie-authenticated requests.",
    });
  }

  next();
}
