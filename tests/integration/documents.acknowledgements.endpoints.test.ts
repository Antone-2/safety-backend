import express from "express";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const writeAuditLogMock = vi.fn();

const approvedDocuments = [
  {
    id: "DOC-2",
    title: "Emergency Procedure",
    code: "EP-001",
    category: "Procedure",
    type: "Procedure",
    version: "2.0",
    status: "Approved",
    author: "Safety Officer",
    site: "Factory B",
    department: "Warehouse",
    effectiveDate: "2026-02-01",
    createdBy: "Admin",
    createdAt: "2026-02-01T00:00:00.000Z",
    updatedAt: "2026-02-01T00:00:00.000Z",
  },
  {
    id: "DOC-1",
    title: "Safety Policy",
    code: "SP-001",
    category: "Policy",
    type: "Policy",
    version: "1.0",
    status: "Approved",
    author: "EHS Manager",
    site: "Factory A",
    department: "Production",
    effectiveDate: "2026-01-01",
    createdBy: "Admin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const mockRepository = {
  findAll: vi.fn(),
  findAcknowledgementSummaryByDocumentIds: vi.fn(),
};

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  pgPool: {},
}));

vi.mock("../../src/modules/documents/documents.repository.js", () => ({
  DocumentsRepository: class {
    findAll = mockRepository.findAll;
    findAcknowledgementSummaryByDocumentIds =
      mockRepository.findAcknowledgementSummaryByDocumentIds;
  },
}));

vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({
  authenticateUser: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "ehs@example.com",
      name: "EHS Lead",
      role: "super-admin",
    };
    next();
  },
}));

vi.mock("../../src/shared/middleware/rbac.middleware.js", () => ({
  rbacMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../src/shared/audit/audit.service.js", () => ({
  writeAuditLog: writeAuditLogMock,
  diffRecord: vi.fn(),
}));

const { createDocumentsRouter } = await import(
  "../../src/modules/documents/documents.controller.js"
);

type TestResponse = {
  status: number;
  body: any;
};

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/api/documents", createDocumentsRouter());

  const server = await new Promise<import("http").Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

async function getJson(baseUrl: string, path: string): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`);
  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("Document acknowledgement report endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRepository.findAll.mockResolvedValue(approvedDocuments);
    mockRepository.findAcknowledgementSummaryByDocumentIds.mockResolvedValue(
      new Map<string, { acknowledgements: number; lastAcknowledgedAt?: string }>([
        [
          "DOC-1",
          {
            acknowledgements: 4,
            lastAcknowledgedAt: "2026-08-14T09:30:00.000Z",
          },
        ],
        [
          "DOC-2",
          {
            acknowledgements: 1,
            lastAcknowledgedAt: "2026-08-10T12:00:00.000Z",
          },
        ],
      ]),
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the approved-document acknowledgement summary in the normalized data envelope", async () => {
    await withServer(async (baseUrl) => {
      const response = await getJson(baseUrl, "/api/documents/acknowledgements/report");

      expect(response.status).toBe(200);
      expect(mockRepository.findAll).toHaveBeenCalledWith({ status: "Approved" });
      expect(mockRepository.findAcknowledgementSummaryByDocumentIds).toHaveBeenCalledWith([
        "DOC-2",
        "DOC-1",
      ]);
      expect(response.body).toEqual({
        data: [
          expect.objectContaining({
            id: "DOC-2",
            acknowledgements: 1,
            lastAcknowledgedAt: "2026-08-10T12:00:00.000Z",
          }),
          expect.objectContaining({
            id: "DOC-1",
            acknowledgements: 4,
            lastAcknowledgedAt: "2026-08-14T09:30:00.000Z",
          }),
        ],
      });
      expect(response.body.data.map((item: { title: string }) => item.title)).toEqual([
        "Emergency Procedure",
        "Safety Policy",
      ]);
    });
  });
});
