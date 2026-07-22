import express from "express";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jwtMock = {
  verify: vi.fn(),
  sign: vi.fn(),
  decode: vi.fn(),
};

const bcryptMock = {
  compare: vi.fn(),
};

const pgQueryMock = vi.fn();
const sendBrevoEmailMock = vi.fn();

const mfaMock = {
  generateSecret: vi.fn(),
  generateRecoveryCodes: vi.fn(),
  createMFAEnrollment: vi.fn(),
  verifyMFAEnrollment: vi.fn(),
  verifyTOTPToken: vi.fn(),
  verifyRecoveryCode: vi.fn(),
  isMFAEnabled: vi.fn(),
  disableMFA: vi.fn(),
};

vi.mock("jsonwebtoken", () => ({
  default: jwtMock,
}));

vi.mock("bcryptjs", () => ({
  default: bcryptMock,
}));

vi.mock("../../src/config/index.js", () => ({
  getEnv: () => ({
    JWT_SECRET: "12345678901234567890123456789012",
    NODE_ENV: "test",
    FRONTEND_URL: "http://127.0.0.1:3000",
  }),
}));

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  pgPool: {
    query: pgQueryMock,
  },
}));

vi.mock("../../src/lib/database.js", () => ({
  allRows: vi.fn(() => []),
  getDb: vi.fn(),
  saveDb: vi.fn(),
}));

vi.mock("../../src/lib/email.js", () => ({
  sendOtpEmail: vi.fn(),
  sendBrevoEmail: sendBrevoEmailMock,
}));

vi.mock("../../src/services/mfa.service.js", () => ({
  MFAService: vi.fn().mockImplementation(() => mfaMock),
}));

vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({
  authenticateUser: (req: any, res: any, next: any) => {
    const serialized = req.headers["x-test-user"];
    if (!serialized) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = JSON.parse(String(serialized));
    next();
  },
  getCookieValue: vi.fn(() => undefined),
  requireRole: () => (_req: any, _res: any, next: any) => next(),
}));

const { createAuthRouter } = await import("../../src/modules/auth/auth.module.js");

type TestResponse = {
  status: number;
  body: any;
  headers: Headers;
};

async function withServer(
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use("/api/auth", createAuthRouter());

  const server = await new Promise<import("http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function postJson(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

async function getJson(
  baseUrl: string,
  path: string,
  headers?: Record<string, string>,
): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers,
  });

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

async function deleteJson(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
    headers: response.headers,
  };
}

describe("MFA Endpoints Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "12345678901234567890123456789012";
    process.env.DATABASE_URL = "postgres://local/test";

    jwtMock.sign.mockImplementation((payload: any) => {
      if (payload?.type === "mfa-verification") return "signed-mfa-verification-token";
      if (payload?.type === "mfa-recovery") return "signed-mfa-recovery-token";
      return "signed-session-token";
    });
    jwtMock.decode.mockReturnValue({
      jti: "session-123",
      exp: Math.floor(Date.now() / 1000) + 900,
    });
    bcryptMock.compare.mockResolvedValue(true);

    mfaMock.generateSecret.mockReturnValue({
      secret: "BASE32SECRET",
      qrCode: "otpauth://totp/Crown%20Safety",
    });
    mfaMock.generateRecoveryCodes.mockReturnValue(
      Array.from({ length: 10 }, (_, index) => ({ code: `CODE${index}` })),
    );
    mfaMock.createMFAEnrollment.mockResolvedValue(undefined);
    mfaMock.verifyMFAEnrollment.mockResolvedValue(true);
    mfaMock.verifyTOTPToken.mockResolvedValue(true);
    mfaMock.verifyRecoveryCode.mockResolvedValue(true);
    mfaMock.isMFAEnabled.mockResolvedValue(true);
    mfaMock.disableMFA.mockResolvedValue(undefined);

    pgQueryMock.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes("FROM users WHERE lower(email)")) {
        return {
          rows: [
            {
              id: "user-1",
              email: params?.[0],
              name: "Privileged User",
              role: "super-admin",
            },
          ],
          rowCount: 1,
        };
      }

      if (sql.includes("SELECT password_hash FROM users WHERE id = $1")) {
        return {
          rows: [{ password_hash: "hashed-password" }],
          rowCount: 1,
        };
      }

      if (sql.includes("INSERT INTO auth_login_audit")) {
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("INSERT INTO auth_sessions")) {
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("FROM auth_sessions")) {
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes("DELETE FROM mfa_recovery_codes")) {
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("INSERT INTO mfa_recovery_codes")) {
        return { rows: [], rowCount: 1 };
      }

      return { rows: [], rowCount: 0 };
    });
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("should fail MFA enrollment for non-privileged role", async () => {
    jwtMock.verify.mockReturnValue({
      type: "mfa-enrollment",
      userId: "user-1",
      email: "employee@example.com",
    });
    pgQueryMock.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "employee@example.com",
          name: "Employee",
          role: "employee",
        },
      ],
      rowCount: 1,
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/enroll", {
        mfaEnrollmentToken: "enrollment-token",
      });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe("MFA enrollment not available for your role");
    });
  });

  it("should generate secret and recovery codes during enrollment", async () => {
    jwtMock.verify.mockReturnValue({
      type: "mfa-enrollment",
      userId: "user-1",
      email: "admin@example.com",
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/enroll", {
        mfaEnrollmentToken: "enrollment-token",
      });

      expect(response.status).toBe(200);
      expect(response.body.secret).toBe("BASE32SECRET");
      expect(response.body.qrCode).toContain("otpauth://");
      expect(response.body.recoveryCodes).toHaveLength(10);
      expect(mfaMock.createMFAEnrollment).toHaveBeenCalledWith(
        "user-1",
        "BASE32SECRET",
        expect.any(Array),
      );
    });
  });

  it("should verify MFA enrollment with correct TOTP code", async () => {
    jwtMock.verify.mockReturnValue({
      type: "mfa-enrollment",
      userId: "user-1",
      email: "admin@example.com",
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/verify-enrollment", {
        mfaEnrollmentToken: "enrollment-token",
        token: "123456",
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(mfaMock.verifyMFAEnrollment).toHaveBeenCalledWith("user-1", "123456");
    });
  });

  it("should reject invalid TOTP codes during enrollment", async () => {
    jwtMock.verify.mockReturnValue({
      type: "mfa-enrollment",
      userId: "user-1",
      email: "admin@example.com",
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/verify-enrollment", {
        mfaEnrollmentToken: "enrollment-token",
        token: "123",
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Invalid TOTP token format");
    });
  });

  it("should return MFA challenge token after OTP verification for privileged users with MFA", async () => {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/verify-token", {
        userId: "user-1",
        token: "123456",
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.mfaVerificationToken).toBe("signed-mfa-verification-token");
    });
  });

  it("should complete login with valid TOTP after MFA challenge", async () => {
    jwtMock.verify.mockImplementation((token: string) => {
      if (token === "challenge-token") {
        return {
          userId: "user-1",
          email: "admin@example.com",
          name: "Admin User",
          role: "super-admin",
        };
      }
      if (token === "verification-token") {
        return { userId: "user-1", mfaVerified: true };
      }
      throw new Error("Unexpected token");
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/login/mfa-complete", {
        mfaChallengeToken: "challenge-token",
        mfaVerificationToken: "verification-token",
      });

      expect(response.status).toBe(200);
      expect(response.body.token).toBe("signed-session-token");
      expect(response.body.user.email).toBe("admin@example.com");
    });
  });

  it("should reject MFA completion with mismatched tokens", async () => {
    jwtMock.verify.mockImplementation((token: string) => {
      if (token === "challenge-token") {
        return {
          userId: "user-1",
          email: "admin@example.com",
          name: "Admin User",
          role: "super-admin",
        };
      }
      if (token === "verification-token") {
        return { userId: "user-2", mfaVerified: true };
      }
      throw new Error("Unexpected token");
    });

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/login/mfa-complete", {
        mfaChallengeToken: "challenge-token",
        mfaVerificationToken: "verification-token",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Token mismatch");
    });
  });

  it("should verify recovery code and return MFA verification token", async () => {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/recovery-code", {
        userId: "user-1",
        code: "ABCD1234",
      });

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.mfaVerificationToken).toBe("signed-mfa-recovery-token");
      expect(response.body.warning).toContain("recovery code");
    });
  });

  it("should reject already-used recovery codes", async () => {
    mfaMock.verifyRecoveryCode.mockResolvedValueOnce(false);

    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/auth/mfa/recovery-code", {
        userId: "user-1",
        code: "ABCD1234",
      });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or already-used recovery code");
    });
  });

  it("should report MFA status correctly", async () => {
    await withServer(async (baseUrl) => {
      const response = await getJson(baseUrl, "/api/auth/mfa/status", {
        "x-test-user": JSON.stringify({
          id: "user-1",
          email: "admin@example.com",
          role: "super-admin",
        }),
      });

      expect(response.status).toBe(200);
      expect(response.body.enabled).toBe(true);
      expect(mfaMock.isMFAEnabled).toHaveBeenCalledWith("user-1");
    });
  });

  it("should disable MFA with correct password", async () => {
    await withServer(async (baseUrl) => {
      const response = await deleteJson(
        baseUrl,
        "/api/auth/mfa",
        { password: "CorrectPassword123!" },
        {
          "x-test-user": JSON.stringify({
            id: "user-1",
            email: "admin@example.com",
            role: "super-admin",
          }),
        },
      );

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(mfaMock.disableMFA).toHaveBeenCalledWith("user-1");
    });
  });

  it("should reject MFA disable without password", async () => {
    await withServer(async (baseUrl) => {
      const response = await deleteJson(
        baseUrl,
        "/api/auth/mfa",
        {},
        {
          "x-test-user": JSON.stringify({
            id: "user-1",
            email: "admin@example.com",
            role: "super-admin",
          }),
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Password required to disable MFA");
    });
  });

  it("should regenerate recovery codes with correct password", async () => {
    await withServer(async (baseUrl) => {
      const response = await postJson(
        baseUrl,
        "/api/auth/mfa/recovery-codes/regenerate",
        { password: "CorrectPassword123!" },
        {
          "x-test-user": JSON.stringify({
            id: "user-1",
            email: "admin@example.com",
            role: "super-admin",
          }),
        },
      );

      expect(response.status).toBe(200);
      expect(response.body.ok).toBe(true);
      expect(response.body.recoveryCodes).toHaveLength(10);
    });
  });

  it("should reject recovery code regeneration for disabled MFA", async () => {
    mfaMock.isMFAEnabled.mockResolvedValueOnce(false);

    await withServer(async (baseUrl) => {
      const response = await postJson(
        baseUrl,
        "/api/auth/mfa/recovery-codes/regenerate",
        { password: "CorrectPassword123!" },
        {
          "x-test-user": JSON.stringify({
            id: "user-1",
            email: "admin@example.com",
            role: "super-admin",
          }),
        },
      );

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("MFA is not currently enabled");
    });
  });
});
