import { describe, expect, it } from "vitest";

import {
  CreateComplianceAuditSchema,
  CreateComplianceObligationSchema,
  CreateLegalUpdateSchema,
} from "../../src/modules/compliance/compliance.types.js";

describe("compliance create schemas", () => {
  it("accepts an obligation payload without createdBy so the controller can inject it", () => {
    const parsed = CreateComplianceObligationSchema.safeParse({
      title: "Fire extinguisher inspection",
      legislation: "Fire Safety Act",
      requirement: "Inspect and tag extinguishers",
      frequency: "Monthly",
      responsibility: "EHS Manager",
      site: "Factory A",
      department: "Operations",
      dueDate: "2026-08-15",
      status: "Pending",
      notes: "Initial rollout",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a compliance audit payload without createdBy so the controller can inject it", () => {
    const parsed = CreateComplianceAuditSchema.safeParse({
      title: "Quarterly internal audit",
      type: "Internal",
      status: "Planned",
      site: "Factory A",
      department: "Operations",
      leadAuditor: "Jane Doe",
      teamMembers: ["John Doe"],
      startDate: "2026-08-01",
      endDate: "2026-08-02",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts a legal update payload without createdBy so the controller can inject it", () => {
    const parsed = CreateLegalUpdateSchema.safeParse({
      title: "Revised permit threshold",
      legislation: "OSHA",
      jurisdiction: "Kenya",
      effectiveDate: "2026-08-10",
      summary: "Permit threshold updated",
      impactAssessment: "Medium",
      actionRequired: "Review permit workflow",
      assignedTo: "Compliance Lead",
      dueDate: "2026-08-20",
      status: "New",
      source: "Government Gazette",
    });

    expect(parsed.success).toBe(true);
  });
});
