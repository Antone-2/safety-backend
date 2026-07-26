import { describe, expect, it } from "vitest";

import { hasMatchingDeviceFingerprint } from "../../src/modules/auth/auth.module.js";

describe("hasMatchingDeviceFingerprint", () => {
  it("matches PostgreSQL-style device_fingerprint values", () => {
    expect(
      hasMatchingDeviceFingerprint(
        [{ device_fingerprint: "fingerprint-1" }],
        "fingerprint-1",
      ),
    ).toBe(true);
  });

  it("matches SQLite-style deviceFingerprint values", () => {
    expect(
      hasMatchingDeviceFingerprint(
        [{ deviceFingerprint: "fingerprint-1" }],
        "fingerprint-1",
      ),
    ).toBe(true);
  });

  it("returns false when no stored session fingerprint matches", () => {
    expect(
      hasMatchingDeviceFingerprint(
        [
          { device_fingerprint: "fingerprint-1" },
          { deviceFingerprint: "fingerprint-2" },
        ],
        "fingerprint-3",
      ),
    ).toBe(false);
  });
});
