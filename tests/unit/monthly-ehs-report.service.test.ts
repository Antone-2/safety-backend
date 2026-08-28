import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockQuery } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
}));

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  pgPool: {
    query: mockQuery,
  },
}));

import { getMonthlyEhsReport } from "../../src/modules/reports/monthly-ehs-report.service.js";

describe("getMonthlyEhsReport", () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it("includes compliance, environmental, and health executive metrics from live sources", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          {
            id: "RPT-1",
            date: new Date("2026-08-05T09:00:00.000Z"),
            type: "Near Miss",
            location: "Plant 1",
            severity: "Critical",
            status: "Open",
            department: "Production",
            description: "Forklift near miss",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "CAPA-1",
            title: "Guarding fix",
            owner: "Alex",
            priority: "High",
            status: "Open",
            due_date: new Date("2026-08-12T00:00:00.000Z"),
            completed_date: null,
            created_at: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "TRN-1",
            status: "Expired",
            department: "Production",
            scheduled_date: new Date("2026-08-01T00:00:00.000Z"),
            completed_date: new Date("2026-08-02T00:00:00.000Z"),
            expiry_date: new Date("2026-08-10T00:00:00.000Z"),
            course_title: "Forklift certification",
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "OBS-1",
            title: "Noise monitoring permit",
            status: "Pending",
            due_date: new Date("2026-08-09T00:00:00.000Z"),
            created_at: new Date("2026-07-20T00:00:00.000Z"),
          },
          {
            id: "OBS-2",
            title: "Fire certificate",
            status: "Non-Compliant",
            due_date: new Date("2026-08-18T00:00:00.000Z"),
            created_at: new Date("2026-08-02T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "AUD-1",
            title: "ISO audit",
            status: "In Progress",
            start_date: new Date("2026-08-03T00:00:00.000Z"),
            end_date: new Date("2026-08-20T00:00:00.000Z"),
            created_at: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "LGL-1",
            title: "Legal bulletin",
            status: "Action Required",
            due_date: new Date("2026-08-22T00:00:00.000Z"),
            effective_date: new Date("2026-08-05T00:00:00.000Z"),
            created_at: new Date("2026-08-04T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "EM-1",
            status: "Exceedance",
            monitored_date: new Date("2026-08-06T00:00:00.000Z"),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "SPL-1",
            severity: "Major",
            date: new Date("2026-08-07T00:00:00.000Z"),
            cleanup_completed: false,
            reported_to_nema: true,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "MED-1",
            next_due_date: new Date("2026-08-25T00:00:00.000Z"),
            fitness_for_work: false,
            type: "Audiometric",
            examination_date: new Date("2026-08-01T00:00:00.000Z"),
          },
        ],
      });

    const payload = await getMonthlyEhsReport("2026-08");

    expect(payload.model.metrics.find((item) => item.key === "compliance")?.value).toBe("4 / 1");
    expect(payload.model.metrics.find((item) => item.key === "environmental")?.value).toBe("1 / 1");
    expect(payload.model.metrics.find((item) => item.key === "health")?.value).toBe("1 / 1");
    expect(payload.model.notifications.some((item) => item.title.includes("compliance item"))).toBe(
      true,
    );
    expect(payload.model.notifications.some((item) => item.title.includes("environmental alert"))).toBe(
      true,
    );
    expect(payload.model.notifications.some((item) => item.title.includes("occupational health item"))).toBe(
      true,
    );
    expect(payload.model.summaryText).toContain("compliance attention items total 4 with 1 open audits");
    expect(payload.model.summaryText).toContain("environmental alerts include 1 emission exceedance and 1 major spill");
    expect(payload.model.summaryText).toContain("occupational health follow-up covers 1 due surveillance record plus 1 restricted-fit case");
  });

  it("reconciles incident counts across trend data, metrics, and incident list", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: "RPT-1", date: new Date("2026-08-05T09:00:00.000Z"), type: "Near Miss", location: "Plant 1", severity: "Critical", status: "Open", department: "Production", description: "Forklift near miss" },
          { id: "RPT-2", date: new Date("2026-07-10T09:00:00.000Z"), type: "First Aid", location: "Plant 2", severity: "Low", status: "Closed", department: "Warehouse", description: "Cut finger" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload = await getMonthlyEhsReport("2026-08");

    const totalIncidentsMetric = payload.model.metrics.find((item) => item.key === "incidents");
    expect(totalIncidentsMetric?.value).toBe("1");
    expect(payload.model.incidents.length).toBe(1);
    expect(payload.model.incidents[0].id).toBe("RPT-1");
    expect(totalIncidentsMetric?.sparkline.reduce((a, b) => a + b, 0)).toBeGreaterThanOrEqual(1);
  });

  it("computes CAPA trend reconciliation from created, completed, and due dates", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: "CAPA-1", title: "Fix A", owner: "Alex", priority: "High", status: "Open", due_date: new Date("2026-08-12T00:00:00.000Z"), completed_date: null, created_at: new Date("2026-08-01T00:00:00.000Z") },
          { id: "CAPA-2", title: "Fix B", owner: "Beth", priority: "Medium", status: "Completed", due_date: new Date("2026-07-30T00:00:00.000Z"), completed_date: new Date("2026-08-05T00:00:00.000Z"), created_at: new Date("2026-07-20T00:00:00.000Z") },
          { id: "CAPA-3", title: "Fix C", owner: "Carl", priority: "High", status: "Open", due_date: new Date("2026-09-01T00:00:00.000Z"), completed_date: null, created_at: new Date("2026-08-10T00:00:00.000Z") },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload = await getMonthlyEhsReport("2026-08");

    const capaTrend = payload.model.capaTrendData;
    const lastMonth = capaTrend[capaTrend.length - 1];
    expect(lastMonth.opened).toBe(2);
    expect(lastMonth.closed).toBe(1);
    expect(lastMonth.overdue).toBe(1);
  });

  it("calculates training completion percentage and expiry status correctly", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { id: "TRN-1", status: "Completed", department: "Production", scheduled_date: new Date("2026-08-01T00:00:00.000Z"), completed_date: new Date("2026-08-02T00:00:00.000Z"), expiry_date: new Date("2026-11-01T00:00:00.000Z"), course_title: "Forklift" },
          { id: "TRN-2", status: "Scheduled", department: "Production", scheduled_date: new Date("2026-08-01T00:00:00.000Z"), completed_date: null, expiry_date: new Date("2026-08-10T00:00:00.000Z"), course_title: "Forklift" },
          { id: "TRN-3", status: "Expired", department: "Warehouse", scheduled_date: new Date("2026-08-01T00:00:00.000Z"), completed_date: new Date("2026-08-02T00:00:00.000Z"), expiry_date: new Date("2026-08-05T00:00:00.000Z"), course_title: "Chemical" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload = await getMonthlyEhsReport("2026-08");

    expect(payload.model.training.length).toBeGreaterThanOrEqual(1);
    const forkliftTraining = payload.model.training.find((item) => item.name === "Forklift");
    expect(forkliftTraining?.completion).toBe(50);
    expect(forkliftTraining?.status).toBe("Expired");

    const chemicalTraining = payload.model.training.find((item) => item.name === "Chemical");
    expect(chemicalTraining?.status).toBe("Expired");
  });

  it("assigns site risk scores and trends based on incident severity and volume", async () => {
    mockQuery
      .mockResolvedValueOnce({
        rows: [
          { id: "RPT-1", date: new Date("2026-08-05T09:00:00.000Z"), type: "LTI", location: "Plant 1", severity: "Critical", status: "Open", department: "Production", description: "Lost time injury" },
          { id: "RPT-2", date: new Date("2026-08-06T09:00:00.000Z"), type: "Near Miss", location: "Plant 1", severity: "Medium", status: "Open", department: "Production", description: "Near miss" },
          { id: "RPT-3", date: new Date("2026-08-07T09:00:00.000Z"), type: "Property Damage", location: "Plant 2", severity: "Low", status: "Closed", department: "Warehouse", description: "Door dent" },
        ],
      })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload = await getMonthlyEhsReport("2026-08");

    const plant1 = payload.model.sites.find((site) => site.name === "Plant 1");
    expect(plant1?.incidents).toBe(2);
    expect(plant1?.riskScore).toBe("High");
    expect(plant1?.trend).toBe("Needs attention");

    const plant2 = payload.model.sites.find((site) => site.name === "Plant 2");
    expect(plant2?.incidents).toBe(1);
    expect(plant2?.riskScore).toBe("Low");
    expect(plant2?.trend).toBe("Stable");
  });

  it("matches the frontend fetchMonthlyEhsReport type contract", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const payload = await getMonthlyEhsReport("2026-08");

    expect(payload).toHaveProperty("month");
    expect(payload).toHaveProperty("currentFocus");
    expect(payload.model).toHaveProperty("metrics");
    expect(payload.model).toHaveProperty("trendData");
    expect(payload.model).toHaveProperty("capaTrendData");
    expect(payload.model).toHaveProperty("incidentTypes");
    expect(payload.model).toHaveProperty("departmentPerformance");
    expect(payload.model).toHaveProperty("incidents");
    expect(payload.model).toHaveProperty("capas");
    expect(payload.model).toHaveProperty("training");
    expect(payload.model).toHaveProperty("sites");
    expect(payload.model).toHaveProperty("notifications");
    expect(payload.model).toHaveProperty("summaryText");
    expect(typeof payload.month).toBe("string");
    expect(typeof payload.currentFocus).toBe("string");
    expect(Array.isArray(payload.model.metrics)).toBe(true);
    expect(Array.isArray(payload.model.incidents)).toBe(true);
  });
});
