import { Router } from "express";
import { PermitsService } from "./permits.service.js";
import { PermitsRepository } from "./permits.repository.js";
import { authenticateUser, } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreatePermitInputSchema, UpdatePermitInputSchema, AdvancePermitStatusSchema, } from "./permits.types.js";
export function createPermitsController(service) {
    return {
        async getAll(req, res) {
            const filters = {};
            const { type, status, location } = req.query;
            if (type)
                filters.type = String(type);
            if (status)
                filters.status = String(status);
            if (location)
                filters.location = String(location);
            const permits = await service.getPermits(filters);
            res.json({ data: permits });
        },
        async getById(req, res) {
            const permit = await service.getPermitById(String(req.params.id));
            if (!permit)
                throw new NotFoundError("Permit");
            res.json({ data: permit });
        },
        async create(req, res) {
            const data = req.body;
            const permit = await service.createPermit({
                ...data,
                createdBy: req.user?.name || "System",
            });
            await writeAuditLog({
                action: "permits.created",
                resourceType: "permit",
                resourceId: permit.id,
                context: { type: permit.type, location: permit.location },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: permit });
        },
        async update(req, res) {
            const before = await service.getPermitById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Permit");
            const permit = await service.updatePermit(String(req.params.id), req.body);
            await writeAuditLog({
                action: "permits.updated",
                resourceType: "permit",
                resourceId: String(req.params.id),
                changes: diffRecord(before, permit),
                actor: req.user,
                request: req,
            });
            res.json({ data: permit });
        },
        async advanceStatus(req, res) {
            const permit = await service.getPermitById(String(req.params.id));
            if (!permit)
                throw new NotFoundError("Permit");
            const event = AdvancePermitStatusSchema.parse(req.body).status;
            const updated = await service.advanceStatus(String(req.params.id), event);
            if (!updated)
                throw new NotFoundError("Permit");
            await writeAuditLog({
                action: "permits.status_advanced",
                resourceType: "permit",
                resourceId: updated.id,
                context: { event },
                actor: req.user,
                request: req,
            });
            res.json({ data: updated });
        },
        async getActive(req, res) {
            const permits = await service.getActivePermits();
            res.json({ data: permits });
        },
        async getExpired(req, res) {
            const permits = await service.getExpiredPermits();
            res.json({ data: permits });
        },
    };
}
export function createPermitsRouter() {
    const repository = new PermitsRepository(pgPool);
    const service = new PermitsService(repository);
    const controller = createPermitsController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", rbacMiddleware("permits:read"), controller.getAll);
    router.get("/active/list", rbacMiddleware("permits:read"), controller.getActive);
    router.get("/expired/list", rbacMiddleware("permits:read"), controller.getExpired);
    router.get("/:id", rbacMiddleware("permits:read"), controller.getById);
    router.post("/", rbacMiddleware("permits:create"), validate(CreatePermitInputSchema), controller.create);
    router.patch("/:id", rbacMiddleware("permits:update"), validate(UpdatePermitInputSchema), controller.update);
    router.post("/:id/advance", rbacMiddleware("permits:approve"), controller.advanceStatus);
    return router;
}
