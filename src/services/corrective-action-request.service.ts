import { randomBytes } from "crypto";

import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { writeAuditLog } from "../shared/audit/audit.service.js";
import { getEnv } from "../config/index.js";
import {
  sendCorrectiveActionReminderEmail,
  sendCorrectiveActionRequestEmail,
  sendCorrectiveActionSubmissionNotification,
} from "../lib/email.js";

export const CORRECTIVE_ACTION_EVENT_TYPES = [
  "Unsafe Act",
  "Unsafe Condition",
  "Incident",
  "Accident",
] as const;

export const CORRECTIVE_ACTION_ITEM_STATUSES = [
  "Planned",
  "In Progress",
  "Completed",
  "Blocked",
] as const;

export type CorrectiveActionEventType =
  (typeof CORRECTIVE_ACTION_EVENT_TYPES)[number];
export type CorrectiveActionItemStatus =
  (typeof CORRECTIVE_ACTION_ITEM_STATUSES)[number];

export interface CorrectiveActionPlanItem {
  action: string;
  byWho: string;
  byWhoEmail?: string;
  byWhen: string;
  status: CorrectiveActionItemStatus;
}

export interface CorrectiveActionRequestRecord {
  id: string;
  reportId: string;
  accessToken: string;
  recipientEmail: string;
  recipientName?: string | null;
  assignedByEmail?: string | null;
  assignedByName?: string | null;
  reportType: string;
  reportCategory?: string | null;
  reportDescription: string;
  reportLocation?: string | null;
  reportDepartment?: string | null;
  assigneeNote?: string | null;
  copiedRecipientEmails: string[];
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate?: string | null;
  actionPlanDueDate?: string | null;
  status: "pending" | "submitted";
  unsafeEventType?: CorrectiveActionEventType | null;
  immediateActionTaken?: string | null;
  completedTasks?: string | null;
  rootCauseAnalysis?: string | null;
  actionPlanItems: CorrectiveActionPlanItem[];
  capaId?: string | null;
  submittedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CorrectiveActionNotificationRecipient = {
  recipient: string;
  role: "recipient" | "sender" | "copied" | "task-owner";
  stage: "request" | "submission" | "request-reminder" | "plan-reminder" | "task-reminder";
  delivered: boolean;
  mode: "brevo" | "smtp" | "failed" | "internal";
  message?: string;
  error?: string;
};

export type CorrectiveActionNotificationHistoryEntry = {
  id: string;
  requestId: string;
  action: string;
  actorEmail?: string;
  actorRole?: string;
  createdAt: string;
  delivered: number;
  queued: number;
  failed: number;
  message: string;
  recipients: CorrectiveActionNotificationRecipient[];
};

export type CorrectiveActionRequestRecordWithHistory = CorrectiveActionRequestRecord & {
  notificationHistory: CorrectiveActionNotificationHistoryEntry[];
};

function normalizeNotificationMode(
  value: string,
): CorrectiveActionNotificationRecipient["mode"] {
  return value === "brevo" ||
    value === "smtp" ||
    value === "failed" ||
    value === "internal"
    ? value
    : "internal";
}

function isEmail(value: string | null | undefined) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isPgConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function buildCorrectiveActionUrl(token: string): string {
  const baseUrl = getEnv().FRONTEND_URL || "http://localhost:5173";
  return `${baseUrl.replace(/\/$/, "")}/corrective-action/${encodeURIComponent(token)}`;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAccessToken() {
  return randomBytes(24).toString("hex");
}

function normalizeActionPlanItems(value: unknown): CorrectiveActionPlanItem[] {
  const list = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
      ? safeParseJsonArray(value)
      : [];

  return list
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const status = String(record.status || "Planned") as CorrectiveActionItemStatus;
      return {
        action: String(record.action || "").trim(),
        byWho: String(record.byWho || "").trim(),
        byWhoEmail: String(record.byWhoEmail || "").trim() || undefined,
        byWhen: String(record.byWhen || "").trim(),
        status: CORRECTIVE_ACTION_ITEM_STATUSES.includes(status)
          ? status
          : "Planned",
      };
    })
    .filter((item) => item.action && item.byWho && item.byWhen);
}

function safeParseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapRecord(row: Record<string, unknown>): CorrectiveActionRequestRecord {
  return {
    id: String(row.id),
    reportId: String(row.report_id ?? row.reportId),
    accessToken: String(row.access_token ?? row.accessToken),
    recipientEmail: String(row.recipient_email ?? row.recipientEmail),
    recipientName: (row.recipient_name ?? row.recipientName ?? null) as string | null,
    assignedByEmail: (row.assigned_by_email ?? row.assignedByEmail ?? null) as string | null,
    assignedByName: (row.assigned_by_name ?? row.assignedByName ?? null) as string | null,
    reportType: String(row.report_type ?? row.reportType),
    reportCategory: (row.report_category ?? row.reportCategory ?? null) as string | null,
    reportDescription: String(row.report_description ?? row.reportDescription),
    reportLocation: (row.report_location ?? row.reportLocation ?? null) as string | null,
    reportDepartment: (row.report_department ?? row.reportDepartment ?? null) as string | null,
    assigneeNote: (row.assignee_note ?? row.assigneeNote ?? null) as string | null,
    copiedRecipientEmails: Array.isArray(row.copied_recipient_emails)
      ? row.copied_recipient_emails.map(String)
      : Array.isArray(row.copiedRecipientEmails)
        ? row.copiedRecipientEmails.map(String)
        : typeof row.copied_recipient_emails === "string"
          ? safeParseJsonArray(String(row.copied_recipient_emails)).map(String)
          : typeof row.copiedRecipientEmails === "string"
            ? safeParseJsonArray(String(row.copiedRecipientEmails)).map(String)
            : [],
    priority: String(row.priority || "Medium") as CorrectiveActionRequestRecord["priority"],
    dueDate: (row.due_date ??
      row.dueDate ??
      null) as string | null,
    actionPlanDueDate: (row.action_plan_due_date ??
      row.actionPlanDueDate ??
      null) as string | null,
    status: String(row.status || "pending") as CorrectiveActionRequestRecord["status"],
    unsafeEventType: (row.unsafe_event_type ??
      row.unsafeEventType ??
      null) as CorrectiveActionEventType | null,
    immediateActionTaken: (row.immediate_action_taken ??
      row.immediateActionTaken ??
      null) as string | null,
    completedTasks: (row.completed_tasks ??
      row.completedTasks ??
      null) as string | null,
    rootCauseAnalysis: (row.root_cause_analysis ??
      row.rootCauseAnalysis ??
      null) as string | null,
    actionPlanItems: normalizeActionPlanItems(
      row.action_plan_items ?? row.actionPlanItems ?? [],
    ),
    capaId: (row.capa_id ?? row.capaId ?? null) as string | null,
    submittedAt: (row.submitted_at ?? row.submittedAt ?? null) as string | null,
    expiresAt: (row.expires_at ?? row.expiresAt ?? null) as string | null,
    createdAt: String(row.created_at ?? row.createdAt),
    updatedAt: String(row.updated_at ?? row.updatedAt),
  };
}

function serializeActionPlan(items: CorrectiveActionPlanItem[]) {
  return items
    .map(
      (item, index) =>
        `${index + 1}. ${item.action} | By who: ${item.byWho} | By when: ${item.byWhen} | Status: ${item.status}`,
    )
    .join("\n");
}

function summarizeNotificationResults(
  recipients: CorrectiveActionNotificationRecipient[],
  defaultMessage: string,
) {
  const delivered = recipients.filter((item) => item.delivered).length;
  const queued = recipients.filter((item) => item.mode === "internal").length;
  const failed = recipients.filter((item) => item.mode === "failed").length;
  return {
    delivered,
    queued,
    failed,
    message:
      recipients.find((item) => item.message)?.message ||
      (recipients.length > 0 ? defaultMessage : "No notification recipients were processed."),
  };
}

async function recordCorrectiveActionNotificationHistory(input: {
  reportId: string;
  requestId: string;
  action: string;
  actor?: { id?: string; email?: string; role?: string } | null;
  recipients: CorrectiveActionNotificationRecipient[];
  message: string;
}) {
  if (!isPgConfigured() || input.recipients.length === 0) return;
  const summary = summarizeNotificationResults(input.recipients, input.message);
  await writeAuditLog({
    action: input.action,
    resourceType: "report",
    resourceId: input.reportId,
    actor: input.actor
      ? {
          id: input.actor.id || "",
          email: input.actor.email || "",
          role: input.actor.role || "",
          name: "",
        }
      : undefined,
    context: {
      correctiveActionRequestId: input.requestId,
      notifications: {
        delivered: summary.delivered,
        queued: summary.queued,
        failed: summary.failed,
        message: summary.message,
        recipients: input.recipients,
      },
    },
  });
}

export type CorrectiveActionNotificationSummary = {
  delivered: number;
  queued: number;
  failed: number;
  message: string;
  recipients: CorrectiveActionNotificationRecipient[];
};

async function getCorrectiveActionNotificationHistory(
  reportId: string,
): Promise<Map<string, CorrectiveActionNotificationHistoryEntry[]>> {
  if (!isPgConfigured()) return new Map();

  const result = await pgPool.query(
    `SELECT id, action, actor_email, actor_role, created_at, context
     FROM audit_logs
     WHERE resource_type = 'report'
       AND resource_id = $1
       AND context ? 'correctiveActionRequestId'
       AND context ? 'notifications'
     ORDER BY created_at DESC`,
    [reportId],
  );

  const history = new Map<string, CorrectiveActionNotificationHistoryEntry[]>();
  for (const row of result.rows) {
    const requestId = String(row.context?.correctiveActionRequestId || "");
    if (!requestId) continue;
    const entry: CorrectiveActionNotificationHistoryEntry = {
      id: String(row.id),
      requestId,
      action: String(row.action),
      actorEmail: row.actor_email ? String(row.actor_email) : undefined,
      actorRole: row.actor_role ? String(row.actor_role) : undefined,
      createdAt: String(row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()),
      delivered: Number(row.context?.notifications?.delivered ?? 0),
      queued: Number(row.context?.notifications?.queued ?? 0),
      failed: Number(row.context?.notifications?.failed ?? 0),
      message: String(row.context?.notifications?.message ?? ""),
      recipients: Array.isArray(row.context?.notifications?.recipients)
        ? row.context.notifications.recipients.map((item: Record<string, unknown>) => ({
            recipient: String(item.recipient || ""),
            role:
              item.role === "sender" ||
              item.role === "copied" ||
              item.role === "task-owner"
                ? item.role
                : "recipient",
            stage:
              item.stage === "submission" ||
              item.stage === "request-reminder" ||
              item.stage === "plan-reminder" ||
              item.stage === "task-reminder"
                ? item.stage
                : "request",
            delivered: Boolean(item.delivered),
            mode:
              item.mode === "brevo" ||
              item.mode === "smtp" ||
              item.mode === "failed" ||
              item.mode === "internal"
                ? item.mode
                : "internal",
            message: item.message ? String(item.message) : undefined,
            error: item.error ? String(item.error) : undefined,
          }))
        : [],
    };
    history.set(requestId, [...(history.get(requestId) || []), entry]);
  }

  return history;
}

async function createLinkedCapa(
  request: CorrectiveActionRequestRecord,
): Promise<string | null> {
  if (!isPgConfigured()) return null;

  const dueDate =
    request.actionPlanDueDate ||
    request.dueDate ||
    request.actionPlanItems
      .map((item) => item.byWhen)
      .find(Boolean) ||
    new Date().toISOString();

  const result = await pgPool.query(
    `INSERT INTO capa (
      capa_no, type, status, priority, title, description, source, source_ref,
      linked_incident_id, root_cause, action_plan, owner, department, site, due_date,
      attachments, created_by
    ) VALUES (
      $1, 'Corrective', 'Open', $2, $3, $4, 'Report', $5,
      $6, $7, $8, $9, $10, $11, $12, '[]'::jsonb, $13
    ) RETURNING id`,
    [
      `CAPA-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
      request.priority,
      `Corrective action for report ${request.reportId}`,
      request.reportDescription,
      request.reportId,
      request.reportId,
      request.rootCauseAnalysis ?? null,
      serializeActionPlan(request.actionPlanItems),
      request.recipientName || request.recipientEmail,
      request.reportDepartment || "Unspecified",
      request.reportLocation || "Unspecified",
      dueDate,
      request.recipientEmail,
    ],
  );

  return result.rows[0]?.id ? String(result.rows[0].id) : null;
}

export async function createCorrectiveActionRequest(input: {
  reportId: string;
  recipientEmail: string;
  recipientName?: string;
  assignedByEmail?: string;
  assignedByName?: string;
  copiedRecipientEmails?: string[];
  reportType: string;
  reportCategory?: string;
  reportDescription: string;
  reportLocation?: string;
  reportDepartment?: string;
  assigneeNote?: string;
  priority: "Low" | "Medium" | "High" | "Critical";
  dueDate?: string;
}): Promise<CorrectiveActionRequestRecord> {
  const id = makeId("CAR");
  const accessToken = makeAccessToken();
  const now = new Date().toISOString();
  const expiresAt = input.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  if (isPgConfigured()) {
    const result = await pgPool.query(
      `INSERT INTO corrective_action_requests (
        id, report_id, access_token, recipient_email, recipient_name,
        assigned_by_email, assigned_by_name, copied_recipient_emails, report_type, report_category,
        report_description, report_location, report_department, assignee_note, priority, due_date,
        status, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, $9, $10,
        $11, $12, $13, $14, $15, $16,
        'pending', $17, $18, $19
      ) RETURNING *`,
      [
        id,
        input.reportId,
        accessToken,
        input.recipientEmail,
        input.recipientName ?? null,
        input.assignedByEmail ?? null,
        input.assignedByName ?? null,
        JSON.stringify(input.copiedRecipientEmails ?? []),
        input.reportType,
        input.reportCategory ?? null,
        input.reportDescription,
        input.reportLocation ?? null,
        input.reportDepartment ?? null,
        input.assigneeNote ?? null,
        input.priority,
        input.dueDate ?? null,
        expiresAt,
        now,
        now,
      ],
    );
    const record = mapRecord(result.rows[0]);
    const delivery = await sendCorrectiveActionRequestEmail({
      to: record.recipientEmail,
      recipientName: record.recipientName || undefined,
      reportId: record.reportId,
      reportType: record.reportType,
      description: record.reportDescription,
      assigneeNote: record.assigneeNote || undefined,
      dueDate: record.dueDate || undefined,
      url: buildCorrectiveActionUrl(record.accessToken),
    });
    await recordCorrectiveActionNotificationHistory({
      reportId: record.reportId,
      requestId: record.id,
      action: "corrective-action.request.notified",
      recipients: [
        {
          recipient: delivery.recipient,
          role: "recipient",
          stage: "request",
          delivered: Boolean(delivery.delivered),
          mode: normalizeNotificationMode(delivery.mode),
          message: delivery.message,
        },
      ],
      message: delivery.message,
    });
    return record;
  }

  const db = await getDb();
  db.prepare(
    `INSERT INTO corrective_action_requests (
      id, reportId, accessToken, recipientEmail, recipientName,
      assignedByEmail, assignedByName, copiedRecipientEmails, reportType, reportCategory,
      reportDescription, reportLocation, reportDepartment, assigneeNote, priority, dueDate,
      status, expiresAt, createdAt, updatedAt, actionPlanItems
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, '[]')`,
  ).run([
    id,
    input.reportId,
    accessToken,
    input.recipientEmail,
    input.recipientName ?? null,
    input.assignedByEmail ?? null,
    input.assignedByName ?? null,
    JSON.stringify(input.copiedRecipientEmails ?? []),
    input.reportType,
    input.reportCategory ?? null,
    input.reportDescription,
    input.reportLocation ?? null,
    input.reportDepartment ?? null,
    input.assigneeNote ?? null,
    input.priority,
    input.dueDate ?? null,
    expiresAt,
    now,
    now,
  ]);
  await saveDb(db);

  const row = allRows(
    db,
    "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1",
    [id],
  )[0] as Record<string, unknown>;
  const record = mapRecord(row);
  await sendCorrectiveActionRequestEmail({
    to: record.recipientEmail,
    recipientName: record.recipientName || undefined,
    reportId: record.reportId,
    reportType: record.reportType,
    description: record.reportDescription,
    assigneeNote: record.assigneeNote || undefined,
    dueDate: record.dueDate || undefined,
    url: buildCorrectiveActionUrl(record.accessToken),
  });
  return record;
}

export async function listCorrectiveActionRequestsByReport(
  reportId: string,
): Promise<CorrectiveActionRequestRecordWithHistory[]> {
  let records: CorrectiveActionRequestRecord[] = [];

  if (isPgConfigured()) {
    const result = await pgPool.query(
      "SELECT * FROM corrective_action_requests WHERE report_id = $1 ORDER BY created_at DESC",
      [reportId],
    );
    records = result.rows.map(mapRecord);
  } else {
    const db = await getDb();
    records = allRows(
      db,
      "SELECT * FROM corrective_action_requests WHERE reportId = ? ORDER BY createdAt DESC",
      [reportId],
    ).map((row) => mapRecord(row as Record<string, unknown>));
  }

  const historyByRequest = await getCorrectiveActionNotificationHistory(reportId);
  return records.map((record) => ({
    ...record,
    notificationHistory: historyByRequest.get(record.id) || [],
  }));
}

export async function resendCorrectiveActionNotifications(input: {
  requestId: string;
  actor?: { id?: string; email?: string; role?: string } | null;
}): Promise<{
  record: CorrectiveActionRequestRecord;
  notifications: CorrectiveActionNotificationSummary;
}> {
  let record: CorrectiveActionRequestRecord | null = null;

  if (isPgConfigured()) {
    const result = await pgPool.query(
      "SELECT * FROM corrective_action_requests WHERE id = $1 LIMIT 1",
      [input.requestId],
    );
    record = result.rows[0] ? mapRecord(result.rows[0]) : null;
  } else {
    const db = await getDb();
    const row = allRows(
      db,
      "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1",
      [input.requestId],
    )[0] as Record<string, unknown> | undefined;
    record = row ? mapRecord(row) : null;
  }

  if (!record) {
    throw new Error("Corrective action request not found");
  }

  const recipients: CorrectiveActionNotificationRecipient[] = [];

  const requestDelivery = await sendCorrectiveActionRequestEmail({
    to: record.recipientEmail,
    recipientName: record.recipientName || undefined,
    reportId: record.reportId,
    reportType: record.reportType,
    description: record.reportDescription,
    assigneeNote: record.assigneeNote || undefined,
    dueDate: record.dueDate || undefined,
    url: buildCorrectiveActionUrl(record.accessToken),
  });
  recipients.push({
    recipient: requestDelivery.recipient,
    role: "recipient",
    stage: "request",
    delivered: Boolean(requestDelivery.delivered),
    mode: normalizeNotificationMode(requestDelivery.mode),
    message: requestDelivery.message,
  });

  if (record.status === "submitted") {
    const summary = serializeActionPlan(record.actionPlanItems);
    const notifyRecipients = Array.from(
      new Set(
        [record.assignedByEmail || "", ...record.copiedRecipientEmails].filter((email) =>
          isEmail(email),
        ),
      ),
    );
    for (const email of notifyRecipients) {
      try {
        const delivery = await sendCorrectiveActionSubmissionNotification({
          to: email,
          reportId: record.reportId,
          recipientName: record.recipientName || undefined,
          recipientEmail: record.recipientEmail,
          dueDate: record.dueDate || undefined,
          actionPlanDueDate: record.actionPlanDueDate || undefined,
          actionPlanSummary: summary || "Action plan submitted",
          url: buildCorrectiveActionUrl(record.accessToken),
        });
        recipients.push({
          recipient: delivery.recipient,
          role: email === record.assignedByEmail ? "sender" : "copied",
          stage: "submission",
          delivered: Boolean(delivery.delivered),
          mode: normalizeNotificationMode(delivery.mode),
          message: delivery.message,
        });
      } catch (error) {
        recipients.push({
          recipient: email,
          role: email === record.assignedByEmail ? "sender" : "copied",
          stage: "submission",
          delivered: false,
          mode: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const notifications = {
    ...summarizeNotificationResults(
      recipients,
      `Corrective action notifications resent for report ${record.reportId}.`,
    ),
    recipients,
  };

  await recordCorrectiveActionNotificationHistory({
    reportId: record.reportId,
    requestId: record.id,
    action: "corrective-action.notifications.resent",
    actor: input.actor,
    recipients,
    message: notifications.message,
  });

  return {
    record,
    notifications,
  };
}

export async function getCorrectiveActionRequestByToken(
  token: string,
): Promise<CorrectiveActionRequestRecord | null> {
  if (isPgConfigured()) {
    const result = await pgPool.query(
      "SELECT * FROM corrective_action_requests WHERE access_token = $1 LIMIT 1",
      [token],
    );
    const record = result.rows[0] ? mapRecord(result.rows[0]) : null;
    if (record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      throw new Error("This corrective action link has expired");
    }
    return record;
  }

  const db = await getDb();
  const row = allRows(
    db,
    "SELECT * FROM corrective_action_requests WHERE accessToken = ? LIMIT 1",
    [token],
  )[0] as Record<string, unknown> | undefined;
  const record = row ? mapRecord(row) : null;
  if (record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
    throw new Error("This corrective action link has expired");
  }
  return record;
}

export async function submitCorrectiveActionRequest(input: {
  token: string;
  unsafeEventType: CorrectiveActionEventType;
  description: string;
  immediateActionTaken: string;
  completedTasks: string;
  rootCauseAnalysis: string;
  actionPlanDueDate?: string;
  actionPlanItems: CorrectiveActionPlanItem[];
}): Promise<CorrectiveActionRequestRecord> {
  const existing = await getCorrectiveActionRequestByToken(input.token);
  if (!existing) {
    throw new Error("Corrective action request not found");
  }
  if (existing.status === "submitted") {
    return existing;
  }

  const now = new Date().toISOString();
  let capaId: string | null = null;

  if (isPgConfigured()) {
    capaId = await createLinkedCapa({
      ...existing,
      unsafeEventType: input.unsafeEventType,
      immediateActionTaken: input.immediateActionTaken,
      completedTasks: input.completedTasks,
      rootCauseAnalysis: input.rootCauseAnalysis,
      actionPlanDueDate: input.actionPlanDueDate ?? null,
      actionPlanItems: input.actionPlanItems,
      submittedAt: now,
      updatedAt: now,
      status: "submitted",
    });

    const result = await pgPool.query(
      `UPDATE corrective_action_requests
       SET status = 'submitted',
           unsafe_event_type = $1,
           report_description = $2,
           immediate_action_taken = $3,
           completed_tasks = $4,
           root_cause_analysis = $5,
           action_plan_due_date = $6,
           action_plan_items = $7::jsonb,
           capa_id = $8,
           submitted_at = $9,
           updated_at = $9
       WHERE access_token = $10
       RETURNING *`,
      [
        input.unsafeEventType,
        input.description,
        input.immediateActionTaken,
        input.completedTasks,
        input.rootCauseAnalysis,
        input.actionPlanDueDate ?? null,
        JSON.stringify(input.actionPlanItems),
        capaId,
        now,
        input.token,
      ],
    );
    const record = mapRecord(result.rows[0]);
    const summary = serializeActionPlan(record.actionPlanItems);
    const notifyRecipients = Array.from(
      new Set(
        [
          record.assignedByEmail || "",
          ...record.copiedRecipientEmails,
        ].filter((email) => isEmail(email)),
      ),
    );
    const notificationRecipients: CorrectiveActionNotificationRecipient[] = [];
    for (const email of notifyRecipients) {
      try {
        const delivery = await sendCorrectiveActionSubmissionNotification({
          to: email,
          reportId: record.reportId,
          recipientName: record.recipientName || undefined,
          recipientEmail: record.recipientEmail,
          dueDate: record.dueDate || undefined,
          actionPlanDueDate: record.actionPlanDueDate || undefined,
          actionPlanSummary: summary || "Action plan submitted",
          url: buildCorrectiveActionUrl(record.accessToken),
        });
        notificationRecipients.push({
          recipient: delivery.recipient,
          role: email === record.assignedByEmail ? "sender" : "copied",
          stage: "submission",
          delivered: Boolean(delivery.delivered),
          mode: normalizeNotificationMode(delivery.mode),
          message: delivery.message,
        });
      } catch (error) {
        notificationRecipients.push({
          recipient: email,
          role: email === record.assignedByEmail ? "sender" : "copied",
          stage: "submission",
          delivered: false,
          mode: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    await recordCorrectiveActionNotificationHistory({
      reportId: record.reportId,
      requestId: record.id,
      action: "corrective-action.submission.notified",
      recipients: notificationRecipients,
      message: `Corrective action submission processed for ${record.reportId}.`,
    });
    await writeAuditLog({
      action: "corrective-action.request.submitted",
      resourceType: "report",
      resourceId: record.reportId,
      context: {
        correctiveActionRequestId: record.id,
        recipientEmail: record.recipientEmail,
        capaId: record.capaId,
        actionPlanDueDate: record.actionPlanDueDate,
        copiedRecipientEmails: record.copiedRecipientEmails,
      },
    });
    return record;
  }

  const db = await getDb();
  db.prepare(
    `UPDATE corrective_action_requests
     SET status = 'submitted',
         unsafeEventType = ?,
         reportDescription = ?,
         immediateActionTaken = ?,
         completedTasks = ?,
         rootCauseAnalysis = ?,
         actionPlanDueDate = ?,
         actionPlanItems = ?,
         submittedAt = ?,
         updatedAt = ?
     WHERE accessToken = ?`,
  ).run([
    input.unsafeEventType,
    input.description,
    input.immediateActionTaken,
    input.completedTasks,
    input.rootCauseAnalysis,
    input.actionPlanDueDate ?? null,
    JSON.stringify(input.actionPlanItems),
    now,
    now,
    input.token,
  ]);
  await saveDb(db);

  const row = allRows(
    db,
    "SELECT * FROM corrective_action_requests WHERE accessToken = ? LIMIT 1",
    [input.token],
  )[0] as Record<string, unknown>;
  const record = mapRecord(row);
  const summary = serializeActionPlan(record.actionPlanItems);
  const notifyRecipients = Array.from(
    new Set(
      [record.assignedByEmail || "", ...record.copiedRecipientEmails].filter((email) =>
        isEmail(email),
      ),
    ),
  );
  for (const email of notifyRecipients) {
    await sendCorrectiveActionSubmissionNotification({
      to: email,
      reportId: record.reportId,
      recipientName: record.recipientName || undefined,
      recipientEmail: record.recipientEmail,
      dueDate: record.dueDate || undefined,
      actionPlanDueDate: record.actionPlanDueDate || undefined,
      actionPlanSummary: summary || "Action plan submitted",
      url: buildCorrectiveActionUrl(record.accessToken),
    });
  }
  return record;
}

export async function sendCorrectiveActionReminders(daysBefore = 3): Promise<{
  sent: number;
}> {
  const now = new Date();
  let records: CorrectiveActionRequestRecord[] = [];

  if (isPgConfigured()) {
    const result = await pgPool.query(
      "SELECT * FROM corrective_action_requests WHERE status IN ('pending', 'submitted')",
    );
    records = result.rows.map(mapRecord);
  } else {
    const db = await getDb();
    records = allRows(
      db,
      "SELECT * FROM corrective_action_requests WHERE status IN ('pending', 'submitted')",
    ).map((row) => mapRecord(row as Record<string, unknown>));
  }

  let sent = 0;

  for (const record of records) {
    const historyRecipients: CorrectiveActionNotificationRecipient[] = [];
    if (record.status === "pending" && record.dueDate && isEmail(record.recipientEmail)) {
      const dueDate = new Date(record.dueDate);
      const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
      if (!Number.isNaN(dueDate.getTime()) && diffDays >= 0 && diffDays <= daysBefore) {
        try {
          const delivery = await sendCorrectiveActionReminderEmail({
            to: record.recipientEmail,
            reportId: record.reportId,
            stage: "request",
            dueDate: record.dueDate,
            title: `Corrective action response for report ${record.reportId}`,
            description: record.reportDescription,
            url: buildCorrectiveActionUrl(record.accessToken),
          });
          historyRecipients.push({
            recipient: delivery.recipient,
            role: "recipient",
            stage: "request-reminder",
            delivered: Boolean(delivery.delivered),
            mode: normalizeNotificationMode(delivery.mode),
            message: delivery.message,
          });
        } catch (error) {
          historyRecipients.push({
            recipient: record.recipientEmail,
            role: "recipient",
            stage: "request-reminder",
            delivered: false,
            mode: "failed",
            error: error instanceof Error ? error.message : String(error),
          });
        }
        sent += 1;
      }
    }

    if (record.status === "submitted") {
      if (record.actionPlanDueDate && isEmail(record.recipientEmail)) {
        const dueDate = new Date(record.actionPlanDueDate);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        if (!Number.isNaN(dueDate.getTime()) && diffDays >= 0 && diffDays <= daysBefore) {
          try {
            const delivery = await sendCorrectiveActionReminderEmail({
              to: record.recipientEmail,
              reportId: record.reportId,
              stage: "plan",
              dueDate: record.actionPlanDueDate,
              title: `Action plan completion for report ${record.reportId}`,
              description: record.reportDescription,
              url: buildCorrectiveActionUrl(record.accessToken),
            });
            historyRecipients.push({
              recipient: delivery.recipient,
              role: "recipient",
              stage: "plan-reminder",
              delivered: Boolean(delivery.delivered),
              mode: normalizeNotificationMode(delivery.mode),
              message: delivery.message,
            });
          } catch (error) {
            historyRecipients.push({
              recipient: record.recipientEmail,
              role: "recipient",
              stage: "plan-reminder",
              delivered: false,
              mode: "failed",
              error: error instanceof Error ? error.message : String(error),
            });
          }
          sent += 1;
        }
      }

      for (const item of record.actionPlanItems) {
        const taskRecipient = item.byWhoEmail || item.byWho;
        if (!isEmail(taskRecipient) || item.status === "Completed") continue;
        const dueDate = new Date(item.byWhen);
        const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        if (!Number.isNaN(dueDate.getTime()) && diffDays >= 0 && diffDays <= daysBefore) {
          try {
            const delivery = await sendCorrectiveActionReminderEmail({
              to: taskRecipient,
              reportId: record.reportId,
              stage: "task",
              dueDate: item.byWhen,
              title: item.action,
              description: `Assigned task owner: ${item.byWho}`,
              url: buildCorrectiveActionUrl(record.accessToken),
            });
            historyRecipients.push({
              recipient: delivery.recipient,
              role: "task-owner",
              stage: "task-reminder",
              delivered: Boolean(delivery.delivered),
              mode: normalizeNotificationMode(delivery.mode),
              message: delivery.message,
            });
          } catch (error) {
            historyRecipients.push({
              recipient: taskRecipient,
              role: "task-owner",
              stage: "task-reminder",
              delivered: false,
              mode: "failed",
              error: error instanceof Error ? error.message : String(error),
            });
          }
          sent += 1;
        }
      }
    }

    await recordCorrectiveActionNotificationHistory({
      reportId: record.reportId,
      requestId: record.id,
      action: "corrective-action.reminder.processed",
      recipients: historyRecipients,
      message: `Corrective action reminders processed for ${record.reportId}.`,
    });
  }

  return { sent };
}

let correctiveActionReminderTimer: NodeJS.Timeout | null = null;

export function startCorrectiveActionReminderScheduler() {
  if (correctiveActionReminderTimer) return correctiveActionReminderTimer;

  const execute = async () => {
    try {
      await sendCorrectiveActionReminders();
    } catch (error) {
      console.error("Failed to process corrective action reminders", error);
    }
  };

  void execute();
  correctiveActionReminderTimer = setInterval(execute, 24 * 60 * 60 * 1000);
  return correctiveActionReminderTimer;
}
