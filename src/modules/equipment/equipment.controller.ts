import { Router, type Response } from "express";
import { z } from "zod";
import { EquipmentService } from "./equipment.service.js";
import { EquipmentRepository } from "./equipment.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import {
  CreateEquipmentSchema,
  UpdateEquipmentSchema,
  CreateEquipmentInspectionSchema,
} from "./equipment.types.js";

export function createEquipmentController(service: EquipmentService) {
  return {
    async getAll(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { type, location, status, site } = req.query;
      if (type) filters.type = String(type);
      if (location) filters.location = String(location);
      if (status) filters.status = String(status);
      if (site) filters.site = String(site);
      const equipment = await service.getEquipment(filters);
      res.json({ data: equipment });
    },

    async getById(req: AuthRequest, res: Response) {
      const item = await service.getEquipmentById(String(req.params.id));
      if (!item) throw new NotFoundError("Equipment");
      res.json({ data: item });
    },

    async create(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateEquipmentSchema>;
      const equipment = await service.createEquipment({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "equipment.created",
        resourceType: "equipment",
        resourceId: equipment.id,
        context: { name: equipment.name, assetTag: equipment.assetTag },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: equipment });
    },

    async update(req: AuthRequest, res: Response) {
      const before = await service.getEquipmentById(String(req.params.id));
      if (!before) throw new NotFoundError("Equipment");
      const equipment = await service.updateEquipment(String(req.params.id), req.body);
      await writeAuditLog({
        action: "equipment.updated",
        resourceType: "equipment",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, equipment as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: equipment });
    },

    async delete(req: AuthRequest, res: Response) {
      const deleted = await service.deleteEquipment(String(req.params.id));
      if (!deleted) throw new NotFoundError("Equipment");
      await writeAuditLog({
        action: "equipment.deleted",
        resourceType: "equipment",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getInspections(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { equipmentId } = req.query;
      if (equipmentId) filters.equipmentId = String(equipmentId);
      const inspections = await service.getInspections(filters);
      res.json({ data: inspections });
    },

    async createInspection(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateEquipmentInspectionSchema>;
      const inspection = await service.createInspection({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "equipment.inspection_created",
        resourceType: "equipment_inspection",
        resourceId: inspection.id,
        context: { equipmentId: inspection.equipmentId, passed: inspection.passed },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: inspection });
    },

    async getOverdue(req: AuthRequest, res: Response) {
      const overdue = await service.getOverdueInspections();
      res.json({ data: overdue });
    },

    async getStats(req: AuthRequest, res: Response) {
      const stats = await service.getEquipmentStats();
      res.json({ data: stats });
    },
  };
}

export function createEquipmentRouter() {
  const repository = new EquipmentRepository(pgPool);
  const service = new EquipmentService(repository);
  const controller = createEquipmentController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("equipment:read"), controller.getAll);
  router.get("/stats", rbacMiddleware("equipment:read"), controller.getStats);
  router.get("/overdue", rbacMiddleware("equipment:read"), controller.getOverdue);
  router.get("/inspections", rbacMiddleware("equipment:read"), controller.getInspections);
  router.get("/:id", rbacMiddleware("equipment:read"), controller.getById);
  router.post("/", rbacMiddleware("equipment:create"), validate(CreateEquipmentSchema), controller.create);
  router.patch("/:id", rbacMiddleware("equipment:update"), validate(UpdateEquipmentSchema), controller.update);
  router.delete("/:id", rbacMiddleware("equipment:delete"), controller.delete);

  router.post("/inspections", rbacMiddleware("equipment:create"), validate(CreateEquipmentInspectionSchema), controller.createInspection);

  return router;
}
