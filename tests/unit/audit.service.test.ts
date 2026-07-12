import { describe, expect, it } from "vitest";
import { diffRecord } from "../../src/shared/audit/audit.service.js";

describe("diffRecord", () => {
  it("returns field-level before and after values for changed records", () => {
    expect(
      diffRecord(
        { status: "Open", assignedTo: null, severity: "High" },
        { status: "Closed", assignedTo: "owner@example.com", severity: "High" },
      ),
    ).toEqual([
      { field: "status", before: "Open", after: "Closed" },
      { field: "assignedTo", before: null, after: "owner@example.com" },
    ]);
  });
});
