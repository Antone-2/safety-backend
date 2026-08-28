import { Router } from "express";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { SafetyAlertsRepository } from "./safety-alerts.repository.js";
import { SafetyAlertsService } from "./safety-alerts.service.js";
import { AcknowledgeSafetyAlertSchema, CreateSafetyAlertSchema, UpdateSafetyAlertSchema, } from "./safety-alerts.types.js";
export function createSafetyAlertsRouter() {
    const repository = new SafetyAlertsRepository(pgPool);
    const service = new SafetyAlertsService(repository);
    const router = Router();
    router.use(authenticateUser);
    router.get("/stats", rbacMiddleware("safety-alerts:read"), async (_req, res) => {
        res.json({ data: await service.getStats() });
    });
    router.get("/pending-acknowledgements", rbacMiddleware("safety-alerts:read"), async (req, res) => {
        res.json({ data: await service.getPendingAcknowledgements(String(req.user?.id || "")) });
    });
    router.get("/", rbacMiddleware("safety-alerts:read"), async (req, res) => {
        const filters = {};
        const { category, severity, status } = req.query;
        if (category)
            filters.category = String(category);
        if (severity)
            filters.severity = String(severity);
        if (status)
            filters.status = String(status);
        res.json({ data: await service.getAlerts(filters) });
    });
    router.get("/:id", rbacMiddleware("safety-alerts:read"), async (req, res) => {
        const record = await service.getById(String(req.params.id));
        if (!record)
            throw new NotFoundError("Safety alert");
        res.json({ data: record });
    });
    router.get("/:id/acknowledgements", rbacMiddleware("safety-alerts:read"), async (req, res) => {
        res.json({ data: await service.getAcknowledgements(String(req.params.id)) });
    });
    router.post("/", rbacMiddleware("safety-alerts:create"), validate(CreateSafetyAlertSchema), async (req, res) => {
        const data = req.body;
        const record = await service.create({
            ...data,
            createdBy: req.user?.name || req.user?.email || "System",
        });
        await writeAuditLog({
            action: "safety-alerts.created",
            resourceType: "safety_alert",
            resourceId: record.id,
            actor: req.user,
            request: req,
            context: { alertNo: record.alertNo, category: record.category, status: record.status },
        });
        res.status(201).json({ data: record });
    });
    router.post("/:id/acknowledge", rbacMiddleware("safety-alerts:read"), validate(AcknowledgeSafetyAlertSchema), async (req, res) => {
        const acknowledgement = await service.acknowledge(String(req.params.id), req.body);
        await writeAuditLog({
            action: "safety-alerts.acknowledged",
            resourceType: "safety_alert",
            resourceId: String(req.params.id),
            actor: req.user,
            request: req,
        });
        res.status(201).json({ data: acknowledgement });
    });
    router.patch("/:id", rbacMiddleware("safety-alerts:update"), validate(UpdateSafetyAlertSchema), async (req, res) => {
        const before = await service.getById(String(req.params.id));
        if (!before)
            throw new NotFoundError("Safety alert");
        const record = await service.update(String(req.params.id), req.body);
        await writeAuditLog({
            action: "safety-alerts.updated",
            resourceType: "safety_alert",
            resourceId: String(req.params.id),
            actor: req.user,
            request: req,
            changes: diffRecord(before, record),
        });
        res.json({ data: record });
    });
    router.delete("/:id", rbacMiddleware("safety-alerts:delete"), async (req, res) => {
        await service.delete(String(req.params.id));
        await writeAuditLog({
            action: "safety-alerts.deleted",
            resourceType: "safety_alert",
            resourceId: String(req.params.id),
            actor: req.user,
            request: req,
        });
        res.json({ data: { ok: true, deleted: String(req.params.id) } });
    });
    return router;
}
