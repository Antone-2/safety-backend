import { describe, expect, it, vi } from "vitest";

const mockRecords = [
  {
    id: "HLT-1",
    employeeId: "EMP-1",
    employeeName: "John Doe",
    department: "Production",
    site: "Factory A",
    type: "Audiometric",
    examinationDate: "2026-01-01",
    nextDueDate: "2027-01-01",
    frequency: "Annual",
    results: "Normal",
    fitnessForWork: true,
    doctorName: "Dr. Smith",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "HLT-2",
    employeeId: "EMP-2",
    employeeName: "Jane Smith",
    department: "Warehouse",
    site: "Factory B",
    type: "Respiratory",
    examinationDate: "2026-02-01",
    nextDueDate: "2026-08-01",
    frequency: "Biannual",
    fitnessForWork: true,
    doctorName: "Dr. Jones",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockRecords];
    if (filters?.type) {
      results = results.filter((r) => r.type === filters.type);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const record = mockRecords.find((r) => r.id === id);
    if (record) return Promise.resolve(record);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "HLT-3",
    employeeId: "EMP-3",
    employeeName: "Bob Johnson",
    department: "Production",
    site: "Factory A",
    type: "Vision",
    examinationDate: "2026-03-01",
    nextDueDate: "2027-03-01",
    frequency: "Annual",
    fitnessForWork: true,
    doctorName: "Dr. Brown",
    createdBy: "Admin",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockRecords.find((r) => r.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-03-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),
  findExpiring: vi.fn().mockResolvedValue(mockRecords),
  getStats: vi.fn().mockResolvedValue({
    total: 2,
    fitForWork: 2,
    notFit: 0,
    audiometric: 1,
    respiratory: 1,
  }),
};

vi.mock("../../src/modules/health/health.repository.js", () => ({
  HealthRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    findExpiring = mockRepository.findExpiring;
    getStats = mockRepository.getStats;
  },
}));

describe("HealthService", () => {
  it("returns all health records", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const records = await service.getRecords();
    expect(records).toHaveLength(2);
    expect(records[0].employeeName).toBe("John Doe");
  });

  it("filters health records by type", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const records = await service.getRecords({ type: "Audiometric" });
    expect(records).toHaveLength(1);
    expect(records[0].type).toBe("Audiometric");
  });

  it("returns health record by id", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const record = await service.getRecordById("HLT-1");
    expect(record?.id).toBe("HLT-1");
    expect(record?.doctorName).toBe("Dr. Smith");
  });

  it("creates new health record", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const record = await service.createRecord({
      employeeId: "EMP-3",
      employeeName: "Bob Johnson",
      department: "Production",
      site: "Factory A",
      type: "Vision",
      examinationDate: "2026-03-01",
      nextDueDate: "2027-03-01",
      frequency: "Annual",
      fitnessForWork: true,
      doctorName: "Dr. Brown",
      createdBy: "Admin",
    });
    expect(record.id).toBe("HLT-3");
    expect(record.type).toBe("Vision");
  });

  it("returns expiring surveillances", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const expiring = await service.getExpiringSurveillances(30);
    expect(expiring).toHaveLength(2);
  });

  it("returns health stats", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const stats = await service.getHealthStats();
    expect(stats.total).toBe(2);
    expect(stats.fitForWork).toBe(2);
    expect(stats.notFit).toBe(0);
    expect(stats.audiometric).toBe(1);
    expect(stats.respiratory).toBe(1);
  });

  it("updates health record", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const updated = await service.updateRecord("HLT-1", { findings: "Updated findings" });
    expect(updated?.findings).toBe("Updated findings");
  });

  it("deletes health record", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    const deleted = await service.deleteRecord("HLT-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent health record", async () => {
    const { HealthService } = await import("../../src/modules/health/health.service.js");
    const service = new HealthService(
      new (await import("../../src/modules/health/health.repository.js")).HealthRepository(),
    );
    await expect(service.updateRecord("non-existent", { findings: "Test" })).rejects.toThrow("Health record");
  });
});
