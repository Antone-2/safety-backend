import { Router, type Response } from "express";
import { z } from "zod";
import { LegalRegisterService } from "./legal-register.service.js";
import { LegalRegisterRepository } from "./legal-register.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import {
  CreateLegalRegisterEntrySchema,
  UpdateLegalRegisterEntrySchema,
  CreateLegalObligationSchema,
  UpdateLegalObligationSchema,
  CreateObligationReviewSchema,
  UpdateObligationReviewSchema,
  CreateObligationEvidenceSchema,
  CreateObligationActionSchema,
  UpdateObligationActionSchema,
} from "./legal-register.types.js";

export function createLegalRegisterController(service: LegalRegisterService) {
  return {
    async getDashboard(req: AuthRequest, res: Response) {
      const dashboard = await service.getDashboard();
      res.json({ data: dashboard });
    },

    async getRegisterEntries(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { title, legislation, jurisdiction, status } = req.query;
      if (title) filters.title = String(title);
      if (legislation) filters.legislation = String(legislation);
      if (jurisdiction) filters.jurisdiction = String(jurisdiction);
      if (status) filters.status = String(status);
      const entries = await service.getRegisterEntries(filters);
      res.json({ data: entries });
    },

    async getRegisterEntryById(req: AuthRequest, res: Response) {
      const entry = await service.getRegisterEntryById(String(req.params.id));
      if (!entry) throw new NotFoundError("Legal register entry");
      res.json({ data: entry });
    },

    async createRegisterEntry(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateLegalRegisterEntrySchema>;
      const entry = await service.createRegisterEntry({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "legal-register.entry.created",
        resourceType: "legal_register_entry",
        resourceId: entry.id,
        context: { title: entry.title, legislation: entry.legislation },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: entry });
    },

    async updateRegisterEntry(req: AuthRequest, res: Response) {
      const before = await service.getRegisterEntryById(String(req.params.id));
      if (!before) throw new NotFoundError("Legal register entry");
      const entry = await service.updateRegisterEntry(String(req.params.id), req.body);
      await writeAuditLog({
        action: "legal-register.entry.updated",
        resourceType: "legal_register_entry",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, entry as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: entry });
    },

    async deleteRegisterEntry(req: AuthRequest, res: Response) {
      const deleted = await service.deleteRegisterEntry(String(req.params.id));
      if (!deleted) throw new NotFoundError("Legal register entry");
      await writeAuditLog({
        action: "legal-register.entry.deleted",
        resourceType: "legal_register_entry",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getObligations(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { site, department, lifecycle, registerEntryId } = req.query;
      if (site) filters.site = String(site);
      if (department) filters.department = String(department);
      if (lifecycle) filters.lifecycle = String(lifecycle);
      if (registerEntryId) filters.registerEntryId = String(registerEntryId);
      const obligations = await service.getObligations(filters);
      res.json({ data: obligations });
    },

    async getObligationById(req: AuthRequest, res: Response) {
      const obligation = await service.getObligationById(String(req.params.id));
      if (!obligation) throw new NotFoundError("Legal obligation");
      res.json({ data: obligation });
    },

    async createObligation(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateLegalObligationSchema>;
      const obligation = await service.createObligation({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "legal-register.obligation.created",
        resourceType: "legal_obligation",
        resourceId: obligation.id,
        context: { title: obligation.title, registerEntryId: obligation.registerEntryId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: obligation });
    },

    async updateObligation(req: AuthRequest, res: Response) {
      const before = await service.getObligationById(String(req.params.id));
      if (!before) throw new NotFoundError("Legal obligation");
      const obligation = await service.updateObligation(String(req.params.id), req.body);
      await writeAuditLog({
        action: "legal-register.obligation.updated",
        resourceType: "legal_obligation",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, obligation as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: obligation });
    },

    async deleteObligation(req: AuthRequest, res: Response) {
      const deleted = await service.deleteObligation(String(req.params.id));
      if (!deleted) throw new NotFoundError("Legal obligation");
      await writeAuditLog({
        action: "legal-register.obligation.deleted",
        resourceType: "legal_obligation",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getReviews(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { obligationId, status } = req.query;
      if (obligationId) filters.obligationId = String(obligationId);
      if (status) filters.status = String(status);
      const reviews = await service.getReviews(filters);
      res.json({ data: reviews });
    },

    async getReviewById(req: AuthRequest, res: Response) {
      const review = await service.getReviewById(String(req.params.id));
      if (!review) throw new NotFoundError("Obligation review");
      res.json({ data: review });
    },

    async createReview(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateObligationReviewSchema>;
      const review = await service.createReview({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "legal-register.review.created",
        resourceType: "obligation_review",
        resourceId: review.id,
        context: { title: review.title, obligationId: review.obligationId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: review });
    },

    async updateReview(req: AuthRequest, res: Response) {
      const before = await service.getReviewById(String(req.params.id));
      if (!before) throw new NotFoundError("Obligation review");
      const review = await service.updateReview(String(req.params.id), req.body);
      await writeAuditLog({
        action: "legal-register.review.updated",
        resourceType: "obligation_review",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, review as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: review });
    },

    async deleteReview(req: AuthRequest, res: Response) {
      const deleted = await service.deleteReview(String(req.params.id));
      if (!deleted) throw new NotFoundError("Obligation review");
      await writeAuditLog({
        action: "legal-register.review.deleted",
        resourceType: "obligation_review",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getEvidence(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { obligationId, reviewId } = req.query;
      if (obligationId) filters.obligationId = String(obligationId);
      if (reviewId) filters.reviewId = String(reviewId);
      const evidence = await service.getEvidence(filters);
      res.json({ data: evidence });
    },

    async createEvidence(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateObligationEvidenceSchema>;
      const evidence = await service.createEvidence({ ...data, uploadedBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "legal-register.evidence.created",
        resourceType: "obligation_evidence",
        resourceId: evidence.id,
        context: { name: evidence.name, obligationId: evidence.obligationId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: evidence });
    },

    async deleteEvidence(req: AuthRequest, res: Response) {
      const deleted = await service.deleteEvidence(String(req.params.id));
      if (!deleted) throw new NotFoundError("Obligation evidence");
      await writeAuditLog({
        action: "legal-register.evidence.deleted",
        resourceType: "obligation_evidence",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getActions(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { obligationId, reviewId, status } = req.query;
      if (obligationId) filters.obligationId = String(obligationId);
      if (reviewId) filters.reviewId = String(reviewId);
      if (status) filters.status = String(status);
      const actions = await service.getActions(filters);
      res.json({ data: actions });
    },

    async getActionById(req: AuthRequest, res: Response) {
      const action = await service.getActionById(String(req.params.id));
      if (!action) throw new NotFoundError("Obligation action");
      res.json({ data: action });
    },

    async createAction(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof CreateObligationActionSchema>;
      const action = await service.createAction({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "legal-register.action.created",
        resourceType: "obligation_action",
        resourceId: action.id,
        context: { title: action.title, obligationId: action.obligationId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: action });
    },

    async updateAction(req: AuthRequest, res: Response) {
      const before = await service.getActionById(String(req.params.id));
      if (!before) throw new NotFoundError("Obligation action");
      const action = await service.updateAction(String(req.params.id), req.body);
      await writeAuditLog({
        action: "legal-register.action.updated",
        resourceType: "obligation_action",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, action as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: action });
    },

    async deleteAction(req: AuthRequest, res: Response) {
      const deleted = await service.deleteAction(String(req.params.id));
      if (!deleted) throw new NotFoundError("Obligation action");
      await writeAuditLog({
        action: "legal-register.action.deleted",
        resourceType: "obligation_action",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },
  };
}

export function createLegalRegisterRouter() {
  const repository = new LegalRegisterRepository(pgPool);
  const service = new LegalRegisterService(repository);
  const controller = createLegalRegisterController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/dashboard", rbacMiddleware("compliance:read"), controller.getDashboard);

  router.get("/register", rbacMiddleware("compliance:read"), controller.getRegisterEntries);
  router.get("/register/:id", rbacMiddleware("compliance:read"), controller.getRegisterEntryById);
  router.post("/register", rbacMiddleware("compliance:create"), validate(CreateLegalRegisterEntrySchema), controller.createRegisterEntry);
  router.patch("/register/:id", rbacMiddleware("compliance:update"), validate(UpdateLegalRegisterEntrySchema), controller.updateRegisterEntry);
  router.delete("/register/:id", rbacMiddleware("compliance:delete"), controller.deleteRegisterEntry);

  router.get("/obligations", rbacMiddleware("compliance:read"), controller.getObligations);
  router.get("/obligations/:id", rbacMiddleware("compliance:read"), controller.getObligationById);
  router.post("/obligations", rbacMiddleware("compliance:create"), validate(CreateLegalObligationSchema), controller.createObligation);
  router.patch("/obligations/:id", rbacMiddleware("compliance:update"), validate(UpdateLegalObligationSchema), controller.updateObligation);
  router.delete("/obligations/:id", rbacMiddleware("compliance:delete"), controller.deleteObligation);

  router.get("/reviews", rbacMiddleware("compliance:read"), controller.getReviews);
  router.get("/reviews/:id", rbacMiddleware("compliance:read"), controller.getReviewById);
  router.post("/reviews", rbacMiddleware("compliance:create"), validate(CreateObligationReviewSchema), controller.createReview);
  router.patch("/reviews/:id", rbacMiddleware("compliance:update"), validate(UpdateObligationReviewSchema), controller.updateReview);
  router.delete("/reviews/:id", rbacMiddleware("compliance:delete"), controller.deleteReview);

  router.get("/evidence", rbacMiddleware("compliance:read"), controller.getEvidence);
  router.post("/evidence", rbacMiddleware("compliance:create"), validate(CreateObligationEvidenceSchema), controller.createEvidence);
  router.delete("/evidence/:id", rbacMiddleware("compliance:delete"), controller.deleteEvidence);

  router.get("/actions", rbacMiddleware("compliance:read"), controller.getActions);
  router.get("/actions/:id", rbacMiddleware("compliance:read"), controller.getActionById);
  router.post("/actions", rbacMiddleware("compliance:create"), validate(CreateObligationActionSchema), controller.createAction);
  router.patch("/actions/:id", rbacMiddleware("compliance:update"), validate(UpdateObligationActionSchema), controller.updateAction);
  router.delete("/actions/:id", rbacMiddleware("compliance:delete"), controller.deleteAction);

  return router;
}
