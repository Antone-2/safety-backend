import { Router, type Response } from "express";
import { z } from "zod";
import { RiskService } from "./risk.service.js";
import { RiskRepository } from "./risk.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import {
  CreateRiskMatrixSchema,
  CreateRiskRegisterSchema,
  UpdateRiskRegisterSchema,
  CreateBowTieSchema,
} from "./risk.types.js";

export function createRiskController(service: RiskService) {
  return {
    async getMatrices(_req: AuthRequest, res: Response) {
      const matrices = await service.getMatrices();
      res.json({ data: matrices });
    },

    async createMatrix(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateRiskMatrixSchema>;
      const matrix = await service.createMatrix({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "risk.matrix.created",
        resourceType: "risk_matrix",
        resourceId: matrix.id,
        context: { name: matrix.name },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: matrix });
    },

    async getRegisters(req: AuthRequest, res: Response) {
      const filters: Record<string, any> = {};
      const { location, department, status } = req.query;
      if (location) filters.location = String(location);
      if (department) filters.department = String(department);
      if (status) filters.status = String(status);
      const registers = await service.getRegisters(filters);
      res.json({ data: registers });
    },

    async createRegister(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateRiskRegisterSchema>;
      const register = await service.createRegister({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "risk.register.created",
        resourceType: "risk_register",
        resourceId: register.id,
        context: { title: register.title },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: register });
    },

    async getRegisterById(req: AuthRequest, res: Response) {
      const register = await service.getRegisterById(String(req.params.id));
      if (!register) throw new NotFoundError("Risk register");
      res.json({ data: register });
    },

    async updateRegister(req: AuthRequest, res: Response) {
      const before = await service.getRegisterById(String(req.params.id));
      if (!before) throw new NotFoundError("Risk register");
      const register = await service.updateRegister(String(req.params.id), req.body);
      await writeAuditLog({
        action: "risk.register.updated",
        resourceType: "risk_register",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, register as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: register });
    },

    async getBowTies(_req: AuthRequest, res: Response) {
      const bowties = await service.getBowTies();
      res.json({ data: bowties });
    },

    async createBowTie(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateBowTieSchema>;
      const bowtie = await service.createBowTie({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "risk.bowtie.created",
        resourceType: "bow_tie",
        resourceId: bowtie.id,
        context: { title: bowtie.title },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: bowtie });
    },

    async getDashboard(_req: AuthRequest, res: Response) {
      const dashboard = await service.getRiskDashboard();
      res.json({ data: dashboard });
    },
  };
}

export function createRiskRouter() {
  const repository = new RiskRepository(pgPool);
  const service = new RiskService(repository);
  const controller = createRiskController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/matrices", rbacMiddleware("risk:read"), controller.getMatrices);
  router.post("/matrices", rbacMiddleware("risk:create"), validate(CreateRiskMatrixSchema), controller.createMatrix);

  router.get("/registers", rbacMiddleware("risk:read"), controller.getRegisters);
  router.post("/registers", rbacMiddleware("risk:create"), validate(CreateRiskRegisterSchema), controller.createRegister);
  router.get("/registers/:id", rbacMiddleware("risk:read"), controller.getRegisterById);
  router.patch("/registers/:id", rbacMiddleware("risk:update"), validate(UpdateRiskRegisterSchema), controller.updateRegister);

  router.get("/bow-ties", rbacMiddleware("risk:read"), controller.getBowTies);
  router.post("/bow-ties", rbacMiddleware("risk:create"), validate(CreateBowTieSchema), controller.createBowTie);

  router.get("/dashboard", rbacMiddleware("risk:read"), controller.getDashboard);

  return router;
}
