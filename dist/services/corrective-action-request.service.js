import { randomBytes } from "crypto";
import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { allRows, getDb, saveDb } from "../lib/database.js";
import { writeAuditLog } from "../shared/audit/audit.service.js";
import { getEnv } from "../config/index.js";
import { sendCorrectiveActionAcknowledgementEmail, sendCorrectiveActionAcknowledgementReminderEmail, sendCorrectiveActionReminderEmail, sendCorrectiveActionRequestEmail, sendCorrectiveActionSubmissionNotification, sendCorrectiveActionSupervisorUpdateEmail, } from "../lib/email.js";
export const CORRECTIVE_ACTION_EVENT_TYPES = [
    "Unsafe Act",
    "Unsafe Condition",
    "Incident",
    "Accident",
];
export const CORRECTIVE_ACTION_ITEM_STATUSES = [
    "Planned",
    "In Progress",
    "Completed",
    "Blocked",
];
function normalizeNotificationMode(value) {
    return value === "brevo" ||
        value === "smtp" ||
        value === "failed" ||
        value === "internal"
        ? value
        : "internal";
}
function isEmail(value) {
    return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
function isPgConfigured() {
    return Boolean(process.env.DATABASE_URL);
}
function buildCorrectiveActionUrl(token) {
    const baseUrl = getEnv().FRONTEND_URL || "http://localhost:5173";
    return `${baseUrl.replace(/\/$/, "")}/corrective-action/${encodeURIComponent(token)}`;
}
function makeId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function makeAccessToken() {
    return randomBytes(24).toString("hex");
}
function normalizeActionPlanItems(value) {
    const list = Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim()
            ? safeParseJsonArray(value)
            : [];
    return list
        .map((entry) => {
        const record = entry;
        const status = String(record.status || "Planned");
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
function safeParseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch {
        return [];
    }
}
function normalizeSupervisorComments(value) {
    const list = Array.isArray(value)
        ? value
        : typeof value === "string" && value.trim()
            ? safeParseJsonArray(value)
            : [];
    return list
        .map((entry) => {
        const record = entry;
        const text = String(record.text || "").trim();
        if (!text)
            return null;
        const comment = {
            id: String(record.id || makeId("CAR-COMMENT")),
            authorName: String(record.authorName || record.author_name || "").trim() || undefined,
            authorEmail: String(record.authorEmail || record.author_email || "").trim() || undefined,
            text,
            createdAt: String(record.createdAt || record.created_at || "").trim() ||
                new Date().toISOString(),
        };
        return comment;
    })
        .filter((entry) => entry !== null);
}
function mapRecord(row) {
    return {
        id: String(row.id),
        reportId: String(row.report_id ?? row.reportId),
        accessToken: String(row.access_token ?? row.accessToken),
        recipientEmail: String(row.recipient_email ?? row.recipientEmail),
        recipientName: (row.recipient_name ?? row.recipientName ?? null),
        assignedByEmail: (row.assigned_by_email ?? row.assignedByEmail ?? null),
        assignedByName: (row.assigned_by_name ?? row.assignedByName ?? null),
        reportType: String(row.report_type ?? row.reportType),
        reportCategory: (row.report_category ?? row.reportCategory ?? null),
        reportDescription: String(row.report_description ?? row.reportDescription),
        reportLocation: (row.report_location ?? row.reportLocation ?? null),
        reportDepartment: (row.report_department ?? row.reportDepartment ?? null),
        assigneeNote: (row.assignee_note ?? row.assigneeNote ?? null),
        copiedRecipientEmails: Array.isArray(row.copied_recipient_emails)
            ? row.copied_recipient_emails.map(String)
            : Array.isArray(row.copiedRecipientEmails)
                ? row.copiedRecipientEmails.map(String)
                : typeof row.copied_recipient_emails === "string"
                    ? safeParseJsonArray(String(row.copied_recipient_emails)).map(String)
                    : typeof row.copiedRecipientEmails === "string"
                        ? safeParseJsonArray(String(row.copiedRecipientEmails)).map(String)
                        : [],
        priority: String(row.priority || "Medium"),
        dueDate: (row.due_date ??
            row.dueDate ??
            null),
        actionPlanDueDate: (row.action_plan_due_date ??
            row.actionPlanDueDate ??
            null),
        status: String(row.status || "pending"),
        unsafeEventType: (row.unsafe_event_type ??
            row.unsafeEventType ??
            null),
        immediateActionTaken: (row.immediate_action_taken ??
            row.immediateActionTaken ??
            null),
        completedTasks: (row.completed_tasks ??
            row.completedTasks ??
            null),
        rootCauseAnalysis: (row.root_cause_analysis ??
            row.rootCauseAnalysis ??
            null),
        actionPlanItems: normalizeActionPlanItems(row.action_plan_items ?? row.actionPlanItems ?? []),
        supervisorComments: normalizeSupervisorComments(row.supervisor_comments ?? row.supervisorComments ?? []),
        supervisorAcknowledgedAt: (row.supervisor_acknowledged_at ??
            row.supervisorAcknowledgedAt ??
            null),
        supervisorAcknowledgedBy: (row.supervisor_acknowledged_by ??
            row.supervisorAcknowledgedBy ??
            null),
        supervisorAcknowledgementNote: (row.supervisor_acknowledgement_note ??
            row.supervisorAcknowledgementNote ??
            null),
        capaId: (row.capa_id ?? row.capaId ?? null),
        submittedAt: (row.submitted_at ?? row.submittedAt ?? null),
        expiresAt: (row.expires_at ?? row.expiresAt ?? null),
        createdAt: String(row.created_at ?? row.createdAt),
        updatedAt: String(row.updated_at ?? row.updatedAt),
    };
}
function serializeActionPlan(items) {
    return items
        .map((item, index) => `${index + 1}. ${item.action} | By who: ${item.byWho} | By when: ${item.byWhen} | Status: ${item.status}`)
        .join("\n");
}
function summarizeNotificationResults(recipients, defaultMessage) {
    const delivered = recipients.filter((item) => item.delivered).length;
    const queued = recipients.filter((item) => item.mode === "internal").length;
    const failed = recipients.filter((item) => item.mode === "failed").length;
    return {
        delivered,
        queued,
        failed,
        message: recipients.find((item) => item.message)?.message ||
            (recipients.length > 0 ? defaultMessage : "No notification recipients were processed."),
    };
}
async function recordCorrectiveActionNotificationHistory(input) {
    if (!isPgConfigured() || input.recipients.length === 0)
        return;
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
async function notifyCorrectiveActionSupervisorFollowUp(input) {
    const recipients = [];
    const notifyRecipients = new Map();
    if (isEmail(input.record.recipientEmail)) {
        notifyRecipients.set(input.record.recipientEmail, {
            role: "recipient",
            recipientName: input.record.recipientName || undefined,
        });
    }
    if (isEmail(input.record.assignedByEmail)) {
        notifyRecipients.set(input.record.assignedByEmail, {
            role: "sender",
        });
    }
    for (const email of input.record.copiedRecipientEmails) {
        if (!isEmail(email))
            continue;
        notifyRecipients.set(email, { role: "copied" });
    }
    for (const [email, recipientMeta] of notifyRecipients.entries()) {
        try {
            const delivery = await sendCorrectiveActionSupervisorUpdateEmail({
                to: email,
                recipientName: recipientMeta.recipientName,
                supervisorName: input.actor?.name || input.actor?.email || "Supervisor",
                reportId: input.record.reportId,
                updateType: input.updateType,
                summary: input.summary,
                url: buildCorrectiveActionUrl(input.record.accessToken),
            });
            recipients.push({
                recipient: delivery.recipient,
                role: recipientMeta.role,
                stage: input.updateType,
                delivered: Boolean(delivery.delivered),
                mode: normalizeNotificationMode(delivery.mode),
                message: delivery.message,
            });
        }
        catch (error) {
            recipients.push({
                recipient: email,
                role: recipientMeta.role,
                stage: input.updateType,
                delivered: false,
                mode: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    if (isPgConfigured() && recipients.length > 0) {
        await recordCorrectiveActionNotificationHistory({
            reportId: input.record.reportId,
            requestId: input.record.id,
            action: input.action,
            actor: input.actor,
            recipients,
            message: input.updateType === "comment"
                ? `Corrective action supervisor comment processed for ${input.record.reportId}.`
                : `Corrective action review update processed for ${input.record.reportId}.`,
        });
    }
    return recipients;
}
async function getCorrectiveActionNotificationHistory(reportId) {
    if (!isPgConfigured())
        return new Map();
    const result = await pgPool.query(`SELECT id, action, actor_email, actor_role, created_at, context
     FROM audit_logs
     WHERE resource_type = 'report'
       AND resource_id = $1
       AND context ? 'correctiveActionRequestId'
       AND context ? 'notifications'
     ORDER BY created_at DESC`, [reportId]);
    const history = new Map();
    for (const row of result.rows) {
        const requestId = String(row.context?.correctiveActionRequestId || "");
        if (!requestId)
            continue;
        const entry = {
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
                ? row.context.notifications.recipients.map((item) => ({
                    recipient: String(item.recipient || ""),
                    role: item.role === "sender" ||
                        item.role === "copied" ||
                        item.role === "task-owner"
                        ? item.role
                        : "recipient",
                    stage: item.stage === "submission" ||
                        item.stage === "request-reminder" ||
                        item.stage === "plan-reminder" ||
                        item.stage === "task-reminder" ||
                        item.stage === "review-update" ||
                        item.stage === "comment" ||
                        item.stage === "acknowledgement" ||
                        item.stage === "acknowledgement-reminder"
                        ? item.stage
                        : "request",
                    delivered: Boolean(item.delivered),
                    mode: item.mode === "brevo" ||
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
async function createLinkedCapa(request, client) {
    if (!isPgConfigured())
        return null;
    const dueDate = request.actionPlanDueDate ||
        request.dueDate ||
        request.actionPlanItems
            .map((item) => item.byWhen)
            .find(Boolean) ||
        new Date().toISOString();
    const result = await (client ?? pgPool).query(`INSERT INTO capa (
      capa_no, type, status, priority, title, description, source, source_ref,
      linked_incident_id, root_cause, action_plan, owner, department, site, due_date,
      attachments, created_by
    ) VALUES (
      $1, 'Corrective', 'Open', $2, $3, $4, 'Report', $5,
      $6, $7, $8, $9, $10, $11, $12, '[]'::jsonb, $13
    ) RETURNING id`, [
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
    ]);
    return result.rows[0]?.id ? String(result.rows[0].id) : null;
}
export async function createCorrectiveActionRequest(input) {
    const id = makeId("CAR");
    const accessToken = makeAccessToken();
    const now = new Date().toISOString();
    const expiresAt = input.dueDate || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    if (isPgConfigured()) {
        const result = await pgPool.query(`INSERT INTO corrective_action_requests (
        id, report_id, access_token, recipient_email, recipient_name,
        assigned_by_email, assigned_by_name, copied_recipient_emails, report_type, report_category,
        report_description, report_location, report_department, assignee_note, priority, due_date,
        status, supervisor_comments, supervisor_acknowledged_at, supervisor_acknowledged_by,
        supervisor_acknowledgement_note, expires_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8::jsonb, $9, $10,
        $11, $12, $13, $14, $15, $16,
        'pending', '[]'::jsonb, NULL, NULL, NULL, $17, $18, $19
      ) RETURNING *`, [
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
    db.prepare(`INSERT INTO corrective_action_requests (
      id, reportId, accessToken, recipientEmail, recipientName,
      assignedByEmail, assignedByName, copiedRecipientEmails, reportType, reportCategory,
      reportDescription, reportLocation, reportDepartment, assigneeNote, priority, dueDate,
      status, supervisorComments, supervisorAcknowledgedAt, supervisorAcknowledgedBy,
      supervisorAcknowledgementNote, expiresAt, createdAt, updatedAt, actionPlanItems
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', '[]', NULL, NULL, NULL, ?, ?, ?, '[]')`).run([
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
    const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [id])[0];
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
export async function listCorrectiveActionRequestsByReport(reportId) {
    let records = [];
    if (isPgConfigured()) {
        const result = await pgPool.query("SELECT * FROM corrective_action_requests WHERE report_id = $1 ORDER BY created_at DESC", [reportId]);
        records = result.rows.map(mapRecord);
    }
    else {
        const db = await getDb();
        records = allRows(db, "SELECT * FROM corrective_action_requests WHERE reportId = ? ORDER BY createdAt DESC", [reportId]).map((row) => mapRecord(row));
    }
    const historyByRequest = await getCorrectiveActionNotificationHistory(reportId);
    return records.map((record) => ({
        ...record,
        notificationHistory: historyByRequest.get(record.id) || [],
    }));
}
export async function resendCorrectiveActionNotifications(input) {
    let record = null;
    if (isPgConfigured()) {
        const result = await pgPool.query("SELECT * FROM corrective_action_requests WHERE id = $1 LIMIT 1", [input.requestId]);
        record = result.rows[0] ? mapRecord(result.rows[0]) : null;
    }
    else {
        const db = await getDb();
        const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
        record = row ? mapRecord(row) : null;
    }
    if (!record) {
        throw new Error("Corrective action request not found");
    }
    const recipients = [];
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
        const notifyRecipients = Array.from(new Set([record.assignedByEmail || "", ...record.copiedRecipientEmails].filter((email) => isEmail(email))));
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
            }
            catch (error) {
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
        ...summarizeNotificationResults(recipients, `Corrective action notifications resent for report ${record.reportId}.`),
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
export async function updateCorrectiveActionRequestReview(input) {
    const now = new Date().toISOString();
    let previousRecord = null;
    if (isPgConfigured()) {
        const before = await pgPool.query("SELECT * FROM corrective_action_requests WHERE id = $1 LIMIT 1", [input.requestId]);
        previousRecord = before.rows[0] ? mapRecord(before.rows[0]) : null;
    }
    else {
        const db = await getDb();
        const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
        previousRecord = row ? mapRecord(row) : null;
    }
    if (!previousRecord)
        throw new Error("Corrective action request not found");
    if (isPgConfigured()) {
        const result = await pgPool.query(`UPDATE corrective_action_requests
       SET action_plan_due_date = $1,
           action_plan_items = $2::jsonb,
           updated_at = $3
       WHERE id = $4
       RETURNING *`, [
            input.actionPlanDueDate ?? null,
            JSON.stringify(input.actionPlanItems),
            now,
            input.requestId,
        ]);
        const record = mapRecord(result.rows[0]);
        const changedTasks = record.actionPlanItems.filter((item, index) => {
            const previous = previousRecord?.actionPlanItems[index];
            return !previous || previous.status !== item.status || previous.byWhen !== item.byWhen;
        });
        const summary = changedTasks.length > 0
            ? changedTasks
                .map((item) => `${item.action}: ${item.status} (due ${item.byWhen})`)
                .join("; ")
            : "The overall action-plan review was updated.";
        await notifyCorrectiveActionSupervisorFollowUp({
            record,
            actor: input.actor,
            updateType: "review-update",
            summary,
            action: "corrective-action.review.notified",
        });
        await writeAuditLog({
            action: "corrective-action.review.updated",
            resourceType: "report",
            resourceId: record.reportId,
            actor: input.actor
                ? {
                    id: input.actor.id || "",
                    email: input.actor.email || "",
                    role: input.actor.role || "",
                    name: "",
                }
                : undefined,
            context: {
                correctiveActionRequestId: record.id,
                actionPlanDueDate: record.actionPlanDueDate,
                actionPlanItems: record.actionPlanItems,
            },
        });
        return record;
    }
    const db = await getDb();
    db.prepare(`UPDATE corrective_action_requests
     SET actionPlanDueDate = ?,
         actionPlanItems = ?,
         updatedAt = ?
     WHERE id = ?`).run([
        input.actionPlanDueDate ?? null,
        JSON.stringify(input.actionPlanItems),
        now,
        input.requestId,
    ]);
    await saveDb(db);
    const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
    if (!row)
        throw new Error("Corrective action request not found");
    const record = mapRecord(row);
    const changedTasks = record.actionPlanItems.filter((item, index) => {
        const previous = previousRecord?.actionPlanItems[index];
        return !previous || previous.status !== item.status || previous.byWhen !== item.byWhen;
    });
    try {
        await notifyCorrectiveActionSupervisorFollowUp({
            record,
            actor: input.actor,
            updateType: "review-update",
            summary: changedTasks.length > 0
                ? changedTasks.map((item) => `${item.action}: ${item.status}`).join("; ")
                : "The overall action-plan review was updated.",
            action: "corrective-action.review.notified",
        });
    }
    catch {
        // Mock/sqlite path should not block the review save if notifications fail.
    }
    return record;
}
export async function addCorrectiveActionSupervisorComment(input) {
    const text = input.text.trim();
    if (!text)
        throw new Error("Comment text is required");
    let record = null;
    if (isPgConfigured()) {
        const existing = await pgPool.query("SELECT * FROM corrective_action_requests WHERE id = $1 LIMIT 1", [input.requestId]);
        record = existing.rows[0] ? mapRecord(existing.rows[0]) : null;
        if (!record)
            throw new Error("Corrective action request not found");
        const nextComments = [
            {
                id: makeId("CAR-COMMENT"),
                authorName: input.actor?.name || input.actor?.email || "Supervisor",
                authorEmail: input.actor?.email,
                text,
                createdAt: new Date().toISOString(),
            },
            ...record.supervisorComments,
        ];
        const result = await pgPool.query(`UPDATE corrective_action_requests
       SET supervisor_comments = $1::jsonb,
           updated_at = $2
       WHERE id = $3
       RETURNING *`, [JSON.stringify(nextComments), new Date().toISOString(), input.requestId]);
        const updated = mapRecord(result.rows[0]);
        await notifyCorrectiveActionSupervisorFollowUp({
            record: updated,
            actor: input.actor,
            updateType: "comment",
            summary: text,
            action: "corrective-action.comment.notified",
        });
        await writeAuditLog({
            action: "corrective-action.comment.added",
            resourceType: "report",
            resourceId: updated.reportId,
            actor: input.actor
                ? {
                    id: input.actor.id || "",
                    email: input.actor.email || "",
                    role: input.actor.role || "",
                    name: input.actor.name || "",
                }
                : undefined,
            context: {
                correctiveActionRequestId: updated.id,
                comment: text,
            },
        });
        return updated;
    }
    const db = await getDb();
    const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
    record = row ? mapRecord(row) : null;
    if (!record)
        throw new Error("Corrective action request not found");
    const nextComments = [
        {
            id: makeId("CAR-COMMENT"),
            authorName: input.actor?.name || input.actor?.email || "Supervisor",
            authorEmail: input.actor?.email,
            text,
            createdAt: new Date().toISOString(),
        },
        ...record.supervisorComments,
    ];
    db.prepare(`UPDATE corrective_action_requests
     SET supervisorComments = ?,
         updatedAt = ?
     WHERE id = ?`).run([JSON.stringify(nextComments), new Date().toISOString(), input.requestId]);
    await saveDb(db);
    const updatedRow = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
    const updated = mapRecord(updatedRow);
    try {
        await notifyCorrectiveActionSupervisorFollowUp({
            record: updated,
            actor: input.actor,
            updateType: "comment",
            summary: text,
            action: "corrective-action.comment.notified",
        });
    }
    catch {
        // Mock/sqlite path should not block comment capture if notifications fail.
    }
    return updated;
}
export async function acknowledgeCorrectiveActionSupervisorFollowUp(input) {
    const existing = await getCorrectiveActionRequestByToken(input.token);
    if (!existing) {
        throw new Error("Corrective action request not found");
    }
    const acknowledgedAt = new Date().toISOString();
    const acknowledgedBy = existing.recipientName || existing.recipientEmail;
    const note = input.note?.trim() || null;
    let record;
    if (isPgConfigured()) {
        const result = await pgPool.query(`UPDATE corrective_action_requests
       SET supervisor_acknowledged_at = $1,
           supervisor_acknowledged_by = $2,
           supervisor_acknowledgement_note = $3,
           updated_at = $1
       WHERE access_token = $4
       RETURNING *`, [acknowledgedAt, acknowledgedBy, note, input.token]);
        if (!result.rows[0])
            throw new Error("Corrective action request not found");
        record = mapRecord(result.rows[0]);
    }
    else {
        const db = await getDb();
        db.prepare(`UPDATE corrective_action_requests
       SET supervisorAcknowledgedAt = ?,
           supervisorAcknowledgedBy = ?,
           supervisorAcknowledgementNote = ?,
           updatedAt = ?
       WHERE accessToken = ?`).run([acknowledgedAt, acknowledgedBy, note, acknowledgedAt, input.token]);
        await saveDb(db);
        const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE accessToken = ? LIMIT 1", [input.token])[0];
        if (!row)
            throw new Error("Corrective action request not found");
        record = mapRecord(row);
    }
    const recipients = [];
    const notifyRecipients = Array.from(new Set([record.assignedByEmail || "", ...record.copiedRecipientEmails].filter((email) => isEmail(email))));
    for (const email of notifyRecipients) {
        try {
            const delivery = await sendCorrectiveActionAcknowledgementEmail({
                to: email,
                reportId: record.reportId,
                recipientName: record.recipientName || undefined,
                acknowledgedBy,
                note: note || undefined,
                url: buildCorrectiveActionUrl(record.accessToken),
            });
            recipients.push({
                recipient: delivery.recipient,
                role: email === record.assignedByEmail ? "sender" : "copied",
                stage: "acknowledgement",
                delivered: Boolean(delivery.delivered),
                mode: normalizeNotificationMode(delivery.mode),
                message: delivery.message,
            });
        }
        catch (error) {
            recipients.push({
                recipient: email,
                role: email === record.assignedByEmail ? "sender" : "copied",
                stage: "acknowledgement",
                delivered: false,
                mode: "failed",
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    if (isPgConfigured() && recipients.length > 0) {
        await recordCorrectiveActionNotificationHistory({
            reportId: record.reportId,
            requestId: record.id,
            action: "corrective-action.acknowledgement.notified",
            recipients,
            message: `Corrective action acknowledgement processed for ${record.reportId}.`,
        });
        await writeAuditLog({
            action: "corrective-action.acknowledged",
            resourceType: "report",
            resourceId: record.reportId,
            context: {
                correctiveActionRequestId: record.id,
                acknowledgedAt,
                acknowledgedBy,
                note,
            },
        });
    }
    return record;
}
export async function sendCorrectiveActionAcknowledgementReminder(input) {
    let record = null;
    if (isPgConfigured()) {
        const result = await pgPool.query("SELECT * FROM corrective_action_requests WHERE id = $1 LIMIT 1", [input.requestId]);
        record = result.rows[0] ? mapRecord(result.rows[0]) : null;
    }
    else {
        const db = await getDb();
        const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE id = ? LIMIT 1", [input.requestId])[0];
        record = row ? mapRecord(row) : null;
    }
    if (!record)
        throw new Error("Corrective action request not found");
    if (!record.supervisorComments.length) {
        throw new Error("No supervisor follow-up comment is available for acknowledgement reminder");
    }
    if (record.supervisorAcknowledgedAt) {
        throw new Error("Supervisor follow-up has already been acknowledged");
    }
    if (!isEmail(record.recipientEmail)) {
        throw new Error("Corrective action assignee email is invalid");
    }
    const latestComment = record.supervisorComments[0];
    const recipients = [];
    try {
        const delivery = await sendCorrectiveActionAcknowledgementReminderEmail({
            to: record.recipientEmail,
            recipientName: record.recipientName || undefined,
            supervisorName: input.actor?.name || input.actor?.email || "Supervisor",
            reportId: record.reportId,
            reminderSummary: latestComment.text,
            url: buildCorrectiveActionUrl(record.accessToken),
        });
        recipients.push({
            recipient: delivery.recipient,
            role: "recipient",
            stage: "acknowledgement-reminder",
            delivered: Boolean(delivery.delivered),
            mode: normalizeNotificationMode(delivery.mode),
            message: delivery.message,
        });
    }
    catch (error) {
        recipients.push({
            recipient: record.recipientEmail,
            role: "recipient",
            stage: "acknowledgement-reminder",
            delivered: false,
            mode: "failed",
            error: error instanceof Error ? error.message : String(error),
        });
    }
    const summary = {
        ...summarizeNotificationResults(recipients, `Corrective action acknowledgement reminder processed for ${record.reportId}.`),
        recipients,
    };
    if (isPgConfigured()) {
        await recordCorrectiveActionNotificationHistory({
            reportId: record.reportId,
            requestId: record.id,
            action: "corrective-action.acknowledgement-reminder.notified",
            actor: input.actor,
            recipients,
            message: summary.message,
        });
    }
    return summary;
}
export async function getCorrectiveActionRequestByToken(token) {
    if (isPgConfigured()) {
        const result = await pgPool.query("SELECT * FROM corrective_action_requests WHERE access_token = $1 LIMIT 1", [token]);
        const record = result.rows[0] ? mapRecord(result.rows[0]) : null;
        if (record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
            throw new Error("This corrective action link has expired");
        }
        return record;
    }
    const db = await getDb();
    const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE accessToken = ? LIMIT 1", [token])[0];
    const record = row ? mapRecord(row) : null;
    if (record?.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
        throw new Error("This corrective action link has expired");
    }
    return record;
}
export async function submitCorrectiveActionRequest(input) {
    const existing = await getCorrectiveActionRequestByToken(input.token);
    if (!existing) {
        throw new Error("Corrective action request not found");
    }
    if (existing.status === "submitted") {
        return existing;
    }
    const now = new Date().toISOString();
    let capaId = null;
    if (isPgConfigured()) {
        const client = await pgPool.connect();
        let record;
        try {
            await client.query("BEGIN");
            const lockedResult = await client.query("SELECT * FROM corrective_action_requests WHERE access_token = $1 FOR UPDATE", [input.token]);
            if (!lockedResult.rows[0])
                throw new Error("Corrective action request not found");
            const locked = mapRecord(lockedResult.rows[0]);
            if (locked.status === "submitted") {
                await client.query("COMMIT");
                return locked;
            }
            capaId = await createLinkedCapa({
                ...locked,
                unsafeEventType: input.unsafeEventType,
                immediateActionTaken: input.immediateActionTaken,
                completedTasks: input.completedTasks,
                rootCauseAnalysis: input.rootCauseAnalysis,
                actionPlanDueDate: input.actionPlanDueDate ?? null,
                actionPlanItems: input.actionPlanItems,
                submittedAt: now,
                updatedAt: now,
                status: "submitted",
            }, client);
            const result = await client.query(`UPDATE corrective_action_requests
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
       RETURNING *`, [
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
            ]);
            record = mapRecord(result.rows[0]);
            await client.query("COMMIT");
        }
        catch (error) {
            await client.query("ROLLBACK");
            throw error;
        }
        finally {
            client.release();
        }
        const summary = serializeActionPlan(record.actionPlanItems);
        const notifyRecipients = Array.from(new Set([
            record.assignedByEmail || "",
            ...record.copiedRecipientEmails,
        ].filter((email) => isEmail(email))));
        const notificationRecipients = [];
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
            }
            catch (error) {
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
    db.prepare(`UPDATE corrective_action_requests
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
     WHERE accessToken = ?`).run([
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
    const row = allRows(db, "SELECT * FROM corrective_action_requests WHERE accessToken = ? LIMIT 1", [input.token])[0];
    const record = mapRecord(row);
    const summary = serializeActionPlan(record.actionPlanItems);
    const notifyRecipients = Array.from(new Set([record.assignedByEmail || "", ...record.copiedRecipientEmails].filter((email) => isEmail(email))));
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
export async function sendCorrectiveActionReminders(daysBefore = 3) {
    const now = new Date();
    let records = [];
    if (isPgConfigured()) {
        const result = await pgPool.query("SELECT * FROM corrective_action_requests WHERE status IN ('pending', 'submitted')");
        records = result.rows.map(mapRecord);
    }
    else {
        const db = await getDb();
        records = allRows(db, "SELECT * FROM corrective_action_requests WHERE status IN ('pending', 'submitted')").map((row) => mapRecord(row));
    }
    let sent = 0;
    for (const record of records) {
        const historyRecipients = [];
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
                }
                catch (error) {
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
                    }
                    catch (error) {
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
                if (!isEmail(taskRecipient) || item.status === "Completed")
                    continue;
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
                    }
                    catch (error) {
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
let correctiveActionReminderTimer = null;
export function startCorrectiveActionReminderScheduler() {
    if (correctiveActionReminderTimer)
        return correctiveActionReminderTimer;
    const execute = async () => {
        try {
            await sendCorrectiveActionReminders();
        }
        catch (error) {
            console.error("Failed to process corrective action reminders", error);
        }
    };
    void execute();
    correctiveActionReminderTimer = setInterval(execute, 24 * 60 * 60 * 1000);
    return correctiveActionReminderTimer;
}
