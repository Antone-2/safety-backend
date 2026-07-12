import { describe, expect, it, vi } from "vitest";

const mockDocuments = [
  {
    id: "DOC-1",
    title: "Safety Policy",
    code: "SP-001",
    category: "Policy",
    type: "Policy",
    version: "1.0",
    status: "Approved",
    content: "Safety policy content",
    author: "EHS Manager",
    site: "Factory A",
    department: "Production",
    effectiveDate: "2026-01-01",
    tags: ["safety", "policy"],
    classification: "Internal",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "DOC-2",
    title: "Emergency Procedure",
    code: "EP-001",
    category: "Procedure",
    type: "Procedure",
    version: "2.0",
    status: "Draft",
    content: "Emergency procedure content",
    author: "Safety Officer",
    site: "Factory B",
    department: "Warehouse",
    effectiveDate: "2026-02-01",
    tags: ["emergency", "procedure"],
    classification: "Internal",
    createdBy: "Admin",
    createdAt: "2026-01-15T00:00:00.000Z",
    updatedAt: "2026-01-15T00:00:00.000Z",
  },
];

const mockVersions = [
  {
    id: "VER-1",
    documentId: "DOC-1",
    version: "1.0",
    changeSummary: "Initial version",
    content: "Safety policy content",
    checksum: "abc123",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockApprovals = [
  {
    id: "APR-1",
    documentId: "DOC-1",
    version: "1.0",
    step: "approval",
    status: "Approved",
    approverName: "EHS Manager",
    comments: "Approved",
    decidedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockAcknowledgements = [
  {
    id: "ACK-1",
    documentId: "DOC-1",
    documentVersion: "1.0",
    userId: "user-1",
    userEmail: "user@example.com",
    userName: "John Doe",
    acknowledgedAt: "2026-01-02T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn().mockImplementation((filters?: Record<string, any>) => {
    let results = [...mockDocuments];
    if (filters?.status) {
      results = results.filter((d) => d.status === filters.status);
    }
    return Promise.resolve(results);
  }),
  findById: vi.fn().mockImplementation((id: string) => {
    const doc = mockDocuments.find((d) => d.id === id);
    if (doc) return Promise.resolve(doc);
    return Promise.resolve(null);
  }),
  create: vi.fn().mockResolvedValue({
    id: "DOC-3",
    title: "New Document",
    code: "ND-001",
    category: "Policy",
    type: "Policy",
    version: "1.0",
    status: "Draft",
    content: undefined,
    author: "Admin",
    site: "Factory A",
    department: "Production",
    effectiveDate: "2026-03-01",
    tags: [],
    classification: "Internal",
    documentNo: "DOC-2026-0001",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  }),
  update: vi.fn().mockImplementation((id: string, data: unknown) => {
    const existing = mockDocuments.find((d) => d.id === id);
    if (!existing) return Promise.resolve(null);
    return Promise.resolve({ ...existing, ...data, updatedAt: "2026-02-01T00:00:00.000Z" });
  }),
  delete: vi.fn().mockResolvedValue(true),

  createVersion: vi.fn().mockResolvedValue({
    id: "VER-2",
    documentId: "DOC-1",
    version: "2.0",
    changeSummary: "Updated content",
    checksum: "def456",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
  findVersions: vi.fn().mockResolvedValue(mockVersions),

  createApproval: vi.fn().mockResolvedValue({
    id: "APR-2",
    documentId: "DOC-1",
    version: "1.0",
    step: "review",
    status: "Pending",
    approverName: "Reviewer",
    createdAt: "2026-02-01T00:00:00.000Z",
  }),
  findApprovals: vi.fn().mockResolvedValue(mockApprovals),

  createAcknowledgement: vi.fn().mockResolvedValue({
    id: "ACK-2",
    documentId: "DOC-1",
    documentVersion: "1.0",
    userId: "user-2",
    userEmail: "user2@example.com",
    userName: "Jane Doe",
    acknowledgedAt: "2026-02-01T00:00:00.000Z",
  }),
  findAcknowledgements: vi.fn().mockResolvedValue(mockAcknowledgements),

  createAccessLink: vi.fn().mockResolvedValue({
    id: "LINK-1",
    documentId: "DOC-1",
    tokenHash: "hashed-token",
    purpose: "download",
    createdBy: "Admin",
    expiresAt: "2026-02-02T00:00:00.000Z",
    downloadCount: 0,
    createdAt: "2026-02-01T00:00:00.000Z",
    signedUrl: "/api/documents/DOC-1/download?token=token",
  }),

  getStats: vi.fn().mockResolvedValue({
    total: 2,
    approved: 1,
    draft: 1,
    underReview: 0,
    obsolete: 0,
    dueForReview: 0,
  }),
};

vi.mock("../../src/modules/documents/documents.repository.js", () => ({
  DocumentsRepository: class {
    findAll = mockRepository.findAll;
    findById = mockRepository.findById;
    create = mockRepository.create;
    update = mockRepository.update;
    delete = mockRepository.delete;
    createVersion = mockRepository.createVersion;
    findVersions = mockRepository.findVersions;
    createApproval = mockRepository.createApproval;
    findApprovals = mockRepository.findApprovals;
    createAcknowledgement = mockRepository.createAcknowledgement;
    findAcknowledgements = mockRepository.findAcknowledgements;
    createAccessLink = mockRepository.createAccessLink;
    getStats = mockRepository.getStats;
  },
}));

describe("DocumentsService", () => {
  it("returns all documents", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const documents = await service.getDocuments();
    expect(documents).toHaveLength(2);
    expect(documents[0].title).toBe("Safety Policy");
  });

  it("filters documents by status", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const documents = await service.getDocuments({ status: "Draft" });
    expect(documents).toHaveLength(1);
    expect(documents[0].status).toBe("Draft");
  });

  it("returns document by id", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const doc = await service.getDocumentById("DOC-1");
    expect(doc?.id).toBe("DOC-1");
    expect(doc?.code).toBe("SP-001");
  });

  it("creates new document with document number", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const doc = await service.createDocument({
      title: "New Document",
      category: "Policy",
      type: "Policy",
      author: "Admin",
      site: "Factory A",
      department: "Production",
      effectiveDate: "2026-03-01",
      createdBy: "Admin",
    });
    expect(doc.id).toBe("DOC-3");
    expect(doc.documentNo).toBeDefined();
  });

  it("creates document version", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const version = await service.createVersion("DOC-1", {
      version: "2.0",
      changeSummary: "Updated content",
    }, "Admin");
    expect(version.id).toBe("VER-2");
    expect(version.version).toBe("2.0");
  });

  it("submits document for review", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const doc = await service.submitForReview("DOC-1", { reviewerName: "Reviewer" }, { name: "Admin" });
    expect(doc.status).toBe("Under Review");
  });

  it("approves document", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const doc = await service.approve("DOC-1", { status: "Approved" }, { name: "EHS Manager" });
    expect(doc.status).toBe("Approved");
    expect(doc.approver).toBe("EHS Manager");
  });

  it("marks document as obsolete", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const result = await service.markObsolete("DOC-1", { reason: "Superseded" }, { name: "Admin" });
    expect(result.status).toBe("Obsolete");
    expect(result.obsoleteReason).toBe("Superseded");
  });

  it("acknowledges document", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const ack = await service.acknowledge("DOC-1", "1.0", { id: "user-2", email: "user2@example.com", name: "Jane Doe" }, {
      ip: "127.0.0.1",
      userAgent: "test",
    });
    expect(ack.userId).toBe("user-2");
    expect(ack.documentVersion).toBe("1.0");
  });

  it("returns acknowledgement report", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const report = await service.getAcknowledgementReport();
    expect(report).toHaveLength(1);
    expect(report[0].acknowledgements).toBe(1);
  });

  it("creates access link", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const link = await service.createAccessLink("DOC-1", { ttlHours: 24 }, { name: "Admin" });
    expect(link.purpose).toBe("download");
    expect(link.signedUrl).toContain("token=");
  });

  it("returns document stats", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    const stats = await service.getStats();
    expect(stats.total).toBe(2);
    expect(stats.approved).toBe(1);
    expect(stats.draft).toBe(1);
  });

  it("throws NotFoundError when updating non-existent document", async () => {
    const { DocumentsService } = await import("../../src/modules/documents/documents.service.js");
    const service = new DocumentsService(
      new (await import("../../src/modules/documents/documents.repository.js")).DocumentsRepository(),
    );
    await expect(service.updateDocument("non-existent", { title: "Test" })).rejects.toThrow("Document");
  });
});
