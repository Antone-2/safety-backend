import { Router, type Response } from "express";
import { z } from "zod";
import { StatutoryAuditService } from "./statutory-audits.service.js";
import { StatutoryAuditRepository } from "./statutory-audits.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import {
  DeleteStatutoryAuditLocationSchema,
  UpsertStatutoryAuditRecordSchema,
} from "./statutory-audits.types.js";

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

    async upsertRecord(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof UpsertStatutoryAuditRecordSchema>;
      const beforeMatrix = await service.getMatrix({
        locationCategory: data.locationCategory,
        search: data.locationName,
      });
      const beforeRecord =
        beforeMatrix.locations
          .find((location) => location.locationName === data.locationName)
          ?.audits.find((audit) => audit.auditType === data.auditType) ?? null;

      const record = await service.upsertRecord(data);

      await writeAuditLog({
        action: beforeRecord ? "statutory_audit.record.updated" : "statutory_audit.record.created",
        resourceType: "statutory_audit_record",
        resourceId: record.id,
        context: {
          locationCategory: record.locationCategory,
          locationName: record.locationName,
          auditType: record.auditType,
        },
        changes: beforeRecord
          ? diffRecord(
              beforeRecord as unknown as Record<string, unknown>,
              record as unknown as Record<string, unknown>,
            )
          : [],
        actor: req.user,
        request: req,
      });

      res.status(beforeRecord ? 200 : 201).json({ data: record });
    },

    async deleteLocation(req: AuthRequest, res: Response) {
      const payload = DeleteStatutoryAuditLocationSchema.parse({
        locationCategory: req.params.locationCategory,
        locationName: decodeURIComponent(String(req.params.locationName ?? "")),
      });

      const deleted = await service.deleteLocation(payload.locationCategory, payload.locationName);
      if (!deleted) throw new NotFoundError("Statutory audit location");

      await writeAuditLog({
        action: "statutory_audit.location.deleted",
        resourceType: "statutory_audit_location",
        resourceId: `${payload.locationCategory}:${payload.locationName}`,
        actor: req.user,
        request: req,
      });

      res.json({ data: { ok: true } });
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
  router.post(
    "/records",
    rbacMiddleware("compliance:update"),
    validate(UpsertStatutoryAuditRecordSchema),
    controller.upsertRecord,
  );
  router.delete(
    "/locations/:locationCategory/:locationName",
    rbacMiddleware("compliance:delete"),
    controller.deleteLocation,
  );

  return router;
}

