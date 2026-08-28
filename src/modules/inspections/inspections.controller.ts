import { Router, type Response } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { InspectionsRepository } from "./inspections.repository.js";
import { InspectionsService } from "./inspections.service.js";
import {
  CreateInspectionSchema,
  CreateInspectionTemplateSchema,
  UpdateInspectionSchema,
  UpdateInspectionTemplateSchema,
} from "./inspections.types.js";

export function createInspectionsRouter() {
  const repository = new InspectionsRepository(pgPool);
  const service = new InspectionsService(repository);
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("inspections:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/overdue", rbacMiddleware("inspections:read"), async (_req, res) => {
    res.json({ data: await service.getOverdueInspections() });
  });

  router.get("/templates", rbacMiddleware("inspections:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { area, site, department, active } = req.query;
    if (area) filters.area = String(area);
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (active !== undefined) filters.active = String(active) === "true";
    res.json({ data: await service.getTemplates(filters) });
  });

  router.post(
    "/templates",
    rbacMiddleware("inspections:create"),
    validate(CreateInspectionTemplateSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateInspectionTemplateSchema>;
      const template = await service.createTemplate({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "inspections.template_created",
        resourceType: "inspection_template",
        resourceId: template.id,
        actor: req.user,
        request: req,
        context: { title: template.title, area: template.area },
      });
      res.status(201).json({ data: template });
    },
  );

  router.patch(
    "/templates/:id",
    rbacMiddleware("inspections:update"),
    validate(UpdateInspectionTemplateSchema),
    async (req: AuthRequest, res: Response) => {
      const before = await service.getTemplateById(String(req.params.id));
      if (!before) throw new NotFoundError("Inspection template");
      const template = await service.updateTemplate(String(req.params.id), req.body);
      await writeAuditLog({
        action: "inspections.template_updated",
        resourceType: "inspection_template",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          template as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: template });
    },
  );

  router.get("/", rbacMiddleware("inspections:read"), async (req, res) => {
    const filters: Record<string, unknown> = {};
    const { status, site, department, area, inspector, assignedTo } = req.query;
    if (status) filters.status = String(status);
    if (site) filters.site = String(site);
    if (department) filters.department = String(department);
    if (area) filters.area = String(area);
    if (inspector) filters.inspector = String(inspector);
    if (assignedTo) filters.assignedTo = String(assignedTo);
    res.json({ data: await service.getInspections(filters) });
  });

  router.get("/:id", rbacMiddleware("inspections:read"), async (req, res) => {
    const inspection = await service.getInspectionById(String(req.params.id));
    if (!inspection) throw new NotFoundError("Inspection");
    res.json({ data: inspection });
  });

  router.post(
    "/",
    rbacMiddleware("inspections:create"),
    validate(CreateInspectionSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof CreateInspectionSchema>;
      const inspection = await service.createInspection({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "inspections.created",
        resourceType: "inspection",
        resourceId: inspection.id,
        actor: req.user,
        request: req,
        context: { title: inspection.title, site: inspection.site, department: inspection.department },
      });
      res.status(201).json({ data: inspection });
    },
  );

  router.patch(
    "/:id",
    rbacMiddleware("inspections:update"),
    validate(UpdateInspectionSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getInspectionById(String(req.params.id));
      if (!before) throw new NotFoundError("Inspection");
      const inspection = await service.updateInspection(String(req.params.id), req.body);
      await writeAuditLog({
        action: "inspections.updated",
        resourceType: "inspection",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          inspection as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: inspection });
    },
  );

  router.delete("/:id", rbacMiddleware("inspections:delete"), async (req: AuthRequest, res) => {
    await service.deleteInspection(String(req.params.id));
    await writeAuditLog({
      action: "inspections.deleted",
      resourceType: "inspection",
      resourceId: String(req.params.id),
      actor: req.user,
      request: req,
    });
    res.json({ data: { ok: true, deleted: String(req.params.id) } });
  });

  return router;
}
