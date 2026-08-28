import { describe, expect, it } from "vitest";
import { StatutoryAuditService } from "../../../src/modules/statutory-audits/statutory-audits.service.js";
import { ALL_AUDIT_TYPES } from "../../../src/modules/statutory-audits/statutory-audits.types.js";

describe("StatutoryAuditService", () => {
  it("returns fallback locations and blank audit cells when the table is empty", async () => {
    const repository = {
      getMatrix: async () => ({
        locations: [],
        auditTypes: ALL_AUDIT_TYPES,
      }),
      getSummary: async () => ({
        totalLocations: 0,
        validCount: 0,
        expiredCount: 0,
        wipCount: 0,
        plannedCount: 0,
      }),
      upsertRecord: async () => undefined,
      findAll: async () => [],
      existsByLocation: async () => false,
      deleteByLocation: async () => undefined,
    };

    const service = new StatutoryAuditService(repository as any);
    const matrix = await service.getMatrix({ locationCategory: "FACTORIES", search: "MOMBASA" });

    expect(matrix.locations.length).toBeGreaterThan(0);
    expect(matrix.summary.totalLocations).toBe(matrix.locations.length);
    expect(matrix.locations[0].audits).toHaveLength(ALL_AUDIT_TYPES.length);
    expect(matrix.locations[0].audits.every((audit) => audit.dateDone === undefined)).toBe(true);
  });
});
