import { describe, expect, it, vi } from "vitest";

const mockRecords = [
  {
    id: "HGT-1",
    permitNo: "HGT-2026-0001",
    location: "Warehouse A",
    building: "Building 1",
    floor: "2nd",
    taskDescription: "Roof maintenance",
    height: 6,
    fallProtection: "Harness and lifeline",
    rescuePlan: "Rescue plan in place",
    harnessInspectionDate: "2026-01-01",
    anchorPointInspected: true,
    workersCount: 2,
    workers: "John, Jane",
    supervisor: "Supervisor A",
    startDate: "2026-01-01",
    endDate: "2026-01-02",
    status: "Planned",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
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
    id: "HGT-2",
    permitNo: "HGT-2026-0002",
    location: "Warehouse B",
    building: "Building 2",
    taskDescription: "Equipment repair",
    height: 4,
    workersCount: 1,
    supervisor: "Supervisor B",
    startDate: "2026-02-01",
    endDate: "2026-02-02",
    status: "Planned",
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
    inProgress: 0,
    completed: 0,
    planned: 1,
  }),
};

vi.mock("../../src/modules/heightwork/heightwork.repository.js", () => ({
  HeightWorkRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    getStats = mockRepository.getStats;
  },
}));

describe("HeightWorkService", () => {
  it("returns all height work records", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const records = await service.getAll();
    expect(records).toHaveLength(1);
    expect(records[0].location).toBe("Warehouse A");
  });

  it("filters height work records by status", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const records = await service.getAll({ status: "Planned" });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("Planned");
  });

  it("returns height work record by id", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const record = await service.getById("HGT-1");
    expect(record?.id).toBe("HGT-1");
    expect(record?.supervisor).toBe("Supervisor A");
  });

  it("creates new height work record with permit number", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const record = await service.create({
      location: "Warehouse B",
      building: "Building 2",
      taskDescription: "Equipment repair",
      height: 4,
      workersCount: 1,
      supervisor: "Supervisor B",
      startDate: "2026-02-01",
      endDate: "2026-02-02",
      createdBy: "Admin",
    });
    expect(record.id).toBe("HGT-2");
    expect(record.status).toBe("Planned");
  });

  it("returns height work stats", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const stats = await service.getStats();
    expect(stats.total).toBe(1);
    expect(stats.planned).toBe(1);
    expect(stats.inProgress).toBe(0);
    expect(stats.completed).toBe(0);
  });

  it("updates height work record", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const updated = await service.update("HGT-1", { status: "In Progress" });
    expect(updated?.status).toBe("In Progress");
  });

  it("deletes height work record", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    const deleted = await service.delete("HGT-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent height work record", async () => {
    const { HeightWorkService } = await import("../../src/modules/heightwork/heightwork.service.js");
    const service = new HeightWorkService(
      new (await import("../../src/modules/heightwork/heightwork.repository.js")).HeightWorkRepository(),
    );
    await expect(service.update("non-existent", { status: "Completed" })).rejects.toThrow("Height work record");
  });
});
