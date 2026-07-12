import { Router } from "express";
import { HealthService } from "./health.service.js";
import { HealthRepository } from "./health.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateHealthRecordSchema, UpdateHealthRecordSchema } from "./health.types.js";
export function createHealthController(service) {
    return {
        async getRecords(req, res) {
            const filters = {};
            const { employeeId, type, site } = req.query;
            if (employeeId)
                filters.employeeId = String(employeeId);
            if (type)
                filters.type = String(type);
            if (site)
                filters.site = String(site);
            const records = await service.getRecords(filters);
            res.json({ data: records });
        },
        async getById(req, res) {
            const record = await service.getRecordById(String(req.params.id));
            if (!record)
                throw new NotFoundError("Health record");
            res.json({ data: record });
        },
        async create(req, res) {
            const data = req.body;
            const record = await service.createRecord({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "health.record.created",
                resourceType: "health_record",
                resourceId: record.id,
                context: { employeeId: record.employeeId, type: record.type },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: record });
        },
        async update(req, res) {
            const before = await service.getRecordById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Health record");
            const record = await service.updateRecord(String(req.params.id), req.body);
            await writeAuditLog({
                action: "health.record.updated",
                resourceType: "health_record",
                resourceId: String(req.params.id),
                changes: diffRecord(before, record),
                actor: req.user,
                request: req,
            });
            res.json({ data: record });
        },
        async delete(req, res) {
            const deleted = await service.deleteRecord(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Health record");
            await writeAuditLog({
                action: "health.record.deleted",
                resourceType: "health_record",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getExpiring(req, res) {
            const daysBefore = parseInt(String(req.query.days)) || 30;
            const records = await service.getExpiringSurveillances(daysBefore);
            res.json({ data: records });
        },
        async getStats(req, res) {
            const stats = await service.getHealthStats();
            res.json({ data: stats });
        },
    };
}
export function createHealthRouter() {
    const repository = new HealthRepository(pgPool);
    const service = new HealthService(repository);
    const controller = createHealthController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/records", rbacMiddleware("health:read"), controller.getRecords);
    router.get("/stats", rbacMiddleware("health:read"), controller.getStats);
    router.get("/expiring", rbacMiddleware("health:read"), controller.getExpiring);
    router.get("/:id", rbacMiddleware("health:read"), controller.getById);
    router.post("/records", rbacMiddleware("health:create"), validate(CreateHealthRecordSchema), controller.create);
    router.patch("/:id", rbacMiddleware("health:update"), validate(UpdateHealthRecordSchema), controller.update);
    router.delete("/:id", rbacMiddleware("health:delete"), controller.delete);
    return router;
}
