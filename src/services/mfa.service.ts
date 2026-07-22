import { createHash, createHmac, randomBytes } from "crypto";
import type { Pool } from "pg";
import * as QRCode from "qrcode";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";

// TOTP implementation using HMAC-SHA1 and base32
// Based on RFC 6238 (TOTP) and RFC 4648 (Base32)

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const MFA_TOTP_TIME_STEP_SECONDS = 30;
const MFA_TOTP_ALLOWED_WINDOW = 2;
const MFA_TOTP_ENROLLMENT_WINDOW = 6;

function base32Encode(bytes: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  while (result.length % 8 !== 0) {
    result += "=";
  }

  return result;
}

function base32Decode(str: string): Buffer {
  const str_cleaned = str.replace(/=/g, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of str_cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char.toUpperCase());
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  return Buffer.from(bytes);
}

function generateHOTP(secret: Buffer, counter: number): number {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return code % 1000000;
}

function generateTOTP(
  secret: Buffer,
  timeStep: number = 30,
  time: number = Date.now(),
): number {
  const counter = Math.floor(time / 1000 / timeStep);
  return generateHOTP(secret, counter);
}

function findTOTPMatchOffset(
  secret: Buffer,
  token: string,
  timeStep: number = MFA_TOTP_TIME_STEP_SECONDS,
  window: number = MFA_TOTP_ALLOWED_WINDOW,
  time: number = Date.now(),
  driftSteps: number = 0,
): number | null {
  const normalizedToken = token.replace(/\s+/g, "").trim();
  const tokenNum = parseInt(normalizedToken, 10);
  if (isNaN(tokenNum) || normalizedToken.length !== 6) return null;
  const counter = Math.floor(time / 1000 / timeStep);
  for (let i = -window; i <= window; i++) {
    const offset = driftSteps + i;
    if (generateHOTP(secret, counter + offset) === tokenNum) {
      return offset;
    }
  }
  return null;
}

export type MFASetupChallenge = {
  secret: string;
  qrCode: string;
};

export type MFARecoveryCode = {
  code: string;
};

export class MFAService {
  constructor(private pool: Pool = pgPool) {}

  async generateSecret(email: string): Promise<MFASetupChallenge> {
    const secret = randomBytes(20);
    const base32Secret = base32Encode(secret);
    const otpauthUrl = `otpauth://totp/Crown%20Safety%20(${encodeURIComponent(email)})?secret=${base32Secret}&issuer=Crown%20Safety`;
    const qrCode = await QRCode.toDataURL(otpauthUrl, {
      width: 200,
      margin: 2,
      errorCorrectionLevel: "M",
    });
    return { secret: base32Secret, qrCode };
  }

  generateRecoveryCodes(count: number = 10): MFARecoveryCode[] {
    return Array.from({ length: count }, () => ({
      code: randomBytes(4).toString("hex").toUpperCase(),
    }));
  }

  async createMFAEnrollment(
    userId: string,
    secret: string,
    recoveryCodesRaw: string[],
  ): Promise<void> {
    try {
      await this.pool.query("BEGIN");

      await this.pool.query(
        `INSERT INTO user_mfa (user_id, secret, verified, enabled)
         VALUES ($1, $2, FALSE, FALSE)
         ON CONFLICT (user_id) DO UPDATE SET secret = $2, verified = FALSE, enabled = FALSE, updated_at = NOW()`,
        [userId, secret],
      );

      await this.pool.query("DELETE FROM mfa_recovery_codes WHERE user_id = $1", [userId]);

      for (const code of recoveryCodesRaw) {
        const codeHash = createHash("sha256").update(code).digest("hex");
        await this.pool.query(
          `INSERT INTO mfa_recovery_codes (user_id, code_hash)
           VALUES ($1, $2)`,
          [userId, codeHash],
        );
      }

      await this.pool.query("COMMIT");
    } catch (err) {
      await this.pool.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  }

  async verifyMFAEnrollment(userId: string, token: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT secret FROM user_mfa WHERE user_id = $1 AND enabled = FALSE",
        [userId],
      );

      if (!result.rows[0]) return false;

      const storedSecret = result.rows[0].secret;
      const secretBinary = base32Decode(storedSecret);

      const driftOffset = findTOTPMatchOffset(
        secretBinary,
        token,
        MFA_TOTP_TIME_STEP_SECONDS,
        MFA_TOTP_ENROLLMENT_WINDOW,
      );
      const isValid = driftOffset !== null;

      if (isValid) {
        await this.pool.query(
          `UPDATE user_mfa
           SET verified = TRUE,
               enabled = TRUE,
               verified_at = NOW(),
               drift_steps = $2,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId, driftOffset],
        );
      }

      return isValid;
    } catch {
      return false;
    }
  }

  async verifyTOTPToken(userId: string, token: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT secret, drift_steps FROM user_mfa WHERE user_id = $1 AND enabled = TRUE",
        [userId],
      );

      if (!result.rows[0]) return false;

      const storedSecret = result.rows[0].secret;
      const storedDrift = Number(result.rows[0].drift_steps ?? 0);
      const secretBinary = base32Decode(storedSecret);
      let driftOffset = findTOTPMatchOffset(
        secretBinary,
        token,
        MFA_TOTP_TIME_STEP_SECONDS,
        MFA_TOTP_ALLOWED_WINDOW,
        Date.now(),
        storedDrift,
      );

      if (driftOffset === null) {
        driftOffset = findTOTPMatchOffset(
          secretBinary,
          token,
          MFA_TOTP_TIME_STEP_SECONDS,
          MFA_TOTP_ENROLLMENT_WINDOW,
        );
      }

      if (driftOffset === null) {
        return false;
      }

      if (driftOffset !== storedDrift) {
        await this.pool.query(
          `UPDATE user_mfa
           SET drift_steps = $2,
               updated_at = NOW()
           WHERE user_id = $1`,
          [userId, driftOffset],
        );
      }

      return true;
    } catch {
      return false;
    }
  }

  async verifyRecoveryCode(userId: string, code: string): Promise<boolean> {
    try {
      const codeHash = createHash("sha256").update(code.toUpperCase()).digest("hex");

      const result = await this.pool.query(
        `SELECT id FROM mfa_recovery_codes
         WHERE user_id = $1 AND code_hash = $2 AND used_at IS NULL
         LIMIT 1`,
        [userId, codeHash],
      );

      if (!result.rows[0]) return false;

      await this.pool.query(
        `UPDATE mfa_recovery_codes SET used_at = NOW()
         WHERE user_id = $1 AND code_hash = $2`,
        [userId, codeHash],
      );

      return true;
    } catch {
      return false;
    }
  }

  async isMFAEnabled(userId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        "SELECT enabled FROM user_mfa WHERE user_id = $1",
        [userId],
      );
      return result.rows[0]?.enabled ?? false;
    } catch {
      return false;
    }
  }

  async disableMFA(userId: string): Promise<void> {
    try {
      await this.pool.query("BEGIN");

      await this.pool.query(
        `UPDATE user_mfa SET enabled = FALSE
         WHERE user_id = $1`,
        [userId],
      );

      await this.pool.query(
        `DELETE FROM mfa_recovery_codes WHERE user_id = $1`,
        [userId],
      );

      await this.pool.query("COMMIT");
    } catch (err) {
      await this.pool.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  }
}

export const mfaService = new MFAService();
