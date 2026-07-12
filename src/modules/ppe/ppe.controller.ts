import { Router, type Response } from "express";
import { z } from "zod";
import { PpeService } from "./ppe.service.js";
import { PpeRepository } from "./ppe.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreatePpeSchema, UpdatePpeSchema } from "./ppe.types.js";

export function createPpeController(service: PpeService) {
  return {
    async getAll(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { type, site, assignedTo } = req.query;
      if (type) filters.type = String(type);
      if (site) filters.site = String(site);
      if (assignedTo) filters.assignedTo = String(assignedTo);
      const records = await service.getAll(filters);
      res.json({ data: records });
    },

    async getById(req: AuthRequest, res: Response) {
      const record = await service.getById(String(req.params.id));
      if (!record) throw new NotFoundError("PPE record");
      res.json({ data: record });
    },

    async create(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreatePpeSchema>;
      const record = await service.create({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "ppe.created",
        resourceType: "ppe",
        resourceId: record.id,
        context: { type: record.type, site: record.site },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: record });
    },

    async update(req: AuthRequest, res: Response) {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("PPE record");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "ppe.updated",
        resourceType: "ppe",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: record });
    },

    async delete(req: AuthRequest, res: Response) {
      const deleted = await service.delete(String(req.params.id));
      if (!deleted) throw new NotFoundError("PPE record");
      await writeAuditLog({
        action: "ppe.deleted",
        resourceType: "ppe",
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

export function createPpeRouter() {
  const repository = new PpeRepository(pgPool);
  const service = new PpeService(repository);
  const controller = createPpeController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("ppe:read"), controller.getAll);
  router.get("/stats", rbacMiddleware("ppe:read"), controller.getStats);
  router.get("/:id", rbacMiddleware("ppe:read"), controller.getById);
  router.post("/", rbacMiddleware("ppe:create"), validate(CreatePpeSchema), controller.create);
  router.patch("/:id", rbacMiddleware("ppe:update"), validate(UpdatePpeSchema), controller.update);
  router.delete("/:id", rbacMiddleware("ppe:delete"), controller.delete);

  return router;
}
