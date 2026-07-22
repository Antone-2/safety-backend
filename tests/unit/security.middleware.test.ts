import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { buildSecurityHeaders, securityHeadersMiddleware } from "../../src/shared/middleware/security.middleware.js";

describe("buildSecurityHeaders", () => {
  it("returns a production-safe set of headers", () => {
    const headers = buildSecurityHeaders();

    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toContain("geolocation=()");
    expect(headers["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(headers["Content-Security-Policy"]).not.toContain("unsafe-inline");
  });
});

describe("securityHeadersMiddleware", () => {
  it("writes headers and forwards the request", () => {
    const setHeader = vi.fn();
    const res = { setHeader } as unknown as Response;
    const req = {} as Request;
    const next = vi.fn() as NextFunction;

    securityHeadersMiddleware(req, res, next);

    expect(setHeader).toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
