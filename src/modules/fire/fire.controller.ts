import { Router, type Response } from "express";
import { z } from "zod";
import { FireService } from "./fire.service.js";
import { FireRepository } from "./fire.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateFireEquipmentSchema, UpdateFireEquipmentSchema, CreateFireInspectionSchema } from "./fire.types.js";

export function createFireController(service: FireService) {
  return {
    async getEquipment(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { type, location, status } = req.query;
      if (type) filters.type = String(type);
      if (location) filters.location = String(location);
      if (status) filters.status = String(status);
      const equipment = await service.getEquipment(filters);
      res.json({ data: equipment });
    },

    async getEquipmentById(req: AuthRequest, res: Response) {
      const equipment = await service.getEquipmentById(String(req.params.id));
      if (!equipment) throw new NotFoundError("Fire equipment");
      res.json({ data: equipment });
    },

    async createEquipment(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateFireEquipmentSchema>;
      const equipment = await service.createEquipment({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "fire.equipment.created",
        resourceType: "fire_equipment",
        resourceId: equipment.id,
        context: { type: equipment.type, location: equipment.location },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: equipment });
    },

    async updateEquipment(req: AuthRequest, res: Response) {
      const before = await service.getEquipmentById(String(req.params.id));
      if (!before) throw new NotFoundError("Fire equipment");
      const equipment = await service.updateEquipment(String(req.params.id), req.body);
      await writeAuditLog({
        action: "fire.equipment.updated",
        resourceType: "fire_equipment",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, equipment as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: equipment });
    },

    async deleteEquipment(req: AuthRequest, res: Response) {
      const deleted = await service.deleteEquipment(String(req.params.id));
      if (!deleted) throw new NotFoundError("Fire equipment");
      await writeAuditLog({
        action: "fire.equipment.deleted",
        resourceType: "fire_equipment",
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
      const data = req.body as z.infer<typeof CreateFireInspectionSchema>;
      const inspection = await service.createInspection({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "fire.inspection.created",
        resourceType: "fire_inspection",
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
      const stats = await service.getFireStats();
      res.json({ data: stats });
    },
  };
}

export function createFireRouter() {
  const repository = new FireRepository(pgPool);
  const service = new FireService(repository);
  const controller = createFireController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/equipment", rbacMiddleware("fire:read"), controller.getEquipment);
  router.get("/equipment/:id", rbacMiddleware("fire:read"), controller.getEquipmentById);
  router.post("/equipment", rbacMiddleware("fire:create"), validate(CreateFireEquipmentSchema), controller.createEquipment);
  router.patch("/equipment/:id", rbacMiddleware("fire:update"), validate(UpdateFireEquipmentSchema), controller.updateEquipment);
  router.delete("/equipment/:id", rbacMiddleware("fire:delete"), controller.deleteEquipment);

  router.get("/inspections", rbacMiddleware("fire:read"), controller.getInspections);
  router.post("/inspections", rbacMiddleware("fire:create"), validate(CreateFireInspectionSchema), controller.createInspection);

  router.get("/overdue", rbacMiddleware("fire:read"), controller.getOverdue);
  router.get("/stats", rbacMiddleware("fire:read"), controller.getStats);

  return router;
}
