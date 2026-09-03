import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { findUserByIdentifier, listUsers, SUPERVISOR_ROLES } from "../../lib/users.js";
import { hasPermission } from "../../shared/middleware/rbac.middleware.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { assignmentSlaService } from "../../services/assignment-sla.service.js";
import { notificationCenterService } from "../../services/notification-center.service.js";
import { assignmentsRepository, mapAssignment } from "./assignments.repository.js";
import { ASSIGNMENT_TRANSITIONS, } from "./assignments.types.js";
function actor(req) {
    if (!req.user?.email)
        throw new Error("Authenticated actor is required");
    return { id: req.user.id, email: req.user.email.toLowerCase(), name: req.user.name };
}
function requiresReason(event) {
    return ["reject", "pause", "request-rework", "reopen", "cancel"].includes(event);
}
export class AssignmentsService {
    async idempotent(operation, key, payload, req, work) {
        if (!key)
            return work();
        const acting = actor(req);
        const requestHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
        return assignmentsRepository.transaction(async (client) => {
            await client.query("SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))", [acting.email, `${operation}:${key}`]);
            const existing = await client.query("SELECT request_hash,response FROM assignment_idempotency_keys WHERE actor_email=$1 AND operation=$2 AND idempotency_key=$3", [acting.email, operation, key]);
            if (existing.rows[0]) {
                if (existing.rows[0].request_hash !== requestHash)
                    throw new Error("Idempotency key was already used with a different request");
                return existing.rows[0].response;
            }
            const response = await work();
            await client.query("INSERT INTO assignment_idempotency_keys (actor_email,operation,idempotency_key,request_hash,response) VALUES ($1,$2,$3,$4,$5::jsonb)", [acting.email, operation, key, requestHash, JSON.stringify(response)]);
            return response;
        });
    }
    async getActorScope(req) {
        if (req.user?.role === "super-admin")
            return { global: true, site: "", department: "" };
        const result = await pgPool.query("SELECT COALESCE(site,'') AS site,COALESCE(department,'') AS department FROM users WHERE id::text=$1 OR lower(email)=lower($2) LIMIT 1", [req.user?.id || "", req.user?.email || ""]);
        return { global: false, site: String(result.rows[0]?.site || ""), department: String(result.rows[0]?.department || "") };
    }
    async assertReportScope(report, req) {
        const scope = await this.getActorScope(req);
        if (scope.global)
            return;
        const reportSite = String(report.location || "").trim().toLowerCase();
        const reportDepartment = String(report.department || "").trim().toLowerCase();
        const scopedSite = scope.site.trim().toLowerCase();
        if (scopedSite && reportSite && !reportSite.includes(scopedSite) && !scopedSite.includes(reportSite))
            throw new Error("Report is outside your assigned site scope");
        if (scope.department && reportDepartment && scope.department.trim().toLowerCase() !== reportDepartment)
            throw new Error("Report is outside your assigned department scope");
    }
    async assertAccess(assignmentId, req, manage = false) {
        const email = req.user?.email || "";
        const result = await pgPool.query(`SELECT a.site,a.department,
        (lower(a.assignee_email)=lower($2) OR EXISTS (
          SELECT 1 FROM assignment_participants p
          WHERE p.assignment_id=a.id AND lower(p.email)=lower($2) AND p.active=TRUE
        )) AS participant
       FROM report_assignments a WHERE a.id=$1`, [assignmentId, email]);
        const assignment = result.rows[0];
        if (!assignment)
            throw new Error("Assignment not found");
        const scope = await this.getActorScope(req);
        if (scope.global)
            return;
        const site = String(assignment.site || "").trim().toLowerCase();
        const department = String(assignment.department || "").trim().toLowerCase();
        const scopedSite = scope.site.trim().toLowerCase();
        const inSite = !scopedSite || !site || site.includes(scopedSite) || scopedSite.includes(site);
        const inDepartment = !scope.department || !department || scope.department.trim().toLowerCase() === department;
        const hasRequiredPermission = hasPermission(req.user?.role || "", manage ? "reports:assign" : "reports:read");
        if (hasRequiredPermission && inSite && inDepartment)
            return;
        if (!manage && assignment.participant)
            return;
        throw new Error("You do not have access to this assignment");
    }
    async create(input, req) {
        const work = () => this.createInternal({ ...input, idempotencyKey: undefined }, req);
        return this.idempotent("create", input.idempotencyKey, input, req, work);
    }
    async createInternal(input, req) {
        const assignedBy = actor(req);
        const assignee = await findUserByIdentifier(input.assigneeEmail);
        if (!assignee || !SUPERVISOR_ROLES.includes(assignee.role)) {
            throw new Error("Assignee must be an active user with an assignable supervisor role");
        }
        const template = input.templateId
            ? (await pgPool.query("SELECT * FROM assignment_templates WHERE id=$1 AND active=TRUE", [input.templateId])).rows[0]
            : undefined;
        if (input.templateId && !template)
            throw new Error("Active assignment template not found");
        const created = await assignmentsRepository.transaction(async (client) => {
            const report = await client.query("SELECT id, location, department FROM reports WHERE id=$1 FOR UPDATE", [input.reportId]);
            if (!report.rows[0])
                throw new Error("Report not found");
            await this.assertReportScope(report.rows[0], req);
            const id = randomUUID();
            const now = Date.now();
            const responseDueAt = input.responseDueAt || (template?.response_sla_hours ? new Date(now + Number(template.response_sla_hours) * 3600000).toISOString() : null);
            const dueAt = input.dueAt || (template?.completion_sla_hours ? new Date(now + Number(template.completion_sla_hours) * 3600000).toISOString() : null);
            const verificationDueAt = input.verificationDueAt || (template?.verification_sla_hours ? new Date(now + Number(template.verification_sla_hours) * 3600000).toISOString() : null);
            const priority = template?.default_priority || input.priority;
            const reviewerEmail = input.reviewerEmail || template?.default_reviewer_email;
            const verifierEmail = input.verifierEmail || template?.default_verifier_email;
            const result = await client.query(`INSERT INTO report_assignments (id, report_id, status, priority, assignee_id, assignee_email,
          assignee_name, assigned_by_id, assigned_by_email, assigned_by_name, site, department,
          assignment_reason, response_due_at, due_at, verification_due_at,template_id,template_version,evidence_requirements)
         VALUES ($1,$2,'Assigned',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb) RETURNING *`, [id, input.reportId, priority, assignee.id, assignee.email, input.assigneeName || assignee.name,
                assignedBy.id, assignedBy.email, assignedBy.name, report.rows[0].location, report.rows[0].department,
                input.reason, responseDueAt, dueAt, verificationDueAt, template?.id || null, template?.version || null, JSON.stringify(template?.evidence_requirements || [])]);
            const participants = [
                { email: assignee.email, name: input.assigneeName || assignee.name, role: "assignee", userId: assignee.id },
                ...input.copiedEmails.filter((email) => email !== assignee.email).map((email) => ({ email, role: "copied" })),
                ...(input.backupEmail ? [{ email: input.backupEmail, role: "backup" }] : []),
                ...(reviewerEmail ? [{ email: reviewerEmail, role: "reviewer" }] : []),
                ...(verifierEmail ? [{ email: verifierEmail, role: "verifier" }] : []),
            ];
            for (const participant of participants) {
                await client.query(`INSERT INTO assignment_participants (id, assignment_id, user_id, email, name, role)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (assignment_id,email,role) DO NOTHING`, [randomUUID(), id, "userId" in participant ? participant.userId : null, participant.email,
                    "name" in participant ? participant.name : null, participant.role]);
            }
            for (const task of (template?.task_blueprint || [])) {
                await client.query(`INSERT INTO assignment_tasks (id,assignment_id,title,description,owner_email,owner_name,milestone,estimated_minutes,due_at,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [randomUUID(), id, task.title, task.description || null, task.ownerEmail, task.ownerName || null, Boolean(task.milestone), task.estimatedMinutes || null, task.dueAt || null, assignedBy.email]);
            }
            await client.query(`INSERT INTO assignment_events (id,assignment_id,event_type,to_status,actor_id,actor_email,actor_name,reason,metadata)
         VALUES ($1,$2,'created','Assigned',$3,$4,$5,$6,$7::jsonb)`, [randomUUID(), id, assignedBy.id, assignedBy.email, assignedBy.name, input.reason,
                JSON.stringify({ participants: participants.map((item) => ({ email: item.email, role: item.role })) })]);
            return mapAssignment(result.rows[0]);
        });
        await assignmentSlaService.applyPolicy(created.id);
        const finalized = (await assignmentsRepository.findById(created.id)) || created;
        await this.notifyAssignmentEvent(created.id, "assigned", `Assignment ${created.reportId} has been assigned to ${created.assigneeName || created.assigneeEmail}.`).catch(() => undefined);
        return finalized;
    }
    async notifyAssignmentEvent(assignmentId, event, message) {
        const assignment = (await pgPool.query("SELECT id,report_id,priority FROM report_assignments WHERE id=$1", [assignmentId])).rows[0];
        if (!assignment)
            return;
        const people = await pgPool.query(`SELECT DISTINCT ON(lower(email)) email,name FROM assignment_participants WHERE assignment_id=$1 AND active=TRUE ORDER BY lower(email),created_at`, [assignmentId]);
        const immediate = [];
        for (const person of people.rows) {
            const pref = (await pgPool.query(`SELECT p.*,u.phone AS user_phone FROM users u LEFT JOIN assignment_notification_preferences p ON p.user_id=u.id::text WHERE lower(u.email)=lower($1) LIMIT 1`, [person.email])).rows[0] || {};
            const events = Array.isArray(pref.assignment_events) ? pref.assignment_events : ["assigned", "due-soon", "overdue", "review", "rework", "escalated"];
            if (!events.includes(event))
                continue;
            let channels = Array.isArray(pref.channels) ? pref.channels : ["email", "in-app"];
            if (pref.digest_cadence && pref.digest_cadence !== "immediate" && assignment.priority !== "Critical") {
                const existing = await notificationCenterService.listDigests({ userId: pref.user_id, recipient: person.email });
                let subscription = existing.find((item) => item.active && item.cadence === pref.digest_cadence);
                if (!subscription)
                    subscription = await notificationCenterService.createDigest({ userId: pref.user_id, recipient: person.email, cadence: pref.digest_cadence, channels: channels.filter((channel) => channel !== "in-app") });
                await notificationCenterService.queueDigestItem(subscription.id, { eventKey: `assignment.${event}`, resourceType: "assignment", resourceId: assignmentId, payload: { message, assignmentId, reportId: assignment.report_id, priority: assignment.priority } });
                channels = channels.filter((channel) => channel === "in-app");
            }
            for (const channel of channels) {
                if (channel === "sms" || channel === "whatsapp") {
                    const phone = pref.phone || pref.user_phone;
                    if (phone)
                        immediate.push({ channel, recipient: phone, name: person.name });
                }
                else if (channel === "teams") {
                    if (pref.teams_recipient)
                        immediate.push({ channel, recipient: pref.teams_recipient, name: person.name });
                }
                else
                    immediate.push({ channel, recipient: person.email, name: person.name });
            }
        }
        if (immediate.length)
            await notificationCenterService.enqueue({ eventKey: `assignment.${event}`, workflow: "assignment", resourceType: "assignment", resourceId: assignmentId, payload: { message, assignmentId, reportId: assignment.report_id, priority: assignment.priority }, recipients: immediate, createdBy: "Assignment workflow" });
    }
    async list(filters, req) {
        const scope = await this.getActorScope(req);
        if (scope.global || filters.email)
            return assignmentsRepository.list(filters);
        return assignmentsRepository.list({
            ...filters,
            site: scope.site || filters.site,
            department: scope.department || filters.department,
        });
    }
    async get(id, req) {
        await this.assertAccess(id, req);
        return assignmentsRepository.findById(id);
    }
    async timeline(id, req) {
        if (req)
            await this.assertAccess(id, req);
        return assignmentsRepository.timeline(id);
    }
    async syncReportAssignment(input, req) {
        const current = (await assignmentsRepository.list({ reportId: input.reportId })).find((item) => !["Closed", "Cancelled", "Rejected"].includes(item.status));
        if (!current) {
            return this.create({
                reportId: input.reportId, assigneeEmail: input.assigneeEmail, copiedEmails: input.copiedEmails,
                priority: input.priority || "Medium", reason: input.reason || "Assigned from report workflow", dueAt: input.dueAt,
            }, req);
        }
        if (current.assigneeEmail.toLowerCase() !== input.assigneeEmail.toLowerCase()) {
            return this.reassign(current.id, { assigneeEmail: input.assigneeEmail, reason: input.reason || "Reassigned from report workflow", keepPreviousAsCopied: true, expectedVersion: current.version }, req);
        }
        return current;
    }
    async enqueueReportAssignmentSync(input, req, error) {
        const acting = actor(req);
        const result = await pgPool.query(`INSERT INTO assignment_sync_outbox (id,report_id,payload,actor,last_error)
      VALUES ($1,$2,$3::jsonb,$4::jsonb,$5)
      ON CONFLICT (report_id) WHERE status IN ('pending','processing','failed')
      DO UPDATE SET payload=EXCLUDED.payload,actor=EXCLUDED.actor,status='pending',next_attempt_at=NOW(),last_error=EXCLUDED.last_error,updated_at=NOW()
      RETURNING id,status`, [randomUUID(), input.reportId, JSON.stringify(input), JSON.stringify(acting), error instanceof Error ? error.message : error ? String(error) : null]);
        return result.rows[0];
    }
    async processReportAssignmentSync(limit = 25) {
        const claimed = await assignmentsRepository.transaction(async (client) => {
            const rows = await client.query(`SELECT * FROM assignment_sync_outbox WHERE status IN ('pending','failed') AND next_attempt_at<=NOW()
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT $1`, [Math.min(Math.max(limit, 1), 100)]);
            if (rows.rowCount)
                await client.query("UPDATE assignment_sync_outbox SET status='processing',updated_at=NOW() WHERE id=ANY($1::text[])", [rows.rows.map((row) => row.id)]);
            return rows.rows;
        });
        const results = [];
        for (const row of claimed) {
            try {
                await this.syncReportAssignment(row.payload, { user: row.actor });
                await pgPool.query("UPDATE assignment_sync_outbox SET status='completed',attempts=attempts+1,last_error=NULL,updated_at=NOW() WHERE id=$1", [row.id]);
                results.push({ id: row.id, status: "completed" });
            }
            catch (error) {
                const attempts = Number(row.attempts) + 1;
                const nextSeconds = Math.min(3600, 30 * 2 ** Math.min(attempts, 7));
                await pgPool.query("UPDATE assignment_sync_outbox SET status='failed',attempts=$2,next_attempt_at=NOW()+($3||' seconds')::interval,last_error=$4,updated_at=NOW() WHERE id=$1", [row.id, attempts, nextSeconds, error instanceof Error ? error.message : String(error)]);
                results.push({ id: row.id, status: "failed" });
            }
        }
        return results;
    }
    async enforceRetention(limit = 100) {
        const due = await pgPool.query(`SELECT a.id FROM report_assignments a WHERE a.retention_until<=NOW() AND a.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM assignment_legal_holds h WHERE h.assignment_id=a.id AND h.released_at IS NULL)
      ORDER BY a.retention_until LIMIT $1`, [Math.min(Math.max(limit, 1), 500)]);
        if (!due.rowCount)
            return { archived: 0 };
        const ids = due.rows.map((row) => String(row.id));
        await pgPool.query("UPDATE report_assignments SET archived_at=NOW(),updated_at=NOW() WHERE id=ANY($1::text[])", [ids]);
        return { archived: ids.length };
    }
    async workload(req) {
        const scope = req ? await this.getActorScope(req) : { global: true, site: "", department: "" };
        const result = await pgPool.query(`SELECT assignee_email,MAX(assignee_name) AS assignee_name,COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status NOT IN ('Closed','Cancelled','Rejected'))::int AS open,
      COUNT(*) FILTER (WHERE due_at < NOW() AND status NOT IN ('Closed','Cancelled','Rejected','Verified'))::int AS overdue,
      COUNT(*) FILTER (WHERE priority='Critical' AND status NOT IN ('Closed','Cancelled','Rejected'))::int AS critical,
      ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(closed_at,NOW())-created_at))/3600)::numeric,1) AS average_age_hours
      FROM report_assignments WHERE ($1::boolean OR $2='' OR lower(site)=lower($2)) AND ($1::boolean OR $3='' OR lower(department)=lower($3))
      GROUP BY assignee_email ORDER BY overdue DESC,open DESC,assignee_email`, [scope.global, scope.site, scope.department]);
        return result.rows;
    }
    async bulkCreate(input, req) {
        const work = () => this.bulkCreateInternal({ ...input, idempotencyKey: undefined }, req);
        return this.idempotent("bulk-create", input.idempotencyKey, input, req, work);
    }
    async bulkCreateInternal(input, req) {
        const results = [];
        for (const reportId of [...new Set(input.reportIds)]) {
            try {
                const current = (await assignmentsRepository.list({ reportId })).find((item) => !["Closed", "Cancelled", "Rejected"].includes(item.status));
                const assignment = current || await this.create({ reportId, assigneeEmail: input.assigneeEmail, copiedEmails: input.copiedEmails, priority: input.priority, reason: input.reason, dueAt: input.dueAt, templateId: input.templateId }, req);
                results.push({ reportId, assignment });
            }
            catch (error) {
                results.push({ reportId, error: error instanceof Error ? error.message : String(error) });
            }
        }
        return { succeeded: results.filter((item) => item.assignment).length, failed: results.filter((item) => item.error).length, results };
    }
    async recommendations(reportId, req) {
        const report = await pgPool.query("SELECT id,location,department,severity,type FROM reports WHERE id=$1", [reportId]);
        if (!report.rows[0])
            throw new Error("Report not found");
        await this.assertReportScope(report.rows[0], req);
        const users = await listUsers(SUPERVISOR_ROLES);
        const workload = await this.workload(req);
        const byEmail = new Map(workload.map((item) => [String(item.assignee_email).toLowerCase(), item]));
        const profiles = await pgPool.query(`SELECT lower(u.email) AS email,u.site,u.department,
      COUNT(a.id)::int AS historical_assignments,
      COUNT(a.id) FILTER (WHERE a.closed_at IS NOT NULL AND (a.due_at IS NULL OR a.closed_at<=a.due_at))::int AS on_time,
      COUNT(a.id) FILTER (WHERE a.status='Rework')::int AS rework,
      COUNT(a.id) FILTER (WHERE lower(r.type)=lower($1))::int AS same_type
      FROM users u LEFT JOIN report_assignments a ON lower(a.assignee_email)=lower(u.email)
      LEFT JOIN reports r ON r.id=a.report_id WHERE u.active=TRUE GROUP BY u.email,u.site,u.department`, [report.rows[0].type]);
        const profileByEmail = new Map(profiles.rows.map((item) => [String(item.email), item]));
        return users.map((user) => {
            const load = byEmail.get(user.email.toLowerCase());
            const profile = profileByEmail.get(user.email.toLowerCase());
            const open = Number(load?.open || 0);
            const overdue = Number(load?.overdue || 0);
            const critical = Number(load?.critical || 0);
            const siteFit = profile?.site && String(report.rows[0].location).toLowerCase().includes(String(profile.site).toLowerCase()) ? 15 : 0;
            const departmentFit = profile?.department && String(profile.department).toLowerCase() === String(report.rows[0].department).toLowerCase() ? 15 : 0;
            const historical = Number(profile?.historical_assignments || 0);
            const onTime = Number(profile?.on_time || 0);
            const rework = Number(profile?.rework || 0);
            const sameType = Number(profile?.same_type || 0);
            const performance = historical ? Math.round((onTime / historical) * 15) : 5;
            const score = Math.max(0, Math.min(100, 55 + siteFit + departmentFit + performance + Math.min(10, sameType * 2) - open * 4 - overdue * 12 - critical * 8 - rework * 3));
            const reasons = [siteFit ? "site match" : "", departmentFit ? "department match" : "", sameType ? `${sameType} similar assignment${sameType === 1 ? "" : "s"}` : "", overdue ? `${overdue} overdue` : "no overdue work"].filter(Boolean);
            return { ...user, score, openAssignments: open, overdueAssignments: overdue, criticalAssignments: critical, siteMatch: Boolean(siteFit), departmentMatch: Boolean(departmentFit), sameTypeAssignments: sameType, onTimeRate: historical ? Math.round(100 * onTime / historical) : null, rationale: reasons.join("; ") };
        }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    }
    async createTemplate(input, req) {
        const acting = actor(req);
        const id = randomUUID();
        return assignmentsRepository.transaction(async (client) => {
            let version = 1;
            if (input.supersedesTemplateId) {
                const previous = await client.query("SELECT version FROM assignment_templates WHERE id=$1 FOR UPDATE", [input.supersedesTemplateId]);
                if (!previous.rows[0])
                    throw new Error("Template to supersede was not found");
                version = Number(previous.rows[0].version) + 1;
                await client.query("UPDATE assignment_templates SET active=FALSE WHERE id=$1", [input.supersedesTemplateId]);
            }
            const result = await client.query(`INSERT INTO assignment_templates (id,name,description,report_type,severity,site,department,default_priority,response_sla_hours,completion_sla_hours,verification_sla_hours,default_assignee_role,default_reviewer_email,default_verifier_email,task_blueprint,evidence_requirements,created_by,version,supersedes_template_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb,$17,$18,$19) RETURNING *`, [id, input.name, input.description || null, input.reportType || null, input.severity || null, input.site || null, input.department || null, input.defaultPriority, input.responseSlaHours || null, input.completionSlaHours || null, input.verificationSlaHours || null, input.defaultAssigneeRole || null, input.defaultReviewerEmail || null, input.defaultVerifierEmail || null, JSON.stringify(input.taskBlueprint || []), JSON.stringify(input.evidenceRequirements || []), acting.email, version, input.supersedesTemplateId || null]);
            return result.rows[0];
        });
    }
    async listTemplates() { return (await pgPool.query("SELECT * FROM assignment_templates WHERE active=TRUE ORDER BY name")).rows; }
    async createRoutingRule(input, req) {
        const acting = actor(req);
        const assignee = await findUserByIdentifier(input.assigneeEmail);
        if (!assignee || !SUPERVISOR_ROLES.includes(assignee.role))
            throw new Error("Routing-rule assignee must be an active user with an assignable role");
        if (input.templateId) {
            const template = await pgPool.query("SELECT 1 FROM assignment_templates WHERE id=$1 AND active=TRUE", [input.templateId]);
            if (!template.rows[0])
                throw new Error("Routing-rule template is not active");
        }
        return (await pgPool.query(`INSERT INTO assignment_routing_rules (id,name,report_type,severity,site,department,assignee_email,copied_emails,template_id,priority,rule_order,active,created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13) RETURNING *`, [randomUUID(), input.name, input.reportType || null, input.severity || null, input.site || null, input.department || null, assignee.email, JSON.stringify(input.copiedEmails), input.templateId || null, input.priority || null, input.ruleOrder, input.active, acting.email])).rows[0];
    }
    async listRoutingRules() { return (await pgPool.query("SELECT * FROM assignment_routing_rules WHERE active=TRUE ORDER BY rule_order,name")).rows; }
    async processAutoAssignmentRules(limit = 25) {
        const reports = await pgPool.query(`SELECT r.*,rule.* FROM reports r JOIN LATERAL (
      SELECT ar.id AS rule_id,ar.name AS rule_name,ar.assignee_email,ar.copied_emails,ar.template_id,ar.priority
      FROM assignment_routing_rules ar WHERE ar.active=TRUE
        AND (ar.report_type IS NULL OR lower(ar.report_type)=lower(r.type))
        AND (ar.severity IS NULL OR lower(ar.severity)=lower(r.severity))
        AND (ar.site IS NULL OR lower(r.location) LIKE '%'||lower(ar.site)||'%')
        AND (ar.department IS NULL OR lower(ar.department)=lower(r.department))
      ORDER BY ar.rule_order,(ar.report_type IS NOT NULL)::int+(ar.severity IS NOT NULL)::int+(ar.site IS NOT NULL)::int+(ar.department IS NOT NULL)::int DESC LIMIT 1
    ) rule ON TRUE WHERE NULLIF(trim(r.assigned_to),'') IS NULL
      AND NOT EXISTS (SELECT 1 FROM report_assignments a WHERE a.report_id=r.id AND a.status NOT IN ('Closed','Cancelled','Rejected'))
      ORDER BY r.created_at LIMIT $1`, [Math.min(Math.max(limit, 1), 100)]);
        const systemRequest = { user: { id: "assignment-automation", email: "assignment-automation@local.invalid", name: "Assignment automation", role: "super-admin" } };
        const results = [];
        for (const report of reports.rows) {
            try {
                const assignment = await this.create({ reportId: report.id, assigneeEmail: report.assignee_email, copiedEmails: Array.isArray(report.copied_emails) ? report.copied_emails : [], priority: report.priority || (["Low", "Medium", "High", "Critical"].includes(report.severity) ? report.severity : "Medium"), reason: `Automatically assigned by rule: ${report.rule_name}`, dueAt: report.due_at, templateId: report.template_id || undefined, idempotencyKey: `auto-rule:${report.id}:${report.rule_id}` }, systemRequest);
                await pgPool.query("UPDATE reports SET assigned_to=$2,assigned_to_copy=$3::jsonb,updated_at=NOW() WHERE id=$1 AND assigned_to IS NULL", [report.id, report.assignee_email, JSON.stringify(report.copied_emails || [])]);
                results.push({ reportId: report.id, assignmentId: assignment.id, status: "assigned" });
            }
            catch (error) {
                results.push({ reportId: report.id, status: "failed", error: error instanceof Error ? error.message : String(error) });
            }
        }
        return results;
    }
    async getNotificationPreferences(req) {
        const acting = actor(req);
        const result = await pgPool.query("SELECT * FROM assignment_notification_preferences WHERE user_id=$1", [acting.id]);
        return result.rows[0] || { user_id: acting.id, email: acting.email, channels: ["email", "in-app"], assignment_events: ["assigned", "due-soon", "overdue", "review", "rework", "escalated"], digest_cadence: "immediate", timezone: "Africa/Nairobi", critical_bypass_quiet_hours: true };
    }
    async updateNotificationPreferences(input, req) {
        const acting = actor(req);
        const result = await pgPool.query(`INSERT INTO assignment_notification_preferences (user_id,email,channels,assignment_events,digest_cadence,quiet_hours_start,quiet_hours_end,timezone,critical_bypass_quiet_hours,phone,teams_recipient) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (user_id) DO UPDATE SET email=EXCLUDED.email,channels=EXCLUDED.channels,assignment_events=EXCLUDED.assignment_events,digest_cadence=EXCLUDED.digest_cadence,quiet_hours_start=EXCLUDED.quiet_hours_start,quiet_hours_end=EXCLUDED.quiet_hours_end,timezone=EXCLUDED.timezone,critical_bypass_quiet_hours=EXCLUDED.critical_bypass_quiet_hours,phone=EXCLUDED.phone,teams_recipient=EXCLUDED.teams_recipient,updated_at=NOW() RETURNING *`, [acting.id, acting.email, JSON.stringify(input.channels), JSON.stringify(input.assignmentEvents), input.digestCadence, input.quietHoursStart || null, input.quietHoursEnd || null, input.timezone, input.criticalBypassQuietHours, input.phone || null, input.teamsRecipient || null]);
        return result.rows[0];
    }
    async createEscalationPolicy(input, req) {
        const acting = actor(req);
        const result = await pgPool.query(`INSERT INTO assignment_escalation_policies (id,name,severity,site,response_sla_hours,completion_sla_hours,levels,business_calendar,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9) RETURNING *`, [randomUUID(), input.name, input.severity || null, input.site || null, input.responseSlaHours, input.completionSlaHours, JSON.stringify(input.levels), JSON.stringify(input.businessCalendar), acting.email]);
        return result.rows[0];
    }
    async listEscalationPolicies() { return (await pgPool.query("SELECT * FROM assignment_escalation_policies WHERE active=TRUE ORDER BY name")).rows; }
    async addEffectivenessReview(assignmentId, input, req) {
        await this.assertAccess(assignmentId, req, true);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const assignment = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [assignmentId]);
            if (!assignment.rows[0])
                throw new Error("Assignment not found");
            if (!["Approved", "Verified", "Closed"].includes(String(assignment.rows[0].status)))
                throw new Error("Effectiveness can only be reviewed after approval");
            const id = randomUUID();
            const review = await client.query(`INSERT INTO assignment_effectiveness_reviews (id,assignment_id,reviewer_id,reviewer_email,reviewer_name,outcome,effectiveness_score,residual_risk,recurrence_detected,follow_up_inspection_required,follow_up_due_at,notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`, [id, assignmentId, acting.id, acting.email, acting.name, input.outcome, input.effectivenessScore, input.residualRisk, input.recurrenceDetected, input.followUpInspectionRequired, input.followUpDueAt || null, input.notes]);
            if (input.outcome === "Ineffective" || input.recurrenceDetected || input.residualRisk === "Critical") {
                await client.query("UPDATE report_assignments SET status='Rework',rework_reason=$2,version=version+1,updated_at=NOW() WHERE id=$1", [assignmentId, `Effectiveness review: ${input.notes}`]);
            }
            await this.event(client, assignmentId, "effectiveness.reviewed", acting, input.notes, { reviewId: id, outcome: input.outcome, score: input.effectivenessScore, residualRisk: input.residualRisk, recurrenceDetected: input.recurrenceDetected });
            return review.rows[0];
        });
    }
    async listEffectivenessReviews(assignmentId, req) {
        if (req)
            await this.assertAccess(assignmentId, req);
        return (await pgPool.query("SELECT * FROM assignment_effectiveness_reviews WHERE assignment_id=$1 ORDER BY reviewed_at DESC", [assignmentId])).rows;
    }
    async sign(assignmentId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const assignment = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [assignmentId]);
            if (!assignment.rows[0])
                throw new Error("Assignment not found");
            if (Number(assignment.rows[0].version) !== input.expectedVersion)
                throw new Error("Assignment changed before signing; reload and review it again");
            const allowedStatus = { submission: ["Submitted", "Under Review"], approval: ["Approved"], verification: ["Verified"], closure: ["Closed"], reopening: ["Rework"] };
            if (!allowedStatus[input.signatureType]?.includes(String(assignment.rows[0].status)))
                throw new Error(`${input.signatureType} sign-off is not valid while the assignment is ${assignment.rows[0].status}`);
            if (["approval", "verification", "closure"].includes(input.signatureType) && String(assignment.rows[0].assignee_email).toLowerCase() === acting.email)
                throw new Error("An assignee cannot provide independent approval, verification, or closure sign-off");
            const duplicate = await client.query("SELECT 1 FROM assignment_signatures WHERE assignment_id=$1 AND signature_type=$2 AND lower(signer_email)=lower($3) LIMIT 1", [assignmentId, input.signatureType, acting.email]);
            if (duplicate.rows[0])
                throw new Error("You have already recorded this sign-off");
            const canonical = JSON.stringify({ assignmentId, reportId: assignment.rows[0].report_id, status: assignment.rows[0].status, version: assignment.rows[0].version, signatureType: input.signatureType, signer: acting.email, declaration: input.declaration });
            const payloadHash = createHash("sha256").update(canonical).digest("hex");
            const secret = process.env.ASSIGNMENT_SIGNATURE_SECRET || process.env.JWT_SECRET;
            if (!secret)
                throw new Error("Assignment signature verification secret is not configured");
            const signatureMac = createHmac("sha256", secret).update(canonical).digest("hex");
            const keyId = createHash("sha256").update(secret).digest("hex").slice(0, 16);
            const result = await client.query(`INSERT INTO assignment_signatures (id,assignment_id,signature_type,signer_id,signer_email,signer_name,declaration,payload_hash,ip_address,user_agent,canonical_payload,signature_mac,key_id,algorithm) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'hmac-sha256') RETURNING *`, [randomUUID(), assignmentId, input.signatureType, acting.id, acting.email, acting.name, input.declaration, payloadHash, req.ip || null, req.get("user-agent") || null, canonical, signatureMac, keyId]);
            await this.event(client, assignmentId, "digitally.signed", acting, input.declaration, { signatureType: input.signatureType, payloadHash });
            return result.rows[0];
        });
    }
    async verifySignatures(assignmentId, req) {
        await this.assertAccess(assignmentId, req);
        const secret = process.env.ASSIGNMENT_SIGNATURE_SECRET || process.env.JWT_SECRET;
        const rows = (await pgPool.query("SELECT * FROM assignment_signatures WHERE assignment_id=$1 ORDER BY signed_at", [assignmentId])).rows;
        return { assignmentId, valid: rows.every((row) => {
                if (row.algorithm !== "hmac-sha256" || !row.signature_mac || !row.canonical_payload || !secret)
                    return row.algorithm === "legacy-sha256" && Boolean(row.payload_hash);
                const canonical = String(row.canonical_payload);
                const expected = createHmac("sha256", secret).update(canonical).digest("hex");
                const left = Buffer.from(expected, "hex"), right = Buffer.from(String(row.signature_mac), "hex");
                return left.length === right.length && timingSafeEqual(left, right);
            }), configured: Boolean(secret), signatures: rows.map((row) => ({ id: row.id, type: row.signature_type, signer: row.signer_email, signedAt: row.signed_at, algorithm: row.algorithm, verified: row.algorithm === "legacy-sha256" ? Boolean(row.payload_hash) : Boolean(secret && row.signature_mac && row.canonical_payload && (() => { const expected = createHmac("sha256", secret).update(String(row.canonical_payload)).digest("hex"); const left = Buffer.from(expected, "hex"), right = Buffer.from(String(row.signature_mac), "hex"); return left.length === right.length && timingSafeEqual(left, right); })()) })) };
    }
    async verifyAuditChain(assignmentId, req) {
        await this.assertAccess(assignmentId, req);
        const seal = await pgPool.query(`SELECT s.*,(SELECT count(*)::int FROM assignment_events e WHERE e.assignment_id=s.assignment_id AND e.event_hash IS NULL) AS actual_count,
      (SELECT encode(digest(string_agg(concat_ws('|',id,event_type,from_status,to_status,actor_id,actor_email,actor_name,reason,metadata::text,created_at::text),E'\n' ORDER BY created_at,id),'sha256'),'hex') FROM assignment_events e WHERE e.assignment_id=s.assignment_id AND e.event_hash IS NULL) AS actual_hash
      FROM assignment_event_chain_seals s WHERE s.assignment_id=$1`, [assignmentId]);
        const historicalValid = !seal.rows[0] || (Number(seal.rows[0].event_count) === Number(seal.rows[0].actual_count) && seal.rows[0].seal_hash === seal.rows[0].actual_hash);
        const events = await pgPool.query(`SELECT *,encode(digest(concat_ws('|',id,assignment_id,event_type,from_status,to_status,actor_id,actor_email,actor_name,reason,metadata::text,created_at::text,COALESCE(previous_hash,'')),'sha256'),'hex') AS calculated_hash FROM assignment_events WHERE assignment_id=$1 AND event_hash IS NOT NULL ORDER BY created_at,id`, [assignmentId]);
        let previous = seal.rows[0]?.seal_hash || null;
        const issues = [];
        for (const event of events.rows) {
            if ((event.previous_hash || null) !== previous)
                issues.push(`Previous hash mismatch at event ${event.id}`);
            if (event.event_hash !== event.calculated_hash)
                issues.push(`Event hash mismatch at event ${event.id}`);
            previous = event.event_hash;
        }
        if (!historicalValid)
            issues.unshift("Historical event seal mismatch");
        return { assignmentId, valid: historicalValid && !issues.length, historicalSeal: Boolean(seal.rows[0]), verifiedEvents: events.rowCount || 0, issues };
    }
    async placeLegalHold(assignmentId, reason, req) {
        await this.assertAccess(assignmentId, req, true);
        const acting = actor(req);
        const result = await pgPool.query(`INSERT INTO assignment_legal_holds (id,assignment_id,reason,placed_by) SELECT $1,$2,$3,$4 WHERE EXISTS (SELECT 1 FROM report_assignments WHERE id=$2) RETURNING *`, [randomUUID(), assignmentId, reason, acting.email]);
        if (!result.rows[0])
            throw new Error("Assignment not found");
        return result.rows[0];
    }
    async releaseLegalHold(assignmentId, holdId, req) {
        await this.assertAccess(assignmentId, req, true);
        const acting = actor(req);
        const result = await pgPool.query("UPDATE assignment_legal_holds SET released_by=$3,released_at=NOW() WHERE id=$1 AND assignment_id=$2 AND released_at IS NULL RETURNING *", [holdId, assignmentId, acting.email]);
        if (!result.rows[0])
            throw new Error("Active legal hold not found");
        return result.rows[0];
    }
    async createRetentionPolicy(input, req) {
        const acting = actor(req);
        return (await pgPool.query(`INSERT INTO assignment_retention_policies (id,name,site,severity,retention_years,created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [randomUUID(), input.name, input.site || null, input.severity || null, input.retentionYears, acting.email])).rows[0];
    }
    async listRetentionPolicies() { return (await pgPool.query("SELECT * FROM assignment_retention_policies WHERE active=TRUE ORDER BY name")).rows; }
    async listLegalHolds(assignmentId, req) {
        await this.assertAccess(assignmentId, req);
        return (await pgPool.query("SELECT * FROM assignment_legal_holds WHERE assignment_id=$1 ORDER BY placed_at DESC", [assignmentId])).rows;
    }
    async caseFile(assignmentId, req) {
        await this.assertAccess(assignmentId, req);
        const [assignment, participants, tasks, evidence, comments, events, reviews, signatures, holds] = await Promise.all([
            pgPool.query("SELECT * FROM report_assignments WHERE id=$1", [assignmentId]), pgPool.query("SELECT * FROM assignment_participants WHERE assignment_id=$1", [assignmentId]), this.listTasks(assignmentId), this.listEvidence(assignmentId), this.listComments(assignmentId, req), this.timeline(assignmentId), this.listEffectivenessReviews(assignmentId), pgPool.query("SELECT * FROM assignment_signatures WHERE assignment_id=$1 ORDER BY signed_at", [assignmentId]), pgPool.query("SELECT * FROM assignment_legal_holds WHERE assignment_id=$1 ORDER BY placed_at", [assignmentId]),
        ]);
        if (!assignment.rows[0])
            throw new Error("Assignment not found");
        const data = { generatedAt: new Date().toISOString(), generatedBy: req.user?.email, assignment: assignment.rows[0], participants: participants.rows, tasks, evidence, comments, events, effectivenessReviews: reviews, signatures: signatures.rows, legalHolds: holds.rows };
        return { ...data, caseFileHash: createHash("sha256").update(JSON.stringify(data)).digest("hex") };
    }
    async analytics(req) {
        const scope = await this.getActorScope(req);
        const params = [scope.global, scope.site, scope.department];
        const scopeSql = "($1::boolean OR $2='' OR lower(site)=lower($2)) AND ($1::boolean OR $3='' OR lower(department)=lower($3))";
        const [summary, statuses, owners, trend, effectiveness] = await Promise.all([
            pgPool.query(`SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status NOT IN ('Closed','Cancelled','Rejected'))::int AS open,COUNT(*) FILTER (WHERE due_at<NOW() AND status NOT IN ('Closed','Cancelled','Rejected','Verified'))::int AS overdue,ROUND(100.0*COUNT(*) FILTER (WHERE closed_at IS NOT NULL AND (due_at IS NULL OR closed_at<=due_at))/NULLIF(COUNT(*) FILTER (WHERE closed_at IS NOT NULL),0),1) AS sla_compliance,ROUND((AVG(EXTRACT(EPOCH FROM (accepted_at-created_at))/3600) FILTER (WHERE accepted_at IS NOT NULL))::numeric,1) AS average_acceptance_hours,ROUND((AVG(EXTRACT(EPOCH FROM (closed_at-created_at))/3600) FILTER (WHERE closed_at IS NOT NULL))::numeric,1) AS average_completion_hours FROM report_assignments WHERE ${scopeSql}`, params),
            pgPool.query(`SELECT status,COUNT(*)::int AS count FROM report_assignments WHERE ${scopeSql} GROUP BY status ORDER BY count DESC`, params),
            pgPool.query(`SELECT assignee_email,MAX(assignee_name) AS assignee_name,COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status='Rework')::int AS rework,COUNT(*) FILTER (WHERE due_at<NOW() AND status NOT IN ('Closed','Cancelled','Rejected','Verified'))::int AS overdue FROM report_assignments WHERE ${scopeSql} GROUP BY assignee_email ORDER BY total DESC LIMIT 20`, params),
            pgPool.query(`SELECT date_trunc('month',created_at) AS month,COUNT(*)::int AS assigned,COUNT(*) FILTER (WHERE closed_at IS NOT NULL)::int AS closed FROM report_assignments WHERE ${scopeSql} AND created_at>=NOW()-INTERVAL '12 months' GROUP BY 1 ORDER BY 1`, params),
            pgPool.query(`SELECT outcome,COUNT(*)::int AS count,ROUND(AVG(effectiveness_score),1) AS average_score FROM assignment_effectiveness_reviews e JOIN report_assignments a ON a.id=e.assignment_id WHERE ${scopeSql} GROUP BY outcome`, params),
        ]);
        return { summary: summary.rows[0], statuses: statuses.rows, owners: owners.rows, trend: trend.rows, effectiveness: effectiveness.rows };
    }
    async updateDeadlines(id, input, req) {
        await this.assertAccess(id, req, true);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const current = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [id]);
            if (!current.rows[0])
                throw new Error("Assignment not found");
            if (Number(current.rows[0].version) !== input.expectedVersion)
                throw new Error("Assignment changed before its deadlines were updated");
            const next = {
                responseDueAt: input.responseDueAt === undefined ? current.rows[0].response_due_at : input.responseDueAt,
                dueAt: input.dueAt === undefined ? current.rows[0].due_at : input.dueAt,
                verificationDueAt: input.verificationDueAt === undefined ? current.rows[0].verification_due_at : input.verificationDueAt,
            };
            if (next.responseDueAt && next.dueAt && new Date(next.responseDueAt) > new Date(next.dueAt))
                throw new Error("Response deadline cannot be after the completion deadline");
            if (next.dueAt && next.verificationDueAt && new Date(next.dueAt) > new Date(next.verificationDueAt))
                throw new Error("Verification deadline cannot be before the completion deadline");
            const updated = await client.query(`UPDATE report_assignments SET response_due_at=$2,due_at=$3,verification_due_at=$4,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [id, next.responseDueAt, next.dueAt, next.verificationDueAt]);
            await this.event(client, id, "deadlines.updated", acting, input.reason, { before: { responseDueAt: current.rows[0].response_due_at, dueAt: current.rows[0].due_at, verificationDueAt: current.rows[0].verification_due_at }, after: next });
            return mapAssignment(updated.rows[0]);
        });
    }
    async transition(id, event, reason, expectedVersion, req) {
        await this.assertAccess(id, req);
        const acting = actor(req);
        if (requiresReason(event) && !reason?.trim())
            throw new Error(`A reason is required to ${event} an assignment`);
        const transitioned = await assignmentsRepository.transaction(async (client) => {
            const currentResult = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [id]);
            if (!currentResult.rows[0])
                throw new Error("Assignment not found");
            const current = currentResult.rows[0];
            const selfEvents = ["view", "accept", "reject", "start", "pause", "resume", "submit"];
            const isAssignee = String(current.assignee_email).toLowerCase() === acting.email;
            if (!(selfEvents.includes(event) && isAssignee) && !hasPermission(req.user?.role || "", "reports:assign")) {
                throw new Error("You are not authorized to perform this assignment transition");
            }
            if (["approve", "verify", "close"].includes(event) && isAssignee)
                throw new Error("Separation of duties prevents an assignee from approving, verifying, or closing their own work");
            const requiredRole = event === "approve" ? "reviewer" : event === "verify" ? "verifier" : undefined;
            if (requiredRole) {
                const designated = await client.query("SELECT email FROM assignment_participants WHERE assignment_id=$1 AND role=$2 AND active=TRUE", [id, requiredRole]);
                if (designated.rowCount && !designated.rows.some((row) => String(row.email).toLowerCase() === acting.email))
                    throw new Error(`Only the designated ${requiredRole} can perform this transition`);
            }
            if (event === "verify") {
                const approval = await client.query("SELECT actor_email FROM assignment_events WHERE assignment_id=$1 AND event_type='approve' ORDER BY created_at DESC,id DESC LIMIT 1", [id]);
                if (String(approval.rows[0]?.actor_email || "").toLowerCase() === acting.email)
                    throw new Error("The approver and verifier must be different people");
            }
            if (expectedVersion && Number(current.version) !== expectedVersion)
                throw new Error("Assignment was changed by another user; reload and try again");
            const next = ASSIGNMENT_TRANSITIONS[String(current.status)]?.[event];
            if (!next)
                throw new Error(`Cannot ${event} an assignment in ${current.status} status`);
            const timestamps = {
                view: "viewed_at", accept: "accepted_at", start: "started_at", pause: "paused_at",
                submit: "submitted_at", approve: "approved_at", verify: "verified_at", close: "closed_at",
            };
            if (event === "resume" && current.paused_at) {
                await client.query(`UPDATE report_assignments SET
          sla_paused_seconds=sla_paused_seconds+GREATEST(0,EXTRACT(EPOCH FROM (NOW()-paused_at))::integer),
          response_due_at=CASE WHEN response_due_at IS NULL THEN NULL ELSE response_due_at+(NOW()-paused_at) END,
          due_at=CASE WHEN due_at IS NULL THEN NULL ELSE due_at+(NOW()-paused_at) END,
          verification_due_at=CASE WHEN verification_due_at IS NULL THEN NULL ELSE verification_due_at+(NOW()-paused_at) END,
          next_escalation_at=CASE WHEN next_escalation_at IS NULL THEN NULL ELSE next_escalation_at+(NOW()-paused_at) END,
          paused_at=NULL WHERE id=$1`, [id]);
            }
            const timestampSql = timestamps[event] ? `, ${timestamps[event]}=COALESCE(${timestamps[event]},NOW())` : "";
            const reasonColumn = { reject: "rejection_reason", pause: "pause_reason", "request-rework": "rework_reason", cancel: "cancellation_reason" };
            const reasonSql = reasonColumn[event] ? `, ${reasonColumn[event]}=$3` : "";
            const updated = await client.query(`UPDATE report_assignments SET status=$2, version=version+1, updated_at=NOW()${timestampSql}${reasonSql} WHERE id=$1 RETURNING *`, [id, next, reason || null]);
            await client.query(`INSERT INTO assignment_events (id,assignment_id,event_type,from_status,to_status,actor_id,actor_email,actor_name,reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [randomUUID(), id, event, current.status, next, acting.id, acting.email, acting.name, reason || null]);
            if (event === "close") {
                await client.query(`UPDATE report_assignments a SET retention_until=NOW()+make_interval(years=>COALESCE((
          SELECT retention_years FROM assignment_retention_policies p WHERE p.active=TRUE
            AND (p.site IS NULL OR lower(p.site)=lower(a.site)) AND (p.severity IS NULL OR lower(p.severity)=lower(a.priority))
          ORDER BY (p.site IS NOT NULL)::int+(p.severity IS NOT NULL)::int DESC LIMIT 1
        ),7)) WHERE a.id=$1`, [id]);
            }
            return mapAssignment(updated.rows[0]);
        });
        const notificationEvent = event === "request-rework" ? "rework" : ["submit", "review", "approve", "verify"].includes(event) ? "review" : undefined;
        if (notificationEvent) {
            await this.notifyAssignmentEvent(id, notificationEvent, `Assignment ${transitioned.reportId} moved to ${transitioned.status}${reason ? `: ${reason}` : ""}.`).catch(() => undefined);
        }
        return transitioned;
    }
    async reassign(id, input, req) {
        await this.assertAccess(id, req, true);
        const acting = actor(req);
        const assignee = await findUserByIdentifier(input.assigneeEmail);
        if (!assignee || !SUPERVISOR_ROLES.includes(assignee.role))
            throw new Error("New assignee must be an active user with an assignable supervisor role");
        return assignmentsRepository.transaction(async (client) => {
            const currentResult = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [id]);
            if (!currentResult.rows[0])
                throw new Error("Assignment not found");
            const current = currentResult.rows[0];
            if (["Closed", "Cancelled"].includes(String(current.status)))
                throw new Error(`Cannot reassign a ${current.status} assignment`);
            if (input.expectedVersion && Number(current.version) !== input.expectedVersion)
                throw new Error("Assignment was changed by another user; reload and try again");
            await client.query("UPDATE assignment_participants SET active=FALSE WHERE assignment_id=$1 AND role='assignee'", [id]);
            if (input.keepPreviousAsCopied) {
                await client.query(`INSERT INTO assignment_participants (id,assignment_id,email,name,role) VALUES ($1,$2,$3,$4,'copied') ON CONFLICT (assignment_id,email,role) DO UPDATE SET active=TRUE`, [randomUUID(), id, current.assignee_email, current.assignee_name]);
            }
            await client.query(`INSERT INTO assignment_participants (id,assignment_id,user_id,email,name,role) VALUES ($1,$2,$3,$4,$5,'assignee') ON CONFLICT (assignment_id,email,role) DO UPDATE SET active=TRUE,name=EXCLUDED.name,user_id=EXCLUDED.user_id`, [randomUUID(), id, assignee.id, assignee.email, input.assigneeName || assignee.name]);
            const updated = await client.query(`UPDATE report_assignments SET assignee_id=$2,assignee_email=$3,assignee_name=$4,status='Assigned',assignment_reason=$5,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`, [id, assignee.id, assignee.email, input.assigneeName || assignee.name, input.reason]);
            await client.query(`INSERT INTO assignment_events (id,assignment_id,event_type,from_status,to_status,actor_id,actor_email,actor_name,reason,metadata) VALUES ($1,$2,'reassigned',$3,'Assigned',$4,$5,$6,$7,$8::jsonb)`, [randomUUID(), id, current.status, acting.id, acting.email, acting.name, input.reason, JSON.stringify({ from: current.assignee_email, to: assignee.email })]);
            return mapAssignment(updated.rows[0]);
        });
    }
    async delegate(id, input, req) {
        await this.assertAccess(id, req);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const current = await client.query("SELECT * FROM report_assignments WHERE id=$1 FOR UPDATE", [id]);
            if (!current.rows[0])
                throw new Error("Assignment not found");
            if (String(current.rows[0].assignee_email).toLowerCase() !== acting.email && !hasPermission(req.user?.role || "", "reports:assign"))
                throw new Error("Only the assignee or an assignment manager can delegate this work");
            await client.query(`INSERT INTO assignment_participants (id,assignment_id,email,name,role) VALUES ($1,$2,$3,$4,'delegate') ON CONFLICT (assignment_id,email,role) DO UPDATE SET active=TRUE,name=EXCLUDED.name`, [randomUUID(), id, input.delegateEmail, input.delegateName || null]);
            await client.query("UPDATE report_assignments SET version=version+1,updated_at=NOW() WHERE id=$1", [id]);
            await client.query(`INSERT INTO assignment_events (id,assignment_id,event_type,from_status,to_status,actor_id,actor_email,actor_name,reason,metadata) VALUES ($1,$2,'delegated',$3,$3,$4,$5,$6,$7,$8::jsonb)`, [randomUUID(), id, current.rows[0].status, acting.id, acting.email, acting.name, input.reason, JSON.stringify({ delegateEmail: input.delegateEmail, dueAt: input.dueAt || null })]);
            return assignmentsRepository.findById(id, client);
        });
    }
    async addTask(assignmentId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const assignment = await client.query("SELECT id FROM report_assignments WHERE id=$1 FOR UPDATE", [assignmentId]);
            if (!assignment.rows[0])
                throw new Error("Assignment not found");
            const relatedIds = [input.parentTaskId, ...input.dependsOnTaskIds].filter(Boolean);
            if (relatedIds.length) {
                const related = await client.query("SELECT id FROM assignment_tasks WHERE assignment_id=$1 AND id=ANY($2::text[])", [assignmentId, relatedIds]);
                if (related.rowCount !== new Set(relatedIds).size)
                    throw new Error("Parent and dependency tasks must belong to this assignment");
            }
            const id = randomUUID();
            const result = await client.query(`INSERT INTO assignment_tasks (id,assignment_id,parent_task_id,title,description,owner_email,owner_name,milestone,estimated_minutes,due_at,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`, [id, assignmentId, input.parentTaskId || null, input.title, input.description || null, input.ownerEmail, input.ownerName || null, input.milestone, input.estimatedMinutes || null, input.dueAt || null, acting.email]);
            for (const dependencyId of new Set(input.dependsOnTaskIds))
                await client.query("INSERT INTO assignment_task_dependencies (task_id,depends_on_task_id) VALUES ($1,$2)", [id, dependencyId]);
            await this.event(client, assignmentId, "task.created", acting, input.title, { taskId: id, dependencies: input.dependsOnTaskIds });
            return result.rows[0];
        });
    }
    async listTasks(assignmentId, req) {
        if (req)
            await this.assertAccess(assignmentId, req);
        const result = await pgPool.query(`SELECT t.*, COALESCE(jsonb_agg(d.depends_on_task_id) FILTER (WHERE d.depends_on_task_id IS NOT NULL),'[]'::jsonb) AS dependency_ids FROM assignment_tasks t LEFT JOIN assignment_task_dependencies d ON d.task_id=t.id WHERE t.assignment_id=$1 GROUP BY t.id ORDER BY t.created_at`, [assignmentId]);
        return result.rows;
    }
    async updateTask(assignmentId, taskId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const current = await client.query("SELECT * FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE", [taskId, assignmentId]);
            if (!current.rows[0])
                throw new Error("Assignment task not found");
            if (input.status === "Completed") {
                const blocked = await client.query(`SELECT 1 FROM assignment_task_dependencies d JOIN assignment_tasks dependency ON dependency.id=d.depends_on_task_id WHERE d.task_id=$1 AND dependency.status NOT IN ('Completed','Verified','Cancelled') LIMIT 1`, [taskId]);
                if (blocked.rows[0])
                    throw new Error("Task cannot be completed until all dependencies are complete");
            }
            const status = input.status || current.rows[0].status;
            const percent = input.percentComplete ?? (status === "Completed" || status === "Verified" ? 100 : current.rows[0].percent_complete);
            const result = await client.query(`UPDATE assignment_tasks SET status=$3,percent_complete=$4,due_at=COALESCE($5,due_at),description=COALESCE($6,description),completed_at=CASE WHEN $3='Completed' THEN NOW() ELSE completed_at END,verified_at=CASE WHEN $3='Verified' THEN NOW() ELSE verified_at END,updated_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *`, [taskId, assignmentId, status, percent, input.dueAt ?? null, input.description ?? null]);
            await this.event(client, assignmentId, "task.updated", acting, input.reason, { taskId, beforeStatus: current.rows[0].status, status, percentComplete: percent });
            return result.rows[0];
        });
    }
    async setTaskDependencies(assignmentId, taskId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        const dependencies = [...new Set(input.dependsOnTaskIds)];
        if (dependencies.includes(taskId))
            throw new Error("A task cannot depend on itself");
        return assignmentsRepository.transaction(async (client) => {
            const task = await client.query("SELECT * FROM assignment_tasks WHERE id=$1 AND assignment_id=$2 FOR UPDATE", [taskId, assignmentId]);
            if (!task.rows[0])
                throw new Error("Task not found");
            if (dependencies.length) {
                const valid = await client.query("SELECT id FROM assignment_tasks WHERE assignment_id=$1 AND id=ANY($2::text[])", [assignmentId, dependencies]);
                if (valid.rowCount !== dependencies.length)
                    throw new Error("Every dependency must belong to this assignment");
                const cycle = await client.query(`WITH RECURSIVE chain(id) AS (SELECT unnest($1::text[]) UNION SELECT d.depends_on_task_id FROM assignment_task_dependencies d JOIN chain c ON c.id=d.task_id) SELECT 1 FROM chain WHERE id=$2 LIMIT 1`, [dependencies, taskId]);
                if (cycle.rows[0])
                    throw new Error("Task dependency would create a cycle");
            }
            const before = (await client.query("SELECT depends_on_task_id FROM assignment_task_dependencies WHERE task_id=$1 ORDER BY depends_on_task_id", [taskId])).rows.map((row) => row.depends_on_task_id);
            await client.query("DELETE FROM assignment_task_dependencies WHERE task_id=$1", [taskId]);
            for (const dependencyId of dependencies)
                await client.query("INSERT INTO assignment_task_dependencies (task_id,depends_on_task_id) VALUES ($1,$2)", [taskId, dependencyId]);
            await this.event(client, assignmentId, "task.dependencies.updated", acting, input.reason, { taskId, before, after: dependencies });
            return (await client.query(`SELECT t.*,COALESCE(jsonb_agg(d.depends_on_task_id) FILTER(WHERE d.depends_on_task_id IS NOT NULL),'[]'::jsonb) AS dependency_ids FROM assignment_tasks t LEFT JOIN assignment_task_dependencies d ON d.task_id=t.id WHERE t.id=$1 GROUP BY t.id`, [taskId])).rows[0];
        });
    }
    async addComment(assignmentId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        if (input.visibility === "internal" && !hasPermission(req.user?.role || "", "reports:assign"))
            throw new Error("Only assignment managers can add internal comments");
        const result = await pgPool.query(`INSERT INTO assignment_comments (id,assignment_id,parent_comment_id,author_id,author_email,author_name,body,visibility,mentions) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb WHERE EXISTS (SELECT 1 FROM report_assignments WHERE id=$2) RETURNING *`, [randomUUID(), assignmentId, input.parentCommentId || null, acting.id, acting.email, acting.name, input.body, input.visibility, JSON.stringify([...new Set(input.mentions)])]);
        if (!result.rows[0])
            throw new Error("Assignment not found");
        if (input.parentCommentId) {
            const parent = await pgPool.query("SELECT 1 FROM assignment_comments WHERE id=$1 AND assignment_id=$2", [input.parentCommentId, assignmentId]);
            if (!parent.rows[0]) {
                await pgPool.query("DELETE FROM assignment_comments WHERE id=$1", [result.rows[0].id]);
                throw new Error("Parent comment does not belong to this assignment");
            }
        }
        const recipients = new Set(input.mentions.map((email) => email.toLowerCase()).filter((email) => email !== acting.email));
        if (input.visibility === "shared") {
            const watchers = await pgPool.query("SELECT email FROM assignment_participants WHERE assignment_id=$1 AND active=TRUE AND role='watcher'", [assignmentId]);
            watchers.rows.forEach((row) => recipients.add(String(row.email).toLowerCase()));
        }
        if (recipients.size)
            await notificationCenterService.enqueue({ eventKey: "assignment.comment", workflow: "assignment", resourceType: "assignment", resourceId: assignmentId, payload: { message: `${acting.name || acting.email} commented on an assignment you follow.`, assignmentId, commentId: result.rows[0].id, visibility: input.visibility }, recipients: [...recipients].map((email) => ({ channel: "in-app", recipient: email })), createdBy: acting.email }).catch(() => undefined);
        return result.rows[0];
    }
    async listComments(assignmentId, req) {
        await this.assertAccess(assignmentId, req);
        const canSeeInternal = hasPermission(req.user?.role || "", "reports:assign");
        const result = await pgPool.query(`SELECT * FROM assignment_comments WHERE assignment_id=$1 AND ($2::boolean OR visibility='shared' OR lower(author_email)=lower($3)) ORDER BY created_at`, [assignmentId, canSeeInternal, req.user?.email || ""]);
        return result.rows;
    }
    async editComment(assignmentId, commentId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        return assignmentsRepository.transaction(async (client) => {
            const current = await client.query("SELECT * FROM assignment_comments WHERE id=$1 AND assignment_id=$2 FOR UPDATE", [commentId, assignmentId]);
            if (!current.rows[0])
                throw new Error("Comment not found");
            const manager = hasPermission(req.user?.role || "", "reports:assign");
            if (!manager && String(current.rows[0].author_email).toLowerCase() !== acting.email)
                throw new Error("Only the author or an assignment manager can edit this comment");
            if (current.rows[0].body === input.body)
                throw new Error("The edited comment is unchanged");
            await client.query(`INSERT INTO assignment_comment_revisions (comment_id,assignment_id,previous_body,new_body,reason,edited_by) VALUES ($1,$2,$3,$4,$5,$6)`, [commentId, assignmentId, current.rows[0].body, input.body, input.reason, acting.email]);
            const updated = await client.query("UPDATE assignment_comments SET body=$3,edited_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *", [commentId, assignmentId, input.body]);
            await this.event(client, assignmentId, "comment.edited", acting, input.reason, { commentId });
            return updated.rows[0];
        });
    }
    async commentRevisions(assignmentId, commentId, req) {
        await this.assertAccess(assignmentId, req);
        const comment = await pgPool.query("SELECT author_email,visibility FROM assignment_comments WHERE id=$1 AND assignment_id=$2", [commentId, assignmentId]);
        if (!comment.rows[0])
            throw new Error("Comment not found");
        if (comment.rows[0].visibility === "internal" && !hasPermission(req.user?.role || "", "reports:assign") && String(comment.rows[0].author_email).toLowerCase() !== String(req.user?.email || "").toLowerCase())
            throw new Error("You cannot view this internal comment history");
        return (await pgPool.query("SELECT * FROM assignment_comment_revisions WHERE comment_id=$1 AND assignment_id=$2 ORDER BY created_at", [commentId, assignmentId])).rows;
    }
    async addEvidence(assignmentId, input, req) {
        await this.assertAccess(assignmentId, req);
        const acting = actor(req);
        const result = await pgPool.query(`INSERT INTO assignment_evidence (id,assignment_id,task_id,file_name,file_url,mime_type,file_size,checksum,description,evidence_type,uploaded_by) SELECT $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11 WHERE EXISTS (SELECT 1 FROM report_assignments WHERE id=$2) AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM assignment_tasks WHERE id=$3 AND assignment_id=$2)) RETURNING *`, [randomUUID(), assignmentId, input.taskId || null, input.fileName, input.fileUrl, input.mimeType || null, input.fileSize || null, input.checksum, input.description || null, input.evidenceType, acting.email]);
        if (!result.rows[0])
            throw new Error("Assignment or task not found");
        return result.rows[0];
    }
    async listEvidence(assignmentId, req) {
        if (req)
            await this.assertAccess(assignmentId, req);
        return (await pgPool.query("SELECT * FROM assignment_evidence WHERE assignment_id=$1 ORDER BY created_at DESC", [assignmentId])).rows;
    }
    async reviewEvidence(assignmentId, evidenceId, input, req) {
        await this.assertAccess(assignmentId, req, true);
        const acting = actor(req);
        const result = await pgPool.query(`UPDATE assignment_evidence SET review_status=$3,review_notes=$4,reviewed_by=$5,reviewed_at=NOW() WHERE id=$1 AND assignment_id=$2 RETURNING *`, [evidenceId, assignmentId, input.status, input.notes || null, acting.email]);
        if (!result.rows[0])
            throw new Error("Evidence not found");
        return result.rows[0];
    }
    async setWatcher(assignmentId, input, active, req) {
        await this.assertAccess(assignmentId, req);
        if (active)
            await pgPool.query(`INSERT INTO assignment_participants (id,assignment_id,email,name,role) VALUES ($1,$2,$3,$4,'watcher') ON CONFLICT (assignment_id,email,role) DO UPDATE SET active=TRUE,name=EXCLUDED.name`, [randomUUID(), assignmentId, input.email, input.name || null]);
        else
            await pgPool.query("UPDATE assignment_participants SET active=FALSE WHERE assignment_id=$1 AND lower(email)=lower($2) AND role='watcher'", [assignmentId, input.email]);
    }
    async event(client, assignmentId, type, acting, reason, metadata = {}) {
        const previous = await client.query("SELECT event_hash FROM assignment_events WHERE assignment_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1", [assignmentId]);
        const previousHash = String(previous.rows[0]?.event_hash || "");
        const id = randomUUID();
        const eventHash = createHash("sha256").update(JSON.stringify({ id, assignmentId, type, actor: acting.email, reason: reason || null, metadata, previousHash })).digest("hex");
        await client.query(`INSERT INTO assignment_events (id,assignment_id,event_type,actor_id,actor_email,actor_name,reason,metadata,previous_hash,event_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`, [id, assignmentId, type, acting.id, acting.email, acting.name, reason || null, JSON.stringify(metadata), previousHash || null, eventHash]);
    }
}
export const assignmentsService = new AssignmentsService();
export function startAssignmentSyncScheduler() {
    const run = async () => {
        try {
            await assignmentsService.processReportAssignmentSync();
            await assignmentsService.processAutoAssignmentRules();
            await assignmentsService.enforceRetention();
        }
        catch (error) {
            console.error("Assignment reconciliation failed", error);
        }
    };
    const initial = setTimeout(() => void run(), 15_000);
    initial.unref();
    const timer = setInterval(() => void run(), 60_000);
    timer.unref();
    return timer;
}
