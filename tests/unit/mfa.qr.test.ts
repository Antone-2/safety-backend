import { describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { MFAService } from "../../src/services/mfa.service.js";

describe("MFA QR code display contract", () => {
  it("returns a data URL PNG QR code with matching base32 secret", async () => {
    const service = new MFAService();
    const challenge = await service.generateSecret("qr-test@example.com");

    expect(challenge.qrCode).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
    expect(challenge.qrCode.length).toBeGreaterThan(1000);
    expect(challenge.secret).toMatch(/^[A-Z2-7=]+$/);
  });
});
