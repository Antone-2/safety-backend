import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { notificationCenterService } from "./notification-center.service.js";
import { writeAuditLog } from "../shared/audit/audit.service.js";
import { getEnv } from "../config/index.js";

export type ClosureRequestStatus = "pending" | "approved" | "rejected";

export interface ReportClosureRequest {
  id: string;
  reportId: string;
  submittedBy: string;
  submittedByEmail: string;
  resolutionNotes: string;
  photos: string[];
  status: ClosureRequestStatus;
  reviewedBy?: string;
  reviewedByEmail?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

const CLOSURE_EVENT_KEY = "report.closure.request";

function buildReportUrl(reportId: string): string {
  const baseUrl = getEnv().FRONTEND_URL;
  if (!baseUrl) return `/reports/${reportId}`;
  return `${baseUrl.replace(/\/$/, "")}/reports/${reportId}`;
}

export async function createClosureRequest(input: {
  reportId: string;
  submittedBy: string;
  submittedByEmail: string;
  resolutionNotes: string;
  photos: string[];
}): Promise<ReportClosureRequest> {
  const id = `CLOSE-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  await pgPool.query(
    `INSERT INTO report_closure_requests
     (id, report_id, submitted_by, submitted_by_email, resolution_notes, photos, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6::text[], 'pending', $7, $8)`,
    [id, input.reportId, input.submittedBy, input.submittedByEmail, input.resolutionNotes, input.photos, now, now],
  );

  await writeAuditLog({
    action: "report.closure.requested",
    resourceType: "report",
    resourceId: input.reportId,
    context: {
      detail: `Closure requested by ${input.submittedByEmail}`,
      closureRequestId: id,
    },
  });

  const reportResult = await pgPool.query(
    "SELECT id, location, description, severity, status, assigned_to, assigned_to_copy FROM reports WHERE id = $1",
    [input.reportId],
  );
  const report = reportResult.rows[0];

  if (report) {
    const recipients = [
      { channel: "email" as const, recipient: input.submittedByEmail, name: input.submittedBy },
    ];

    const assignedTo = String(report.assigned_to ?? "");
    const assignedToCopy = Array.isArray(report.assigned_to_copy)
      ? report.assigned_to_copy.map((v: unknown) => String(v))
      : [];
    for (const email of assignedToCopy) {
      if (email && email !== input.submittedByEmail) {
        recipients.push({ channel: "email" as const, recipient: email, name: email });
      }
    }

    await notificationCenterService.enqueue({
      eventKey: CLOSURE_EVENT_KEY,
      workflow: "report-closure",
      resourceType: "report",
      resourceId: input.reportId,
      payload: {
        reportId: input.reportId,
        location: report.location,
        description: report.description,
        severity: report.severity,
        status: report.status,
        submittedBy: input.submittedBy,
        submittedByEmail: input.submittedByEmail,
        resolutionNotes: input.resolutionNotes,
        url: buildReportUrl(input.reportId),
      },
      recipients,
      createdBy: `closure-request:${id}`,
      maxAttempts: 3,
    });
  }

  return {
    id,
    reportId: input.reportId,
    submittedBy: input.submittedBy,
    submittedByEmail: input.submittedByEmail,
    resolutionNotes: input.resolutionNotes,
    photos: input.photos,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };
}

export async function approveClosureRequest(input: {
  requestId: string;
  reportId: string;
  reviewedBy: string;
  reviewedByEmail: string;
  reviewNotes?: string;
}): Promise<ReportClosureRequest> {
  const now = new Date().toISOString();

  const requestResult = await pgPool.query(
    "SELECT * FROM report_closure_requests WHERE id = $1 AND report_id = $2 AND status = 'pending'",
    [input.requestId, input.reportId],
  );
  const request = requestResult.rows[0];
  if (!request) {
    throw new Error("Closure request not found or already processed");
  }

  const client = await pgPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE report_closure_requests
       SET status = 'approved', reviewed_by = $1, reviewed_by_email = $2,
           review_notes = $3, updated_at = $4
       WHERE id = $5`,
      [input.reviewedBy, input.reviewedByEmail, input.reviewNotes || null, now, input.requestId],
    );

    await client.query(
      "UPDATE reports SET status = 'Closed', updated_at = $1 WHERE id = $2",
      [now, input.reportId],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await writeAuditLog({
    action: "report.closure.approved",
    resourceType: "report",
    resourceId: input.reportId,
    context: {
      detail: `Closure approved by ${input.reviewedByEmail}`,
      closureRequestId: input.requestId,
      reviewNotes: input.reviewNotes,
    },
  });

  const updatedRequest = await getClosureRequest(input.requestId, input.reportId);
  if (updatedRequest) {
    await notificationCenterService.enqueue({
      eventKey: `${CLOSURE_EVENT_KEY}:approved`,
      workflow: "report-closure",
      resourceType: "report",
      resourceId: input.reportId,
      payload: {
        reportId: input.reportId,
        submittedBy: updatedRequest.submittedBy,
        submittedByEmail: updatedRequest.submittedByEmail,
        reviewedBy: input.reviewedBy,
        reviewedByEmail: input.reviewedByEmail,
        reviewNotes: input.reviewNotes,
        url: buildReportUrl(input.reportId),
      },
      recipients: [
        { channel: "email" as const, recipient: updatedRequest.submittedByEmail, name: updatedRequest.submittedBy },
      ],
      createdBy: `closure-approval:${input.requestId}`,
      maxAttempts: 3,
    });
  }

  return updatedRequest!;
}

export async function rejectClosureRequest(input: {
  requestId: string;
  reportId: string;
  reviewedBy: string;
  reviewedByEmail: string;
  reviewNotes: string;
}): Promise<ReportClosureRequest> {
  const now = new Date().toISOString();

  const requestResult = await pgPool.query(
    "SELECT * FROM report_closure_requests WHERE id = $1 AND report_id = $2 AND status = 'pending'",
    [input.requestId, input.reportId],
  );
  const request = requestResult.rows[0];
  if (!request) {
    throw new Error("Closure request not found or already processed");
  }

  await pgPool.query(
    `UPDATE report_closure_requests
     SET status = 'rejected', reviewed_by = $1, reviewed_by_email = $2,
         review_notes = $3, updated_at = $4
     WHERE id = $5`,
    [input.reviewedBy, input.reviewedByEmail, input.reviewNotes, now, input.requestId],
  );

  await writeAuditLog({
    action: "report.closure.rejected",
    resourceType: "report",
    resourceId: input.reportId,
    context: {
      detail: `Closure rejected by ${input.reviewedByEmail}: ${input.reviewNotes}`,
      closureRequestId: input.requestId,
      reviewNotes: input.reviewNotes,
    },
  });

  const updatedRequest = await getClosureRequest(input.requestId, input.reportId);
  if (updatedRequest) {
    await notificationCenterService.enqueue({
      eventKey: `${CLOSURE_EVENT_KEY}:rejected`,
      workflow: "report-closure",
      resourceType: "report",
      resourceId: input.reportId,
      payload: {
        reportId: input.reportId,
        submittedBy: updatedRequest.submittedBy,
        submittedByEmail: updatedRequest.submittedByEmail,
        reviewedBy: input.reviewedBy,
        reviewedByEmail: input.reviewedByEmail,
        reviewNotes: input.reviewNotes,
        url: buildReportUrl(input.reportId),
      },
      recipients: [
        { channel: "email" as const, recipient: updatedRequest.submittedByEmail, name: updatedRequest.submittedBy },
      ],
      createdBy: `closure-rejection:${input.requestId}`,
      maxAttempts: 3,
    });
  }

  return updatedRequest!;
}

export async function getClosureRequest(requestId: string, reportId: string): Promise<ReportClosureRequest | null> {
  const result = await pgPool.query(
    "SELECT * FROM report_closure_requests WHERE id = $1 AND report_id = $2",
    [requestId, reportId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return mapClosureRequest(row);
}

export async function listClosureRequests(reportId?: string): Promise<ReportClosureRequest[]> {
  const result = reportId
    ? await pgPool.query("SELECT * FROM report_closure_requests WHERE report_id = $1 ORDER BY created_at DESC", [reportId])
    : await pgPool.query("SELECT * FROM report_closure_requests ORDER BY created_at DESC LIMIT 250");
  return result.rows.map(mapClosureRequest);
}

function mapClosureRequest(row: any): ReportClosureRequest {
  const photos = Array.isArray(row.photos)
    ? row.photos.map((photo: unknown) => String(photo))
    : typeof row.photos === "string" && row.photos.trim()
      ? safeParsePhotos(row.photos)
      : [];

  return {
    id: row.id,
    reportId: row.report_id,
    submittedBy: row.submitted_by,
    submittedByEmail: row.submitted_by_email,
    resolutionNotes: row.resolution_notes,
    photos,
    status: row.status,
    reviewedBy: row.reviewed_by,
    reviewedByEmail: row.reviewed_by_email,
    reviewNotes: row.review_notes,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

function safeParsePhotos(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map((photo) => String(photo)) : [];
  } catch {
    return [];
  }
}
