import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_TRANSITIONS,
  AssignmentTransitionSchema,
  AssignmentEvidenceReviewSchema,
  AssignmentTaskUpdateSchema,
  CreateAssignmentSchema,
  BulkAssignmentSchema,
  AssignmentTemplateSchema,
  AssignmentNotificationPreferenceSchema,
  EscalationPolicySchema,
  EffectivenessReviewSchema,
  AssignmentSignatureSchema,
  AssignmentDeadlineSchema,
  AssignmentRoutingRuleSchema,
  AssignmentTaskDependenciesSchema,
} from "../../src/modules/assignments/assignments.types.js";
import { addBusinessHours } from "../../src/services/assignment-sla.service.js";

describe("assignment domain", () => {
  it("models the complete operational lifecycle", () => {
    expect(ASSIGNMENT_TRANSITIONS.Assigned?.accept).toBe("Accepted");
    expect(ASSIGNMENT_TRANSITIONS.Accepted?.start).toBe("In Progress");
    expect(ASSIGNMENT_TRANSITIONS["In Progress"]?.submit).toBe("Submitted");
    expect(ASSIGNMENT_TRANSITIONS.Submitted?.review).toBe("Under Review");
    expect(ASSIGNMENT_TRANSITIONS["Under Review"]?.approve).toBe("Approved");
    expect(ASSIGNMENT_TRANSITIONS.Approved?.verify).toBe("Verified");
    expect(ASSIGNMENT_TRANSITIONS.Verified?.close).toBe("Closed");
    expect(ASSIGNMENT_TRANSITIONS.Closed?.reopen).toBe("Rework");
  });

  it("normalizes and validates assignment recipients", () => {
    const parsed = CreateAssignmentSchema.parse({
      reportId: "RPT-1",
      assigneeEmail: "  Supervisor@Example.com ",
      copiedEmails: ["manager@example.com"],
      reason: "Own the corrective action",
    });
    expect(parsed.assigneeEmail).toBe("supervisor@example.com");
    expect(parsed.priority).toBe("Medium");
  });

  it("rejects unsupported transitions", () => {
    expect(AssignmentTransitionSchema.safeParse({ event: "delete" }).success).toBe(false);
    expect(ASSIGNMENT_TRANSITIONS.Assigned?.approve).toBeUndefined();
  });

  it("requires explanations for blocked work and rejected evidence", () => {
    expect(AssignmentTaskUpdateSchema.safeParse({ status: "Blocked" }).success).toBe(false);
    expect(AssignmentTaskUpdateSchema.safeParse({ status: "Blocked", reason: "Waiting for parts" }).success).toBe(true);
    expect(AssignmentEvidenceReviewSchema.safeParse({ status: "Rejected" }).success).toBe(false);
    expect(AssignmentEvidenceReviewSchema.safeParse({ status: "Rejected", notes: "Photo is unreadable" }).success).toBe(true);
  });

  it("bounds bulk assignment and template blueprints", () => {
    expect(BulkAssignmentSchema.safeParse({ reportIds: [], assigneeEmail: "owner@example.com", reason: "Assign" }).success).toBe(false);
    expect(BulkAssignmentSchema.safeParse({ reportIds: ["RPT-1", "RPT-2"], assigneeEmail: "owner@example.com", reason: "Assign" }).success).toBe(true);
    expect(AssignmentTemplateSchema.safeParse({ name: "Critical response", completionSlaHours: 4 }).success).toBe(true);
  });

  it("calculates SLA deadlines across weekends and validates escalation policies", () => {
    expect(addBusinessHours(new Date("2026-08-28T16:00:00.000Z"), 3).toISOString()).toBe("2026-08-31T10:00:00.000Z");
    expect(addBusinessHours(new Date("2026-08-28T16:00:00.000Z"),3,{workingDays:[1,2,3,4,5],startHour:8,endHour:17,timezone:"Africa/Nairobi"}).toISOString()).toBe("2026-08-31T08:00:00.000Z");
    expect(EscalationPolicySchema.safeParse({ name: "Critical", responseSlaHours: 1, completionSlaHours: 4, levels: [{ afterHours: 1, recipients: ["assignee"], channels: ["email", "in-app"] }], businessCalendar: { workingDays: [1,2,3,4,5], startHour: 8, endHour: 17, timezone: "Africa/Nairobi" } }).success).toBe(true);
    expect(AssignmentNotificationPreferenceSchema.safeParse({ channels: ["email"], assignmentEvents: ["overdue"], digestCadence: "daily", quietHoursStart: "20:00", quietHoursEnd: "06:00" }).success).toBe(true);
  });

  it("requires complete effectiveness and digital sign-off records", () => {
    expect(EffectivenessReviewSchema.safeParse({ outcome: "Ineffective", effectivenessScore: 20, residualRisk: "High", recurrenceDetected: true, followUpInspectionRequired: true, notes: "Control did not prevent recurrence" }).success).toBe(false);
    expect(EffectivenessReviewSchema.safeParse({ outcome: "Ineffective", effectivenessScore: 20, residualRisk: "High", recurrenceDetected: true, followUpInspectionRequired: true, followUpDueAt: "2026-09-10T08:00:00.000Z", notes: "Control did not prevent recurrence" }).success).toBe(true);
    expect(AssignmentSignatureSchema.safeParse({ signatureType: "verification", declaration: "I reviewed and confirm this evidence.", expectedVersion: 2 }).success).toBe(true);
  });

  it("validates controlled deadline changes and automatic routing rules", () => {
    expect(AssignmentDeadlineSchema.safeParse({ dueAt: "2026-09-10T08:00:00.000Z", reason: "Investigation scope expanded", expectedVersion: 3 }).success).toBe(true);
    expect(AssignmentDeadlineSchema.safeParse({ reason: "No deadline supplied", expectedVersion: 3 }).success).toBe(false);
    expect(AssignmentRoutingRuleSchema.safeParse({ name: "Critical Nairobi reports", severity: "Critical", site: "Nairobi", assigneeEmail: "manager@example.com", copiedEmails: [], ruleOrder: 10 }).success).toBe(true);
    expect(AssignmentRoutingRuleSchema.safeParse({ name: "Broken", assigneeEmail: "not-an-email" }).success).toBe(false);
    expect(AssignmentTaskDependenciesSchema.safeParse({ dependsOnTaskIds: [], reason: "No longer blocked" }).success).toBe(true);
    expect(AssignmentTaskDependenciesSchema.safeParse({ dependsOnTaskIds: [], reason: "" }).success).toBe(false);
  });
});
