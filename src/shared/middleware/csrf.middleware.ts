import type { NextFunction, Request, Response } from "express";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function hasRefreshCookie(req: Request) {
  return Boolean(
    req.headers.cookie
      ?.split(";")
      .map((part) => part.trim())
      .some((part) => part.startsWith("ehs_refresh=")),
  );
}

export function csrfProtectionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (process.env.CSRF_PROTECTION_ENABLED !== "true") return next();
  if (!unsafeMethods.has(req.method)) return next();
  if (!hasRefreshCookie(req)) return next();

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
