import { Router } from "express";
import { KpiService } from "./kpi.service.js";
import { KpiRepository } from "./kpi.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateKpiDefinitionSchema, UpdateKpiDefinitionSchema, CreateKpiValueSchema, UpdateKpiValueSchema, } from "./kpi.types.js";
export function createKpiController(service) {
    return {
        async getDefinitions(req, res) {
            const filters = {};
            const { category, isActive } = req.query;
            if (category)
                filters.category = String(category);
            if (isActive !== undefined)
                filters.isActive = String(isActive) === "true";
            const definitions = await service.getDefinitions(filters);
            res.json({ data: definitions });
        },
        async getDefinition(req, res) {
            const definition = await service.getDefinitionById(String(req.params.id));
            if (!definition)
                throw new NotFoundError("KPI definition");
            res.json({ data: definition });
        },
        async createDefinition(req, res) {
            const data = req.body;
            const definition = await service.createDefinition({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "kpi.definition.created",
                resourceType: "kpi_definition",
                resourceId: definition.id,
                context: { name: definition.name },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: definition });
        },
        async updateDefinition(req, res) {
            const before = await service.getDefinitionById(String(req.params.id));
            if (!before)
                throw new NotFoundError("KPI definition");
            const definition = await service.updateDefinition(String(req.params.id), req.body);
            await writeAuditLog({
                action: "kpi.definition.updated",
                resourceType: "kpi_definition",
                resourceId: String(req.params.id),
                changes: diffRecord(before, definition),
                actor: req.user,
                request: req,
            });
            res.json({ data: definition });
        },
        async deleteDefinition(req, res) {
            const deleted = await service.deleteDefinition(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("KPI definition");
            await writeAuditLog({
                action: "kpi.definition.deleted",
                resourceType: "kpi_definition",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { success: true } });
        },
        async getValues(req, res) {
            const filters = {};
            const { definitionId, periodStart, periodEnd } = req.query;
            if (definitionId)
                filters.definitionId = String(definitionId);
            if (periodStart)
                filters.periodStart = String(periodStart);
            if (periodEnd)
                filters.periodEnd = String(periodEnd);
            const values = await service.getValues(filters);
            res.json({ data: values });
        },
        async getValue(req, res) {
            const value = await service.getValueById(String(req.params.id));
            if (!value)
                throw new NotFoundError("KPI value");
            res.json({ data: value });
        },
        async createValue(req, res) {
            const data = req.body;
            const value = await service.createValue({ ...data, recordedBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "kpi.value.created",
                resourceType: "kpi_value",
                resourceId: value.id,
                context: { definitionId: value.definitionId, period: `${value.periodStart} to ${value.periodEnd}` },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: value });
        },
        async updateValue(req, res) {
            const before = await service.getValueById(String(req.params.id));
            if (!before)
                throw new NotFoundError("KPI value");
            const value = await service.updateValue(String(req.params.id), req.body);
            await writeAuditLog({
                action: "kpi.value.updated",
                resourceType: "kpi_value",
                resourceId: String(req.params.id),
                changes: diffRecord(before, value),
                actor: req.user,
                request: req,
            });
            res.json({ data: value });
        },
        async deleteValue(req, res) {
            const deleted = await service.deleteValue(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("KPI value");
            await writeAuditLog({
                action: "kpi.value.deleted",
                resourceType: "kpi_value",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { success: true } });
        },
        async getDashboard(_req, res) {
            const dashboard = await service.getDashboard();
            res.json({ data: dashboard });
        },
    };
}
export function createKpiRouter() {
    const repository = new KpiRepository(pgPool);
    const service = new KpiService(repository);
    const controller = createKpiController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/definitions", rbacMiddleware("kpi:read"), controller.getDefinitions);
    router.get("/definitions/:id", rbacMiddleware("kpi:read"), controller.getDefinition);
    router.post("/definitions", rbacMiddleware("kpi:create"), validate(CreateKpiDefinitionSchema), controller.createDefinition);
    router.patch("/definitions/:id", rbacMiddleware("kpi:update"), validate(UpdateKpiDefinitionSchema), controller.updateDefinition);
    router.delete("/definitions/:id", rbacMiddleware("kpi:delete"), controller.deleteDefinition);
    router.get("/values", rbacMiddleware("kpi:read"), controller.getValues);
    router.get("/values/:id", rbacMiddleware("kpi:read"), controller.getValue);
    router.post("/values", rbacMiddleware("kpi:create"), validate(CreateKpiValueSchema), controller.createValue);
    router.patch("/values/:id", rbacMiddleware("kpi:update"), validate(UpdateKpiValueSchema), controller.updateValue);
    router.delete("/values/:id", rbacMiddleware("kpi:delete"), controller.deleteValue);
    router.get("/dashboard", rbacMiddleware("kpi:read"), controller.getDashboard);
    return router;
}
