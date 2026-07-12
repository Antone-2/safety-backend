import { describe, expect, it } from "vitest";
import {
  INCIDENT_WORKFLOW,
  REPORT_WORKFLOW,
  WorkflowEngine,
} from "../../src/shared/workflow/workflow.engine.js";

describe("WorkflowEngine", () => {
  it("transitions when the actor has the required permission", () => {
    const engine = new WorkflowEngine(INCIDENT_WORKFLOW);
    expect(
      engine.transition("Open", "start-investigation", {
        role: "EHS-manager",
        permissions: ["incidents:update"],
      }),
    ).toBe("Investigating");
  });

  it("rejects invalid transitions", () => {
    const engine = new WorkflowEngine(INCIDENT_WORKFLOW);
    expect(() =>
      engine.transition("Open", "close", {
        role: "EHS-manager",
        permissions: ["capa:verify"],
      }),
    ).toThrow("Invalid workflow transition");
  });

  it("rejects actors without transition permission", () => {
    const engine = new WorkflowEngine(INCIDENT_WORKFLOW);
    expect(() =>
      engine.transition("Open", "start-investigation", {
        role: "depot-admin",
        permissions: ["reports:create"],
      }),
    ).toThrow("Actor cannot perform workflow transition");
  });

  it("models report assignment and closure workflow", () => {
    const engine = new WorkflowEngine(REPORT_WORKFLOW);
    const assigned = engine.transition("Open", "assign", {
      role: "EHS-manager",
      permissions: ["reports:assign"],
    });
    expect(assigned).toBe("Assigned");
    expect(
      engine.transition(assigned, "close", {
        role: "EHS-manager",
        permissions: ["reports:update"],
      }),
    ).toBe("Closed");
  });
});
