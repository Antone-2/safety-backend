import { Router } from "express";
import { z } from "zod";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { diffRecord, writeAuditLog } from "../../shared/audit/audit.service.js";
import { OrganizationRepository } from "./organization.repository.js";
import { OrganizationService } from "./organization.service.js";
import {
  OrganizationDepartmentFiltersSchema,
  OrganizationDepartmentSchema,
  OrganizationSiteFiltersSchema,
  OrganizationSiteSchema,
  UpdateOrganizationDepartmentSchema,
  UpdateOrganizationSiteSchema,
} from "./organization.types.js";

const service = new OrganizationService(new OrganizationRepository(pgPool));

export function createOrganizationRouter() {
  const router = Router();

  router.use(authenticateUser);

  router.get("/stats", rbacMiddleware("users:read"), async (_req, res) => {
    res.json({ data: await service.getStats() });
  });

  router.get("/tree", rbacMiddleware("users:read"), async (_req, res) => {
    res.json({ data: await service.getTree() });
  });

  router.get("/sites", rbacMiddleware("users:read"), async (req, res) => {
    const parsed = OrganizationSiteFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    res.json({ data: await service.listSites(parsed.data) });
  });

  router.post(
    "/sites",
    rbacMiddleware("users:create"),
    validate(OrganizationSiteSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof OrganizationSiteSchema>;
      const site = await service.createSite({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "organization.site.created",
        resourceType: "organization_site",
        resourceId: site.id,
        actor: req.user,
        request: req,
        context: { name: site.name },
      });
      res.status(201).json({ data: site });
    },
  );

  router.patch(
    "/sites/:id",
    rbacMiddleware("users:update"),
    validate(UpdateOrganizationSiteSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getSiteById(String(req.params.id));
      const site = await service.updateSite(String(req.params.id), req.body);
      await writeAuditLog({
        action: "organization.site.updated",
        resourceType: "organization_site",
        resourceId: site.id,
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          site as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: site });
    },
  );

  router.delete("/sites/:id", rbacMiddleware("users:delete"), async (req: AuthRequest, res) => {
    const before = await service.getSiteById(String(req.params.id));
    await service.deleteSite(String(req.params.id));
    await writeAuditLog({
      action: "organization.site.deleted",
      resourceType: "organization_site",
      resourceId: before.id,
      actor: req.user,
      request: req,
      context: { name: before.name },
    });
    res.json({ data: { ok: true, deleted: before.id } });
  });

  router.get("/departments", rbacMiddleware("users:read"), async (req, res) => {
    const parsed = OrganizationDepartmentFiltersSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.flatten() });
    }
    res.json({ data: await service.listDepartments(parsed.data) });
  });

  router.post(
    "/departments",
    rbacMiddleware("users:create"),
    validate(OrganizationDepartmentSchema),
    async (req: AuthRequest, res) => {
      const data = req.body as z.infer<typeof OrganizationDepartmentSchema>;
      const department = await service.createDepartment({
        ...data,
        createdBy: req.user?.name || req.user?.email || "System",
      });
      await writeAuditLog({
        action: "organization.department.created",
        resourceType: "organization_department",
        resourceId: department.id,
        actor: req.user,
        request: req,
        context: { name: department.name, siteName: department.siteName },
      });
      res.status(201).json({ data: department });
    },
  );

  router.patch(
    "/departments/:id",
    rbacMiddleware("users:update"),
    validate(UpdateOrganizationDepartmentSchema),
    async (req: AuthRequest, res) => {
      const before = await service.getDepartmentById(String(req.params.id));
      const department = await service.updateDepartment(String(req.params.id), req.body);
      await writeAuditLog({
        action: "organization.department.updated",
        resourceType: "organization_department",
        resourceId: department.id,
        actor: req.user,
        request: req,
        changes: diffRecord(
          before as unknown as Record<string, unknown>,
          department as unknown as Record<string, unknown>,
        ),
      });
      res.json({ data: department });
    },
  );

  router.delete(
    "/departments/:id",
    rbacMiddleware("users:delete"),
    async (req: AuthRequest, res) => {
      const before = await service.getDepartmentById(String(req.params.id));
      await service.deleteDepartment(String(req.params.id));
      await writeAuditLog({
        action: "organization.department.deleted",
        resourceType: "organization_department",
        resourceId: before.id,
        actor: req.user,
        request: req,
        context: { name: before.name, siteName: before.siteName },
      });
      res.json({ data: { ok: true, deleted: before.id } });
    },
  );

  return router;
}
