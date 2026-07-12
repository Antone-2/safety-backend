import { describe, expect, it, vi } from "vitest";

const mockRecords = [
  {
    id: "SDS-1",
    sdsNo: "SDS-2026-0001",
    chemicalName: "Acetone",
    casNumber: "67-64-1",
    supplier: "ChemCorp",
    hazardClass: "Flammable",
    signalWord: "Danger",
    status: "Active",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "SDS-2",
    chemicalName: "Hydrochloric Acid",
    casNumber: "7647-01-0",
    supplier: "AcidSupply",
    hazardClass: "Corrosive",
    signalWord: "Danger",
    status: "Active",
    createdBy: "Admin",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockRecords];
    if (filters?.status) {
      results = results.filter((r) => r.status === filters.status);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const record = mockRecords.find((r) => r.id === id);
    if (record) return Promise.resolve(record);
    return Promise.resolve(null);
  }),
  searchByChemical: vi.fn().mockImplementation((name: string) => {
    return Promise.resolve(mockRecords.filter((r) => r.chemicalName.toLowerCase().includes(name.toLowerCase())));
  }),
  create: vi.fn().mockResolvedValue({
    id: "SDS-3",
    sdsNo: "SDS-2026-0003",
    chemicalName: "Methanol",
    casNumber: "67-56-1",
    supplier: "ChemCorp",
    hazardClass: "Flammable",
    signalWord: "Danger",
    status: "Active",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockRecords.find((r) => r.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),
  getStats: vi.fn().mockResolvedValue({
    total: 2,
    active: 2,
    expired: 0,
    overdue: 0,
  }),
};

vi.mock("../../src/modules/sds/sds.repository.js", () => ({
  SdsRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    searchByChemical = mockRepository.searchByChemical;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    getStats = mockRepository.getStats;
  },
}));

describe("SdsService", () => {
  it("returns all SDS records", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const records = await service.getAll();
    expect(records).toHaveLength(2);
    expect(records[0].chemicalName).toBe("Acetone");
  });

  it("filters SDS records by status", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const records = await service.getAll({ status: "Active" });
    expect(records).toHaveLength(2);
    expect(records[0].status).toBe("Active");
  });

  it("returns SDS by id", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const sds = await service.getById("SDS-1");
    expect(sds?.id).toBe("SDS-1");
    expect(sds?.casNumber).toBe("67-64-1");
  });

  it("searches SDS by chemical name", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const results = await service.searchByChemical("acetone");
    expect(results).toHaveLength(1);
    expect(results[0].chemicalName).toBe("Acetone");
  });

  it("creates new SDS with SDS number", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const sds = await service.create({
      chemicalName: "Methanol",
      casNumber: "67-56-1",
      supplier: "ChemCorp",
      hazardClass: "Flammable",
      signalWord: "Danger",
      createdBy: "Admin",
    });
    expect(sds.id).toBe("SDS-3");
    expect(sds.status).toBe("Active");
  });

  it("returns SDS stats", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const stats = await service.getStats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(2);
    expect(stats.expired).toBe(0);
    expect(stats.overdue).toBe(0);
  });

  it("updates SDS", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const updated = await service.update("SDS-1", { status: "Expired" });
    expect(updated?.status).toBe("Expired");
  });

  it("deletes SDS", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    const deleted = await service.delete("SDS-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent SDS", async () => {
    const { SdsService } = await import("../../src/modules/sds/sds.service.js");
    const service = new SdsService(
      new (await import("../../src/modules/sds/sds.repository.js")).SdsRepository(),
    );
    await expect(service.update("non-existent", { status: "Expired" })).rejects.toThrow("SDS");
  });
});
