import { describe, expect, it, vi } from "vitest";

const mockPermits = [
  {
    id: "PMT-1",
    type: "Hot Work",
    status: "active",
    location: "Factory A",
    applicant: "John Doe",
    description: "Welding work",
    startDate: "2026-01-01T00:00:00.000Z",
    endDate: "2026-12-31T23:59:59.000Z",
    hazards: "Fire",
    precautions: "Fire watch",
    ppeRequired: ["Helmet", "Gloves"],
    isolationRequired: true,
    fireWatchRequired: true,
    gasTestRequired: false,
    attachments: [],
    comments: [],
    createdBy: "EHS Manager",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "PMT-2",
    type: "Confined Space",
    status: "draft",
    location: "Factory B",
    applicant: "Jane Smith",
    description: "Tank entry",
    startDate: "2026-02-01T00:00:00.000Z",
    endDate: "2026-02-15T23:59:59.000Z",
    hazards: "Oxygen deficiency",
    precautions: "Gas monitoring",
    ppeRequired: ["Harness", "Gas detector"],
    isolationRequired: true,
    fireWatchRequired: false,
    gasTestRequired: true,
    attachments: [],
    comments: [],
    createdBy: "Supervisor",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockPermits];
    if (filters?.status) {
      results = results.filter((p) => p.status === filters.status);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const permit = mockPermits.find((p) => p.id === id);
    if (permit) return Promise.resolve(permit);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "PMT-3",
    type: "Electrical",
    status: "draft",
    location: "Factory C",
    applicant: "Bob Johnson",
    description: "Switchgear maintenance",
    startDate: "2026-03-01T00:00:00.000Z",
    endDate: "2026-03-05T23:59:59.000Z",
    hazards: "Arc flash",
    precautions: "LOTO",
    ppeRequired: ["Face shield"],
    isolationRequired: true,
    fireWatchRequired: false,
    gasTestRequired: false,
    attachments: [],
    comments: [],
    createdBy: "EHS Manager",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockPermits.find((p) => p.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-03-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),
  count: vi.fn().mockResolvedValue(2),
};

vi.mock("../../src/modules/permits/permits.repository.js", () => ({
  PermitsRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    count = mockRepository.count;
  },
}));

describe("PermitsService", () => {
  it("returns all permits", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const permits = await service.getPermits();
    expect(permits).toHaveLength(2);
    expect(permits[0].type).toBe("Hot Work");
  });

  it("returns a permit by id", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const permit = await service.getPermitById("PMT-1");
    expect(permit?.id).toBe("PMT-1");
    expect(permit?.applicant).toBe("John Doe");
  });

  it("creates a new permit", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const permit = await service.createPermit({
      type: "Electrical",
      location: "Factory C",
      applicant: "Bob Johnson",
      description: "Switchgear maintenance",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      createdBy: "EHS Manager",
    });
    expect(permit.id).toBe("PMT-3");
    expect(permit.status).toBe("draft");
  });

  it("advances permit status", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const updated = await service.advanceStatus("PMT-1", "active");
    expect(updated?.status).toBe("active");
  });

  it("returns active permits", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const active = await service.getActivePermits();
    expect(active.every((p) => p.status === "active")).toBe(true);
  });

  it("returns expired permits", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const expired = await service.getExpiredPermits();
    expect(expired.every((p) => p.status === "active" && p.endDate < new Date().toISOString())).toBe(true);
  });

  it("adds a comment to a permit", async () => {
    const { PermitsService } = await import("../../src/modules/permits/permits.service.js");
    const service = new PermitsService(
      new (await import("../../src/modules/permits/permits.repository.js")).PermitsRepository(),
    );
    const commented = await service.addComment("PMT-1", {
      author: "EHS Manager",
      at: "2026-03-01T00:00:00.000Z",
      text: "Approved",
    });
    expect(commented?.comments).toHaveLength(1);
    expect(commented?.comments[0].text).toBe("Approved");
  });
});
