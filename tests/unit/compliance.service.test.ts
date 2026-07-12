import { describe, expect, it, vi } from "vitest";

const mockObligations = [
  {
    id: "OBS-1",
    title: "ISO 45001 Clause 4",
    legislation: "ISO 45001",
    requirement: "Context of organization",
    frequency: "Annual",
    responsibility: "EHS Manager",
    site: "Factory A",
    department: "Production",
    dueDate: "2026-12-31",
    status: "Compliant",
    lastComplianceDate: "2026-01-15",
    evidence: "Audit report",
    notes: "Minor observations",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
  {
    id: "OBS-2",
    title: "Fire Safety Act",
    legislation: "Fire Safety Act",
    requirement: "Fire risk assessment",
    frequency: "Biannual",
    responsibility: "Safety Officer",
    site: "Factory B",
    department: "Warehouse",
    dueDate: "2026-06-30",
    status: "Pending",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockAudits = [
  {
    id: "AUD-1",
    title: "ISO 45001 Surveillance Audit",
    type: "External",
    status: "In Progress",
    site: "Factory A",
    department: "Production",
    leadAuditor: "John Smith",
    teamMembers: ["Jane Doe"],
    startDate: "2026-01-10",
    endDate: "2026-01-15",
    scope: "Clause 4-10",
    criteria: "ISO 45001",
    findings: [],
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockLegalUpdates = [
  {
    id: "LGL-1",
    title: "OSHA Updates",
    legislation: "OSHA",
    jurisdiction: "National",
    effectiveDate: "2026-02-01",
    summary: "Updated PPE requirements",
    impactAssessment: "Low impact",
    actionRequired: "Update signage",
    assignedTo: "EHS Manager",
    dueDate: "2026-02-15",
    status: "New",
    source: "OSHA.gov",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findObligations: vi
    .fn()
    .mockImplementation((filters?: Record<string, any>) => {
      let results = [...mockObligations];
      if (filters?.status) {
        results = results.filter((o) => o.status === filters.status);
      }
      return Promise.resolve(results);
    }),
  findObligationById: vi.fn().mockImplementation((id: string) => {
    const obligation = mockObligations.find((o) => o.id === id);
    if (obligation) return Promise.resolve(obligation);
    return Promise.resolve(null);
  }),
  createObligation: vi.fn().mockResolvedValue({
    id: "OBS-3",
    title: "New Obligation",
    legislation: "Test",
    requirement: "Test requirement",
    frequency: "Monthly",
    responsibility: "Tester",
    site: "Factory A",
    department: "Production",
    status: "Pending",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateObligation: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockObligations.find((o) => o.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({
      ...existing,
      ...data,
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  }),
  deleteObligation: vi.fn().mockResolvedValue(true),

  findAudits: vi.fn().mockResolvedValue(mockAudits),
  findAuditById: vi.fn().mockImplementation((id: string) => {
    const audit = mockAudits.find((a) => a.id === id);
    if (audit) return Promise.resolve(audit);
    return Promise.resolve(null);
  }),
  createAudit: vi.fn().mockResolvedValue({
    id: "AUD-2",
    title: "New Audit",
    type: "Internal",
    status: "Planned",
    site: "Factory A",
    department: "Production",
    leadAuditor: "Tester",
    teamMembers: [],
    startDate: "2026-02-01",
    endDate: "2026-02-05",
    findings: [],
    createdBy: "Admin",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  }),
  updateAudit: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockAudits.find((a) => a.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({
      ...existing,
      ...data,
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  }),
  deleteAudit: vi.fn().mockResolvedValue(true),

  findLegalUpdates: vi.fn().mockResolvedValue(mockLegalUpdates),
  findLegalUpdateById: vi.fn().mockImplementation((id: string) => {
    const update = mockLegalUpdates.find((u) => u.id === id);
    if (update) return Promise.resolve(update);
    return Promise.resolve(null);
  }),
  createLegalUpdate: vi.fn().mockResolvedValue({
    id: "LGL-2",
    title: "New Update",
    legislation: "Test",
    jurisdiction: "National",
    effectiveDate: "2026-03-01",
    summary: "Test summary",
    status: "New",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  updateLegalUpdate: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockLegalUpdates.find((u) => u.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({
      ...existing,
      ...data,
      updatedAt: "2026-02-01T00:00:00.000Z",
    });
  }),
  deleteLegalUpdate: vi.fn().mockResolvedValue(true),

  getDashboard: vi.fn().mockResolvedValue({
    total: 2,
    compliant: 1,
    nonCompliant: 0,
    pending: 1,
    openAudits: 1,
  }),
};

vi.mock("../../src/modules/compliance/compliance.repository.js", () => ({
  ComplianceRepository: class {
    findObligations = mockRepository.findObligations;
    findObligationById = mockRepository.findObligationById;
    createObligation = mockRepository.createObligation;
    updateObligation = mockRepository.updateObligation;
    deleteObligation = mockRepository.deleteObligation;
    findAudits = mockRepository.findAudits;
    findAuditById = mockRepository.findAuditById;
    createAudit = mockRepository.createAudit;
    updateAudit = mockRepository.updateAudit;
    deleteAudit = mockRepository.deleteAudit;
    findLegalUpdates = mockRepository.findLegalUpdates;
    findLegalUpdateById = mockRepository.findLegalUpdateById;
    createLegalUpdate = mockRepository.createLegalUpdate;
    updateLegalUpdate = mockRepository.updateLegalUpdate;
    deleteLegalUpdate = mockRepository.deleteLegalUpdate;
    getDashboard = mockRepository.getDashboard;
  },
}));

async function createMockComplianceService() {
  const { ComplianceService } =
    await import("../../src/modules/compliance/compliance.service.js");
  return new ComplianceService(mockRepository as any);
}

describe("ComplianceService", () => {
  it("returns all obligations", async () => {
    const { ComplianceService } = await import("../../src/modules/compliance/compliance.service.js");
    const service = new ComplianceService(
      new (await import("../../src/modules/compliance/compliance.repository.js")).ComplianceRepository(),
    );
    const obligations = await service.getObligations();
    expect(obligations).toHaveLength(2);
    expect(obligations[0].title).toBe("ISO 45001 Clause 4");
  }, 10000);

  it("filters obligations by status", async () => {
    const service = await createMockComplianceService();
    const obligations = await service.getObligations({ status: "Pending" });
    expect(obligations).toHaveLength(1);
    expect(obligations[0].status).toBe("Pending");
  });

  it("creates a new obligation", async () => {
    const service = await createMockComplianceService();
    const obligation = await service.createObligation({
      title: "New Obligation",
      legislation: "Test",
      requirement: "Test requirement",
      frequency: "Monthly",
      responsibility: "Tester",
      site: "Factory A",
      department: "Production",
      createdBy: "Admin",
    });
    expect(obligation.id).toBe("OBS-3");
    expect(obligation.status).toBe("Pending");
  });

  it("returns all audits", async () => {
    const service = await createMockComplianceService();
    const audits = await service.getAudits();
    expect(audits).toHaveLength(1);
    expect(audits[0].title).toBe("ISO 45001 Surveillance Audit");
  });

  it("creates a new audit", async () => {
    const service = await createMockComplianceService();
    const audit = await service.createAudit({
      title: "New Audit",
      type: "Internal",
      status: "Planned",
      site: "Factory A",
      department: "Production",
      leadAuditor: "Tester",
      startDate: "2026-02-01",
      endDate: "2026-02-05",
      createdBy: "Admin",
    });
    expect(audit.id).toBe("AUD-2");
    expect(audit.type).toBe("Internal");
  });

  it("returns all legal updates", async () => {
    const service = await createMockComplianceService();
    const updates = await service.getLegalUpdates();
    expect(updates).toHaveLength(1);
    expect(updates[0].title).toBe("OSHA Updates");
  });

  it("creates a new legal update", async () => {
    const service = await createMockComplianceService();
    const legalUpdate = await service.createLegalUpdate({
      title: "New Update",
      legislation: "Test",
      jurisdiction: "National",
      effectiveDate: "2026-03-01",
      summary: "Test summary",
      createdBy: "Admin",
    });
    expect(legalUpdate.id).toBe("LGL-2");
    expect(legalUpdate.status).toBe("New");
  });

  it("returns compliance dashboard stats", async () => {
    const service = await createMockComplianceService();
    const dashboard = await service.getComplianceDashboard();
    expect(dashboard.total).toBe(2);
    expect(dashboard.compliant).toBe(1);
    expect(dashboard.openAudits).toBe(1);
  });

  it("throws NotFoundError when updating non-existent obligation", async () => {
    const service = await createMockComplianceService();
    await expect(
      service.updateObligation("non-existent", { status: "Compliant" }),
    ).rejects.toThrow("Compliance obligation");
  });
});
