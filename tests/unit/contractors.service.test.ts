import { describe, expect, it, vi } from "vitest";

const mockContractors = [
  {
    id: "CTR-1",
    companyName: "SafeBuild Contractors Ltd",
    registrationNumber: "PVT-SAFEBUILD",
    contactPerson: "Grace Wanjiku",
    contactEmail: "grace.wanjiku@example.invalid",
    contactPhone: "+254700000101",
    services: "Civil works, scaffolding",
    certifications: "ISO 45001",
    insuranceExpiry: "2026-12-31",
    safetyRating: 4.4,
    incidents: 1,
    lastAuditDate: "2026-01-01",
    status: "Active",
    inductionExpiry: "2026-06-01",
    documents: [],
    performanceScore: 88,
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "CTR-2",
    companyName: "Metro Electrical Services",
    registrationNumber: "PVT-METRO-ELEC",
    contactPerson: "Daniel Otieno",
    contactEmail: "daniel.otieno@example.invalid",
    contactPhone: "+254700000202",
    status: "Suspended",
    incidents: 3,
    safetyRating: 3.7,
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
];

const mockIncidents = [
  {
    id: "INC-1",
    contractorId: "CTR-1",
    incidentType: "Near miss",
    description: "Falling object near walkway",
    severity: "Medium",
    date: "2026-03-01",
    location: "Factory A",
    actionTaken: "Remedied",
    followUpRequired: false,
    createdBy: "Safety Officer",
    createdAt: "2026-03-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockContractors];
    if (filters?.status) {
      results = results.filter((c) => c.status === filters.status);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const contractor = mockContractors.find((c) => c.id === id);
    if (contractor) return Promise.resolve(contractor);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "CTR-3",
    companyName: "New Contractor",
    registrationNumber: "PVT-NEW",
    contactPerson: "New Contact",
    contactEmail: "new@example.com",
    contactPhone: "+254700000303",
    status: "Active",
    incidents: 0,
    createdBy: "Admin",
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockContractors.find((c) => c.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-03-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),

  createIncident: vi.fn().mockResolvedValue({
    id: "INC-2",
    contractorId: "CTR-1",
    incidentType: "Property damage",
    description: "Forklift struck guardrail",
    severity: "High",
    date: "2026-03-02",
    location: "Warehouse A",
    followUpRequired: true,
    createdBy: "Safety Officer",
    createdAt: "2026-03-02T00:00:00.000Z",
  }),
  findIncidents: vi.fn().mockResolvedValue(mockIncidents),
  incrementIncidentCount: vi.fn().mockResolvedValue(undefined),

  getStats: vi.fn().mockResolvedValue({
    total: 2,
    active: 1,
    suspended: 1,
    blacklisted: 0,
    avgRating: "4.1",
  }),
};

vi.mock("../../src/modules/contractors/contractors.repository.js", () => ({
  ContractorsRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    createIncident = mockRepository.createIncident;
    findIncidents = mockRepository.findIncidents;
    incrementIncidentCount = mockRepository.incrementIncidentCount;
    getStats = mockRepository.getStats;
  },
}));

describe("ContractorsService", () => {
  it("returns all contractors", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const contractors = await service.getContractors();
    expect(contractors).toHaveLength(2);
    expect(contractors[0].companyName).toBe("SafeBuild Contractors Ltd");
  });

  it("filters contractors by status", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const contractors = await service.getContractors({ status: "Active" });
    expect(contractors).toHaveLength(1);
    expect(contractors[0].status).toBe("Active");
  });

  it("returns contractor by id", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const contractor = await service.getContractorById("CTR-1");
    expect(contractor?.id).toBe("CTR-1");
    expect(contractor?.registrationNumber).toBe("PVT-SAFEBUILD");
  });

  it("creates new contractor", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const contractor = await service.createContractor({
      companyName: "New Contractor",
      registrationNumber: "PVT-NEW",
      contactPerson: "New Contact",
      contactEmail: "new@example.com",
      contactPhone: "+254700000303",
      createdBy: "Admin",
    });
    expect(contractor.id).toBe("CTR-3");
    expect(contractor.status).toBe("Active");
  });

  it("returns contractor incidents", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const incidents = await service.getContractorIncidents("CTR-1");
    expect(incidents).toHaveLength(1);
    expect(incidents[0].incidentType).toBe("Near miss");
  });

  it("records contractor incident and increments count", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const incident = await service.recordIncident({
      contractorId: "CTR-1",
      incidentType: "Property damage",
      description: "Forklift struck guardrail",
      severity: "High",
      date: "2026-03-02",
      location: "Warehouse A",
      followUpRequired: true,
      createdBy: "Safety Officer",
    });
    expect(incident.id).toBe("INC-2");
    expect(incident.severity).toBe("High");
  });

  it("returns contractor stats", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const stats = await service.getContractorStats();
    expect(stats.total).toBe(2);
    expect(stats.active).toBe(1);
    expect(stats.suspended).toBe(1);
    expect(stats.avgRating).toBe("4.1");
  });

  it("updates contractor", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const updated = await service.updateContractor("CTR-1", { status: "Suspended" });
    expect(updated?.status).toBe("Suspended");
  });

  it("deletes contractor", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    const deleted = await service.deleteContractor("CTR-1");
    expect(deleted).toBe(true);
  });

  it("throws NotFoundError when updating non-existent contractor", async () => {
    const { ContractorsService } = await import("../../src/modules/contractors/contractors.service.js");
    const service = new ContractorsService(
      new (await import("../../src/modules/contractors/contractors.repository.js")).ContractorsRepository(),
    );
    await expect(service.updateContractor("non-existent", { companyName: "Test" })).rejects.toThrow("Contractor");
  });
});
