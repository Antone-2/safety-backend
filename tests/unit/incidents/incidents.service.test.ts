import { describe, expect, it } from "vitest";
import { IncidentsService } from "../../../src/modules/incidents/incidents.service.js";
import type { Incident } from "../../../src/modules/incidents/incidents.types.js";

function createDatabaseIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: "INC-001",
    type: "Unsafe Condition",
    severity: "Medium",
    status: "Open",
    location: "Mombasa Plant",
    department: "Operations",
    shift: "Day",
    description: "Oil spill near line 2",
    reporter: "Manual Reporter",
    anonymous: false,
    isNearMiss: false,
    photos: [],
    assignedToCopy: [],
    slaHours: 24,
    regulatoryNotificationRequired: false,
    complianceRequired: false,
    source: "manual",
    createdAt: "2026-07-20T08:00:00.000Z",
    updatedAt: "2026-07-20T08:00:00.000Z",
    ...overrides,
  };
}

describe("IncidentsService", () => {
  it("normalizes database incident columns for the API response", async () => {
    const repository = {
      findAll: async () => [
        {
          id: "INC-002",
          type: "Near Miss",
          severity: "High",
          status: "Open",
          location: "Nairobi Depot",
          department: "Warehouse",
          shift: "Night",
          description: "Forklift near miss",
          reporter: "Database Reporter",
          anonymous: false,
          is_near_miss: true,
          assigned_to: "Safety Officer",
          created_at: "2026-08-01T08:00:00.000Z",
          updated_at: "2026-08-01T09:00:00.000Z",
        },
      ],
      findAllReports: async () => [],
    };

    const service = new IncidentsService(repository as any);
    const incidents = await service.getAll();

    expect(incidents[0]).toMatchObject({
      id: "INC-002",
      isNearMiss: true,
      assignedTo: "Safety Officer",
      createdAt: "2026-08-01T08:00:00.000Z",
      updatedAt: "2026-08-01T09:00:00.000Z",
      sourceKind: "database",
    });
  });

  it("merges database incidents with synced report incidents and marks their source explicitly", async () => {
    const repository = {
      findAll: async () => [createDatabaseIncident()],
      findAllReports: async () => [
        {
          id: "RPT-9001",
          type: "Near Miss",
          severity: "Critical",
          status: "Open",
          location: "Nairobi Depot",
          department: "Warehouse",
          shift: "Night",
          description: "Forklift almost hit pedestrian",
          reporter: "Google Sheets Reporter",
          anonymous: false,
          is_near_miss: true,
          source: "google-sheets",
          created_at: "2026-07-29T10:00:00.000Z",
          updated_at: "2026-07-29T10:00:00.000Z",
          due_at: "2026-07-30T10:00:00.000Z",
        },
      ],
      findById: async () => null,
      findReportById: async () => null,
      create: async () => createDatabaseIncident(),
      update: async () => createDatabaseIncident(),
      delete: async () => true,
    };

    const service = new IncidentsService(repository as any);
    const incidents = await service.getAll({ severity: "Critical" });

    expect(incidents).toHaveLength(1);
    expect(incidents[0]).toMatchObject({
      id: "RPT-9001",
      sourceKind: "report-sync",
      readonly: true,
      severity: "Critical",
    });
  });

  it("computes stats from the combined live dataset instead of only manual incidents", async () => {
    const repository = {
      findAll: async () => [
        createDatabaseIncident({ id: "INC-001", status: "Open", dueAt: "2026-07-30T08:00:00.000Z" }),
        createDatabaseIncident({ id: "INC-002", status: "Closed", severity: "Low" }),
      ],
      findAllReports: async () => [
        {
          id: "RPT-9002",
          type: "Near Miss",
          severity: "Critical",
          status: "Open",
          location: "Nairobi Depot",
          department: "Warehouse",
          shift: "Night",
          description: "Forklift almost hit pedestrian",
          reporter: "Google Sheets Reporter",
          anonymous: false,
          is_near_miss: true,
          source: "google-sheets",
          created_at: "2026-07-29T10:00:00.000Z",
          updated_at: "2026-07-29T10:00:00.000Z",
          due_at: "2026-07-30T10:00:00.000Z",
        },
      ],
      findById: async () => null,
      findReportById: async () => null,
      create: async () => createDatabaseIncident(),
      update: async () => createDatabaseIncident(),
      delete: async () => true,
    };

    const service = new IncidentsService(repository as any);
    const stats = await service.getStats();

    expect(stats).toMatchObject({
      total: 3,
      open: 2,
      closed: 1,
      critical: 1,
      overdue: 2,
    });
  });
});
