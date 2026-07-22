import type { NextFunction, Request, Response } from "express";

export function buildSecurityHeaders(): Record<string, string> {
  const connectSources = [
    "'self'",
    ...(process.env.FRONTEND_URL || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ].join(" ");
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "0",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy": `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${connectSources}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`,
    "Cross-Origin-Opener-Policy": "same-origin",
    "X-DNS-Prefetch-Control": "off",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] =
      "max-age=31536000; includeSubDomains; preload";
  }
  return headers;
}

export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  for (const [header, value] of Object.entries(buildSecurityHeaders())) {
    res.setHeader(header, value);
  }
  next();
}
