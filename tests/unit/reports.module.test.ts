import { describe, expect, it } from "vitest";

import { dedupeDashboardReports } from "../../src/modules/reports/reports.module.js";

describe("dedupeDashboardReports", () => {
  it("keeps only the newest row when the same report id appears multiple times", () => {
    const rows = [
      {
        id: "RPT-100",
        date: "2026-07-01T08:00:00.000Z",
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T08:15:00.000Z",
        status: "Open",
      },
      {
        id: "RPT-100",
        date: "2026-07-01T08:00:00.000Z",
        createdAt: "2026-07-01T08:00:00.000Z",
        updatedAt: "2026-07-01T09:45:00.000Z",
        status: "Closed",
      },
      {
        id: "RPT-101",
        date: "2026-07-02T08:00:00.000Z",
        createdAt: "2026-07-02T08:00:00.000Z",
        updatedAt: "2026-07-02T08:15:00.000Z",
        status: "Open",
      },
    ];

    const deduped = dedupeDashboardReports(rows);

    expect(deduped).toHaveLength(2);
    expect(deduped.find((row) => row.id === "RPT-100")?.status).toBe("Closed");
    expect(deduped.find((row) => row.id === "RPT-101")?.status).toBe("Open");
  });

  it("ignores rows without a usable report id", () => {
    const deduped = dedupeDashboardReports([
      { id: " ", updatedAt: "2026-07-01T08:00:00.000Z" },
      { updatedAt: "2026-07-01T09:00:00.000Z" },
      { id: "RPT-200", updatedAt: "2026-07-01T10:00:00.000Z" },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.id).toBe("RPT-200");
  });
});
