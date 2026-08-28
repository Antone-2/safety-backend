import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { CalibrationsRepository } from "./calibrations.repository.js";
import { CalibrationsService } from "./calibrations.service.js";
import { CreateCalibrationSchema, UpdateCalibrationSchema } from "./calibrations.types.js";

export function createCalibrationsRouter() {
  const repository = new CalibrationsRepository(pgPool);
  const service = new CalibrationsService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("calibrations:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/overdue", rbacMiddleware("calibrations:read"), async (_req, res) => {
    res.json({ data: await service.getOverdue() });
  });

  router.get("/out-of-tolerance", rbacMiddleware("calibrations:read"), async (_req, res) => {
    res.json({ data: await service.getOutOfTolerance() });
  });

  router.get("/", rbacMiddleware("calibrations:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { site, department, status, criticality, equipmentId } = req.query;
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (status) filters.status = String(status);
    if (criticality) filters.criticality = String(criticality);
    if (equipmentId) filters.equipmentId = String(equipmentId);
    res.json({ data: await service.getRecords(filters) });
  });

  router.get("/:id", rbacMiddleware("calibrations:read"), async (req, res: Response) => {
    const record = await service.getById(String(req.params.id));
    if (!record) throw new NotFoundError("Calibration record");
    res.json({ data: record });
  });

  router.post(
    "/",
    rbacMiddleware("calibrations:create"),
    validate(CreateCalibrationSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateCalibrationSchema>;
      const record = await service.create({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "calibrations.created",
        resourceType: "calibration_record",
        resourceId: record.id,
        actor: req.user,
        request: req,
        context: { calibrationNo: record.calibrationNo, equipmentName: record.equipmentName, site: record.site },
      });
      res.status(201).json({ data: record });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("calibrations:update"),
    validate(UpdateCalibrationSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("Calibration record");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "calibrations.updated",
        resourceType: "calibration_record",
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

  router.delete("/:id", rbacMiddleware("calibrations:delete"), async (req: AuthRequest, res) => {
    const deleted = await service.delete(String(req.params.id));
    if (!deleted) throw new NotFoundError("Calibration record");
    await writeAuditLog({
      action: "calibrations.deleted",
      resourceType: "calibration_record",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
