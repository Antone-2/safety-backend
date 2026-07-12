import { describe, expect, it, vi } from "vitest";

const mockWaste = [
  {
    id: "WST-1",
    type: "Hazardous",
    category: "Chemicals",
    description: "Used solvent",
    quantity: 10,
    unit: "L",
    generatedDate: "2026-01-01",
    storedLocation: "Hazardous store",
    status: "Stored",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockEmissions = [
  {
    id: "EMI-1",
    type: "Air",
    parameter: "PM2.5",
    location: "Boiler house",
    value: 25,
    unit: "mg/m3",
    limit: 30,
    monitoredDate: "2026-01-01",
    monitoredBy: "EHS Officer",
    status: "Within Limit",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockChemicals = [
  {
    id: "CHEM-1",
    name: "Acetone",
    casNumber: "67-64-1",
    quantity: 50,
    unit: "L",
    storageLocation: "Flammable store",
    hazardClass: "Flammable",
    sdsUrl: "https://example.com/sds/acetone",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockSpills = [
  {
    id: "SPL-1",
    chemical: "Acetone",
    quantity: 5,
    unit: "L",
    location: "Lab 2",
    date: "2026-03-01",
    time: "14:30",
    severity: "Minor",
    cleanupCompleted: true,
    reportedToNema: false,
    createdBy: "Lab Technician",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findWaste: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockWaste];
    if (filters?.type) {
      results = results.filter((w) => w.type === filters.type);
    }
    return Promise.resolve(results);
  }),
  createWaste: vi.fn().mockResolvedValue({
    id: "WST-2",
    type: "Recyclable",
    category: "Paper",
    description: "Office paper waste",
    quantity: 20,
    unit: "kg",
    generatedDate: "2026-02-01",
    storedLocation: "Recycling bay",
    status: "Stored",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateWaste: vi.fn().mockImplementation((id: string, data: unknown) => {
    if (id === "non-existent") return Promise.resolve(null);
    const existing = mockWaste[0];
    return Promise.resolve({ ...existing, id, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),

  findEmissions: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockEmissions];
    if (filters?.type) {
      results = results.filter((e) => e.type === filters.type);
    }
    return Promise.resolve(results);
  }),
  createEmission: vi.fn().mockResolvedValue({
    id: "EMI-2",
    type: "Water",
    parameter: "pH",
    location: "Effluent pond",
    value: 7.2,
    unit: "pH",
    monitoredDate: "2026-02-01",
    monitoredBy: "EHS Officer",
    status: "Within Limit",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateEmission: vi.fn().mockImplementation((id: string, data: unknown) => {
    if (id === "non-existent") return Promise.resolve(null);
    const existing = mockEmissions[0];
    return Promise.resolve({ ...existing, id, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),

  findChemicals: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockChemicals];
    if (filters?.name) {
      results = results.filter((c) => c.name === filters.name);
    }
    return Promise.resolve(results);
  }),
  createChemical: vi.fn().mockResolvedValue({
    id: "CHEM-2",
    name: "Methanol",
    quantity: 30,
    unit: "L",
    storageLocation: "Flammable store",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateChemical: vi.fn().mockImplementation((id: string, data: unknown) => {
    if (id === "non-existent") return Promise.resolve(null);
    const existing = mockChemicals[0];
    return Promise.resolve({ ...existing, id, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),

  findSpills: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockSpills];
    if (filters?.severity) {
      results = results.filter((s) => s.severity === filters.severity);
    }
    return Promise.resolve(results);
  }),
  createSpill: vi.fn().mockResolvedValue({
    id: "SPL-2",
    chemical: "Diesel",
    quantity: 10,
    unit: "L",
    location: "Fuel station",
    date: "2026-03-02",
    time: "09:15",
    severity: "Major",
    cleanupCompleted: false,
    reportedToNema: true,
    createdBy: "Safety Officer",
    createdAt: "2026-03-02T00:00:00.000Z",
    updatedAt: "2026-03-02T00:00:00.000Z",
  }),
  updateSpill: vi.fn().mockImplementation((id: string, data: unknown) => {
    if (id === "non-existent") return Promise.resolve(null);
    const existing = mockSpills[0];
    return Promise.resolve({ ...existing, id, ...data, updatedAt: "2026-03-02T00:00:00.000Z" });
  }),

  getStats: vi.fn().mockResolvedValue({
    totalWaste: 1,
    hazardousWaste: 1,
    totalEmissions: 1,
    exceedances: 0,
    totalChemicals: 1,
    totalSpills: 1,
    majorSpills: 0,
  }),
};

vi.mock("../../src/modules/environmental/environmental.repository.js", () => ({
  EnvironmentalRepository: class {
    findWaste = mockRepository.findWaste;
    createWaste = mockRepository.createWaste;
    updateWaste = mockRepository.updateWaste;
    findEmissions = mockRepository.findEmissions;
    createEmission = mockRepository.createEmission;
    updateEmission = mockRepository.updateEmission;
    findChemicals = mockRepository.findChemicals;
    createChemical = mockRepository.createChemical;
    updateChemical = mockRepository.updateChemical;
    findSpills = mockRepository.findSpills;
    createSpill = mockRepository.createSpill;
    updateSpill = mockRepository.updateSpill;
    getStats = mockRepository.getStats;
  },
}));

describe("EnvironmentalService", () => {
  it("returns waste records", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const waste = await service.getWaste();
    expect(waste).toHaveLength(1);
    expect(waste[0].type).toBe("Hazardous");
  });

  it("filters waste by type", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const waste = await service.getWaste({ type: "Hazardous" });
    expect(waste).toHaveLength(1);
    expect(waste[0].type).toBe("Hazardous");
  });

  it("creates waste record", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const waste = await service.createWaste({
      type: "Recyclable",
      category: "Paper",
      description: "Office paper waste",
      quantity: 20,
      unit: "kg",
      generatedDate: "2026-02-01",
      storedLocation: "Recycling bay",
      createdBy: "Admin",
    });
    expect(waste.id).toBe("WST-2");
    expect(waste.status).toBe("Stored");
  });

  it("returns emissions", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const emissions = await service.getEmissions();
    expect(emissions).toHaveLength(1);
    expect(emissions[0].parameter).toBe("PM2.5");
  });

  it("returns chemicals", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const chemicals = await service.getChemicals();
    expect(chemicals).toHaveLength(1);
    expect(chemicals[0].name).toBe("Acetone");
  });

  it("returns spills", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const spills = await service.getSpills();
    expect(spills).toHaveLength(1);
    expect(spills[0].severity).toBe("Minor");
  });

  it("returns environmental stats", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    const stats = await service.getEnvironmentalStats();
    expect(stats.totalWaste).toBe(1);
    expect(stats.hazardousWaste).toBe(1);
    expect(stats.totalEmissions).toBe(1);
    expect(stats.exceedances).toBe(0);
    expect(stats.totalChemicals).toBe(1);
    expect(stats.totalSpills).toBe(1);
    expect(stats.majorSpills).toBe(0);
  });

  it("throws NotFoundError when updating non-existent waste", async () => {
    const { EnvironmentalService } = await import("../../src/modules/environmental/environmental.service.js");
    const service = new EnvironmentalService(
      new (await import("../../src/modules/environmental/environmental.repository.js")).EnvironmentalRepository(),
    );
    await expect(service.updateWaste("non-existent", { status: "Disposed" })).rejects.toThrow("Waste record");
  });
});
