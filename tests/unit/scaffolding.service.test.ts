import { describe, expect, it, vi } from "vitest";

const mockRecords = [
  {
    id: "SCF-1",
    scaffoldNo: "SCAF-2026-0001",
    location: "Warehouse A",
    building: "Building 1",
    floor: "2nd",
    room: "Bay 1",
    type: "Standard",
    height: 6,
    length: 10,
    width: 3,
    erectedBy: "John Doe",
    erectedDate: "2026-01-01",
    inspectedBy: "Jane Smith",
    inspectedDate: "2026-01-15",
    nextInspectionDate: "2026-04-15",
    status: "In Use",
    tagNumber: "TAG-001",
    photos: ["photo1.jpg"],
    notes: "Regular inspection completed",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
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
  create: vi.fn().mockResolvedValue({
    id: "SCF-2",
    scaffoldNo: "SCAF-2026-0002",
    location: "Warehouse B",
    building: "Building 2",
    type: "Mobile",
    height: 4,
    erectedBy: "Jane Doe",
    status: "Erected",
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
    total: 1,
    inUse: 1,
    needsInspection: 0,
    taggedOut: 0,
  }),
};

vi.mock("../../src/modules/scaffolding/scaffolding.repository.js", () => ({
  ScaffoldRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    getStats = mockRepository.getStats;
  },
}));

describe("ScaffoldService", () => {
  it("returns all scaffolding records", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const records = await service.getAll();
    expect(records).toHaveLength(1);
    expect(records[0].location).toBe("Warehouse A");
  });

  it("filters scaffolding records by status", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const records = await service.getAll({ status: "In Use" });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("In Use");
  });

  it("returns scaffolding record by id", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const record = await service.getById("SCF-1");
    expect(record?.id).toBe("SCF-1");
    expect(record?.type).toBe("Standard");
  });

  it("creates new scaffolding record", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const record = await service.create({
      location: "Warehouse B",
      building: "Building 2",
      type: "Mobile",
      height: 4,
      erectedBy: "Jane Doe",
      createdBy: "Admin",
    });
    expect(record.id).toBe("SCF-2");
    expect(record.status).toBe("Erected");
  });

  it("returns scaffolding stats", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const stats = await service.getStats();
    expect(stats.total).toBe(1);
    expect(stats.inUse).toBe(1);
    expect(stats.needsInspection).toBe(0);
    expect(stats.taggedOut).toBe(0);
  });

  it("updates scaffolding record", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const updated = await service.update("SCF-1", { status: "Under Inspection" });
    expect(updated?.status).toBe("Under Inspection");
  });

  it("deletes scaffolding record", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    const deleted = await service.delete("SCF-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent scaffolding record", async () => {
    const { ScaffoldService } = await import("../../src/modules/scaffolding/scaffolding.service.js");
    const service = new ScaffoldService(
      new (await import("../../src/modules/scaffolding/scaffolding.repository.js")).ScaffoldRepository(),
    );
    await expect(service.update("non-existent", { status: "Dismantled" })).rejects.toThrow("Scaffold");
  });
});
