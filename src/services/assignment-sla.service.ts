import { pgPool } from "../shared/infrastructure/database/postgres.client.js";
import { notificationCenterService, type NotificationChannel } from "./notification-center.service.js";

type Calendar = { workingDays?: number[]; startHour?: number; endHour?: number; holidays?: string[]; timezone?: string };

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",weekday:"short" }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type===type)?.value || "0";
  const weekdays: Record<string,number> = { Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6 };
  return { year:Number(value("year")),month:Number(value("month")),day:Number(value("day")),hour:Number(value("hour")),minute:Number(value("minute")),second:Number(value("second")),weekday:weekdays[value("weekday")] };
}

function localPartsToUtc(parts: { year:number;month:number;day:number;hour:number;minute:number;second:number }, timezone: string) {
  const target = Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);
  let candidate = new Date(target);
  for (let attempt=0;attempt<3;attempt+=1) {
    const actual = zonedParts(candidate,timezone);
    const actualAsUtc = Date.UTC(actual.year,actual.month-1,actual.day,actual.hour,actual.minute,actual.second);
    candidate = new Date(candidate.getTime()+(target-actualAsUtc));
  }
  return candidate;
}

export function addBusinessHours(start: Date, hours: number, calendar: Calendar = {}) {
  const workingDays = calendar.workingDays || [1, 2, 3, 4, 5];
  const startHour = calendar.startHour ?? 8; const endHour = calendar.endHour ?? 17;
  const timezone = calendar.timezone || "UTC"; const initial = zonedParts(start,timezone);
  const holidays = new Set(calendar.holidays || []); const result = new Date(Date.UTC(initial.year,initial.month-1,initial.day,initial.hour,initial.minute,initial.second)); let remaining = hours;
  while (remaining > 0) {
    const dateKey = result.toISOString().slice(0, 10);
    const working = workingDays.includes(result.getUTCDay()) && !holidays.has(dateKey);
    if (!working || result.getUTCHours() >= endHour) { result.setUTCDate(result.getUTCDate() + 1); result.setUTCHours(startHour, 0, 0, 0); continue; }
    if (result.getUTCHours() < startHour) result.setUTCHours(startHour, 0, 0, 0);
    const available = endHour - result.getUTCHours(); const consume = Math.min(remaining, available);
    result.setUTCHours(result.getUTCHours() + consume); remaining -= consume;
  }
  return localPartsToUtc({ year:result.getUTCFullYear(),month:result.getUTCMonth()+1,day:result.getUTCDate(),hour:result.getUTCHours(),minute:result.getUTCMinutes(),second:result.getUTCSeconds() },timezone);
}

function isQuietHour(start: string | null, end: string | null, timezone: string) {
  if (!start || !end) return false;
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: timezone }).format(new Date()));
  const from = Number(start.slice(0, 2)); const to = Number(end.slice(0, 2));
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export class AssignmentSlaService {
  async applyPolicy(assignmentId: string) {
    const assignment = await pgPool.query("SELECT * FROM report_assignments WHERE id=$1", [assignmentId]);
    if (!assignment.rows[0]) throw new Error("Assignment not found");
    const row = assignment.rows[0];
    const policy = await pgPool.query(`SELECT * FROM assignment_escalation_policies WHERE active=TRUE AND (severity IS NULL OR lower(severity)=lower($1)) AND (site IS NULL OR lower($2) LIKE '%'||lower(site)||'%') ORDER BY (severity IS NOT NULL)::int+(site IS NOT NULL)::int DESC LIMIT 1`, [row.priority, row.site || ""]);
    if (!policy.rows[0]) return row;
    const calendar = policy.rows[0].business_calendar || {};
    const responseDue = addBusinessHours(new Date(row.created_at), Number(policy.rows[0].response_sla_hours), calendar);
    const completionDue = addBusinessHours(new Date(row.created_at), Number(policy.rows[0].completion_sla_hours), calendar);
    const levels = Array.isArray(policy.rows[0].levels) ? policy.rows[0].levels : [];
    const firstEscalationHours = Number(levels[0]?.afterHours || policy.rows[0].response_sla_hours);
    const nextEscalation = addBusinessHours(new Date(row.created_at), firstEscalationHours, calendar);
    const result = await pgPool.query(`UPDATE report_assignments SET sla_policy_id=$2,response_due_at=COALESCE(response_due_at,$3),due_at=COALESCE(due_at,$4),next_escalation_at=$5,updated_at=NOW() WHERE id=$1 RETURNING *`, [assignmentId, policy.rows[0].id, responseDue, completionDue, nextEscalation]);
    return result.rows[0];
  }

  async processDue(limit = 100) {
    const claimed = await pgPool.query(`WITH due AS (SELECT a.id FROM report_assignments a WHERE a.status NOT IN ('Paused','Closed','Cancelled','Rejected','Verified') AND (a.escalation_claimed_until IS NULL OR a.escalation_claimed_until<NOW()) AND (a.next_escalation_at<=NOW() OR (a.due_at<=NOW() AND a.escalation_level=0)) ORDER BY COALESCE(a.next_escalation_at,a.due_at) FOR UPDATE SKIP LOCKED LIMIT $1)
      UPDATE report_assignments a SET escalation_claimed_until=NOW()+INTERVAL '10 minutes' FROM due WHERE a.id=due.id RETURNING a.*`,[Math.min(Math.max(limit,1),500)]);
    const due = claimed.rowCount ? await pgPool.query(`SELECT a.*,p.levels,p.business_calendar FROM report_assignments a LEFT JOIN assignment_escalation_policies p ON p.id=a.sla_policy_id WHERE a.id=ANY($1::text[])`,[claimed.rows.map((row)=>row.id)]) : { rows: [] };
    const results = [];
    for (const assignment of due.rows) results.push(await this.escalate(assignment));
    return results;
  }

  private async escalate(assignment: Record<string, any>) {
    const levels = Array.isArray(assignment.levels) ? assignment.levels : [];
    const levelIndex = Math.min(Number(assignment.escalation_level || 0), Math.max(levels.length - 1, 0));
    const level = levels[levelIndex] || { recipients: ["assignee", "assigner"], channels: ["email", "in-app"] };
    const participantResult = await pgPool.query("SELECT email,name,role FROM assignment_participants WHERE assignment_id=$1 AND active=TRUE", [assignment.id]);
    const available = [
      { email: assignment.assignee_email, name: assignment.assignee_name, role: "assignee" },
      { email: assignment.assigned_by_email, name: assignment.assigned_by_name, role: "assigner" },
      ...participantResult.rows,
    ];
    const wantedRoles = new Set(Array.isArray(level.recipients) ? level.recipients : ["assignee", "assigner"]);
    const unique = new Map(available.filter((item) => wantedRoles.has(item.role)).map((item) => [String(item.email).toLowerCase(), item]));
    for (const recipient of unique.values()) await this.notify(assignment, recipient, level.channels);
    const nextLevel = Number(assignment.escalation_level || 0) + 1;
    const nextConfig = levels[nextLevel];
    const nextAt = nextConfig ? addBusinessHours(new Date(), Number(nextConfig.afterHours || 24), assignment.business_calendar || {}) : null;
    await pgPool.query("UPDATE report_assignments SET escalation_level=$2,last_escalated_at=NOW(),next_escalation_at=$3,escalation_claimed_until=NULL,updated_at=NOW() WHERE id=$1", [assignment.id, nextLevel, nextAt]);
    return { assignmentId: assignment.id, level: nextLevel, recipients: unique.size };
  }

  private async notify(assignment: Record<string, any>, recipient: { email: string; name?: string }, requestedChannels?: string[]) {
    const pref = await pgPool.query(`SELECT p.*,u.phone AS user_phone FROM assignment_notification_preferences p FULL JOIN users u ON u.id::text=p.user_id WHERE lower(COALESCE(p.email,u.email))=lower($1) LIMIT 1`, [recipient.email]);
    const settings = pref.rows[0] || {};
    const subscribedEvents = Array.isArray(settings.assignment_events) ? settings.assignment_events : ["assigned", "due-soon", "overdue", "review", "rework", "escalated"];
    if (!subscribedEvents.includes("escalated")) return;
    const quiet = isQuietHour(settings.quiet_hours_start, settings.quiet_hours_end, settings.timezone || "Africa/Nairobi");
    const critical = assignment.priority === "Critical";
    const configured = Array.isArray(settings.channels) ? settings.channels : ["email", "in-app"];
    const allowed = new Set(requestedChannels?.length ? requestedChannels : configured);
    let channels = configured.filter((channel: string) => allowed.has(channel));
    if (quiet && !(critical && settings.critical_bypass_quiet_hours !== false)) channels = channels.filter((channel: string) => channel === "in-app");
    if (settings.digest_cadence && settings.digest_cadence !== "immediate" && !critical) {
      const existing = await notificationCenterService.listDigests({ userId: settings.user_id, recipient: recipient.email });
      let subscription = existing.find((item) => item.active && item.cadence === settings.digest_cadence);
      if (!subscription) subscription = await notificationCenterService.createDigest({ userId: settings.user_id, recipient: recipient.email, cadence: settings.digest_cadence, channels: channels.filter((channel: string) => channel !== "in-app") as NotificationChannel[] });
      await notificationCenterService.queueDigestItem(subscription.id, { eventKey: "assignment.escalated", resourceType: "assignment", resourceId: assignment.id, payload: { message: `Assignment ${assignment.report_id} is overdue or requires escalation.`, priority: assignment.priority, dueAt: assignment.due_at } });
      channels = channels.filter((channel: string) => channel === "in-app");
    }
    const channelRecipients = channels.flatMap((channel: string) => {
      if (channel === "sms" || channel === "whatsapp") return settings.phone || settings.user_phone ? [{ channel: channel as NotificationChannel, recipient: settings.phone || settings.user_phone, name: recipient.name }] : [];
      if (channel === "teams") return settings.teams_recipient ? [{ channel: channel as NotificationChannel, recipient: settings.teams_recipient, name: recipient.name }] : [];
      return [{ channel: channel as NotificationChannel, recipient: recipient.email, name: recipient.name }];
    });
    if (!channelRecipients.length) return;
    await notificationCenterService.enqueue({ eventKey: "assignment.escalated", workflow: "assignment", resourceType: "assignment", resourceId: assignment.id, payload: { message: `Assignment ${assignment.report_id} is overdue or requires escalation.`, reportId: assignment.report_id, assignmentId: assignment.id, priority: assignment.priority, dueAt: assignment.due_at }, recipients: channelRecipients, createdBy: "Assignment SLA scheduler", maxAttempts: 5 });
  }
}

export const assignmentSlaService = new AssignmentSlaService();
export function startAssignmentSlaScheduler() {
  const run = async () => {
    try {
      await assignmentSlaService.processDue();
      await notificationCenterService.processDigests();
      await notificationCenterService.processDue(100);
    } catch (error) { console.error("Assignment SLA or notification processing failed", error); }
  };
  const initial = setTimeout(() => void run(), 10_000);
  initial.unref();
  const timer = setInterval(() => void run(), 5 * 60_000);
  timer.unref();
  return timer;
}
