import test from "node:test";
import assert from "node:assert/strict";
import { buildIncidentNotification, buildReportAssignmentNotification } from "./email.js";

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

test("buildReportAssignmentNotification creates assigner confirmation content", () => {
  const report = {
    id: "RPT-2002",
    severity: "High",
    location: "Nakuru - Depot",
    reporter: "John Doe",
    description: "Forklift near miss",
    category: "Vehicle / Forklift",
    type: "Unsafe Act",
    date: "2026-07-10T08:00:00.000Z",
  };

  const result = buildReportAssignmentNotification(
    report,
    { email: "assigner@example.com", role: "assigner" },
    "assigner@example.com",
    "primary@example.com",
  );

  assert.equal(result.recipient, "assigner@example.com");
  assert.equal(result.role, "assigner");
  assert.match(result.subject, /Assignment confirmation/i);
  assert.match(result.message, /assigned report RPT-2002 to primary@example.com/i);
});

test("buildReportAssignmentNotification creates copied recipient content", () => {
  const report = {
    id: "RPT-2003",
    severity: "Medium",
    location: "Mombasa - Factory",
    reporter: "Jane Doe",
    description: "Missing PPE",
    category: "PPE Violation",
    type: "Unsafe Condition",
    date: "2026-07-10T09:00:00.000Z",
  };

  const result = buildReportAssignmentNotification(
    report,
    { email: "copy@example.com", role: "secondary" },
    "assigner@example.com",
    "primary@example.com",
  );

  assert.equal(result.recipient, "copy@example.com");
  assert.equal(result.role, "secondary");
  assert.match(result.subject, /copied/i);
  assert.match(result.message, /copied you on report RPT-2003/i);
});
