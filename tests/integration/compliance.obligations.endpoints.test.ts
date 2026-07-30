import express from "express";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createObligationMock = vi.fn();
const writeAuditLogMock = vi.fn();

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  pgPool: {},
}));

vi.mock("../../src/modules/compliance/compliance.repository.js", () => ({
  ComplianceRepository: class {},
}));

vi.mock("../../src/modules/compliance/compliance.service.js", () => ({
  ComplianceService: class {
    createObligation = createObligationMock;
  },
}));

vi.mock("../../src/shared/middleware/auth.middleware.js", () => ({
  authenticateUser: (req: any, _res: any, next: any) => {
    req.user = {
      id: "user-1",
      email: "safety@example.com",
      name: "Safety Lead",
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

const { createComplianceRouter } = await import(
  "../../src/modules/compliance/compliance.controller.js"
);

type TestResponse = {
  status: number;
  body: any;
};

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(express.json());
  app.use("/api/compliance", createComplianceRouter());

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

async function postJson(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
): Promise<TestResponse> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  return {
    status: response.status,
    body: await response.json(),
  };
}

describe("Compliance obligation endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createObligationMock.mockResolvedValue({
      id: "obl-1",
      title: "Fire extinguisher inspection",
      legislation: "Fire Safety Act",
      requirement: "Inspect and tag extinguishers",
      frequency: "Monthly",
      responsibility: "EHS Manager",
      site: "Factory A",
      department: "Operations",
      dueDate: "2026-08-15",
      status: "Pending",
      createdBy: "Safety Lead",
      createdAt: "2026-07-30T10:00:00.000Z",
      updatedAt: "2026-07-30T10:00:00.000Z",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates an obligation without requiring createdBy in the request body", async () => {
    await withServer(async (baseUrl) => {
      const response = await postJson(baseUrl, "/api/compliance/obligations", {
        title: "Fire extinguisher inspection",
        legislation: "Fire Safety Act",
        requirement: "Inspect and tag extinguishers",
        frequency: "Monthly",
        responsibility: "EHS Manager",
        site: "Factory A",
        department: "Operations",
        dueDate: "2026-08-15",
        status: "Pending",
        notes: "Initial rollout",
      });

      expect(response.status).toBe(201);
      expect(createObligationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Fire extinguisher inspection",
          createdBy: "Safety Lead",
        }),
      );
      expect(response.body.data).toEqual(
        expect.objectContaining({
          id: "obl-1",
          createdBy: "Safety Lead",
        }),
      );
      expect(writeAuditLogMock).toHaveBeenCalled();
    });
  });
});
