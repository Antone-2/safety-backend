import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { notificationCenterService } from "./notification-center.service.js";
import { getEnv } from "../config/index.js";
const FOLLOWUP_EVENT_KEY = "report.followup";
function buildReportUrl(reportId) {
    const baseUrl = getEnv().FRONTEND_URL;
    if (!baseUrl)
        return `/reports/${reportId}`;
    return `${baseUrl.replace(/\/$/, "")}/reports/${reportId}`;
}
function stageLabel(stage) {
    switch (stage) {
        case "reminder":
            return "Reminder";
        case "urgent":
            return "Urgent reminder";
        case "overdue":
            return "Overdue notice";
        default:
            return "Follow-up";
    }
}
function stageMessage(stage, dueAt) {
    const due = new Date(dueAt).toLocaleString();
    switch (stage) {
        case "reminder":
            return `This report is approaching its due date. Please review and take action before it is due on ${due}.`;
        case "urgent":
            return `This report is due very soon (${due}). Immediate action is required to close it on time.`;
        case "overdue":
            return `This report was due on ${due} and is now overdue. Please close it as soon as possible.`;
        default:
            return `Please review this report.`;
    }
}
function resolveRecipients(report) {
    const recipients = [];
    const primary = report.assignedTo.trim();
    if (primary) {
        recipients.push({ channel: "email", recipient: primary });
    }
    for (const copy of report.assignedToCopy) {
        const email = copy.trim();
        if (email && email !== primary) {
            recipients.push({ channel: "email", recipient: email });
        }
    }
    return recipients;
}
async function alreadyNotifiedRecently(reportId, stage) {
    const result = await pgPool.query(`SELECT created_at FROM notification_jobs
     WHERE resource_type = 'report' AND resource_id = $1 AND event_key = $2
     ORDER BY created_at DESC LIMIT 1`, [reportId, `${FOLLOWUP_EVENT_KEY}:${stage}`]);
    if (!result.rows[0]?.created_at)
        return false;
    const lastSent = new Date(result.rows[0].created_at).getTime();
    const now = Date.now();
    const cooldownMs = 4 * 60 * 60 * 1000;
    return now - lastSent < cooldownMs;
}
export async function findReportsNeedingFollowup(limit = 50) {
    if (!pgPool)
        return [];
    const now = new Date();
    const result = await pgPool.query(`SELECT id, status, severity, sla_hours, due_at, assigned_to, assigned_to_copy,
            location, description
     FROM reports
     WHERE status != 'Closed'
       AND assigned_to IS NOT NULL
       AND assigned_to <> ''
       AND due_at IS NOT NULL
       AND due_at <= $1 + INTERVAL '7 days'
     ORDER BY due_at ASC
     LIMIT $2`, [now.toISOString(), limit]);
    const candidates = [];
    for (const row of result.rows) {
        const status = String(row.status ?? "");
        const assignedTo = String(row.assigned_to ?? "").trim();
        if (status === "Closed" || !assignedTo)
            continue;
        const dueAt = row.due_at instanceof Date ? row.due_at.toISOString() : String(row.due_at);
        const slaHours = Number(row.sla_hours ?? 24);
        const dueTimestamp = new Date(dueAt).getTime();
        const remainingMs = dueTimestamp - now.getTime();
        const elapsedMs = now.getTime() - (dueTimestamp - slaHours * 3600 * 1000);
        const elapsedRatio = elapsedMs / (slaHours * 3600 * 1000);
        let stage;
        if (remainingMs <= 0) {
            stage = "overdue";
        }
        else if (elapsedRatio >= 0.8 || remainingMs <= 24 * 3600 * 1000) {
            stage = "urgent";
        }
        else if (elapsedRatio >= 0.5 || remainingMs <= 72 * 3600 * 1000) {
            stage = "reminder";
        }
        else {
            continue;
        }
        const assignedToCopy = Array.isArray(row.assigned_to_copy)
            ? row.assigned_to_copy.map((v) => String(v))
            : [];
        candidates.push({
            reportId: String(row.id),
            stage,
            dueAt,
            assignedTo,
            assignedToCopy: assignedToCopy,
            location: String(row.location ?? ""),
            description: String(row.description ?? ""),
            severity: String(row.severity ?? ""),
            status,
            slaHours,
        });
    }
    return candidates;
}
export async function enqueueFollowup(report) {
    if (!pgPool)
        return;
    if (await alreadyNotifiedRecently(report.reportId, report.stage))
        return;
    const recipients = resolveRecipients(report);
    if (!recipients.length)
        return;
    const subject = `${stageLabel(report.stage)}: Report ${report.reportId} — ${report.location}`;
    const body = `${stageMessage(report.stage, report.dueAt)}\n\n` +
        `Report: ${report.reportId}\n` +
        `Location: ${report.location}\n` +
        `Severity: ${report.severity}\n` +
        `Status: ${report.status}\n` +
        `Description: ${report.description}\n` +
        `Due: ${new Date(report.dueAt).toLocaleString()}\n\n` +
        `Open report: ${buildReportUrl(report.reportId)}`;
    await notificationCenterService.enqueue({
        eventKey: `${FOLLOWUP_EVENT_KEY}:${report.stage}`,
        workflow: "report-followup",
        resourceType: "report",
        resourceId: report.reportId,
        payload: {
            reportId: report.reportId,
            location: report.location,
            description: report.description,
            severity: report.severity,
            status: report.status,
            dueAt: report.dueAt,
            stage: report.stage,
            subject,
            message: body,
            url: buildReportUrl(report.reportId),
        },
        recipients,
        createdBy: "system-followup",
        maxAttempts: 3,
    });
}
export async function scheduleFollowupsForReport(reportId) {
    if (!pgPool)
        return;
    const result = await pgPool.query(`SELECT id, status, severity, sla_hours, due_at, assigned_to, assigned_to_copy,
            location, description
     FROM reports WHERE id = $1`, [reportId]);
    const row = result.rows[0];
    if (!row || row.status === "Closed" || !row.assigned_to)
        return;
    const dueAt = row.due_at instanceof Date ? row.due_at.toISOString() : String(row.due_at);
    const slaHours = Number(row.sla_hours ?? 24);
    const assignedToCopy = Array.isArray(row.assigned_to_copy)
        ? row.assigned_to_copy.map((v) => String(v))
        : [];
    const report = {
        reportId: String(row.id),
        stage: "reminder",
        dueAt,
        assignedTo: String(row.assigned_to ?? ""),
        assignedToCopy,
        location: String(row.location ?? ""),
        description: String(row.description ?? ""),
        severity: String(row.severity ?? ""),
        status: String(row.status ?? ""),
        slaHours,
    };
    await enqueueFollowup(report);
}
