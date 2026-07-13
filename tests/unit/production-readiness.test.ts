import { describe, expect, it } from "vitest";

import { POSTGRES_MIGRATIONS } from "../../src/shared/infrastructure/database/migrations.js";
import {
  leaderboardMonth,
  reporterPointsForSeverity,
} from "../../src/services/leaderboard.service.js";
import {
  getDb,
  PostgresOnlyDatabaseError,
} from "../../src/lib/database.js";

describe("production readiness", () => {
  it("uses unique PostgreSQL migration identifiers", () => {
    const ids = POSTGRES_MIGRATIONS.map((migration) => migration.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes the PostgreSQL leaderboard migration", () => {
    expect(
      POSTGRES_MIGRATIONS.some((migration) =>
        migration.sql.includes("CREATE TABLE IF NOT EXISTS reporter_points"),
      ),
    ).toBe(true);
  });

  it("fails closed instead of opening the legacy SQLite runtime database", async () => {
    await expect(getDb()).rejects.toBeInstanceOf(PostgresOnlyDatabaseError);
  });

  it("stores application settings in PostgreSQL", () => {
    expect(
      POSTGRES_MIGRATIONS.some((migration) =>
        migration.sql.includes("CREATE TABLE IF NOT EXISTS app_settings"),
      ),
    ).toBe(true);
  });

  it("applies the configured monthly severity points", () => {
    expect(reporterPointsForSeverity("Low")).toBe(1);
    expect(reporterPointsForSeverity("Medium")).toBe(2);
    expect(reporterPointsForSeverity("High")).toBe(2);
    expect(reporterPointsForSeverity("Critical")).toBe(3);
    expect(leaderboardMonth("2026-07-13T12:00:00.000Z")).toBe("2026-07");
  });
});
