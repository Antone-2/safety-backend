import { describe, expect, it } from "vitest";
import { RiskService } from "../../../src/modules/risk/risk.service.js";
import type { RiskRegister } from "../../../src/modules/risk/risk.types.js";

function createRiskRegister(overrides: Partial<RiskRegister> = {}): RiskRegister {
  return {
    id: "RISK-001",
    title: "Boiler room inspection",
    location: "Mombasa Plant",
    department: "Engineering",
    activity: "Inspection",
    hazard: "Heat exposure",
    existingControls: "PPE and access control",
    likelihood: 2,
    severity: 3,
    riskRating: 6,
    riskLevel: "Medium",
    status: "Active",
    createdBy: "EHS Manager",
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
    ...overrides,
  };
}

describe("RiskService", () => {
  it("falls back to synced reports when no saved risk registers exist", async () => {
    const repository = {
      getRegisters: async () => [],
      getRiskReportCandidates: async () => [
        {
          id: "RPT-7001",
          location: "Nairobi Depot",
          department: "Warehouse",
          description: "Unprotected loading bay edge",
          severity: "High",
          category: "Working at Height",
          type: "Unsafe Condition",
          source: "google-sheets",
          reporter: "Sheet Reporter",
          created_at: "2026-07-28T08:00:00.000Z",
          updated_at: "2026-07-28T08:00:00.000Z",
        },
      ],
      getRegisterById: async () => null,
      createRegister: async () => createRiskRegister(),
      updateRegister: async () => createRiskRegister(),
      deleteRegister: async () => true,
      getMatrices: async () => [],
      getDefaultMatrix: async () => null,
      createMatrix: async () => { throw new Error("not used"); },
      getBowTies: async () => [],
      createBowTie: async () => { throw new Error("not used"); },
      getRiskDashboard: async () => ({ total: 0, low: 0, medium: 0, high: 0, critical: 0 }),
    };

    const service = new RiskService(repository as any);
    const registers = await service.getRegisters();

    expect(registers).toHaveLength(1);
    expect(registers[0]).toMatchObject({
      id: "report-risk-RPT-7001",
      sourceKind: "report-sync",
      readonly: true,
      riskLevel: "Medium",
    });
  });

  it("marks saved risk registers as database-backed records", async () => {
    const repository = {
      getRegisters: async () => [createRiskRegister()],
      getRiskReportCandidates: async () => [],
      getRegisterById: async () => createRiskRegister(),
      createRegister: async () => createRiskRegister(),
      updateRegister: async () => createRiskRegister(),
      deleteRegister: async () => true,
      getMatrices: async () => [],
      getDefaultMatrix: async () => null,
      createMatrix: async () => { throw new Error("not used"); },
      getBowTies: async () => [],
      createBowTie: async () => { throw new Error("not used"); },
      getRiskDashboard: async () => ({ total: 0, low: 0, medium: 0, high: 0, critical: 0 }),
    };

    const service = new RiskService(repository as any);
    const registers = await service.getRegisters();

    expect(registers[0]).toMatchObject({
      sourceKind: "database",
      readonly: false,
    });
  });
});
