import { Router, type Response } from "express";
import { StatutoryAuditService } from "./statutory-audits.service.js";
import { StatutoryAuditRepository } from "./statutory-audits.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";

export function createStatutoryAuditController(service: StatutoryAuditService) {
  return {
    async getMatrix(req: AuthRequest, res: Response) {
      const filters: { locationCategory?: string; search?: string } = {};
      if (req.query.locationCategory) {
        filters.locationCategory = String(req.query.locationCategory);
      }
      if (req.query.search) {
        filters.search = String(req.query.search);
      }
      const matrix = await service.getMatrix(filters);
      res.json({ data: matrix });
    },
  };
}

export function createStatutoryAuditRouter() {
  const repository = new StatutoryAuditRepository(pgPool);
  const service = new StatutoryAuditService(repository);
  const controller = createStatutoryAuditController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/matrix", rbacMiddleware("compliance:read"), controller.getMatrix);

  return router;
}

