import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { MocRepository } from "./moc.repository.js";
import { MocService } from "./moc.service.js";
import { CreateMocSchema, MocTransitionSchema, UpdateMocSchema } from "./moc.types.js";

export function createMocRouter() {
  const repository = new MocRepository(pgPool);
  const service = new MocService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("moc:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/", rbacMiddleware("moc:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { status, changeType, site, department, assignedTo, requestedBy, riskLevel } = req.query;
    if (status) filters.status = String(status);
    if (changeType) filters.changeType = String(changeType);
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (assignedTo) filters.assignedTo = String(assignedTo);
    if (requestedBy) filters.requestedBy = String(requestedBy);
    if (riskLevel) filters.riskLevel = String(riskLevel);
    res.json({ data: await service.getRecords(filters) });
  });

  router.get("/:id", rbacMiddleware("moc:read"), async (req, res: Response) => {
    const record = await service.getById(String(req.params.id));
    if (!record) throw new NotFoundError("MOC");
    res.json({ data: record });
  });

  router.post(
    "/",
    rbacMiddleware("moc:create"),
    validate(CreateMocSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateMocSchema>;
      const record = await service.create({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "moc.created",
        resourceType: "moc",
        resourceId: record.id,
        actor: req.user,
        request: req,
        context: {
          mocNo: record.mocNo,
          title: record.title,
          site: record.site,
          department: record.department,
        },
      });
      res.status(201).json({ data: record });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("moc:update"),
    validate(UpdateMocSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("MOC");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "moc.updated",
        resourceType: "moc",
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

  router.post(
    "/:id/transition",
    rbacMiddleware("moc:approve"),
    validate(MocTransitionSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("MOC");
      const record = await service.transition(String(req.params.id), req.body, req.user);
      if (!record) throw new NotFoundError("MOC");
      await writeAuditLog({
        action: "moc.transitioned",
        resourceType: "moc",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        context: { event: req.body.event, from: before.status, to: record.status },
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          record as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: record });
    },
  );

  router.delete("/:id", rbacMiddleware("moc:delete"), async (req: AuthRequest, res) => {
    await service.delete(String(req.params.id));
    await writeAuditLog({
      action: "moc.deleted",
      resourceType: "moc",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
