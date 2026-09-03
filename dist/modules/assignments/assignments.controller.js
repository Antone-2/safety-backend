import { Router } from "express";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { requirePermission } from "../../shared/middleware/rbac.middleware.js";
import { assignmentsService } from "./assignments.service.js";
import { AssignmentStatusSchema, AssignmentCommentSchema, AssignmentEvidenceReviewSchema, AssignmentEvidenceSchema, AssignmentTaskSchema, AssignmentTaskUpdateSchema, AssignmentTaskDependenciesSchema, AssignmentWatcherSchema, AssignmentTemplateSchema, BulkAssignmentSchema, AssignmentNotificationPreferenceSchema, EscalationPolicySchema, EffectivenessReviewSchema, AssignmentSignatureSchema, AssignmentLegalHoldSchema, AssignmentDeadlineSchema, AssignmentRoutingRuleSchema, AssignmentCommentEditSchema, AssignmentRetentionPolicySchema, AssignmentTransitionSchema, CreateAssignmentSchema, DelegateAssignmentSchema, ReassignAssignmentSchema, } from "./assignments.types.js";
function message(error) { return error instanceof Error ? error.message : "Assignment operation failed"; }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character); }
export function createAssignmentsRouter() {
    const router = Router();
    router.use(authenticateUser);
    router.get("/", requirePermission("reports:read"), async (req, res) => {
        const status = typeof req.query.status === "string" ? AssignmentStatusSchema.safeParse(req.query.status) : null;
        const mine = req.query.mine === "true";
        const data = await assignmentsService.list({
            email: mine ? req.user?.email : typeof req.query.email === "string" ? req.query.email : undefined,
            reportId: typeof req.query.reportId === "string" ? req.query.reportId : undefined,
            status: status?.success ? status.data : undefined,
            site: typeof req.query.site === "string" ? req.query.site : undefined,
            department: typeof req.query.department === "string" ? req.query.department : undefined,
        }, req);
        res.json({ data });
    });
    router.get("/analytics/workload", requirePermission("reports:assign"), async (req, res) => {
        res.json({ data: await assignmentsService.workload(req) });
    });
    router.get("/analytics/dashboard", requirePermission("reports:assign"), async (req, res) => res.json({ data: await assignmentsService.analytics(req) }));
    router.get("/recommendations/:reportId", requirePermission("reports:assign"), async (req, res) => {
        try {
            res.json({ data: await assignmentsService.recommendations(String(req.params.reportId), req) });
        }
        catch (error) {
            res.status(404).json({ error: message(error) });
        }
    });
    router.get("/templates/active", requirePermission("reports:read"), async (_req, res) => res.json({ data: await assignmentsService.listTemplates() }));
    router.post("/templates", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentTemplateSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        res.status(201).json({ data: await assignmentsService.createTemplate(parsed.data, req) });
    });
    router.post("/bulk", requirePermission("reports:assign"), async (req, res) => {
        const parsed = BulkAssignmentSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        const data = await assignmentsService.bulkCreate(parsed.data, req);
        res.status(data.failed ? 207 : 201).json({ data });
    });
    router.get("/preferences/me", async (req, res) => res.json({ data: await assignmentsService.getNotificationPreferences(req) }));
    router.put("/preferences/me", async (req, res) => {
        const parsed = AssignmentNotificationPreferenceSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        res.json({ data: await assignmentsService.updateNotificationPreferences(parsed.data, req) });
    });
    router.get("/escalation-policies/active", requirePermission("reports:assign"), async (_req, res) => res.json({ data: await assignmentsService.listEscalationPolicies() }));
    router.post("/escalation-policies", requirePermission("reports:assign"), async (req, res) => {
        const parsed = EscalationPolicySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        res.status(201).json({ data: await assignmentsService.createEscalationPolicy(parsed.data, req) });
    });
    router.post("/retention-policies", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentRetentionPolicySchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        res.status(201).json({ data: await assignmentsService.createRetentionPolicy(parsed.data, req) });
    });
    router.get("/retention-policies/active", requirePermission("reports:assign"), async (_req, res) => res.json({ data: await assignmentsService.listRetentionPolicies() }));
    router.get("/routing-rules/active", requirePermission("reports:assign"), async (_req, res) => res.json({ data: await assignmentsService.listRoutingRules() }));
    router.post("/routing-rules", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentRoutingRuleSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.createRoutingRule(parsed.data, req) });
        }
        catch (error) {
            res.status(400).json({ error: message(error) });
        }
    });
    router.post("/", requirePermission("reports:assign"), async (req, res) => {
        const parsed = CreateAssignmentSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.create(parsed.data, req) });
        }
        catch (error) {
            res.status(/not found/i.test(message(error)) ? 404 : 400).json({ error: message(error) });
        }
    });
    router.get("/:id", requirePermission("reports:read"), async (req, res) => {
        const data = await assignmentsService.get(String(req.params.id), req);
        if (!data)
            return res.status(404).json({ error: "Assignment not found" });
        res.json({ data });
    });
    router.get("/:id/timeline", requirePermission("reports:read"), async (req, res) => {
        res.json({ data: await assignmentsService.timeline(String(req.params.id), req) });
    });
    router.get("/:id/case-file", async (req, res) => {
        try {
            const data = await assignmentsService.caseFile(String(req.params.id), req);
            const format = typeof req.query.format === "string" ? req.query.format.toLowerCase() : "json";
            if (format === "html") {
                const assignment = data.assignment || {};
                res.setHeader("Content-Disposition", `attachment; filename="${String(assignment.report_id || req.params.id)}-assignment-case-file.html"`);
                return res.type("html").send(`<!doctype html><html><head><meta charset="utf-8"><title>Assignment case file</title><style>body{font:14px system-ui;margin:40px;color:#17202a}h1,h2{color:#17365d}table{border-collapse:collapse;width:100%;margin-bottom:24px}th,td{border:1px solid #ccd3da;padding:8px;text-align:left;vertical-align:top}pre{white-space:pre-wrap}</style></head><body><h1>Assignment ${escapeHtml(assignment.report_id)}</h1><p>Status: ${escapeHtml(assignment.status)} · Generated: ${escapeHtml(data.generatedAt)}</p>${["participants", "tasks", "evidence", "comments", "events", "effectivenessReviews", "signatures", "legalHolds"].map((section) => `<h2>${escapeHtml(section)}</h2><pre>${escapeHtml(JSON.stringify(data[section] || [], null, 2))}</pre>`).join("")}<p>Integrity hash: ${escapeHtml(data.caseFileHash)}</p></body></html>`);
            }
            if (format === "csv") {
                const lines = [["section", "id", "type_or_status", "description", "timestamp"], ...["participants", "tasks", "evidence", "comments", "events", "effectivenessReviews", "signatures", "legalHolds"].flatMap((section) => (Array.isArray(data[section]) ? data[section] : []).map((row) => [section, row.id, row.status || row.event_type || row.role || row.outcome || row.signature_type, row.title || row.file_name || row.body || row.reason || row.notes, row.created_at || row.reviewed_at || row.signed_at || row.placed_at]))].map((row) => row.map(csvCell).join(","));
                res.setHeader("Content-Disposition", `attachment; filename="${String(data.assignment?.report_id || req.params.id)}-assignment-case-file.csv"`);
                return res.type("text/csv").send(lines.join("\n"));
            }
            res.json({ data });
        }
        catch (error) {
            res.status(403).json({ error: message(error) });
        }
    });
    router.get("/:id/effectiveness", requirePermission("reports:read"), async (req, res) => res.json({ data: await assignmentsService.listEffectivenessReviews(String(req.params.id), req) }));
    router.post("/:id/effectiveness", requirePermission("reports:assign"), async (req, res) => {
        const parsed = EffectivenessReviewSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.addEffectivenessReview(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(409).json({ error: message(error) });
        }
    });
    router.post("/:id/signatures", async (req, res) => {
        const parsed = AssignmentSignatureSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.sign(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(409).json({ error: message(error) });
        }
    });
    router.get("/:id/signatures/verify", requirePermission("reports:read"), async (req, res) => {
        try {
            res.json({ data: await assignmentsService.verifySignatures(String(req.params.id), req) });
        }
        catch (error) {
            res.status(400).json({ error: message(error) });
        }
    });
    router.get("/:id/audit-chain/verify", requirePermission("reports:read"), async (req, res) => {
        try {
            res.json({ data: await assignmentsService.verifyAuditChain(String(req.params.id), req) });
        }
        catch (error) {
            res.status(400).json({ error: message(error) });
        }
    });
    router.post("/:id/legal-holds", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentLegalHoldSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        res.status(201).json({ data: await assignmentsService.placeLegalHold(String(req.params.id), parsed.data.reason, req) });
    });
    router.get("/:id/legal-holds", requirePermission("reports:read"), async (req, res) => {
        try {
            res.json({ data: await assignmentsService.listLegalHolds(String(req.params.id), req) });
        }
        catch (error) {
            res.status(403).json({ error: message(error) });
        }
    });
    router.post("/:id/legal-holds/:holdId/release", requirePermission("reports:assign"), async (req, res) => {
        try {
            res.json({ data: await assignmentsService.releaseLegalHold(String(req.params.id), String(req.params.holdId), req) });
        }
        catch (error) {
            res.status(404).json({ error: message(error) });
        }
    });
    router.patch("/:id/deadlines", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentDeadlineSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.updateDeadlines(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(409).json({ error: message(error) });
        }
    });
    router.post("/:id/transition", async (req, res) => {
        const parsed = AssignmentTransitionSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.transition(String(req.params.id), parsed.data.event, parsed.data.reason, parsed.data.expectedVersion, req) });
        }
        catch (error) {
            res.status(/not found/i.test(message(error)) ? 404 : 409).json({ error: message(error) });
        }
    });
    router.post("/:id/reassign", requirePermission("reports:assign"), async (req, res) => {
        const parsed = ReassignAssignmentSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.reassign(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(/not found/i.test(message(error)) ? 404 : 409).json({ error: message(error) });
        }
    });
    router.post("/:id/delegate", async (req, res) => {
        const parsed = DelegateAssignmentSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.delegate(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(/not found/i.test(message(error)) ? 404 : 403).json({ error: message(error) });
        }
    });
    router.get("/:id/tasks", requirePermission("reports:read"), async (req, res) => res.json({ data: await assignmentsService.listTasks(String(req.params.id), req) }));
    router.post("/:id/tasks", async (req, res) => {
        const parsed = AssignmentTaskSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.addTask(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(400).json({ error: message(error) });
        }
    });
    router.patch("/:id/tasks/:taskId", async (req, res) => {
        const parsed = AssignmentTaskUpdateSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.updateTask(String(req.params.id), String(req.params.taskId), parsed.data, req) });
        }
        catch (error) {
            res.status(409).json({ error: message(error) });
        }
    });
    router.put("/:id/tasks/:taskId/dependencies", async (req, res) => {
        const parsed = AssignmentTaskDependenciesSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.setTaskDependencies(String(req.params.id), String(req.params.taskId), parsed.data, req) });
        }
        catch (error) {
            res.status(409).json({ error: message(error) });
        }
    });
    router.get("/:id/comments", async (req, res) => res.json({ data: await assignmentsService.listComments(String(req.params.id), req) }));
    router.post("/:id/comments", async (req, res) => {
        const parsed = AssignmentCommentSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.addComment(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(403).json({ error: message(error) });
        }
    });
    router.patch("/:id/comments/:commentId", async (req, res) => {
        const parsed = AssignmentCommentEditSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.editComment(String(req.params.id), String(req.params.commentId), parsed.data, req) });
        }
        catch (error) {
            res.status(403).json({ error: message(error) });
        }
    });
    router.get("/:id/comments/:commentId/revisions", async (req, res) => {
        try {
            res.json({ data: await assignmentsService.commentRevisions(String(req.params.id), String(req.params.commentId), req) });
        }
        catch (error) {
            res.status(403).json({ error: message(error) });
        }
    });
    router.get("/:id/evidence", requirePermission("reports:read"), async (req, res) => res.json({ data: await assignmentsService.listEvidence(String(req.params.id), req) }));
    router.post("/:id/evidence", async (req, res) => {
        const parsed = AssignmentEvidenceSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.status(201).json({ data: await assignmentsService.addEvidence(String(req.params.id), parsed.data, req) });
        }
        catch (error) {
            res.status(400).json({ error: message(error) });
        }
    });
    router.patch("/:id/evidence/:evidenceId/review", requirePermission("reports:assign"), async (req, res) => {
        const parsed = AssignmentEvidenceReviewSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        try {
            res.json({ data: await assignmentsService.reviewEvidence(String(req.params.id), String(req.params.evidenceId), parsed.data, req) });
        }
        catch (error) {
            res.status(404).json({ error: message(error) });
        }
    });
    router.put("/:id/watchers", async (req, res) => {
        const parsed = AssignmentWatcherSchema.safeParse(req.body);
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        await assignmentsService.setWatcher(String(req.params.id), parsed.data, true, req);
        res.status(204).end();
    });
    router.delete("/:id/watchers/:email", async (req, res) => {
        const parsed = AssignmentWatcherSchema.safeParse({ email: req.params.email });
        if (!parsed.success)
            return res.status(400).json({ error: parsed.error.errors });
        await assignmentsService.setWatcher(String(req.params.id), parsed.data, false, req);
        res.status(204).end();
    });
    return router;
}
