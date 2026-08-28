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

    async summary() {
      return {
        total: reports.length,
        open: 1,
        closed: 1,
        overdue: 1,
        criticalOpen: 1,
        avgResolution: 2,
        recordableIncidents: 1,
        lostTimeInjuries: 0,
        medicalTreatmentCases: 1,
        nearMissCount: 1,
        daysSinceLastLti: -1,
        totalManhoursWorked: 52000,
        totalWorkforce: 250,
        severityCounts: {
          Critical: 2,
          High: 1,
          Medium: 0,
          Low: 0,
        },
      };
    }

    async topReportersMonthToDate() {
      return [
        { reporter: "Ann", reportCount: 1 },
        { reporter: "Ben", reportCount: 1 },
        { reporter: "Cara", reportCount: 1 },
      ];
    }
  },
}));

vi.mock("../../src/modules/ai/ai.repository.js", () => ({
  AiRepository: class {
    async savePrediction() {
      return "prediction-1";
    }
    async saveChatSession() {
      return "ai-chat-1";
    }
    async getLatestChatSession() {
      return null;
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

vi.mock("../../src/modules/ai/infra/llm.client.js", () => ({
  LlmClient: class {
    async generate(_system: string, prompt: string) {
      if (prompt.includes("spill response")) {
        return "Use the spill response procedure, isolate the area, and verify PPE before cleanup.";
      }
      return "Grounded AI response.";
    }
  },
}));

vi.mock("../../src/modules/ai/infra/rag.engine.js", () => ({
  RagEngine: class {
    async search(query: string) {
      if (query.toLowerCase().includes("spill")) {
        return [
          {
            title: "Chemical Spill Response Procedure",
            excerpt: "Isolate the spill area, don chemical-resistant PPE, and notify the supervisor immediately.",
            score: 6,
          },
          {
            title: "Emergency Eyewash Guidance",
            excerpt: "Use the nearest eyewash station for splash exposure and refer exposed workers for medical review.",
            score: 4,
          },
        ];
      }
      return [];
    }
  },
}));

vi.mock("../../src/modules/training/training.service.js", () => ({
  TrainingService: class {
    async getCourses() {
      return [
        {
          id: "CRS-1",
          title: "Chemical Handling Basics",
          code: "CHEM-101",
          category: "Chemical Safety",
          duration: 4,
          frequency: "Annual",
          passingScore: 80,
          createdBy: "Admin",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "CRS-2",
          title: "Forklift Refresher",
          code: "FL-201",
          category: "Mobile Equipment",
          duration: 3,
          frequency: "Annual",
          passingScore: 75,
          createdBy: "Admin",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
    }

    async getRecords(filters?: Record<string, unknown>) {
      const rows = [
        {
          id: "TRN-1",
          employeeId: "EMP-1",
          employeeName: "Jane Doe",
          courseId: "CRS-1",
          department: "Production",
          site: "Factory A",
          status: "Expired",
          expiryDate: "2026-07-01",
        },
        {
          id: "TRN-2",
          employeeId: "EMP-1",
          employeeName: "Jane Doe",
          courseId: "CRS-2",
          department: "Production",
          site: "Factory A",
          status: "Scheduled",
          expiryDate: undefined,
        },
      ];
      return rows.filter((row) => {
        if (filters?.employeeId && row.employeeId !== filters.employeeId) return false;
        if (filters?.department && row.department !== filters.department) return false;
        if (filters?.site && row.site !== filters.site) return false;
        return true;
      });
    }

    async getMatrix(filters?: Record<string, unknown>) {
      const rows = [
        {
          id: "MAT-1",
          role: "Operator",
          department: "Production",
          courseId: "CRS-1",
          frequency: "Annual",
          mandatory: true,
        },
        {
          id: "MAT-2",
          role: "Operator",
          department: "Production",
          courseId: "CRS-3",
          frequency: "Quarterly",
          mandatory: true,
        },
      ];
      return rows.filter((row) => {
        if (filters?.role && row.role !== filters.role) return false;
        if (filters?.department && row.department !== filters.department) return false;
        return true;
      });
    }
  },
}));

describe("AiService query", () => {
  it("generates auditable backend EHS intelligence from reports", async () => {
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

  it("returns structured, grounded investigation guidance from incident input", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.investigationAssistant(
      {
        incidentId: "RPT-3",
        type: "Chemical Spill",
        description:
          "Chemical spill on the production line caused medical treatment after splash exposure.",
        evidence: [
          "Photos show spill residue beside the transfer pump.",
          "PPE checklist for the task was unsigned.",
        ],
        witnessStatements: [
          "Jane Supervisor: Operator reported the spill immediately after the hose failed.",
        ],
        location: "Factory A",
        department: "Production",
      },
      "user-1",
    );

    expect((result as any).feature).toBe("investigation-assistant");
    expect((result as any).content).toContain("Investigation questions");
    expect((result as any).data.category).toBe("Chemical Spill");
    expect((result as any).data.severity).toBe("Critical");
    expect((result as any).data.relatedIncidents).toEqual(
      expect.arrayContaining(["RPT-3", "RPT-1"]),
    );
    expect((result as any).data.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: "RPT-3" }),
        expect.objectContaining({ source: "user-evidence" }),
        expect.objectContaining({ source: "witness-statement" }),
      ]),
    );
    expect((result as any).data.entities.where).toBe("Factory A");
    expect((result as any).data.suggestedQuestions.join(" ")).toContain(
      "related reports",
    );
  }, 15000);

  it("returns chatbot citations, suggested actions, and prediction linkage", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.chatbot(
      {
        query: "What should we do first after a spill response incident?",
        history: [{ role: "user", content: "We had a spill response incident." }],
      },
      "user-4",
    );

    expect((result as any).feature).toBe("chatbot");
    expect((result as any).predictionId).toBe("prediction-1");
    expect((result as any).content).toContain("spill response");
    expect((result as any).sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Chemical Spill Response Procedure",
        }),
      ]),
    );
    expect((result as any).suggestedActions.join(" ")).toContain("PPE");
  }, 15000);

  it("returns grounded compliance guidance from live obligation and audit context", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.complianceAssistant(
      {
        siteId: "Factory B",
        regulation: "Fire Safety Act",
        department: "Warehouse",
        includeGaps: true,
      },
      "user-2",
    );

    expect((result as any).feature).toBe("compliance-assistant");
    expect((result as any).content).toContain("Compliance risk is");
    expect((result as any).data.summary.nonCompliant).toBe(0);
    expect((result as any).data.summary.pending).toBe(1);
    expect((result as any).data.summary.riskLevel).toBe("Medium");
    expect((result as any).data.gaps.join(" ")).toContain("pending");
    expect((result as any).data.matchedObligations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "OBS-2",
          legislation: "Fire Safety Act",
          department: "Warehouse",
        }),
      ]),
    );
  }, 15000);

  it("returns grounded training recommendations from live training context", async () => {
    const { AiService } = await import("../../src/modules/ai/ai.service.js");
    const service = new AiService();

    const result = await service.trainingRecommendation(
      {
        employeeId: "EMP-1",
        role: "Operator",
        department: "Production",
        siteId: "Factory A",
        incidentId: "RPT-3",
        limit: 10,
      },
      "user-3",
    );

    expect((result as any).feature).toBe("training-recommendation");
    expect((result as any).content).toContain("Training priority is High");
    expect((result as any).data.summary.expired).toBe(1);
    expect((result as any).data.summary.open).toBe(1);
    expect((result as any).data.summary.mandatoryMatches).toBe(1);
    expect((result as any).data.gaps.join(" ")).toContain("Mandatory matrix requirement");
    expect((result as any).data.matchedRecords).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          employeeId: "EMP-1",
          courseTitle: "Chemical Handling Basics",
          status: "Expired",
        }),
      ]),
    );
  }, 15000);
});
