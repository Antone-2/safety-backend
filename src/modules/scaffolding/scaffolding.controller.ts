import { Router, type Response } from "express";
import { z } from "zod";
import { ScaffoldService } from "./scaffolding.service.js";
import { ScaffoldRepository } from "./scaffolding.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateScaffoldSchema, UpdateScaffoldSchema } from "./scaffolding.types.js";

export function createScaffoldController(service: ScaffoldService) {
  return {
    async getAll(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { status, location, building, type } = req.query;
      if (status) filters.status = String(status);
      if (location) filters.location = String(location);
      if (building) filters.building = String(building);
      if (type) filters.type = String(type);
      const records = await service.getAll(filters);
      res.json({ data: records });
    },

    async getById(req: AuthRequest, res: Response) {
      const record = await service.getById(String(req.params.id));
      if (!record) throw new NotFoundError("Scaffold");
      res.json({ data: record });
    },

    async create(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateScaffoldSchema>;
      const record = await service.create({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "scaffolding.created",
        resourceType: "scaffolding",
        resourceId: record.id,
        context: { scaffoldNo: record.scaffoldNo, location: record.location, building: record.building },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: record });
    },

    async update(req: AuthRequest, res: Response) {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("Scaffold");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "scaffolding.updated",
        resourceType: "scaffolding",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: record });
    },

    async delete(req: AuthRequest, res: Response) {
      const deleted = await service.delete(String(req.params.id));
      if (!deleted) throw new NotFoundError("Scaffold");
      await writeAuditLog({
        action: "scaffolding.deleted",
        resourceType: "scaffolding",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getStats(req: AuthRequest, res: Response) {
      const stats = await service.getStats();
      res.json({ data: stats });
    },
  };
}

export function createScaffoldRouter() {
  const repository = new ScaffoldRepository(pgPool);
  const service = new ScaffoldService(repository);
  const controller = createScaffoldController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("scaffolding:read"), controller.getAll);
  router.get("/stats", rbacMiddleware("scaffolding:read"), controller.getStats);
  router.get("/:id", rbacMiddleware("scaffolding:read"), controller.getById);
  router.post("/", rbacMiddleware("scaffolding:create"), validate(CreateScaffoldSchema), controller.create);
  router.patch("/:id", rbacMiddleware("scaffolding:update"), validate(UpdateScaffoldSchema), controller.update);
  router.delete("/:id", rbacMiddleware("scaffolding:delete"), controller.delete);

  return router;
}
