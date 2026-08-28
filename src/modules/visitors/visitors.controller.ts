import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { VisitorsRepository } from "./visitors.repository.js";
import { VisitorsService } from "./visitors.service.js";
import { CreateVisitorSchema, UpdateVisitorSchema } from "./visitors.types.js";

export function createVisitorsRouter() {
  const repository = new VisitorsRepository(pgPool);
  const service = new VisitorsService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("visitors:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/on-site", rbacMiddleware("visitors:read"), async (_req, res) => {
    res.json({ data: await service.getOnSite() });
  });

  router.get("/overdue-checkouts", rbacMiddleware("visitors:read"), async (_req, res) => {
    res.json({ data: await service.getOverdueCheckouts() });
  });

  router.get("/", rbacMiddleware("visitors:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { accessStatus, inductionStatus, site, hostName, visitDate } = req.query;
    if (accessStatus) filters.accessStatus = String(accessStatus);
    if (inductionStatus) filters.inductionStatus = String(inductionStatus);
    if (site) filters.site = String(site);
    if (hostName) filters.hostName = String(hostName);
    if (visitDate) filters.visitDate = String(visitDate);
    res.json({ data: await service.getVisitors(filters) });
  });

  router.get("/:id", rbacMiddleware("visitors:read"), async (req, res: Response) => {
    const record = await service.getById(String(req.params.id));
    if (!record) throw new NotFoundError("Visitor record");
    res.json({ data: record });
  });

  router.post(
    "/",
    rbacMiddleware("visitors:create"),
    validate(CreateVisitorSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateVisitorSchema>;
      const record = await service.create({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "visitors.created",
        resourceType: "visitor_record",
        resourceId: record.id,
        actor: req.user,
        request: req,
        context: { site: record.site, hostName: record.hostName, accessStatus: record.accessStatus },
      });
      res.status(201).json({ data: record });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("visitors:update"),
    validate(UpdateVisitorSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getById(String(req.params.id));
      if (!before) throw new NotFoundError("Visitor record");
      const record = await service.update(String(req.params.id), req.body);
      await writeAuditLog({
        action: "visitors.updated",
        resourceType: "visitor_record",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          record as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: record });
    },
  );

  router.delete("/:id", rbacMiddleware("visitors:delete"), async (req: AuthRequest, res) => {
    await service.delete(String(req.params.id));
    await writeAuditLog({
      action: "visitors.deleted",
      resourceType: "visitor_record",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
