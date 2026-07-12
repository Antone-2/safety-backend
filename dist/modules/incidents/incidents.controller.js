import { Router } from "express";
import { z } from "zod";
import { IncidentsService } from "./incidents.service.js";
import { IncidentsRepository } from "./incidents.repository.js";
import { authenticateUser, requireRole } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { IncidentInputSchema } from "./incidents.types.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { ROLE_PERMISSIONS } from "../../shared/middleware/rbac.middleware.js";
import { INCIDENT_WORKFLOW, WorkflowEngine } from "../../shared/workflow/workflow.engine.js";
const createIncidentSchema = IncidentInputSchema;
export function createIncidentsController(service) {
    return {
        async getAll(req, res) {
            const filters = {};
            if (String(req.query.status))
                filters.status = String(req.query.status);
            if (String(req.query.severity))
                filters.severity = String(req.query.severity);
            if (String(req.query.location))
                filters.location = String(req.query.location);
            if (String(req.query.department))
                filters.department = String(req.query.department);
            const incidents = await service.getAll(filters);
            res.json({ data: incidents });
        },
        async getById(req, res) {
            const incident = await service.getById(String(req.params.id));
            if (!incident)
                throw new NotFoundError("Incident");
            res.json({ data: incident });
        },
        async create(req, res) {
            const data = req.body;
            const incident = await service.create(data);
            await writeAuditLog({
                action: "incident.created",
                resourceType: "incident",
                resourceId: incident.id,
                context: { severity: incident.severity, location: incident.location },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: incident });
        },
        async update(req, res) {
            const before = await service.getById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Incident");
            const incident = await service.update(String(req.params.id), req.body);
            if (incident) {
                await writeAuditLog({
                    action: "incident.updated",
                    resourceType: "incident",
                    resourceId: incident.id,
                    changes: diffRecord(before, incident),
                    actor: req.user,
                    request: req,
                });
            }
            res.json({ data: incident });
        },
        async delete(req, res) {
            const deleted = await service.delete(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Incident");
            await writeAuditLog({
                action: "incident.deleted",
                resourceType: "incident",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async transition(req, res) {
            const incident = await service.getById(String(req.params.id));
            if (!incident)
                throw new NotFoundError("Incident");
            const event = z.string().min(1).parse(req.body?.event);
            const workflow = new WorkflowEngine(INCIDENT_WORKFLOW);
            const permissions = ROLE_PERMISSIONS[req.user?.role ?? ""] ?? [];
            const nextStatus = workflow.transition(incident.status, event, {
                id: req.user?.id,
                role: req.user?.role ?? "",
                permissions,
            });
            const updated = await service.update(String(req.params.id), { status: nextStatus });
            if (!updated)
                throw new NotFoundError("Incident");
            await writeAuditLog({
                action: "incident.workflow.transitioned",
                resourceType: "incident",
                resourceId: updated.id,
                changes: [{ field: "status", before: incident.status, after: updated.status }],
                context: { event, workflow: workflow.name },
                actor: req.user,
                request: req,
            });
            res.json({ data: updated });
        },
        async getStats(req, res) {
            const stats = await service.getStats();
            res.json({ data: stats });
        },
        async getOverdue(req, res) {
            const overdue = await service.getOverdue();
            res.json({ data: overdue });
        },
    };
}
export function createIncidentsRouter() {
    const repository = new IncidentsRepository(pgPool);
    const service = new IncidentsService(repository);
    const controller = createIncidentsController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", controller.getAll);
    router.get("/stats/summary", controller.getStats);
    router.get("/overdue/list", controller.getOverdue);
    router.get("/:id", controller.getById);
    router.post("/", requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin", "supervisor"]), validate(createIncidentSchema), controller.create);
    router.post("/:id/transition", requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager"]), controller.transition);
    router.patch("/:id", requireRole(["super-admin", "EHS-manager", "hse-officer", "plant-manager", "factory-manager", "depot-admin"]), controller.update);
    router.delete("/:id", requireRole(["super-admin", "EHS-manager"]), controller.delete);
    return router;
}
