import { describe, expect, it, vi } from "vitest";

const reports = [
  {
    id: "RPT-1",
    date: "2026-01-10T08:00:00.000Z",
    location: "Factory A",
    reporter: "Ann",
    description: "Guard removed during operation",
    severity: "High",
    status: "Open",
    category: "Machine Guarding",
    type: "Unsafe Act",
    dueAt: "2026-01-15T08:00:00.000Z",
    isNearMiss: true,
    department: "Production",
    shift: "Day",
  },
  {
    id: "RPT-2",
    date: "2026-01-12T08:00:00.000Z",
    location: "Factory B",
    reporter: "Ben",
    description: "Blocked emergency exit",
    severity: "Critical",
    status: "Closed",
    category: "Emergency Preparedness",
    type: "Unsafe Condition",
    dueAt: "2026-01-14T08:00:00.000Z",
    isNearMiss: false,
    department: "Warehouse",
    shift: "Night",
  },
  {
    id: "RPT-3",
    date: "2026-02-03T08:00:00.000Z",
    location: "Factory A",
    reporter: "Cara",
    description: "Chemical spill requiring medical treatment",
    severity: "Critical",
    status: "In Progress",
    category: "Chemical Spill",
    type: "Unsafe Condition",
    dueAt: "2026-02-04T08:00:00.000Z",
    isNearMiss: false,
    department: "Production",
    shift: "Day",
  },
];

vi.mock("../../src/modules/reports/reports.service.js", () => ({
  ReportsService: class {
    async list() {
      return {
        data: reports,
        total: reports.length,
        page: 1,
        limit: reports.length,
      };
    }
  },
}));

vi.mock("../../src/modules/ai/ai.repository.js", () => ({
  AiRepository: class {
    async savePrediction() {
      return "prediction-1";
    }
    async getGuardrailSettings() {
      return {
        enabled: true,
        allowedRoles: ["super-admin", "EHS-manager"],
        deniedRoles: [],
        requireCitation: true,
        blockedTopics: [],
        allowExports: true,
        maxSourceRecords: 50,
        ragSources: [],
      };
    }
    async savePromptAudit() {
      return undefined;
    }
  },
}));

describe("AiService query", () => {
  it("generates auditable backend SHEQ intelligence from reports", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.query(
      {
        query: "Give me a YTD unsafe act and condition trend report",
        maxSourceRecords: 20,
        exportFormat: "json",
      },
      { role: "EHS-manager" },
    );

    expect(result.success).toBe(true);
    expect((result.data as any).kpis).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Total reports", value: 3 }),
        expect.objectContaining({ label: "Unsafe acts", value: 1 }),
        expect.objectContaining({ label: "Unsafe conditions", value: 2 }),
      ]),
    );
    expect((result.data as any).trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ month: "2026-01", total: 2 }),
        expect.objectContaining({ month: "2026-02", total: 1 }),
      ]),
    );
    expect((result.data as any).sources).toEqual(["RPT-1", "RPT-2", "RPT-3"]);
    expect((result.data as any).dataExplanations).toEqual(
      expect.arrayContaining([
        expect.stringContaining("No mock or frontend fallback data was used"),
      ]),
    );
    expect((result.data as any).managementActions).toEqual(
      expect.arrayContaining([expect.stringContaining("Escalate")]),
    );
    expect((result.data as any).citations.dataset).toEqual([
      "RPT-1",
      "RPT-2",
      "RPT-3",
    ]);
    expect((result.data as any).citations.kpis.unsafeConditions).toEqual([
      "RPT-2",
      "RPT-3",
    ]);
    expect((result.metadata as any).feature).toBe("ai-query");
    expect((result.metadata as any).confidenceLevel).toBe("medium");
    expect((result.metadata as any).warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Recordable and LTI values"),
      ]),
    );
  }, 15000);

  it("focuses the answer shape on the question asked", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.query(
      {
        query:
          "Which locations are highest and lowest rated and what management actions are required?",
        maxSourceRecords: 20,
        exportFormat: "json",
      },
      { role: "EHS-manager" },
    );

    const tableTitles = (result.data as any).tables.map(
      (table: any) => table.title,
    );
    expect(tableTitles).toContain("Location Hotspots And Rated Locations");
    expect(tableTitles).toContain("Department Exposure");
    expect((result.data as any).managementActions.join(" ")).toContain(
      "Factory",
    );
  }, 15000);
});
