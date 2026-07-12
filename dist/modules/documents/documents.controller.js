import { Router } from "express";
import { DocumentsService } from "./documents.service.js";
import { DocumentsRepository } from "./documents.repository.js";
import { authenticateUser } from "../../shared/middleware/auth.middleware.js";
import { rbacMiddleware } from "../../shared/middleware/rbac.middleware.js";
import { validate } from "../../shared/middleware/validation.middleware.js";
import { NotFoundError } from "../../shared/domain/errors/index.js";
import { writeAuditLog, diffRecord } from "../../shared/audit/audit.service.js";
import { pgPool } from "../../shared/infrastructure/database/postgres.client.js";
import { CreateDocumentSchema, UpdateDocumentSchema, CreateDocumentVersionSchema, SubmitForReviewSchema, ApproveDocumentSchema, MarkObsoleteSchema, CreateAccessLinkSchema, } from "./documents.types.js";
export function createDocumentsController(service) {
    return {
        async getAll(req, res) {
            const filters = {};
            const { status, type, site } = req.query;
            if (status)
                filters.status = String(status);
            if (type)
                filters.type = String(type);
            if (site)
                filters.site = String(site);
            const documents = await service.getDocuments(filters);
            res.json({ data: documents });
        },
        async getById(req, res) {
            const document = await service.getDocumentById(String(req.params.id));
            if (!document)
                throw new NotFoundError("Document");
            res.json({ data: document });
        },
        async create(req, res) {
            const data = req.body;
            const document = await service.createDocument({ ...data, createdBy: req.user?.name || "System" });
            await writeAuditLog({
                action: "documents.created",
                resourceType: "document",
                resourceId: document.id,
                context: { title: document.title, type: document.type },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: document });
        },
        async update(req, res) {
            const before = await service.getDocumentById(String(req.params.id));
            if (!before)
                throw new NotFoundError("Document");
            const document = await service.updateDocument(String(req.params.id), req.body);
            await writeAuditLog({
                action: "documents.updated",
                resourceType: "document",
                resourceId: String(req.params.id),
                changes: diffRecord(before, document),
                actor: req.user,
                request: req,
            });
            res.json({ data: document });
        },
        async delete(req, res) {
            const deleted = await service.deleteDocument(String(req.params.id));
            if (!deleted)
                throw new NotFoundError("Document");
            await writeAuditLog({
                action: "documents.deleted",
                resourceType: "document",
                resourceId: String(req.params.id),
                actor: req.user,
                request: req,
            });
            res.json({ data: { ok: true, deleted: req.params.id } });
        },
        async getVersions(req, res) {
            const versions = await service.getVersions(String(req.params.id));
            res.json({ data: versions });
        },
        async createVersion(req, res) {
            const data = req.body;
            const version = await service.createVersion(String(req.params.id), data, req.user?.name || "System");
            await writeAuditLog({
                action: "documents.version_created",
                resourceType: "document_version",
                resourceId: version.id,
                context: { documentId: req.params.id, version: version.version },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: version });
        },
        async submitForReview(req, res) {
            const data = req.body;
            const document = await service.submitForReview(String(req.params.id), data, req.user);
            await writeAuditLog({
                action: "documents.submitted_for_review",
                resourceType: "document",
                resourceId: String(req.params.id),
                context: { version: data.version },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: document });
        },
        async approve(req, res) {
            const data = req.body;
            const document = await service.approve(String(req.params.id), data, req.user);
            await writeAuditLog({
                action: "documents.approved",
                resourceType: "document",
                resourceId: String(req.params.id),
                context: { status: data.status, version: data.version },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: document });
        },
        async markObsolete(req, res) {
            const data = req.body;
            const result = await service.markObsolete(String(req.params.id), data, req.user);
            await writeAuditLog({
                action: "documents.marked_obsolete",
                resourceType: "document",
                resourceId: String(req.params.id),
                context: { reason: result.obsoleteReason },
                actor: req.user,
                request: req,
            });
            res.json({ data: result });
        },
        async acknowledge(req, res) {
            const document = await service.getDocumentById(String(req.params.id));
            if (!document)
                throw new NotFoundError("Document");
            const version = String(req.body.version || document.version || "current");
            const acknowledgement = await service.acknowledge(String(req.params.id), version, req.user || {}, {
                ip: req.ip,
                userAgent: req.get("user-agent"),
            });
            await writeAuditLog({
                action: "documents.acknowledged",
                resourceType: "document_acknowledgement",
                resourceId: acknowledgement.id,
                context: { documentId: req.params.id, version },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: acknowledgement });
        },
        async getAcknowledgements(req, res) {
            const acknowledgements = await service.getAcknowledgements(String(req.params.id));
            res.json({ data: acknowledgements });
        },
        async createAccessLink(req, res) {
            const data = req.body;
            const link = await service.createAccessLink(String(req.params.id), data, req.user);
            await writeAuditLog({
                action: "documents.access_link_created",
                resourceType: "document_access_link",
                resourceId: link.id,
                context: { documentId: req.params.id, purpose: link.purpose },
                actor: req.user,
                request: req,
            });
            res.status(201).json({ data: link });
        },
        async getStats(req, res) {
            const stats = await service.getStats();
            res.json({ data: stats });
        },
    };
}
export function createDocumentsRouter() {
    const repository = new DocumentsRepository(pgPool);
    const service = new DocumentsService(repository);
    const controller = createDocumentsController(service);
    const router = Router();
    router.use(authenticateUser);
    router.get("/", rbacMiddleware("documents:read"), controller.getAll);
    router.get("/stats", rbacMiddleware("documents:read"), controller.getStats);
    router.get("/:id", rbacMiddleware("documents:read"), controller.getById);
    router.post("/", rbacMiddleware("documents:create"), validate(CreateDocumentSchema), controller.create);
    router.patch("/:id", rbacMiddleware("documents:update"), validate(UpdateDocumentSchema), controller.update);
    router.delete("/:id", rbacMiddleware("documents:delete"), controller.delete);
    router.get("/:id/versions", rbacMiddleware("documents:read"), controller.getVersions);
    router.post("/:id/versions", rbacMiddleware("documents:create"), validate(CreateDocumentVersionSchema), controller.createVersion);
    router.post("/:id/submit-review", rbacMiddleware("documents:update"), validate(SubmitForReviewSchema), controller.submitForReview);
    router.post("/:id/approve", rbacMiddleware("documents:approve"), validate(ApproveDocumentSchema), controller.approve);
    router.post("/:id/obsolete", rbacMiddleware("documents:update"), validate(MarkObsoleteSchema), controller.markObsolete);
    router.post("/:id/acknowledge", rbacMiddleware("documents:read"), controller.acknowledge);
    router.get("/:id/acknowledgements", rbacMiddleware("documents:read"), controller.getAcknowledgements);
    router.post("/:id/access-link", rbacMiddleware("documents:create"), validate(CreateAccessLinkSchema), controller.createAccessLink);
    router.get("/acknowledgements/report", rbacMiddleware("documents:read"), async (req, res) => {
        const report = await service.getAcknowledgementReport();
        res.json({ data: report });
    });
    return router;
}
