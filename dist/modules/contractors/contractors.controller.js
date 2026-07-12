import { Router } from "express";
import { ContractorsService } from "./contractors.service.js";
import { ContractorsRepository } from "./contractors.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateContractorSchema, UpdateContractorSchema, CreateContractorIncidentSchema, } from "./contractors.types.js";
export function createContractorsController(service) {
    return {
        async getAll(req, res) {
            const filters = {};
            const { status, companyName } = req.query;
            if (status)
                filters.status = String(status);
            if (companyName)
                filters.companyName = String(companyName);
            const contractors = await service.getContractors(filters);
            res.json({ data: contractors });
        },
        async getById(req, res) {
            const contractor = await service.getContractorById(String(req.params.id));
            if (!contractor)
                throw new NotFoundError("Contractor");
            res.json({ data: contractor });
        },
        async create(req, res) {
            const data = req.body;
            const contractor = await service.createContractor({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "contractors.created",
                resourceType: "contractor",
                resourceId: contractor.id,
                context: { companyName: contractor.companyName, registrationNumber: contractor.registrationNumber },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: contractor });
        },
        async update(req, res) {
            const before = await service.getContractorById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Contractor");
            const contractor = await service.updateContractor(String(req.params.id), req.body);
            await writeAuditLog({
                action: "contractors.updated",
                resourceType: "contractor",
                resourceId: String(req.params.id),
                changes: diffRecord(before, contractor),
                actor: req.user,
                request: req,
            });
            res.json({ data: contractor });
        },
        async delete(req, res) {
            const deleted = await service.deleteContractor(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Contractor");
            await writeAuditLog({
                action: "contractors.deleted",
                resourceType: "contractor",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async recordIncident(req, res) {
            const data = req.body;
            const incident = await service.recordIncident({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "contractors.incident_recorded",
                resourceType: "contractor_incident",
                resourceId: incident.id,
                context: { contractorId: incident.contractorId, severity: incident.severity },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: incident });
        },
        async getIncidents(req, res) {
            const incidents = await service.getContractorIncidents(String(req.params.id));
            res.json({ data: incidents });
        },
        async getStats(req, res) {
            const stats = await service.getContractorStats();
            res.json({ data: stats });
        },
    };
}
export function createContractorsRouter() {
    const repository = new ContractorsRepository(pgPool);
    const service = new ContractorsService(repository);
    const controller = createContractorsController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", rbacMiddleware("contractors:read"), controller.getAll);
    router.get("/stats/summary", rbacMiddleware("contractors:read"), controller.getStats);
    router.get("/:id", rbacMiddleware("contractors:read"), controller.getById);
    router.post("/", rbacMiddleware("contractors:create"), validate(CreateContractorSchema), controller.create);
    router.patch("/:id", rbacMiddleware("contractors:update"), validate(UpdateContractorSchema), controller.update);
    router.delete("/:id", rbacMiddleware("contractors:delete"), controller.delete);
    router.post("/incidents", rbacMiddleware("contractors:create"), validate(CreateContractorIncidentSchema), controller.recordIncident);
    router.get("/:id/incidents", rbacMiddleware("contractors:read"), controller.getIncidents);
    return router;
}
