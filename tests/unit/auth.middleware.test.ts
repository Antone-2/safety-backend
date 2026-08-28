import { beforeEach, describe, expect, it, vi } from "vitest";
import jwt from "jsonwebtoken";

vi.mock("jsonwebtoken", () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  pgPool: {
    query: vi.fn(),
  },
}));

vi.mock("../../src/lib/database.js", () => ({
  allRows: vi.fn(),
  getDb: vi.fn(),
  saveDb: vi.fn(),
}));

vi.mock("../../src/shared/middleware/rbac.middleware.js", () => ({
  hasPermission: vi.fn(() => true),
  recordAuthFailure: vi.fn(),
}));

import { authenticateUser } from "../../src/shared/middleware/auth.middleware.js";

describe("authenticateUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "12345678901234567890123456789012";
    delete process.env.ENABLE_DEMO_LOGIN;
    delete process.env.DEMO_EMAIL;
    delete process.env.DEMO_NAME;
    delete process.env.DEMO_ROLE;
  });

  it("rejects access tokens supplied through query parameters", async () => {
    vi.mocked(jwt.verify).mockReturnValue({ id: "user-1", jti: "session-1", email: "user@example.com", role: "super-admin" } as any);

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();
    const req = {
      headers: {},
      query: { access_token: "query-token" },
    } as any;

    await authenticateUser(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts the configured demo token when demo login is enabled", async () => {
    process.env.ENABLE_DEMO_LOGIN = "true";
    process.env.DEMO_EMAIL = "demo@example.com";
    process.env.DEMO_NAME = "QA Demo";
    process.env.DEMO_ROLE = "super-admin";

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;
    const next = vi.fn();
    const req = {
      headers: { authorization: "Bearer demo-token" },
      query: {},
    } as any;

    await authenticateUser(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({
      id: "demo-user",
      email: "demo@example.com",
      name: "QA Demo",
      role: "super-admin",
      jti: "demo-session",
    });
    expect(res.status).not.toHaveBeenCalled();
  });
});
