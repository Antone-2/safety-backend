import { Router } from "express";
import { ComplianceService } from "./compliance.service.js";
import { ComplianceRepository } from "./compliance.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateComplianceObligationSchema, UpdateComplianceObligationSchema, CreateComplianceAuditSchema, UpdateComplianceAuditSchema, CreateLegalUpdateSchema, UpdateLegalUpdateSchema, } from "./compliance.types.js";
export function createComplianceController(service) {
    return {
        async getObligations(req, res) {
            const filters = {};
            const { site, status, responsibility } = req.query;
            if (site)
                filters.site = String(site);
            if (status)
                filters.status = String(status);
            if (responsibility)
                filters.responsibility = String(responsibility);
            const obligations = await service.getObligations(filters);
            res.json({ data: obligations });
        },
        async getObligationById(req, res) {
            const obligation = await service.getObligationById(String(req.params.id));
            if (!obligation)
                throw new NotFoundError("Compliance obligation");
            res.json({ data: obligation });
        },
        async createObligation(req, res) {
            const data = req.body;
            const obligation = await service.createObligation({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "compliance.obligation.created",
                resourceType: "compliance_obligation",
                resourceId: obligation.id,
                context: { title: obligation.title, legislation: obligation.legislation },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: obligation });
        },
        async updateObligation(req, res) {
            const before = await service.getObligationById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Compliance obligation");
            const obligation = await service.updateObligation(String(req.params.id), req.body);
            await writeAuditLog({
                action: "compliance.obligation.updated",
                resourceType: "compliance_obligation",
                resourceId: String(req.params.id),
                changes: diffRecord(before, obligation),
                actor: req.user,
                request: req,
            });
            res.json({ data: obligation });
        },
        async deleteObligation(req, res) {
            const deleted = await service.deleteObligation(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Compliance obligation");
            await writeAuditLog({
                action: "compliance.obligation.deleted",
                resourceType: "compliance_obligation",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getAudits(req, res) {
            const filters = {};
            const { type, status, site } = req.query;
            if (type)
                filters.type = String(type);
            if (status)
                filters.status = String(status);
            if (site)
                filters.site = String(site);
            const audits = await service.getAudits(filters);
            res.json({ data: audits });
        },
        async getAuditById(req, res) {
            const audit = await service.getAuditById(String(req.params.id));
            if (!audit)
                throw new NotFoundError("Compliance audit");
            res.json({ data: audit });
        },
        async createAudit(req, res) {
            const data = req.body;
            const audit = await service.createAudit({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "compliance.audit.created",
                resourceType: "compliance_audit",
                resourceId: audit.id,
                context: { title: audit.title, type: audit.type },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: audit });
        },
        async updateAudit(req, res) {
            const before = await service.getAuditById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Compliance audit");
            const audit = await service.updateAudit(String(req.params.id), req.body);
            await writeAuditLog({
                action: "compliance.audit.updated",
                resourceType: "compliance_audit",
                resourceId: String(req.params.id),
                changes: diffRecord(before, audit),
                actor: req.user,
                request: req,
            });
            res.json({ data: audit });
        },
        async deleteAudit(req, res) {
            const deleted = await service.deleteAudit(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Compliance audit");
            await writeAuditLog({
                action: "compliance.audit.deleted",
                resourceType: "compliance_audit",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getLegalUpdates(req, res) {
            const filters = {};
            const { status } = req.query;
            if (status)
                filters.status = String(status);
            const updates = await service.getLegalUpdates(filters);
            res.json({ data: updates });
        },
        async getLegalUpdateById(req, res) {
            const update = await service.getLegalUpdateById(String(req.params.id));
            if (!update)
                throw new NotFoundError("Legal update");
            res.json({ data: update });
        },
        async createLegalUpdate(req, res) {
            const data = req.body;
            const legalUpdate = await service.createLegalUpdate({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "compliance.legal_update.created",
                resourceType: "legal_update",
                resourceId: legalUpdate.id,
                context: { title: legalUpdate.title, legislation: legalUpdate.legislation },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: legalUpdate });
        },
        async updateLegalUpdate(req, res) {
            const before = await service.getLegalUpdateById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Legal update");
            const legalUpdate = await service.updateLegalUpdate(String(req.params.id), req.body);
            await writeAuditLog({
                action: "compliance.legal_update.updated",
                resourceType: "legal_update",
                resourceId: String(req.params.id),
                changes: diffRecord(before, legalUpdate),
                actor: req.user,
                request: req,
            });
            res.json({ data: legalUpdate });
        },
        async deleteLegalUpdate(req, res) {
            const deleted = await service.deleteLegalUpdate(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Legal update");
            await writeAuditLog({
                action: "compliance.legal_update.deleted",
                resourceType: "legal_update",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getDashboard(req, res) {
            const dashboard = await service.getComplianceDashboard();
            res.json({ data: dashboard });
        },
    };
}
export function createComplianceRouter() {
    const repository = new ComplianceRepository(pgPool);
    const service = new ComplianceService(repository);
    const controller = createComplianceController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/obligations", rbacMiddleware("compliance:read"), controller.getObligations);
    router.get("/obligations/:id", rbacMiddleware("compliance:read"), controller.getObligationById);
    router.post("/obligations", rbacMiddleware("compliance:create"), validate(CreateComplianceObligationSchema), controller.createObligation);
    router.patch("/obligations/:id", rbacMiddleware("compliance:update"), validate(UpdateComplianceObligationSchema), controller.updateObligation);
    router.delete("/obligations/:id", rbacMiddleware("compliance:delete"), controller.deleteObligation);
    router.get("/audits", rbacMiddleware("compliance:read"), controller.getAudits);
    router.get("/audits/:id", rbacMiddleware("compliance:read"), controller.getAuditById);
    router.post("/audits", rbacMiddleware("compliance:create"), validate(CreateComplianceAuditSchema), controller.createAudit);
    router.patch("/audits/:id", rbacMiddleware("compliance:update"), validate(UpdateComplianceAuditSchema), controller.updateAudit);
    router.delete("/audits/:id", rbacMiddleware("compliance:delete"), controller.deleteAudit);
    router.get("/legal-updates", rbacMiddleware("compliance:read"), controller.getLegalUpdates);
    router.get("/legal-updates/:id", rbacMiddleware("compliance:read"), controller.getLegalUpdateById);
    router.post("/legal-updates", rbacMiddleware("compliance:create"), validate(CreateLegalUpdateSchema), controller.createLegalUpdate);
    router.patch("/legal-updates/:id", rbacMiddleware("compliance:update"), validate(UpdateLegalUpdateSchema), controller.updateLegalUpdate);
    router.delete("/legal-updates/:id", rbacMiddleware("compliance:delete"), controller.deleteLegalUpdate);
    router.get("/dashboard", rbacMiddleware("compliance:read"), controller.getDashboard);
    return router;
}
