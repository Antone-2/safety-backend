import { describe, expect, it, vi } from "vitest";

const mockPpeItems = [
  {
    id: "PPE-1",
    ppeNo: "PPE-2026-0001",
    type: "Hard Hat",
    description: "Yellow hard hat",
    assignedTo: "John Doe",
    department: "Production",
    site: "Factory A",
    issuedDate: "2026-01-01",
    expiryDate: "2027-01-01",
    condition: "Good",
    inspectionDate: "2026-06-01",
    inspectionDueDate: "2026-12-01",
    status: "Issued",
    serialNumber: "HH-001",
    notes: "",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "PPE-2",
    ppeNo: "PPE-2026-0002",
    type: "Gloves",
    description: "Chemical resistant gloves",
    assignedTo: "Jane Smith",
    department: "Warehouse",
    site: "Factory B",
    issuedDate: "2026-02-01",
    expiryDate: "2026-08-01",
    condition: "Fair",
    status: "Issued",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockPpeItems];
    if (filters?.type) {
      results = results.filter((p) => p.type === filters.type);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const item = mockPpeItems.find((p) => p.id === id);
    if (item) return Promise.resolve(item);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "PPE-3",
    ppeNo: "PPE-2026-0003",
    type: "Safety Glasses",
    description: "Safety glasses",
    assignedTo: "Bob Johnson",
    department: "Production",
    site: "Factory A",
    issuedDate: "2026-03-01",
    expiryDate: "2027-03-01",
    condition: "New",
    status: "Issued",
    createdBy: "Admin",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockPpeItems.find((p) => p.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-03-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),

  getStats: vi.fn().mockResolvedValue({
    total: 2,
    issued: 2,
    expired: 0,
    dueForInspection: 0,
  }),
};

vi.mock("../../src/modules/ppe/ppe.repository.js", () => ({
  PpeRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    getStats = mockRepository.getStats;
  },
}));

describe("PpeService", () => {
  it("returns all PPE items", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const items = await service.getAll();
    expect(items).toHaveLength(2);
    expect(items[0].type).toBe("Hard Hat");
  });

  it("filters PPE items by type", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const items = await service.getAll({ type: "Hard Hat" });
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("Hard Hat");
  });

  it("returns PPE by id", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const item = await service.getById("PPE-1");
    expect(item?.id).toBe("PPE-1");
    expect(item?.ppeNo).toBe("PPE-2026-0001");
  });

  it("creates new PPE", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const record = await service.create({
      type: "Safety Glasses",
      description: "Safety glasses",
      site: "Factory A",
      createdBy: "Admin",
    });
    expect(record.id).toBe("PPE-3");
    expect(record.status).toBe("Issued");
  });

  it("returns PPE stats", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const stats = await service.getStats();
    expect(stats.total).toBe(2);
    expect(stats.issued).toBe(2);
    expect(stats.expired).toBe(0);
  });

  it("updates PPE", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const updated = await service.update("PPE-1", { condition: "Fair" });
    expect(updated?.condition).toBe("Fair");
  });

  it("deletes PPE", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const deleted = await service.delete("PPE-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent PPE", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    await expect(service.update("non-existent", { condition: "Good" })).rejects.toThrow("PPE record");
  });

  it("throws NotFoundError when deleting non-existent PPE", async () => {
    const { PpeService } = await import("../../src/modules/ppe/ppe.service.js");
    const service = new PpeService(
      new (await import("../../src/modules/ppe/ppe.repository.js")).PpeRepository(),
    );
    const deleted = await service.delete("non-existent");
    expect(deleted).toBe(false);
  });
});
