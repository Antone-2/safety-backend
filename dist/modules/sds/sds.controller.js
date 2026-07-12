import { Router } from "express";
import { SdsService } from "./sds.service.js";
import { SdsRepository } from "./sds.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateSdsSchema, UpdateSdsSchema } from "./sds.types.js";
export function createSdsController(service) {
    return {
        async getAll(req, res) {
            const filters = {};
            const { status, supplier } = req.query;
            if (status)
                filters.status = String(status);
            if (supplier)
                filters.supplier = String(supplier);
            const records = await service.getAll(filters);
            res.json({ data: records });
        },
        async getById(req, res) {
            const sds = await service.getById(String(req.params.id));
            if (!sds)
                throw new NotFoundError("SDS");
            res.json({ data: sds });
        },
        async search(req, res) {
            const results = await service.searchByChemical(String(req.params.chemicalName));
            res.json({ data: results });
        },
        async create(req, res) {
            const data = req.body;
            const sds = await service.create({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "sds.created",
                resourceType: "sds",
                resourceId: sds.id,
                context: { chemicalName: sds.chemicalName, supplier: sds.supplier },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: sds });
        },
        async update(req, res) {
            const before = await service.getById(String(req.params.id));
            if (!before)
                throw new NotFoundError("SDS");
            const sds = await service.update(String(req.params.id), req.body);
            await writeAuditLog({
                action: "sds.updated",
                resourceType: "sds",
                resourceId: String(req.params.id),
                changes: diffRecord(before, sds),
                actor: req.user,
                request: req,
            });
            res.json({ data: sds });
        },
        async delete(req, res) {
            const deleted = await service.delete(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("SDS");
            await writeAuditLog({
                action: "sds.deleted",
                resourceType: "sds",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getStats(req, res) {
            const stats = await service.getStats();
            res.json({ data: stats });
        },
    };
}
export function createSdsRouter() {
    const repository = new SdsRepository(pgPool);
    const service = new SdsService(repository);
    const controller = createSdsController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", rbacMiddleware("sds:read"), controller.getAll);
    router.get("/stats", rbacMiddleware("sds:read"), controller.getStats);
    router.get("/search/:chemicalName", rbacMiddleware("sds:read"), controller.search);
    router.get("/:id", rbacMiddleware("sds:read"), controller.getById);
    router.post("/", rbacMiddleware("sds:create"), validate(CreateSdsSchema), controller.create);
    router.patch("/:id", rbacMiddleware("sds:update"), validate(UpdateSdsSchema), controller.update);
    router.delete("/:id", rbacMiddleware("sds:delete"), controller.delete);
    return router;
}
