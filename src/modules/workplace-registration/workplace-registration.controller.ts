import { Router, type Response } from "express";
import { z } from "zod";
import { WorkplaceRegistrationService } from "./workplace-registration.service.js";
import { WorkplaceRegistrationRepository } from "./workplace-registration.repository.js";
import {
  CreateWorkplaceRegistrationSchema,
  UpdateWorkplaceRegistrationSchema,
} from "./workplace-registration.types.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";

export function createWorkplaceRegistrationController(service: WorkplaceRegistrationService) {
  return {
    async getRegistrations(_req: AuthRequest, res: Response) {
      const registrations = await service.getRegistrations();
      res.json({ data: registrations });
    },

    async getRegistrationById(req: AuthRequest, res: Response) {
      const registration = await service.getRegistrationById(String(req.params.id));
      if (!registration) throw new NotFoundError("Workplace registration");
      res.json({ data: registration });
    },

    async getStats(_req: AuthRequest, res: Response) {
      const stats = await service.getStats();
      res.json({ data: stats });
    },

    async createRegistration(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateWorkplaceRegistrationSchema>;
      const registration = await service.createRegistration(data);
      await writeAuditLog({
        action: "workplace-registration.created",
        resourceType: "workplace_registration",
        resourceId: registration.id,
        context: { location: registration.location },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: registration });
    },

    async updateRegistration(req: AuthRequest, res: Response) {
      const before = await service.getRegistrationById(String(req.params.id));
      if (!before) throw new NotFoundError("Workplace registration");
      const registration = await service.updateRegistration(
        String(req.params.id),
        req.body as z.infer<typeof UpdateWorkplaceRegistrationSchema>,
      );
      if (!registration) throw new NotFoundError("Workplace registration");
      await writeAuditLog({
        action: "workplace-registration.updated",
        resourceType: "workplace_registration",
        resourceId: registration.id,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          registration as unknown as Record<string, unknown>,
        ),
        actor: req.user,
        request: req,
      });
      res.json({ data: registration });
    },

    async deleteRegistration(req: AuthRequest, res: Response) {
      const before = await service.getRegistrationById(String(req.params.id));
      if (!before) throw new NotFoundError("Workplace registration");
      const deleted = await service.deleteRegistration(String(req.params.id));
      if (!deleted) throw new NotFoundError("Workplace registration");
      await writeAuditLog({
        action: "workplace-registration.deleted",
        resourceType: "workplace_registration",
        resourceId: String(req.params.id),
        context: { location: before.location },
        actor: req.user,
        request: req,
      });
      res.json({ data: { success: true } });
    },
  };
}

export function createWorkplaceRegistrationRouter() {
  const repository = new WorkplaceRegistrationRepository(pgPool);
  const service = new WorkplaceRegistrationService(repository);
  const controller = createWorkplaceRegistrationController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("workplace-registration:read"), controller.getRegistrations);
  router.get("/stats", rbacMiddleware("workplace-registration:read"), controller.getStats);
  router.get("/:id", rbacMiddleware("workplace-registration:read"), controller.getRegistrationById);
  router.post("/", rbacMiddleware("workplace-registration:create"), validate(CreateWorkplaceRegistrationSchema), controller.createRegistration);
  router.patch("/:id", rbacMiddleware("workplace-registration:update"), validate(UpdateWorkplaceRegistrationSchema), controller.updateRegistration);
  router.delete("/:id", rbacMiddleware("workplace-registration:delete"), controller.deleteRegistration);

  return router;
}

