import { afterEach, describe, expect, it } from "vitest";
import {
  buildCapaAssignmentNotification,
  buildCorrectiveActionRequestNotification,
  buildIncidentNotification,
  buildReportAssignmentNotification,
  sendCapaAssignmentNotifications,
  sendOtpEmail,
  sendReportAssignmentNotifications,
} from "./email.js";

const originalFetch = globalThis.fetch;
const originalBrevoKey = process.env.BREVO_API_KEY;
const originalSender = process.env.BREVO_SENDER_EMAIL;

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalBrevoKey === undefined) delete process.env.BREVO_API_KEY;
  else process.env.BREVO_API_KEY = originalBrevoKey;
  if (originalSender === undefined) delete process.env.BREVO_SENDER_EMAIL;
  else process.env.BREVO_SENDER_EMAIL = originalSender;
});

describe("email notifications", () => {
  it("sends OTP with branded digital HTML and a plain-text fallback", async () => {
    let payload: Record<string, unknown> | undefined;
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_SENDER_EMAIL = "safety@crownpaints.co.ke";
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      payload = JSON.parse(String(init?.body));
      return new Response("{}", { status: 201 });
    }) as typeof fetch;

    const result = await sendOtpEmail({
      to: "user@example.com",
      code: "482913",
      expiresMinutes: 10,
    });

    expect(result.delivered).toBe(true);
    expect(payload?.htmlContent).toMatch(/CROWN PAINTS/);
    // Six digits rendered in order, regardless of the per-digit box markup.
    expect(payload?.htmlContent).toMatch(/4[\s\S]*?8[\s\S]*?2[\s\S]*?9[\s\S]*?1[\s\S]*?3/);
    expect(payload?.htmlContent).toMatch(/One-time passcode/);
    expect(payload?.htmlContent).toMatch(/Valid for/);
    expect(payload?.htmlContent).toMatch(/Anti-phishing warning/);
    expect(payload?.textContent).toMatch(/482913/);
  });

  it("buildIncidentNotification includes severity, location, and report details", () => {
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

    const result = buildIncidentNotification(
      report as any,
      "safety@example.com",
    );

    expect(result.recipient).toBe("safety@example.com");
    expect(result.subject).toMatch(/Critical incident/i);
    expect(result.message).toMatch(/RPT-1001/);
    expect(result.message).toMatch(/Mombasa - Factory/);
    expect(result.message).toMatch(/Chemical spill/);
  });

  it("buildReportAssignmentNotification creates assigner confirmation content", () => {
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

    expect(result.recipient).toBe("assigner@example.com");
    expect(result.role).toBe("assigner");
    expect(result.subject).toMatch(/Assignment confirmation/i);
    expect(result.message).toMatch(
      /assigned report RPT-2002 to primary@example.com/i,
    );
  });

  it("buildReportAssignmentNotification creates copied recipient content", () => {
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

    expect(result.recipient).toBe("copy@example.com");
    expect(result.role).toBe("secondary");
    expect(result.subject).toMatch(/copied/i);
    expect(result.message).toMatch(/copied you on report RPT-2003/i);
  });

  it("buildCorrectiveActionRequestNotification includes the corrective action form link", () => {
    const result = buildCorrectiveActionRequestNotification({
      to: "supervisor@example.com",
      recipientName: "Plant Supervisor",
      reportId: "RPT-3001",
      reportType: "Unsafe Condition",
      description: "Spill around the mixing station",
      dueDate: "2026-07-29",
      url: "https://ehs.example.com/corrective-action/mock-token",
    });

    expect(result.recipient).toBe("supervisor@example.com");
    expect(result.subject).toMatch(/Corrective action form assigned/i);
    expect(result.message).toMatch(/Plant Supervisor/);
    expect(result.message).toMatch(/Open corrective action form:/);
    expect(result.message).toMatch(/mock-token/);
  });

  it("buildCapaAssignmentNotification includes assignment details and the CAPA link", () => {
    const result = buildCapaAssignmentNotification({
      to: "owner@example.com",
      role: "owner",
      capaId: "CAPA-2026-1042",
      title: "Guard rail restoration",
      source: "Incident",
      actionPlan: "Restore rail and verify handover controls.",
      dueDate: "2026-07-29T00:00:00.000Z",
      site: "Nakuru Plant",
      department: "Operations",
      owner: "Plant Supervisor",
      assignedBy: "ehs.manager@crownpaints.co.ke",
      status: "Open",
      updateSummary: "owner email, task rows",
      url: "https://ehs.example.com/capa?focus=CAPA-2026-1042",
    });

    expect(result.recipient).toBe("owner@example.com");
    expect(result.subject).toMatch(/CAPA assignment updated/i);
    expect(result.message).toMatch(/Guard rail restoration/);
    expect(result.message).toMatch(/Updated assignment details: owner email, task rows/);
    expect(result.message).toMatch(/Open CAPA:/);
  });

  it("sendReportAssignmentNotifications delivers to assigner, primary, and secondary recipients through Brevo", async () => {
    const report = {
      id: "RPT-2004",
      severity: "High",
      location: "Nairobi - Factory",
      reporter: "Jane Doe",
      description: "Guarding defect",
      category: "Machine Guarding",
      type: "Unsafe Condition",
      date: "2026-07-10T09:00:00.000Z",
    };
    const calls: unknown[] = [];

    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_SENDER_EMAIL = "safety@crownpaints.co.ke";
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 201 });
    }) as typeof fetch;

    const results = await sendReportAssignmentNotifications(
      report,
      [
        { email: "assigner@example.com", role: "assigner" },
        { email: "primary@example.com", role: "primary" },
        { email: "copy@example.com", role: "secondary" },
      ],
      "assigner@example.com",
      "primary@example.com",
    );

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.delivered)).toBe(true);
    expect(results.map((result) => result.role)).toEqual([
      "assigner",
      "primary",
      "secondary",
    ]);
    expect(calls.map((call: any) => call.to[0].email)).toEqual([
      "assigner@example.com",
      "primary@example.com",
      "copy@example.com",
    ]);
    expect(calls.every((call: any) => call.htmlContent.includes("CROWN PAINTS"))).toBe(true);
    expect(calls.every((call: any) => call.htmlContent.includes("EHS digital notification"))).toBe(
      true,
    );
  });

  it("sendCapaAssignmentNotifications delivers unique owner and escalation emails through Brevo", async () => {
    const calls: unknown[] = [];

    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.BREVO_SENDER_EMAIL = "safety@crownpaints.co.ke";
    globalThis.fetch = (async (
      _url: string | URL | Request,
      init?: RequestInit,
    ) => {
      calls.push(JSON.parse(String(init?.body)));
      return new Response("{}", { status: 201 });
    }) as typeof fetch;

    const results = await sendCapaAssignmentNotifications([
      {
        to: "owner@example.com",
        role: "owner",
        capaId: "CAPA-2026-1050",
        title: "Repair damaged ladder",
        source: "Inspection",
        actionPlan: "Repair or replace the access ladder and verify condition.",
        dueDate: "2026-07-28T00:00:00.000Z",
        site: "Mombasa Factory",
        department: "Maintenance",
        owner: "Maintenance Lead",
      },
      {
        to: "escalation@example.com",
        role: "escalation",
        capaId: "CAPA-2026-1050",
        title: "Repair damaged ladder",
        source: "Inspection",
        actionPlan: "Repair or replace the access ladder and verify condition.",
        dueDate: "2026-07-28T00:00:00.000Z",
        site: "Mombasa Factory",
        department: "Maintenance",
        owner: "Maintenance Lead",
        updateSummary: "due date, escalation contact",
      },
      {
        to: "owner@example.com",
        role: "owner",
        capaId: "CAPA-2026-1050",
        title: "Repair damaged ladder",
        source: "Inspection",
        actionPlan: "Repair or replace the access ladder and verify condition.",
        dueDate: "2026-07-28T00:00:00.000Z",
        site: "Mombasa Factory",
        department: "Maintenance",
        owner: "Maintenance Lead",
      },
    ]);

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.delivered)).toBe(true);
    expect(calls.map((call: any) => call.to[0].email)).toEqual([
      "owner@example.com",
      "escalation@example.com",
    ]);
    expect(calls[0]).toMatchObject({ subject: expect.stringMatching(/CAPA assigned/i) });
    expect(calls[1]).toMatchObject({ subject: expect.stringMatching(/CAPA assignment updated/i) });
  });
});
