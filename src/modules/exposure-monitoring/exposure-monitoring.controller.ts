import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { ExposureMonitoringRepository } from "./exposure-monitoring.repository.js";
import { ExposureMonitoringService } from "./exposure-monitoring.service.js";
import {
  CreateExposureMonitoringSchema,
  UpdateExposureMonitoringSchema,
} from "./exposure-monitoring.types.js";

export function createExposureMonitoringRouter() {
  const repository = new ExposureMonitoringRepository(pgPool);
  const service = new ExposureMonitoringService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("exposure-monitoring:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/exceedances", rbacMiddleware("exposure-monitoring:read"), async (_req, res) => {
    res.json({ data: await service.getExceedances() });
  });

  router.get("/overdue-actions", rbacMiddleware("exposure-monitoring:read"), async (req, res) => {
    const daysBefore = parseInt(String(req.query.days)) || 30;
    res.json({ data: await service.getOverdueActions(daysBefore) });
  });

  router.get("/", rbacMiddleware("exposure-monitoring:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { exposureType, status, site, department, riskLevel } = req.query;
    if (exposureType) filters.exposureType = String(exposureType);
    if (status) filters.status = String(status);
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (riskLevel) filters.riskLevel = String(riskLevel);
    res.json({ data: await service.getRecords(filters) });
  });

  router.get("/:id", rbacMiddleware("exposure-monitoring:read"), async (req, res: Response) => {
    const record = await service.getById(String(req.params.id));
    if (!record) throw new NotFoundError("Exposure monitoring record");
    res.json({ data: record });
  });

  router.post(
    "/",
    rbacMiddleware("exposure-monitoring:create"),
    validate(CreateExposureMonitoringSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateExposureMonitoringSchema>;
      const record = await service.create({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "exposure-monitoring.created",
        resourceType: "exposure_monitoring",
        resourceId: record.id,
        actor: req.user,
        request: req,
        context: { sampleNo: record.sampleNo, exposureType: record.exposureType, site: record.site },
      });
      res.status(201).json({ data: record });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("exposure-monitoring:update"),
    validate(UpdateExposureMonitoringSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("Exposure monitoring record");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "exposure-monitoring.updated",
        resourceType: "exposure_monitoring",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          (record ?? {}) as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: record });
    },
  );

  router.delete("/:id", rbacMiddleware("exposure-monitoring:delete"), async (req: AuthRequest, res) => {
    const deleted = await service.delete(String(req.params.id));
    if (!deleted) throw new NotFoundError("Exposure monitoring record");
    await writeAuditLog({
      action: "exposure-monitoring.deleted",
      resourceType: "exposure_monitoring",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
