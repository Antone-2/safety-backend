import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentNotification } from "./email.js";

test("buildIncidentNotification includes severity, location, and report details", () => {
  const report = {
    id: "RPT-1001",
    severity: "Critical",
    location: "Mombasa - Factory",
    reporter: "Jane Doe",
    description: "Chemical spill near mixing bay",
    category: "Chemical Spill",
    type: "Unsafe Condition",
    date: "2026-06-23T10:00:00.000Z",
  };

  const result = buildIncidentNotification(report as any, "safety@example.com");

  assert.equal(result.recipient, "safety@example.com");
  assert.match(result.subject, /Critical incident/i);
  assert.match(result.message, /RPT-1001/);
  assert.match(result.message, /Mombasa - Factory/);
  assert.match(result.message, /Chemical spill/);
});
