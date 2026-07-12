import { Router, type Response } from "express";
import { z } from "zod";
import { HeightWorkService } from "./heightwork.service.js";
import { HeightWorkRepository } from "./heightwork.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateHeightWorkSchema, UpdateHeightWorkSchema } from "./heightwork.types.js";

export function createHeightWorkController(service: HeightWorkService) {
  return {
    async getAll(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { status, location, building } = req.query;
      if (status) filters.status = String(status);
      if (location) filters.location = String(location);
      if (building) filters.building = String(building);
      const records = await service.getAll(filters);
      res.json({ data: records });
    },

    async getById(req: AuthRequest, res: Response) {
      const record = await service.getById(String(req.params.id));
      if (!record) throw new NotFoundError("Height work record");
      res.json({ data: record });
    },

    async create(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateHeightWorkSchema>;
      const record = await service.create({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "heightwork.created",
        resourceType: "height_work",
        resourceId: record.id,
        context: { location: record.location, height: record.height },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: record });
    },

    async update(req: AuthRequest, res: Response) {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("Height work record");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "heightwork.updated",
        resourceType: "height_work",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: record });
    },

    async delete(req: AuthRequest, res: Response) {
      const deleted = await service.delete(String(req.params.id));
      if (!deleted) throw new NotFoundError("Height work record");
      await writeAuditLog({
        action: "heightwork.deleted",
        resourceType: "height_work",
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

export function createHeightWorkRouter() {
  const repository = new HeightWorkRepository(pgPool);
  const service = new HeightWorkService(repository);
  const controller = createHeightWorkController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("heightwork:read"), controller.getAll);
  router.get("/stats", rbacMiddleware("heightwork:read"), controller.getStats);
  router.get("/:id", rbacMiddleware("heightwork:read"), controller.getById);
  router.post("/", rbacMiddleware("heightwork:create"), validate(CreateHeightWorkSchema), controller.create);
  router.patch("/:id", rbacMiddleware("heightwork:update"), validate(UpdateHeightWorkSchema), controller.update);
  router.delete("/:id", rbacMiddleware("heightwork:delete"), controller.delete);

  return router;
}
