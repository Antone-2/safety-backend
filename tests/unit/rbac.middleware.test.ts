import { describe, expect, it, vi } from "vitest";
import { hasPermission, rbacMiddleware, requirePermission, requireRole, recordAuthFailure, ROUTE_PERMISSION_MATRIX } from "../../src/shared/middleware/rbac.middleware.js";
import {
  canRoleMutate,
  isWriteExemptPath,
  normalizeApiPath,
} from "../../src/shared/middleware/write-authorization.middleware.js";

vi.mock("../../src/shared/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

describe("hasPermission", () => {
  it("allows super-admin to do everything", () => {
    expect(hasPermission("super-admin", "settings:update")).toBe(true);
    expect(hasPermission("super-admin", "unknown:permission")).toBe(true);
  });

  it("keeps supervisors read-only", () => {
    expect(hasPermission("supervisor", "reports:read")).toBe(true);
    expect(hasPermission("supervisor", "reports:create")).toBe(false);
    expect(hasPermission("supervisor", "settings:update")).toBe(false);
  });

  it("prevents operational managers from assigning reports", () => {
    expect(hasPermission("gm", "reports:assign")).toBe(false);
    expect(hasPermission("plant-manager", "reports:assign")).toBe(false);
    expect(hasPermission("factory-manager", "reports:assign")).toBe(false);
  });

  it("denies missing roles", () => {
    expect(hasPermission(undefined, "reports:read")).toBe(false);
  });

  it("allows EHS-manager to manage all domains", () => {
    expect(hasPermission("EHS-manager", "training:update")).toBe(true);
    expect(hasPermission("EHS-manager", "equipment:delete")).toBe(true);
    expect(hasPermission("EHS-manager", "medical:delete")).toBe(true);
  });

  it("keeps hse-officers read-only on operational domains", () => {
    expect(hasPermission("hse-officer", "ppe:update")).toBe(false);
    expect(hasPermission("hse-officer", "contractors:create")).toBe(false);
    expect(hasPermission("hse-officer", "fire:read")).toBe(true);
  });

  it("allows plant managers to read but not approve", () => {
    expect(hasPermission("plant-manager", "ppe:read")).toBe(true);
    expect(hasPermission("plant-manager", "permits:approve")).toBe(false);
    expect(hasPermission("plant-manager", "medical:read")).toBe(true);
  });

  it("denies factory-manager sensitive medical/health writes", () => {
    expect(hasPermission("factory-manager", "medical:create")).toBe(false);
    expect(hasPermission("factory-manager", "medical:delete")).toBe(false);
    expect(hasPermission("factory-manager", "health:delete")).toBe(false);
  });

  it("denies depot-admin document approval", () => {
    expect(hasPermission("depot-admin", "documents:approve")).toBe(false);
    expect(hasPermission("depot-admin", "documents:delete")).toBe(false);
  });

  it("allows she-committee-member read-only across all domains", () => {
    expect(hasPermission("she-committee-member", "training:read")).toBe(true);
    expect(hasPermission("she-committee-member", "ppe:read")).toBe(true);
    expect(hasPermission("she-committee-member", "medical:read")).toBe(true);
    expect(hasPermission("she-committee-member", "training:create")).toBe(false);
  });

  it("allows gm read access only", () => {
    expect(hasPermission("gm", "reports:assign")).toBe(false);
    expect(hasPermission("gm", "reports:read")).toBe(true);
    expect(hasPermission("gm", "capa:verify")).toBe(false);
  });

  it("keeps maintenance managers read-only", () => {
    expect(hasPermission("maintenance-manager", "equipment:update")).toBe(false);
    expect(hasPermission("maintenance-manager", "fire:update")).toBe(false);
    expect(hasPermission("maintenance-manager", "scaffolding:update")).toBe(false);
    expect(hasPermission("maintenance-manager", "heightwork:read")).toBe(true);
  });

  it("keeps issuers read-only", () => {
    expect(hasPermission("issuer", "permits:read")).toBe(true);
    expect(hasPermission("issuer", "permits:update")).toBe(false);
    expect(hasPermission("issuer", "permits:approve")).toBe(false);
    expect(hasPermission("issuer", "reports:read")).toBe(false);
  });
});

describe("global mutation policy", () => {
  it("allows writes only for super-admin and EHS-manager", () => {
    expect(canRoleMutate("super-admin")).toBe(true);
    expect(canRoleMutate("EHS-manager")).toBe(true);
    expect(canRoleMutate("hse-officer")).toBe(false);
    expect(canRoleMutate("supervisor")).toBe(false);
    expect(canRoleMutate("gm")).toBe(false);
  });

  it("allows essential authentication mutations", () => {
    expect(isWriteExemptPath("/api/auth/otp/request")).toBe(true);
    expect(isWriteExemptPath("/api/v1/auth/otp/verify")).toBe(true);
    expect(isWriteExemptPath("/auth/logout")).toBe(true);
    expect(isWriteExemptPath("/reports/RPT-1/assign")).toBe(false);
    expect(normalizeApiPath("/api/v1/reports/RPT-1/assign")).toBe("/reports/RPT-1/assign");
  });
});

describe("rbacMiddleware", () => {
  it("allows access when permission granted", async () => {
    const middleware = rbacMiddleware("reports:read");
    const req = { user: { id: "1", role: "supervisor" }, originalUrl: "/api/reports", method: "GET", ip: "127.0.0.1", headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies access when permission missing", async () => {
    const middleware = rbacMiddleware("settings:update");
    const req = { user: { id: "1", role: "supervisor" }, originalUrl: "/api/settings", method: "PUT", ip: "127.0.0.1", headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Forbidden: insufficient permissions",
      permission: "settings:update",
    });
  });

  it("returns 401 when no user", async () => {
    const middleware = rbacMiddleware("reports:read");
    const req = { originalUrl: "/api/reports", method: "GET", ip: "127.0.0.1", headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("requireRole legacy compatibility", () => {
  it("allows access for matching role", async () => {
    const middleware = requireRole(["super-admin", "EHS-manager"]);
    const req = { user: { id: "1", role: "EHS-manager" }, originalUrl: "/api/users", method: "GET", ip: "127.0.0.1", headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("denies access for non-matching role", async () => {
    const middleware = requireRole(["super-admin", "EHS-manager"]);
    const req = { user: { id: "1", role: "supervisor" }, originalUrl: "/api/users", method: "DELETE", ip: "127.0.0.1", headers: {} } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("recordAuthFailure", () => {
  it("records a denied auth event", async () => {
    const { writeAuditLog } = await import("../../src/shared/audit/audit.service.js");
    const req = {
      user: { id: "user-1", role: "supervisor" },
      originalUrl: "/api/settings",
      method: "PUT",
      ip: "127.0.0.1",
      headers: { "user-agent": "test" },
    } as any;

    await recordAuthFailure(req, "settings:update", 403);

    expect(writeAuditLog).toHaveBeenCalledWith({
      action: "auth.rbac.denied",
      resourceType: "authorization",
      resourceId: "user-1",
      context: {
        permission: "settings:update",
        statusCode: 403,
        path: "/api/settings",
        method: "PUT",
        role: "supervisor",
      },
      actor: { id: "user-1", role: "supervisor" },
      request: req,
    });
  });

  it("handles missing user gracefully", async () => {
    const req = {
      user: undefined,
      originalUrl: "/api/login",
      method: "POST",
      ip: "127.0.0.1",
      headers: {},
    } as any;

    await expect(recordAuthFailure(req, "auth:login", 401)).resolves.toBeUndefined();
  });
});

describe("ROUTE_PERMISSION_MATRIX", () => {
  it("covers read endpoints for all domains", () => {
    const domains = [
      "incidents", "reports", "capa", "permits", "training", "documents",
      "ppe", "equipment", "contractors", "compliance", "environmental",
      "health", "fire", "spill", "sds", "scaffolding", "hazard", "risk",
      "objectives", "emergency", "medical", "esg", "analytics", "governance",
      "investigations", "heightwork",
    ];
    for (const domain of domains) {
      const readKey = `/api/${domain}`;
      expect(ROUTE_PERMISSION_MATRIX[readKey]).toBe(`${domain}:read`);
    }
  });

  it("has create permission for write paths", () => {
    expect(ROUTE_PERMISSION_MATRIX["/api/training/courses"]).toBe("training:create");
    expect(ROUTE_PERMISSION_MATRIX["/api/ppe"]).toBe("ppe:read");
  });
});
