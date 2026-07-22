import { describe, expect, it } from "vitest";

import {
  buildPgFilter,
  buildSqliteFilter,
} from "../../src/modules/reports/reports.service.js";

describe("report query contract", () => {
  const filters = {
    status: "Open",
    severity: "Critical",
    location: "Mombasa - Factory",
    category: "Chemical Spill",
    search: "forklift",
    dateFrom: "2026-07-01T00:00:00.000Z",
    dateTo: "2026-08-01T00:00:00.000Z",
  };

  it("builds equivalent PostgreSQL filters with an exclusive end boundary", () => {
    const query = buildPgFilter(filters);
    expect(query.whereSql).toContain("date >= $5");
    expect(query.whereSql).toContain("date < $6");
    expect(query.whereSql).toContain("description ILIKE $7");
    expect(query.params).toEqual([
      "Open",
      "Critical",
      "Mombasa - Factory",
      "Chemical Spill",
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
      "%forklift%",
    ]);
  });

  it("builds equivalent SQLite filters with an exclusive end boundary", () => {
    const query = buildSqliteFilter(filters);
    expect(query.whereSql).toContain("date >= ?");
    expect(query.whereSql).toContain("date < ?");
    expect(query.whereSql).toContain("description LIKE ?");
    expect(query.params.slice(0, 6)).toEqual([
      "Open",
      "Critical",
      "Mombasa - Factory",
      "Chemical Spill",
      "2026-07-01T00:00:00.000Z",
      "2026-08-01T00:00:00.000Z",
    ]);
  });
});
