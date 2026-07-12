import { Router } from "express";
import { EnvironmentalService } from "./environmental.service.js";
import { EnvironmentalRepository } from "./environmental.repository.js";
import { authenticateUser, } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateWasteSchema, UpdateWasteSchema, CreateEmissionSchema, UpdateEmissionSchema, CreateChemicalSchema, UpdateChemicalSchema, CreateSpillSchema, UpdateSpillSchema, } from "./environmental.types.js";
export function createEnvironmentalController(service) {
    return {
        async getWaste(req, res) {
            const filters = {};
            const { type, status } = req.query;
            if (type)
                filters.type = String(type);
            if (status)
                filters.status = String(status);
            const waste = await service.getWaste(filters);
            res.json({ data: waste });
        },
        async createWaste(req, res) {
            const data = req.body;
            const waste = await service.createWaste({
                ...data,
                createdBy: req.user?.name || "System",
            });
            await writeAuditLog({
                action: "environmental.waste.created",
                resourceType: "waste_record",
                resourceId: waste.id,
                context: { type: waste.type, category: waste.category },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: waste });
        },
        async updateWaste(req, res) {
            const before = (await service.getWaste({ id: String(req.params.id) }))[0];
            if (!before)
                throw new NotFoundError("Waste record");
            const waste = await service.updateWaste(String(req.params.id), req.body);
            await writeAuditLog({
                action: "environmental.waste.updated",
                resourceType: "waste_record",
                resourceId: String(req.params.id),
                changes: diffRecord(before, waste),
                actor: req.user,
                request: req,
            });
            res.json({ data: waste });
        },
        async getEmissions(req, res) {
            const filters = {};
            const { type, location } = req.query;
            if (type)
                filters.type = String(type);
            if (location)
                filters.location = String(location);
            const emissions = await service.getEmissions(filters);
            res.json({ data: emissions });
        },
        async createEmission(req, res) {
            const data = req.body;
            const emission = await service.createEmission({
                ...data,
                createdBy: req.user?.name || "System",
            });
            await writeAuditLog({
                action: "environmental.emission.created",
                resourceType: "emission",
                resourceId: emission.id,
                context: { type: emission.type, parameter: emission.parameter },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: emission });
        },
        async updateEmission(req, res) {
            const before = (await service.getEmissions({ id: String(req.params.id) }))[0];
            if (!before)
                throw new NotFoundError("Emission record");
            const emission = await service.updateEmission(String(req.params.id), req.body);
            await writeAuditLog({
                action: "environmental.emission.updated",
                resourceType: "emission",
                resourceId: String(req.params.id),
                changes: diffRecord(before, emission),
                actor: req.user,
                request: req,
            });
            res.json({ data: emission });
        },
        async getChemicals(req, res) {
            const chemicals = await service.getChemicals();
            res.json({ data: chemicals });
        },
        async createChemical(req, res) {
            const data = req.body;
            const chemical = await service.createChemical({
                ...data,
                createdBy: req.user?.name || "System",
            });
            await writeAuditLog({
                action: "environmental.chemical.created",
                resourceType: "chemical",
                resourceId: chemical.id,
                context: {
                    name: chemical.name,
                    storageLocation: chemical.storageLocation,
                },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: chemical });
        },
        async updateChemical(req, res) {
            const before = (await service.getChemicals({ id: String(req.params.id) }))[0];
            if (!before)
                throw new NotFoundError("Chemical");
            const chemical = await service.updateChemical(String(req.params.id), req.body);
            await writeAuditLog({
                action: "environmental.chemical.updated",
                resourceType: "chemical",
                resourceId: String(req.params.id),
                changes: diffRecord(before, chemical),
                actor: req.user,
                request: req,
            });
            res.json({ data: chemical });
        },
        async getSpills(req, res) {
            const filters = {};
            const { severity, location } = req.query;
            if (severity)
                filters.severity = String(severity);
            if (location)
                filters.location = String(location);
            const spills = await service.getSpills(filters);
            res.json({ data: spills });
        },
        async createSpill(req, res) {
            const data = req.body;
            const spill = await service.createSpill({
                ...data,
                createdBy: req.user?.name || "System",
            });
            await writeAuditLog({
                action: "environmental.spill.created",
                resourceType: "spill",
                resourceId: spill.id,
                context: { chemical: spill.chemical, severity: spill.severity },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: spill });
        },
        async updateSpill(req, res) {
            const before = (await service.getSpills({ id: String(req.params.id) }))[0];
            if (!before)
                throw new NotFoundError("Spill record");
            const spill = await service.updateSpill(String(req.params.id), req.body);
            await writeAuditLog({
                action: "environmental.spill.updated",
                resourceType: "spill",
                resourceId: String(req.params.id),
                changes: diffRecord(before, spill),
                actor: req.user,
                request: req,
            });
            res.json({ data: spill });
        },
        async getStats(req, res) {
            const stats = await service.getEnvironmentalStats();
            res.json({ data: stats });
        },
    };
}
export function createEnvironmentalRouter() {
    const repository = new EnvironmentalRepository(pgPool);
    const service = new EnvironmentalService(repository);
    const controller = createEnvironmentalController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/waste", rbacMiddleware("environmental:read"), controller.getWaste);
    router.post("/waste", rbacMiddleware("environmental:create"), validate(CreateWasteSchema), controller.createWaste);
    router.patch("/waste/:id", rbacMiddleware("environmental:update"), validate(UpdateWasteSchema), controller.updateWaste);
    router.get("/emissions", rbacMiddleware("environmental:read"), controller.getEmissions);
    router.post("/emissions", rbacMiddleware("environmental:create"), validate(CreateEmissionSchema), controller.createEmission);
    router.patch("/emissions/:id", rbacMiddleware("environmental:update"), validate(UpdateEmissionSchema), controller.updateEmission);
    router.get("/chemicals", rbacMiddleware("environmental:read"), controller.getChemicals);
    router.post("/chemicals", rbacMiddleware("environmental:create"), validate(CreateChemicalSchema), controller.createChemical);
    router.patch("/chemicals/:id", rbacMiddleware("environmental:update"), validate(UpdateChemicalSchema), controller.updateChemical);
    router.get("/spills", rbacMiddleware("environmental:read"), controller.getSpills);
    router.post("/spills", rbacMiddleware("environmental:create"), validate(CreateSpillSchema), controller.createSpill);
    router.patch("/spills/:id", rbacMiddleware("environmental:update"), validate(UpdateSpillSchema), controller.updateSpill);
    router.get("/stats", rbacMiddleware("environmental:read"), controller.getStats);
    return router;
}
