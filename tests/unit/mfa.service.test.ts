import { beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { MFAService } from "../../src/services/mfa.service.js";

type UserMfaRow = {
  user_id: string;
  secret: string;
  verified: boolean;
  enabled: boolean;
  verified_at?: string;
  updated_at?: string;
};

type RecoveryCodeRow = {
  user_id: string;
  code_hash: string;
  used_at: string | null;
};

function createMockPool() {
  const userMfa = new Map<string, UserMfaRow>();
  const recoveryCodes: RecoveryCodeRow[] = [];

  const pool = {
    query: async (sql: string, params: unknown[] = []) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes("INSERT INTO user_mfa")) {
        const [userId, secret] = params as [string, string];
        userMfa.set(userId, {
          user_id: userId,
          secret,
          verified: false,
          enabled: false,
          updated_at: new Date().toISOString(),
        });
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("DELETE FROM mfa_recovery_codes WHERE user_id = $1")) {
        const [userId] = params as [string];
        for (let i = recoveryCodes.length - 1; i >= 0; i -= 1) {
          if (recoveryCodes[i].user_id === userId) recoveryCodes.splice(i, 1);
        }
        return { rows: [], rowCount: 0 };
      }

      if (sql.includes("INSERT INTO mfa_recovery_codes")) {
        const [userId, codeHash] = params as [string, string];
        recoveryCodes.push({ user_id: userId, code_hash: codeHash, used_at: null });
        return { rows: [], rowCount: 1 };
      }

      if (sql.includes("SELECT * FROM user_mfa WHERE user_id = $1")) {
        const [userId] = params as [string];
        const row = userMfa.get(userId);
        return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
      }

      if (sql.includes("SELECT enabled FROM user_mfa WHERE user_id = $1")) {
        const [userId] = params as [string];
        const row = userMfa.get(userId);
        return { rows: row ? [{ enabled: row.enabled }] : [], rowCount: row ? 1 : 0 };
      }

      if (sql.includes("SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = $1")) {
        const [userId] = params as [string];
        const count = recoveryCodes.filter((row) => row.user_id === userId).length;
        return { rows: [{ count: String(count) }], rowCount: 1 };
      }

      if (sql.includes("UPDATE user_mfa SET enabled = FALSE")) {
        const [userId] = params as [string];
        const row = userMfa.get(userId);
        if (row) row.enabled = false;
        return { rows: [], rowCount: row ? 1 : 0 };
      }

      throw new Error(`Unhandled query in MFA unit test: ${sql}`);
    },
  } satisfies Pick<Pool, "query">;

  return pool;
}

describe("MFA Service", () => {
  let mfaService: MFAService;
  let pool: Pick<Pool, "query">;
  const testUserId = "user-mfa-test";

  beforeEach(() => {
    pool = createMockPool();
    mfaService = new MFAService(pool as Pool);
  });

  it("should generate a valid TOTP secret and QR code", async () => {
    const challenge = await mfaService.generateSecret("test@example.com");

    expect(challenge.secret).toBeDefined();
    expect(challenge.secret).toMatch(/^[A-Z2-7=]+$/);
    expect(challenge.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it("should generate recovery codes", () => {
    const codes = mfaService.generateRecoveryCodes(10);

    expect(codes).toHaveLength(10);
    expect(codes[0].code).toBeDefined();
    expect(codes[0].code).toMatch(/^[A-F0-9]+$/);
    expect(codes[0].code).toHaveLength(8);
  });

  it("should create MFA enrollment", async () => {
    const challenge = await mfaService.generateSecret("test@example.com");
    const codes = mfaService.generateRecoveryCodes(10);

    await mfaService.createMFAEnrollment(
      testUserId,
      challenge.secret,
      codes.map((c) => c.code),
    );

    const result = await pool.query("SELECT * FROM user_mfa WHERE user_id = $1", [testUserId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].verified).toBe(false);
    expect(result.rows[0].enabled).toBe(false);

    const codesResult = await pool.query(
      "SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = $1",
      [testUserId],
    );

    expect(Number.parseInt(String(codesResult.rows[0].count), 10)).toBe(10);
  });

  it("should check if MFA is enabled for a user", async () => {
    const enabled = await mfaService.isMFAEnabled(testUserId);
    expect(enabled).toBe(false);
  });

  it("should disable MFA", async () => {
    const challenge = await mfaService.generateSecret("test@example.com");
    const codes = mfaService.generateRecoveryCodes(10);

    await mfaService.createMFAEnrollment(
      testUserId,
      challenge.secret,
      codes.map((c) => c.code),
    );

    await mfaService.disableMFA(testUserId);

    const result = await pool.query("SELECT enabled FROM user_mfa WHERE user_id = $1", [
      testUserId,
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].enabled).toBe(false);

    const codesResult = await pool.query(
      "SELECT COUNT(*) as count FROM mfa_recovery_codes WHERE user_id = $1",
      [testUserId],
    );

    expect(Number.parseInt(String(codesResult.rows[0].count), 10)).toBe(0);
  });

  it("should handle duplicate enrollment attempts", async () => {
    const challenge1 = await mfaService.generateSecret("test@example.com");
    const challenge2 = await mfaService.generateSecret("test@example.com");
    const codes = mfaService.generateRecoveryCodes(10);

    await mfaService.createMFAEnrollment(
      testUserId,
      challenge1.secret,
      codes.map((c) => c.code),
    );

    await mfaService.createMFAEnrollment(
      testUserId,
      challenge2.secret,
      codes.map((c) => c.code),
    );

    const result = await pool.query("SELECT * FROM user_mfa WHERE user_id = $1", [
      testUserId,
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].secret).toBe(challenge2.secret);
  });
});
