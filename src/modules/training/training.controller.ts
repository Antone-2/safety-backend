import { Router, type Response } from "express";
import { z } from "zod";
import { TrainingService } from "./training.service.js";
import { TrainingRepository } from "./training.repository.js";
import { authenticateUser, type AuthRequest } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import {
  TrainingCourseInputSchema,
  TrainingRecordInputSchema,
} from "./training.types.js";

export function createTrainingController(service: TrainingService) {
  return {
    async getAll(req: AuthRequest, res: Response) {
      const courses = await service.getCourses();
      res.json({ data: courses });
    },

    async getById(req: AuthRequest, res: Response) {
      const course = await service.getCourseById(String(req.params.id));
      if (!course) throw new NotFoundError("Training course");
      res.json({ data: course });
    },

    async createCourse(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof TrainingCourseInputSchema>;
      const course = await service.createCourse({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "training.course.created",
        resourceType: "training_course",
        resourceId: course.id,
        context: { title: course.title },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: course });
    },

    async updateCourse(req: AuthRequest, res: Response) {
      const before = await service.getCourseById(String(req.params.id));
      if (!before) throw new NotFoundError("Training course");
      const course = await service.updateCourse(String(req.params.id), req.body);
      await writeAuditLog({
        action: "training.course.updated",
        resourceType: "training_course",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, course as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: course });
    },

    async deleteCourse(req: AuthRequest, res: Response) {
      const deleted = await service.deleteCourse(String(req.params.id));
      if (!deleted) throw new NotFoundError("Training course");
      await writeAuditLog({
        action: "training.course.deleted",
        resourceType: "training_course",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getRecords(req: AuthRequest, res: Response) {
      const filters: Record<string, unknown> = {};
      const { employeeId, courseId } = req.query;
      if (employeeId) filters.employeeId = String(employeeId);
      if (courseId) filters.courseId = String(courseId);
      const records = await service.getRecords(filters);
      res.json({ data: records });
    },

    async getRecordById(req: AuthRequest, res: Response) {
      const record = await service.getRecordById(String(req.params.id));
      if (!record) throw new NotFoundError("Training record");
      res.json({ data: record });
    },

    async createRecord(req: AuthRequest, res: Response) {
      const data = req.body as z.infer<typeof TrainingRecordInputSchema>;
      const record = await service.createRecord({ ...data, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "training.record.created",
        resourceType: "training_record",
        resourceId: record.id,
        context: { courseId: record.courseId, employeeId: record.employeeId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: record });
    },

    async updateRecord(req: AuthRequest, res: Response) {
      const before = await service.getRecordById(String(req.params.id));
      if (!before) throw new NotFoundError("Training record");
      const record = await service.updateRecord(String(req.params.id), req.body);
      await writeAuditLog({
        action: "training.record.updated",
        resourceType: "training_record",
        resourceId: String(req.params.id),
        changes: diffRecord(before as unknown as Record<string, unknown>, record as unknown as Record<string, unknown>),
        actor: req.user,
        request: req,
      });
      res.json({ data: record });
    },

    async deleteRecord(req: AuthRequest, res: Response) {
      const deleted = await service.deleteRecord(String(req.params.id));
      if (!deleted) throw new NotFoundError("Training record");
      await writeAuditLog({
        action: "training.record.deleted",
        resourceType: "training_record",
        resourceId: String(req.params.id),
        actor: req.user,
        request: req,
      });
      res.json({ data: { ok: true, deleted: req.params.id } });
    },

    async getMatrix(req: AuthRequest, res: Response) {
      const matrix = await service.getMatrix();
      res.json({ data: matrix });
    },

    async createMatrix(req: AuthRequest, res: Response) {
      const matrix = await service.createMatrix({ ...req.body, createdBy: req.user?.name || "System" });
      await writeAuditLog({
        action: "training.matrix.created",
        resourceType: "training_matrix",
        resourceId: matrix.id,
        context: { role: matrix.role, courseId: matrix.courseId },
        actor: req.user,
        request: req,
      });
      res.status(201).json({ data: matrix });
    },

    async getStats(req: AuthRequest, res: Response) {
      const stats = await service.getStats();
      res.json({ data: stats });
    },
  };
}

export function createTrainingRouter() {
  const repository = new TrainingRepository(pgPool);
  const service = new TrainingService(repository);
  const controller = createTrainingController(service);
  const router = Router();

  router.use(authenticateUser);

  router.get("/", rbacMiddleware("training:read"), controller.getAll);
  router.get("/records", rbacMiddleware("training:read"), controller.getRecords);
  router.get("/records/:id", rbacMiddleware("training:read"), controller.getRecordById);
  router.post("/records", rbacMiddleware("training:create"), validate(TrainingRecordInputSchema), controller.createRecord);
  router.patch("/records/:id", rbacMiddleware("training:update"), controller.updateRecord);
  router.delete("/records/:id", rbacMiddleware("training:delete"), controller.deleteRecord);

  router.get("/matrix", rbacMiddleware("training:read"), controller.getMatrix);
  router.post("/matrix", rbacMiddleware("training:create"), controller.createMatrix);
  router.get("/stats", rbacMiddleware("training:read"), controller.getStats);
  router.post("/courses", rbacMiddleware("training:create"), validate(TrainingCourseInputSchema), controller.createCourse);
  router.patch("/courses/:id", rbacMiddleware("training:update"), controller.updateCourse);
  router.delete("/courses/:id", rbacMiddleware("training:delete"), controller.deleteCourse);
  router.get("/:id", rbacMiddleware("training:read"), controller.getById);

  return router;
}
