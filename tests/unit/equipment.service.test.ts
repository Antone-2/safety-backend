import { describe, expect, it, vi } from "vitest";

const mockEquipment = [
  {
    id: "EQ-1",
    name: "Forklift 3T",
    type: "SafetyEquipment",
    category: "Material Handling",
    assetTag: "FL-003",
    serialNumber: "FL3T-001",
    manufacturer: "Toyota",
    model: "8FD30",
    location: "Warehouse A",
    site: "Nairobi Plant",
    department: "Logistics",
    purchaseDate: "2025-01-01",
    installationDate: "2025-01-15",
    warrantyExpiry: "2026-01-15",
    lastInspectionDate: "2026-01-01",
    nextInspectionDate: "2026-02-01",
    inspectionFrequency: "Monthly",
    status: "Operational",
    condition: "Good",
    assignedTo: "Warehouse Supervisor",
    notes: "",
    photoUrl: "",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "EQ-2",
    name: "VOC Area Monitor",
    type: "Monitoring",
    category: "Air Monitoring",
    assetTag: "VOC-014",
    manufacturer: "Honeywell",
    location: "Solvent Store",
    site: "Nairobi Plant",
    department: "Production",
    nextInspectionDate: "2025-12-01",
    inspectionFrequency: "Monthly",
    status: "Under Maintenance",
    condition: "Calibration due",
    assignedTo: "EHS Technician",
    notes: "",
    photoUrl: "",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockInspections = [
  {
    id: "INS-1",
    equipmentId: "EQ-1",
    inspector: "John Doe",
    inspectionDate: "2026-01-01",
    inspectionType: "Routine",
    findings: "No issues",
    defects: "",
    actionRequired: "",
    passed: true,
    nextInspectionDue: "2026-02-01",
    photoUrl: "",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockEquipment];
    if (filters?.status) {
      results = results.filter((e) => e.status === filters.status);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const equipment = mockEquipment.find((e) => e.id === id);
    if (equipment) return Promise.resolve(equipment);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "EQ-3",
    name: "New Equipment",
    type: "SafetyEquipment",
    category: "Test",
    assetTag: "TEST-001",
    location: "Test Location",
    site: "Test Site",
    department: "Test",
    status: "Operational",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockEquipment.find((e) => e.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),

  findInspections: vi.fn().mockResolvedValue(mockInspections),
  createInspection: vi.fn().mockResolvedValue({
    id: "INS-2",
    equipmentId: "EQ-1",
    inspector: "Jane Smith",
    inspectionDate: "2026-02-01",
    inspectionType: "Routine",
    passed: true,
    nextInspectionDue: "2026-03-01",
    findings: "Passed",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
  }),

  getStats: vi.fn().mockResolvedValue({
    total: 2,
    operational: 1,
    maintenance: 1,
    retired: 0,
  }),

  count: vi.fn().mockResolvedValue(2),
};

vi.mock("../../src/modules/equipment/equipment.repository.js", () => ({
  EquipmentRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    findInspections = mockRepository.findInspections;
    createInspection = mockRepository.createInspection;
    getStats = mockRepository.getStats;
    count = mockRepository.count;
  },
}));

describe("EquipmentService", () => {
  it("returns all equipment", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const equipment = await service.getEquipment();
    expect(equipment).toHaveLength(2);
    expect(equipment[0].name).toBe("Forklift 3T");
  });

  it("filters equipment by status", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const equipment = await service.getEquipment({ status: "Operational" });
    expect(equipment).toHaveLength(1);
    expect(equipment[0].status).toBe("Operational");
  });

  it("returns equipment by id", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const item = await service.getEquipmentById("EQ-1");
    expect(item?.id).toBe("EQ-1");
    expect(item?.assetTag).toBe("FL-003");
  });

  it("creates new equipment", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const equipment = await service.createEquipment({
      name: "New Equipment",
      type: "SafetyEquipment",
      category: "Test",
      assetTag: "TEST-001",
      location: "Test Location",
      site: "Test Site",
      department: "Test",
      createdBy: "Admin",
    });
    expect(equipment.id).toBe("EQ-3");
    expect(equipment.status).toBe("Operational");
  });

  it("returns all inspections", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const inspections = await service.getInspections();
    expect(inspections).toHaveLength(1);
    expect(inspections[0].inspector).toBe("John Doe");
  });

  it("creates a new inspection", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const inspection = await service.createInspection({
      equipmentId: "EQ-1",
      inspector: "Jane Smith",
      inspectionDate: "2026-02-01",
      inspectionType: "Routine",
      passed: true,
      nextInspectionDue: "2026-03-01",
      createdBy: "Admin",
    });
    expect(inspection.id).toBe("INS-2");
    expect(inspection.passed).toBe(true);
  });

  it("returns equipment stats", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const stats = await service.getEquipmentStats();
    expect(stats.total).toBe(2);
    expect(stats.operational).toBe(1);
    expect(stats.maintenance).toBe(1);
  });

  it("throws NotFoundError when updating non-existent equipment", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    await expect(service.updateEquipment("non-existent", { name: "Test" })).rejects.toThrow("Equipment");
  });

  it("deletes equipment", async () => {
    const { EquipmentService } = await import("../../src/modules/equipment/equipment.service.js");
    const service = new EquipmentService(
      new (await import("../../src/modules/equipment/equipment.repository.js")).EquipmentRepository(),
    );
    const deleted = await service.deleteEquipment("EQ-1");
    expect(deleted).toBe(true);
  });
});
