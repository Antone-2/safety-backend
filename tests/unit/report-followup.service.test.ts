import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPgPoolQuery, mockNotificationCenterEnqueue } = vi.hoisted(() => {
  const mockPgPoolQuery = vi.fn();
  const mockNotificationCenterEnqueue = vi.fn();
  return { mockPgPoolQuery, mockNotificationCenterEnqueue };
});

vi.mock("../../src/shared/infrastructure/database/postgres.client.js", () => ({
  get pgPool() {
    return { query: mockPgPoolQuery };
  },
}));

vi.mock("../../src/services/notification-center.service.js", () => ({
  get notificationCenterService() {
    return { enqueue: mockNotificationCenterEnqueue };
  },
}));

vi.mock("../../src/config/index.js", () => ({
  getEnv: () => ({ FRONTEND_URL: "https://app.example.com" }),
}));

import {
  findReportsNeedingFollowup,
  enqueueFollowup,
  scheduleFollowupsForReport,
} from "../../src/services/report-followup.service.js";

describe("report-followup.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPgPoolQuery.mockReset();
    mockNotificationCenterEnqueue.mockReset();
  });

  describe("findReportsNeedingFollowup", () => {
    it("queries reports with open status and upcoming due dates", async () => {
      const now = new Date();
      const dueAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      mockPgPoolQuery.mockResolvedValue({
        rows: [
          {
            id: "RPT-001",
            status: "Open",
            severity: "High",
            sla_hours: 72,
            due_at: dueAt,
            assigned_to: "user@example.com",
            assigned_to_copy: [],
            location: "Nairobi",
            description: "Test report",
          },
        ],
      });

      const result = await findReportsNeedingFollowup();
      expect(mockPgPoolQuery).toHaveBeenCalledTimes(1);
      expect(mockPgPoolQuery.mock.calls[0][0]).toContain("status != 'Closed'");
      expect(mockPgPoolQuery.mock.calls[0][0]).toContain("assigned_to IS NOT NULL");
      expect(result).toHaveLength(1);
      expect(result[0].reportId).toBe("RPT-001");
      expect(result[0].stage).toBe("urgent");
    });

    it("returns empty array when no reports match", async () => {
      mockPgPoolQuery.mockResolvedValue({ rows: [] });
      const result = await findReportsNeedingFollowup();
      expect(result).toEqual([]);
    });
  });

  describe("enqueueFollowup", () => {
    it("does not enqueue if recently notified", async () => {
      mockPgPoolQuery.mockResolvedValue({
        rows: [{ created_at: new Date().toISOString() }],
      });

      await enqueueFollowup({
        reportId: "RPT-001",
        stage: "reminder",
        dueAt: new Date().toISOString(),
        assignedTo: "user@example.com",
        assignedToCopy: [],
        location: "Nairobi",
        description: "Test",
        severity: "High",
        status: "Open",
        slaHours: 72,
      });
      expect(mockNotificationCenterEnqueue).not.toHaveBeenCalled();
    });

    it("enqueues notification for assigned report", async () => {
      mockPgPoolQuery.mockResolvedValue({ rows: [] });
      mockNotificationCenterEnqueue.mockResolvedValue({});

      await enqueueFollowup({
        reportId: "RPT-001",
        stage: "overdue",
        dueAt: new Date(Date.now() - 3600000).toISOString(),
        assignedTo: "user@example.com",
        assignedToCopy: ["cc@example.com"],
        location: "Nairobi",
        description: "Test report",
        severity: "High",
        status: "Open",
        slaHours: 72,
      });
      expect(mockNotificationCenterEnqueue).toHaveBeenCalledTimes(1);
      const call = mockNotificationCenterEnqueue.mock.calls[0][0];
      expect(call.eventKey).toBe("report.followup:overdue");
      expect(call.resourceType).toBe("report");
      expect(call.resourceId).toBe("RPT-001");
      expect(call.recipients).toHaveLength(2);
    });

    it("deduplicates primary and cc recipients", async () => {
      mockPgPoolQuery.mockResolvedValue({ rows: [] });
      mockNotificationCenterEnqueue.mockResolvedValue({});

      await enqueueFollowup({
        reportId: "RPT-001",
        stage: "reminder",
        dueAt: new Date().toISOString(),
        assignedTo: "user@example.com",
        assignedToCopy: ["user@example.com", "cc@example.com"],
        location: "Nairobi",
        description: "Test",
        severity: "High",
        status: "Open",
        slaHours: 72,
      });
      expect(mockNotificationCenterEnqueue).toHaveBeenCalledTimes(1);
      const call = mockNotificationCenterEnqueue.mock.calls[0][0];
      expect(call.recipients).toHaveLength(2);
      expect(call.recipients.map((r: any) => r.recipient)).toEqual([
        "user@example.com",
        "cc@example.com",
      ]);
    });
  });

  describe("scheduleFollowupsForReport", () => {
    it("does nothing for closed or unassigned reports", async () => {
      mockPgPoolQuery.mockResolvedValue({ rows: [] });

      await scheduleFollowupsForReport("RPT-001");
      expect(mockNotificationCenterEnqueue).not.toHaveBeenCalled();
    });

    it("schedules follow-up for assigned open report", async () => {
      const now = new Date();
      const dueAt = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
      mockPgPoolQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("FROM reports WHERE id = $1")) {
          return {
            rows: [
              {
                id: "RPT-001",
                status: "Open",
                severity: "High",
                sla_hours: 72,
                due_at: dueAt,
                assigned_to: "user@example.com",
                assigned_to_copy: [],
                location: "Nairobi",
                description: "Test",
              },
            ],
          };
        }

        return { rows: [] };
      });
      mockNotificationCenterEnqueue.mockResolvedValue({});

      await scheduleFollowupsForReport("RPT-001");
      expect(mockNotificationCenterEnqueue).toHaveBeenCalledTimes(1);
    });
  });
});
