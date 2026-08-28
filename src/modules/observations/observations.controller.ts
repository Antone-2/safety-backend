import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { ObservationsRepository } from "./observations.repository.js";
import { ObservationsService } from "./observations.service.js";
import { CreateObservationSchema, UpdateObservationSchema } from "./observations.types.js";

export function createObservationsRouter() {
  const repository = new ObservationsRepository(pgPool);
  const service = new ObservationsService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("observations:read"), async (_req, res) => {
    res.json({ data: await service.getObservationStats() });
  });

  router.get("/", rbacMiddleware("observations:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { type, status, site, department, assignedTo, observerName } = req.query;
    if (type) filters.type = String(type);
    if (status) filters.status = String(status);
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (assignedTo) filters.assignedTo = String(assignedTo);
    if (observerName) filters.observerName = String(observerName);
    res.json({ data: await service.getObservations(filters) });
  });

  router.get("/:id", rbacMiddleware("observations:read"), async (req, res: Response) => {
    const observation = await service.getObservationById(String(req.params.id));
    if (!observation) throw new NotFoundError("Observation");
    res.json({ data: observation });
  });

  router.post(
    "/",
    rbacMiddleware("observations:create"),
    validate(CreateObservationSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateObservationSchema>;
      const observation = await service.createObservation({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "observations.created",
        resourceType: "observation",
        resourceId: observation.id,
        actor: req.user,
        request: req,
        context: { type: observation.type, site: observation.site, department: observation.department },
      });
      res.status(201).json({ data: observation });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("observations:update"),
    validate(UpdateObservationSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getObservationById(String(req.params.id));
      if (!before) throw new NotFoundError("Observation");
      const observation = await service.updateObservation(String(req.params.id), req.body);
      await writeAuditLog({
        action: "observations.updated",
        resourceType: "observation",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          observation as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: observation });
    },
  );

  router.delete("/:id", rbacMiddleware("observations:delete"), async (req: AuthRequest, res) => {
    await service.deleteObservation(String(req.params.id));
    await writeAuditLog({
      action: "observations.deleted",
      resourceType: "observation",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
