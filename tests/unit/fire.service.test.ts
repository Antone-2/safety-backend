import { describe, expect, it, vi } from "vitest";

const mockEquipment = [
  {
    id: "FIRE-1",
    type: "Extinguisher",
    location: "Warehouse A",
    building: "Building 1",
    assetTag: "FE-001",
    status: "Operational",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockInspections = [
  {
    id: "INS-1",
    equipmentId: "FIRE-1",
    inspector: "John Doe",
    inspectionDate: "2026-01-01",
    passed: true,
    nextInspectionDue: "2027-01-01",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findEquipment: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockEquipment];
    if (filters?.type) {
      results = results.filter((e) => e.type === filters.type);
    }
    return Promise.resolve(results);
  }),
  findEquipmentById: vi.fn().mockImplementation((id: string) => {
    const equipment = mockEquipment.find((e) => e.id === id);
    if (equipment) return Promise.resolve(equipment);
    return Promise.resolve(null);
  }),
  createEquipment: vi.fn().mockResolvedValue({
    id: "FIRE-2",
    type: "Hydrant",
    location: "Warehouse B",
    building: "Building 2",
    assetTag: "FH-001",
    status: "Operational",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateEquipment: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockEquipment.find((e) => e.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),
  deleteEquipment: vi.fn().mockResolvedValue(true),

  findInspections: vi.fn().mockResolvedValue(mockInspections),
  createInspection: vi.fn().mockResolvedValue({
    id: "INS-2",
    equipmentId: "FIRE-1",
    inspector: "Jane Smith",
    inspectionDate: "2026-02-01",
    passed: true,
    nextInspectionDue: "2027-02-01",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
  findOverdue: vi.fn().mockResolvedValue([]),

  getStats: vi.fn().mockResolvedValue({
    totalEquipment: 1,
    operational: 1,
    defective: 0,
    overdueInspections: 0,
    totalInspections: 1,
  }),
};

vi.mock("../../src/modules/fire/fire.repository.js", () => ({
  FireRepository: class {
    findEquipment = mockRepository.findEquipment;
    findEquipmentById = mockRepository.findEquipmentById;
    createEquipment = mockRepository.createEquipment;
    updateEquipment = mockRepository.updateEquipment;
    deleteEquipment = mockRepository.deleteEquipment;
    findInspections = mockRepository.findInspections;
    createInspection = mockRepository.createInspection;
    findOverdue = mockRepository.findOverdue;
    getStats = mockRepository.getStats;
  },
}));

describe("FireService", () => {
  it("returns all fire equipment", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const equipment = await service.getEquipment();
    expect(equipment).toHaveLength(1);
    expect(equipment[0].type).toBe("Extinguisher");
  });

  it("filters fire equipment by type", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const equipment = await service.getEquipment({ type: "Extinguisher" });
    expect(equipment).toHaveLength(1);
    expect(equipment[0].type).toBe("Extinguisher");
  });

  it("returns fire equipment by id", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const equipment = await service.getEquipmentById("FIRE-1");
    expect(equipment?.id).toBe("FIRE-1");
    expect(equipment?.assetTag).toBe("FE-001");
  });

  it("creates new fire equipment", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const equipment = await service.createEquipment({
      type: "Hydrant",
      location: "Warehouse B",
      building: "Building 2",
      assetTag: "FH-001",
      createdBy: "Admin",
    });
    expect(equipment.id).toBe("FIRE-2");
    expect(equipment.status).toBe("Operational");
  });

  it("returns all inspections", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const inspections = await service.getInspections();
    expect(inspections).toHaveLength(1);
    expect(inspections[0].inspector).toBe("John Doe");
  });

  it("creates a new inspection", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const inspection = await service.createInspection({
      equipmentId: "FIRE-1",
      inspector: "Jane Smith",
      inspectionDate: "2026-02-01",
      passed: true,
      nextInspectionDue: "2027-02-01",
      createdBy: "Admin",
    });
    expect(inspection.id).toBe("INS-2");
    expect(inspection.passed).toBe(true);
  });

  it("returns fire stats", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const stats = await service.getFireStats();
    expect(stats.totalEquipment).toBe(1);
    expect(stats.operational).toBe(1);
    expect(stats.defective).toBe(0);
    expect(stats.totalInspections).toBe(1);
  });

  it("returns overdue inspections", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const overdue = await service.getOverdueInspections();
    expect(overdue).toHaveLength(0);
  });

  it("updates fire equipment", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const updated = await service.updateEquipment("FIRE-1", { status: "Defective" });
    expect(updated?.status).toBe("Defective");
  });

  it("deletes fire equipment", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    const deleted = await service.deleteEquipment("FIRE-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent fire equipment", async () => {
    const { FireService } = await import("../../src/modules/fire/fire.service.js");
    const service = new FireService(
      new (await import("../../src/modules/fire/fire.repository.js")).FireRepository(),
    );
    await expect(service.updateEquipment("non-existent", { status: "Defective" })).rejects.toThrow("Fire equipment");
  });
});
